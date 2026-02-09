import { NextRequest, NextResponse } from "next/server";

interface ShopifyImage {
  src: string;
  position: number;
}

interface ShopifyVariant {
  title: string;
  price: string;
  available: boolean;
  inventory_quantity?: number;
  option1: string | null;
  option2: string | null;
  option3: string | null;
}

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  body_html: string;
  vendor: string;
  product_type: string;
  tags: string[];
  images: ShopifyImage[];
  variants: ShopifyVariant[];
}

interface ParsedProduct {
  name: string;
  slug: string;
  description: string;
  price: number;
  currency: string;
  category: string | null;
  images: string[];
  sizes: Array<{ size: string; in_stock: boolean; quantity: number }>;
  tags: string[];
}

export async function POST(request: NextRequest) {
  try {
    const { url, limit = 50 } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Parse and normalize URL
    let shopifyUrl = url.trim();
    if (!shopifyUrl.startsWith("http://") && !shopifyUrl.startsWith("https://")) {
      shopifyUrl = "https://" + shopifyUrl;
    }

    let baseUrl: string;
    try {
      const parsedUrl = new URL(shopifyUrl);
      baseUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}`;
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    // Try to fetch products using Shopify JSON API
    const productsUrl = `${baseUrl}/products.json?limit=${Math.min(limit, 250)}`;

    const response = await fetch(productsUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      // Try collection URL if products.json fails
      const collectionMatch = shopifyUrl.match(/\/collections\/([^\/\?]+)/);
      if (collectionMatch) {
        const collectionHandle = collectionMatch[1];
        const collectionUrl = `${baseUrl}/collections/${collectionHandle}/products.json?limit=${Math.min(limit, 250)}`;

        const collectionResponse = await fetch(collectionUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "Accept": "application/json",
          },
        });

        if (!collectionResponse.ok) {
          return NextResponse.json({ error: "Could not fetch products from store" }, { status: 400 });
        }

        const collectionData = await collectionResponse.json();
        return processProducts(collectionData.products, baseUrl);
      }

      return NextResponse.json({ error: "Could not fetch products. Make sure it's a Shopify store." }, { status: 400 });
    }

    const data = await response.json();
    return processProducts(data.products, baseUrl);

  } catch (error) {
    console.error("Shopify catalog import error:", error);
    return NextResponse.json(
      { error: "Failed to import catalog" },
      { status: 500 }
    );
  }
}

function processProducts(products: ShopifyProduct[], baseUrl: string) {
  if (!products || products.length === 0) {
    return NextResponse.json({ error: "No products found" }, { status: 404 });
  }

  const parsedProducts: ParsedProduct[] = products.map((product) => {
    // Extract sizes from variants
    const sizes: Array<{ size: string; in_stock: boolean; quantity: number }> = [];
    const seenSizes = new Set<string>();

    for (const variant of product.variants) {
      // Size is usually in option1 or the variant title
      const size = variant.option1 || variant.title;
      if (size && !seenSizes.has(size) && size !== "Default Title") {
        seenSizes.add(size);
        sizes.push({
          size: size,
          in_stock: variant.available,
          quantity: variant.inventory_quantity ?? (variant.available ? 10 : 0),
        });
      }
    }

    // Get price from first variant
    const price = parseFloat(product.variants[0]?.price || "0");

    // Clean description HTML
    let description = product.body_html || "";
    description = description
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();

    return {
      name: product.title,
      slug: product.handle,
      description: description.substring(0, 2000), // Limit description length
      price: price,
      currency: "USD", // Shopify JSON doesn't include currency, default to USD
      category: product.product_type || null,
      images: product.images.map((img) => img.src),
      sizes: sizes,
      tags: product.tags || [],
    };
  });

  // Get store info
  const storeInfo = {
    url: baseUrl,
    productCount: parsedProducts.length,
  };

  return NextResponse.json({
    success: true,
    store: storeInfo,
    products: parsedProducts,
  });
}
