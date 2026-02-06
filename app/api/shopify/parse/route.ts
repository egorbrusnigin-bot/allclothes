import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Validate it looks like a Shopify URL
    let shopifyUrl = url.trim();

    // Add https:// if missing
    if (!shopifyUrl.startsWith("http://") && !shopifyUrl.startsWith("https://")) {
      shopifyUrl = "https://" + shopifyUrl;
    }

    // Parse URL to get domain
    let domain: string;
    try {
      const parsedUrl = new URL(shopifyUrl);
      domain = parsedUrl.hostname;
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    // Fetch the Shopify store page
    const response = await fetch(shopifyUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Could not fetch store page" }, { status: 400 });
    }

    const html = await response.text();

    // Extract store name from various sources
    let storeName = "";
    let logoUrl = "";

    // Try to get from og:site_name or og:title
    const ogSiteNameMatch = html.match(/<meta[^>]*property="og:site_name"[^>]*content="([^"]+)"/i);
    if (ogSiteNameMatch) {
      storeName = ogSiteNameMatch[1];
    }

    // Fallback to og:title
    if (!storeName) {
      const ogTitleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
      if (ogTitleMatch) {
        storeName = ogTitleMatch[1].split(/[|\-–—]/)[0].trim();
      }
    }

    // Fallback to <title> tag
    if (!storeName) {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) {
        storeName = titleMatch[1].split(/[|\-–—]/)[0].trim();
      }
    }

    // Try to get logo from og:image
    const ogImageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
    if (ogImageMatch) {
      logoUrl = ogImageMatch[1];
    }

    // Try to find logo in theme settings JSON
    if (!logoUrl) {
      const logoMatch = html.match(/"logo":\s*"([^"]+)"/i);
      if (logoMatch) {
        logoUrl = logoMatch[1];
        // Convert protocol-relative URLs
        if (logoUrl.startsWith("//")) {
          logoUrl = "https:" + logoUrl;
        }
      }
    }

    // Try to find in header img with logo in src or class
    if (!logoUrl) {
      const headerLogoMatch = html.match(/<img[^>]*(?:class="[^"]*logo[^"]*"|src="[^"]*logo[^"]*")[^>]*src="([^"]+)"/i);
      if (headerLogoMatch) {
        logoUrl = headerLogoMatch[1];
        if (logoUrl.startsWith("//")) {
          logoUrl = "https:" + logoUrl;
        }
      }
    }

    // Clean up store name
    storeName = storeName
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim();

    if (!storeName) {
      // Use domain as fallback
      storeName = domain
        .replace(/\.myshopify\.com$/, "")
        .replace(/\.(com|net|org|io|co|store|shop)$/, "")
        .replace(/-/g, " ")
        .split(".")
        .pop() || "";
      storeName = storeName.charAt(0).toUpperCase() + storeName.slice(1);
    }

    return NextResponse.json({
      success: true,
      data: {
        name: storeName,
        logo: logoUrl || null,
        domain: domain,
      },
    });
  } catch (error) {
    console.error("Shopify parse error:", error);
    return NextResponse.json(
      { error: "Failed to parse store" },
      { status: 500 }
    );
  }
}
