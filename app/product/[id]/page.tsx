"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "../../lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCountryFlag } from "../../lib/countryFlags";
import { isProductFavorited } from "../../lib/favorites";
import { addToCart, addToRecentlyViewed } from "../../lib/cart";
import Price from "../../components/Price";
import { trackProductView } from "../../lib/analytics";
import FavoriteButton from "../../components/FavoriteButton";
import LoadingLogo from "../../components/LoadingLogo";
import { useIsMobile } from "../../lib/useIsMobile";

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
  const isMobile = useIsMobile();
  const router = useRouter();

  // Reviews
  const [reviews, setReviews] = useState<any[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [canReview, setCanReview] = useState(false);
  const [reviewOrderId, setReviewOrderId] = useState<string | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  // Recommendations
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const carouselRef = useRef<HTMLDivElement>(null);

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

    // Load reviews
    loadReviews(transformedProduct.id);
    // Load recommendations
    loadRecommendations(transformedProduct);
    // Check if user can review
    checkCanReview(transformedProduct.id);
  }

  async function loadReviews(productId: string) {
    try {
      const res = await fetch(`/api/reviews?productId=${productId}&limit=10`);
      const data = await res.json();
      setReviews(data.reviews || []);
      setAvgRating(data.avgRating || 0);
      setReviewTotal(data.total || 0);
    } catch { /* ignore */ }
  }

  async function checkCanReview(productId: string) {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    // Check if user has an order with this product
    const { data: items } = await supabase
      .from("order_items")
      .select("order_id, orders!inner(user_id, payment_status)")
      .eq("product_id", productId);

    if (!items) return;
    const myOrder = items.find((i: any) => i.orders?.user_id === session.user.id && i.orders?.payment_status === "paid");
    if (!myOrder) return;

    // Check if already reviewed
    const { data: existing } = await supabase
      .from("reviews")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("product_id", productId)
      .eq("order_id", myOrder.order_id)
      .single();

    if (!existing) {
      setCanReview(true);
      setReviewOrderId(myOrder.order_id);
    }
  }

  async function submitReview() {
    if (!product || !reviewOrderId || submittingReview) return;
    setSubmittingReview(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || "";
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          productId: product.id,
          orderId: reviewOrderId,
          rating: reviewRating,
          text: reviewText,
          images: [],
        }),
      });
      if (res.ok) {
        setShowReviewForm(false);
        setCanReview(false);
        setReviewText("");
        loadReviews(product.id);
      }
    } catch { /* ignore */ }
    setSubmittingReview(false);
  }

  async function loadRecommendations(prod: Product) {
    if (!supabase) return;
    // Same brand products + same category
    const { data } = await supabase
      .from("products")
      .select("id, name, slug, price, currency, brand_id, brands(name, slug), product_images(image_url, is_main)")
      .eq("status", "approved")
      .neq("id", prod.id)
      .or(`brand_id.eq.${prod.brand_id}${prod.category ? `,category.eq.${prod.category}` : ""}`)
      .limit(20);

    if (data && data.length > 0) {
      setRecommendations(data);
    }
  }

  async function openChat() {
    if (!product?.brand_id || !supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/?login=1");
      return;
    }
    try {
      const res = await fetch("/api/messages/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ brandId: product.brand_id }),
      });
      if (res.ok) {
        router.push("/account/messages");
      }
    } catch { /* ignore */ }
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
    <main style={{ maxWidth: 1400, margin: "0 auto", padding: isMobile ? "16px 4px" : "24px 40px" }}>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 24 : 80 }}>
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
            <Price price={product.price} currency={product.currency} />
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

          {/* Write to brand button */}
          {product.brand && (
            <button
              onClick={openChat}
              style={{
                width: "100%",
                padding: "14px",
                background: "#fff",
                color: "#000",
                border: "1px solid #000",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                textTransform: "uppercase",
                letterSpacing: 1,
                marginTop: 16,
              }}
            >
              НАПИСАТЬ БРЕНДУ
            </button>
          )}
        </div>
      </div>

      {/* Reviews section */}
      <div style={{ marginTop: isMobile ? 40 : 64, borderTop: "1px solid #e6e6e6", paddingTop: isMobile ? 24 : 40 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, margin: 0 }}>ОТЗЫВЫ</h2>
            {reviewTotal > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 24, fontWeight: 700 }}>{avgRating.toFixed(1)}</span>
                <div>
                  <div style={{ fontSize: 14, letterSpacing: 1 }}>
                    {"★".repeat(Math.round(avgRating))}{"☆".repeat(5 - Math.round(avgRating))}
                  </div>
                  <div style={{ fontSize: 10, color: "#999" }}>{reviewTotal} отзыв{reviewTotal === 1 ? "" : reviewTotal < 5 ? "а" : "ов"}</div>
                </div>
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {canReview && !showReviewForm && (
              <button
                onClick={() => setShowReviewForm(true)}
                style={{
                  padding: "8px 16px",
                  background: "#000",
                  color: "#fff",
                  border: "none",
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: "pointer",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                НАПИСАТЬ ОТЗЫВ
              </button>
            )}
            {product.brand && (
              <Link
                href={`/brand/${product.brand.slug}#reviews`}
                style={{ fontSize: 10, color: "#999", textDecoration: "none", letterSpacing: 0.5, whiteSpace: "nowrap" }}
              >
                Все отзывы бренда →
              </Link>
            )}
          </div>
        </div>

        {/* Review form */}
        {showReviewForm && (
          <div style={{ border: "1px solid #e6e6e6", padding: isMobile ? 16 : 24, marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>ВАША ОЦЕНКА</div>
            <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setReviewRating(star)}
                  style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: star <= reviewRating ? "#000" : "#ddd", padding: 0 }}
                >
                  ★
                </button>
              ))}
            </div>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Расскажите о вашем опыте..."
              style={{
                width: "100%",
                minHeight: 80,
                padding: 12,
                border: "1px solid #e6e6e6",
                fontSize: 13,
                resize: "vertical",
                outline: "none",
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                onClick={submitReview}
                disabled={submittingReview}
                style={{
                  padding: "10px 24px",
                  background: "#000",
                  color: "#fff",
                  border: "none",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: submittingReview ? "not-allowed" : "pointer",
                  opacity: submittingReview ? 0.5 : 1,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                {submittingReview ? "..." : "ОТПРАВИТЬ"}
              </button>
              <button
                onClick={() => setShowReviewForm(false)}
                style={{ padding: "10px 16px", background: "none", border: "1px solid #e6e6e6", fontSize: 11, cursor: "pointer", letterSpacing: 0.5 }}
              >
                ОТМЕНА
              </button>
            </div>
          </div>
        )}

        {/* Review list */}
        {reviews.length === 0 && !showReviewForm ? (
          <div style={{ textAlign: "center", padding: "32px 0", color: "#ccc", fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>
            Пока нет отзывов
          </div>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {reviews.map((review: any) => (
              <div key={review.id} style={{ border: "1px solid #f0f0f0", padding: isMobile ? 14 : 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%", background: "#f0f0f0",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 700, color: "#666",
                    }}>
                      {(review.userEmail || "?").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{review.userEmail || "Покупатель"}</div>
                      <div style={{ fontSize: 12, color: "#000", letterSpacing: 0.5 }}>
                        {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: "#999" }}>
                    {new Date(review.created_at).toLocaleDateString("ru")}
                  </div>
                </div>
                {review.text && (
                  <div style={{ fontSize: 13, color: "#333", lineHeight: 1.5, marginTop: 8 }}>{review.text}</div>
                )}
                {review.images && review.images.length > 0 && (
                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    {review.images.map((img: string, i: number) => (
                      <img key={i} src={img} alt="" style={{ width: 64, height: 64, objectFit: "cover", border: "1px solid #eee" }} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recommendations carousel */}
      {recommendations.length > 0 && (
        <div style={{ marginTop: isMobile ? 40 : 64, borderTop: "1px solid #e6e6e6", paddingTop: isMobile ? 24 : 40, overflow: "hidden" }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, margin: 0, marginBottom: 24 }}>
            ВАМ ТАКЖЕ МОЖЕТ ПОНРАВИТЬСЯ
          </h2>
          <div
            ref={carouselRef}
            style={{ overflow: "hidden", position: "relative" }}
            onMouseEnter={() => {
              const inner = carouselRef.current?.querySelector("[data-carousel-inner]") as HTMLElement;
              if (inner) inner.style.animationPlayState = "paused";
            }}
            onMouseLeave={() => {
              const inner = carouselRef.current?.querySelector("[data-carousel-inner]") as HTMLElement;
              if (inner) inner.style.animationPlayState = "running";
            }}
          >
            <style>{`
              @keyframes carouselScroll {
                0% { transform: translateX(0); }
                100% { transform: translateX(-50%); }
              }
            `}</style>
            <div
              data-carousel-inner=""
              style={{
                display: "flex",
                gap: isMobile ? 12 : 16,
                animation: `carouselScroll ${recommendations.length * 3}s linear infinite`,
                width: "max-content",
              }}
            >
              {[...recommendations, ...recommendations].map((rec: any, idx: number) => {
                const mainImg = rec.product_images?.find((i: any) => i.is_main) || rec.product_images?.[0];
                const brand = Array.isArray(rec.brands) ? rec.brands[0] : rec.brands;
                return (
                  <Link
                    key={`${rec.id}-${idx}`}
                    href={`/product/${rec.slug}`}
                    style={{ textDecoration: "none", color: "#000", flexShrink: 0, width: isMobile ? 150 : 200 }}
                  >
                    <div style={{
                      width: "100%",
                      aspectRatio: "3/4",
                      background: "#f5f5f5",
                      overflow: "hidden",
                      marginBottom: 8,
                    }}>
                      {mainImg && (
                        <img
                          src={mainImg.image_url}
                          alt={rec.name}
                          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                          loading="lazy"
                        />
                      )}
                    </div>
                    {brand && (
                      <div style={{ fontSize: 10, color: "#999", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>
                        {brand.name}
                      </div>
                    )}
                    <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {rec.name}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>
                      <Price price={rec.price} currency={rec.currency} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
