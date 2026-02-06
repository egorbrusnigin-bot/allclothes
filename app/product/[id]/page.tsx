"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import Link from "next/link";
import { getCountryFlag } from "../../lib/countryFlags";
import { isProductFavorited } from "../../lib/favorites";
import { addToCart, addToRecentlyViewed } from "../../lib/cart";
import { formatPrice } from "../../lib/currency";
import { trackProductView } from "../../lib/analytics";
import FavoriteButton from "../../components/FavoriteButton";
import LoadingLogo from "../../components/LoadingLogo";

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  currency: string;
  category: string | null;
  description: string | null;
  details: string | null;
  model_info: string | null;
  shipping_info: string | null;
  care_instructions: string | null;
  contact_info: string | null;
  brand_id?: string;
  brand?: {
    name: string;
    slug: string;
    logo_url: string | null;
    country: string | null;
  };
  product_images: Array<{
    image_url: string;
    is_main: boolean;
    display_order: number;
  }>;
  product_sizes: Array<{
    size: string;
    in_stock: boolean;
    quantity: number;
  }>;
}

export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isFavorited, setIsFavorited] = useState(false);
  const [expandedSections, setExpandedSections] = useState<{[key: string]: boolean}>({
    description: false,
    modelInfo: false,
    shipping: false,
    care: false,
    contact: false
  });
  const [, setCurrencyUpdate] = useState(0);

  useEffect(() => {
    params.then(p => {
      loadProduct(p.id);
    });

    const handleCurrencyChange = () => setCurrencyUpdate(n => n + 1);
    window.addEventListener("currencyChanged", handleCurrencyChange);
    return () => window.removeEventListener("currencyChanged", handleCurrencyChange);
  }, [params]);

  async function loadProduct(productSlug: string) {
    if (!supabase) return;

    setLoading(true);

    const { data: productData, error: productError } = await supabase
      .from("products")
      .select(`
        id,
        name,
        slug,
        price,
        currency,
        category,
        description,
        details,
        model_info,
        shipping_info,
        care_instructions,
        contact_info,
        brand_id,
        brands(name, slug, logo_url, country),
        product_images(image_url, is_main, display_order),
        product_sizes(size, in_stock, quantity)
      `)
      .eq("slug", productSlug)
      .single();

    if (productError || !productData) {
      console.error("Error loading product:", productError, "Data:", productData);
      alert(`Ошибка: ${JSON.stringify(productError)}`);
      setLoading(false);
      return;
    }

    // Transform brand from array to object
    const transformedProduct: Product = {
      id: productData.id,
      name: productData.name,
      slug: productData.slug,
      price: productData.price,
      currency: productData.currency,
      category: productData.category,
      description: productData.description,
      details: productData.details,
      model_info: productData.model_info,
      shipping_info: productData.shipping_info,
      care_instructions: productData.care_instructions,
      contact_info: productData.contact_info,
      brand_id: productData.brand_id,
      brand: Array.isArray(productData.brands) ? productData.brands[0] : productData.brands,
      product_images: productData.product_images,
      product_sizes: productData.product_sizes
    };

    setProduct(transformedProduct);

    // Track product view for analytics
    if (productData.brand_id) {
      trackProductView(productData.brand_id, productData.id);
    }

    // Check if product is favorited
    const favorited = await isProductFavorited(productData.id);
    setIsFavorited(favorited);

    // Add to recently viewed
    const mainImage = transformedProduct.product_images.find(img => img.is_main) || transformedProduct.product_images[0];
    if (mainImage) {
      addToRecentlyViewed({
        productId: transformedProduct.id,
        productSlug: transformedProduct.slug,
        productName: transformedProduct.name,
        brandName: transformedProduct.brand?.name || "Unknown",
        price: transformedProduct.price,
        currency: transformedProduct.currency,
        imageUrl: mainImage.image_url,
        viewedAt: Date.now(),
      });
    }

    setLoading(false);
  }

  function handleAddToCart() {
    if (!product) return;

    if (!selectedSize) {
      alert("Пожалуйста, выберите размер");
      return;
    }

    const mainImage = product.product_images.find(img => img.is_main) || product.product_images[0];

    const success = addToCart({
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      brandName: product.brand?.name || "Unknown",
      price: product.price,
      currency: product.currency,
      size: selectedSize,
      quantity: 1,
      imageUrl: mainImage?.image_url || "",
    });

    if (success) {
      // Dispatch event to open cart drawer
      window.dispatchEvent(new Event("openCart"));
    } else {
      alert("Ошибка при добавлении в корзину");
    }
  }

  if (loading) {
    return <LoadingLogo />;
  }

  if (!product) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <p style={{ fontSize: 18, marginBottom: 16 }}>Product not found</p>
        <Link href="/" style={{ color: "#000", textDecoration: "underline" }}>
          ← Back to home
        </Link>
      </div>
    );
  }

  const productImages = (product.product_images || [])
    .sort((a, b) => a.display_order - b.display_order)
    .map(img => img.image_url);

  // All possible sizes
  const allSizes = ["XS", "S", "M", "L", "XL", "XXL"];
  const dbSizes = product.product_sizes || [];

  // Merge db sizes with all sizes
  const productSizes = allSizes.map(size => {
    const dbSize = dbSizes.find(s => s.size === size);
    return dbSize || { size, in_stock: false, quantity: 0 };
  });

  return (
    <main style={{ maxWidth: 1400, margin: "0 auto", padding: "40px 60px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80 }}>
        {/* Left column - images */}
        <div style={{ position: "relative" }}>
          {productImages.length > 0 ? (
            <div style={{ position: "relative" }}>
              <img
                key={currentImageIndex}
                src={productImages[currentImageIndex]}
                alt={product.name}
                style={{
                  width: "100%",
                  aspectRatio: "3/4",
                  objectFit: "cover",
                  marginBottom: 16,
                  display: "block"
                }}
                loading="eager"
                decoding="async"
                fetchPriority="high"
              />

            </div>
          ) : (
            <div style={{ width: "100%", aspectRatio: "3/4", background: "#f5f5f5", marginBottom: 16 }} />
          )}

          {/* Thumbnails */}
          {productImages.length > 1 && (
            <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
              {productImages.map((img, index) => (
                <img
                  key={index}
                  src={img}
                  alt={`${product.name} ${index + 1}`}
                  onClick={() => setCurrentImageIndex(index)}
                  onMouseEnter={() => setCurrentImageIndex(index)}
                  style={{
                    width: 60,
                    height: 80,
                    objectFit: "cover",
                    cursor: "pointer",
                    border: currentImageIndex === index ? "1px solid #000" : "1px solid #e6e6e6",
                    opacity: currentImageIndex === index ? 1 : 0.5
                  }}
                  loading="lazy"
                  decoding="async"
                />
              ))}
            </div>
          )}
        </div>

        {/* Right column - info */}
        <div>
          {/* Product title */}
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16, lineHeight: 1.3, textTransform: "uppercase", letterSpacing: 0.5 }}>
            {product.name}
          </h1>

          {/* Price */}
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 32, borderBottom: "1px solid #e6e6e6", paddingBottom: 16 }}>
            {formatPrice(product.price, product.currency)}
          </div>

          {/* Size selection */}
          {productSizes.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>SIZE</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {productSizes.map((sizeObj) => (
                  <button
                    key={sizeObj.size}
                    onClick={() => sizeObj.in_stock && setSelectedSize(sizeObj.size)}
                    disabled={!sizeObj.in_stock}
                    style={{
                      padding: "10px 16px",
                      border: selectedSize === sizeObj.size ? "1px solid #000" : "1px solid #e6e6e6",
                      background: selectedSize === sizeObj.size ? "#000" : "#fff",
                      color: selectedSize === sizeObj.size ? "#fff" : sizeObj.in_stock ? "#000" : "#ccc",
                      cursor: sizeObj.in_stock ? "pointer" : "not-allowed",
                      fontSize: 12,
                      fontWeight: 600,
                      opacity: sizeObj.in_stock ? 1 : 0.3
                    }}
                  >
                    {sizeObj.size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Add to cart button and favorite button */}
          <div style={{ display: "flex", gap: 12, marginBottom: 32 }}>
            <button
              onClick={handleAddToCart}
              style={{
                flex: 1,
                padding: "14px",
                background: "#000",
                color: "#fff",
                border: "none",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                textTransform: "uppercase",
                letterSpacing: 1
              }}
            >
              ADD TO CART
            </button>
            <div style={{ display: "flex", alignItems: "center" }}>
              <FavoriteButton
                productId={product.id}
                initialIsFavorited={isFavorited}
                size={20}
                onToggle={(newStatus) => setIsFavorited(newStatus)}
                brandId={product.brand_id}
              />
            </div>
          </div>

          {/* Brand */}
          {product.brand && (
            <Link
              href={`/brand/${product.brand.slug}`}
              style={{
                display: "block",
                textDecoration: "none",
                color: "#000",
                marginBottom: 32,
                paddingBottom: 16,
                borderBottom: "1px solid #e6e6e6"
              }}
            >
              <div style={{ fontSize: 11, color: "#999", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                BRAND
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{product.brand.name}</div>
                {product.brand.country && (
                  <span style={{
                    fontSize: 16,
                    lineHeight: 1
                  }}>
                    {getCountryFlag(product.brand.country)}
                  </span>
                )}
              </div>
            </Link>
          )}

          {/* Collapsible sections */}
          <div>
            {/* ABOUT US */}
            {product.description?.trim() && (
              <div style={{ borderBottom: "1px solid #e6e6e6" }}>
                <button
                  onClick={() => setExpandedSections({...expandedSections, description: !expandedSections.description})}
                  style={{
                    width: "100%",
                    padding: "14px 0",
                    background: "none",
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    color: "#000"
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span>👤</span>
                    <span>ABOUT US</span>
                  </span>
                  <span style={{ fontSize: 10 }}>
                    {expandedSections.description ? "−" : "+"}
                  </span>
                </button>
                {expandedSections.description && (
                  <div style={{ paddingBottom: 14, fontSize: 12, color: "#666", lineHeight: 1.6, whiteSpace: "pre-line" }}>
                    {product.description}
                  </div>
                )}
              </div>
            )}

            {/* SIZE CHART */}
            {product.model_info?.trim() && (
              <div style={{ borderBottom: "1px solid #e6e6e6" }}>
                <button
                  onClick={() => setExpandedSections({...expandedSections, modelInfo: !expandedSections.modelInfo})}
                  style={{
                    width: "100%",
                    padding: "14px 0",
                    background: "none",
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    color: "#000"
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span>📋</span>
                    <span>SIZE CHART</span>
                  </span>
                  <span style={{ fontSize: 10 }}>
                    {expandedSections.modelInfo ? "−" : "+"}
                  </span>
                </button>
                {expandedSections.modelInfo && (
                  <div style={{ paddingBottom: 14, fontSize: 12, color: "#666", lineHeight: 1.6, whiteSpace: "pre-line" }}>
                    {product.model_info}
                  </div>
                )}
              </div>
            )}

            {/* SHIPPING */}
            {product.shipping_info?.trim() && (
              <div style={{ borderBottom: "1px solid #e6e6e6" }}>
                <button
                  onClick={() => setExpandedSections({...expandedSections, shipping: !expandedSections.shipping})}
                  style={{
                    width: "100%",
                    padding: "14px 0",
                    background: "none",
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    color: "#000"
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span>📦</span>
                    <span>SHIPPING</span>
                  </span>
                  <span style={{ fontSize: 10 }}>
                    {expandedSections.shipping ? "−" : "+"}
                  </span>
                </button>
                {expandedSections.shipping && (
                  <div style={{ paddingBottom: 14, fontSize: 12, color: "#666", lineHeight: 1.6, whiteSpace: "pre-line" }}>
                    {product.shipping_info}
                  </div>
                )}
              </div>
            )}

            {/* WASHING */}
            {product.care_instructions?.trim() && (
              <div style={{ borderBottom: "1px solid #e6e6e6" }}>
                <button
                  onClick={() => setExpandedSections({...expandedSections, care: !expandedSections.care})}
                  style={{
                    width: "100%",
                    padding: "14px 0",
                    background: "none",
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    color: "#000"
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span>🧺</span>
                    <span>WASHING</span>
                  </span>
                  <span style={{ fontSize: 10 }}>
                    {expandedSections.care ? "−" : "+"}
                  </span>
                </button>
                {expandedSections.care && (
                  <div style={{ paddingBottom: 14, fontSize: 12, color: "#666", lineHeight: 1.6, whiteSpace: "pre-line" }}>
                    {product.care_instructions}
                  </div>
                )}
              </div>
            )}

            {/* CONTACT */}
            {product.contact_info?.trim() && (
              <div style={{ borderBottom: "1px solid #e6e6e6" }}>
                <button
                  onClick={() => setExpandedSections({...expandedSections, contact: !expandedSections.contact})}
                  style={{
                    width: "100%",
                    padding: "14px 0",
                    background: "none",
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    color: "#000"
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span>💬</span>
                    <span>CONTACT</span>
                  </span>
                  <span style={{ fontSize: 10 }}>
                    {expandedSections.contact ? "−" : "+"}
                  </span>
                </button>
                {expandedSections.contact && (
                  <div style={{ paddingBottom: 14, fontSize: 12, color: "#666", lineHeight: 1.6, whiteSpace: "pre-line" }}>
                    {product.contact_info}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </main>
  );
}
