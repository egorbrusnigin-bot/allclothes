"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { getCountryFlag } from "../../lib/countryFlags";
import { getFavoritedProductIds } from "../../lib/favorites";
import { formatPrice } from "../../lib/currency";
import FavoriteButton from "../../components/FavoriteButton";
import QuickAddButton from "../../components/QuickAddButton";
import LoadingLogo from "../../components/LoadingLogo";

interface Brand {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  city: string | null;
  logo_url: string | null;
  description: string | null;
}

interface Product {
  id: string;
  name: string;
  price: number;
  currency: string;
  slug: string;
  created_at?: string;
  product_images: Array<{
    image_url: string;
    is_main: boolean;
    display_order: number;
  }>;
  product_sizes: Array<{
    size: string;
    in_stock: boolean;
  }>;
}

function ProductCard({ product, isNew, isFavorited = false, brandName, brandCountry }: {
  product: Product;
  isNew: boolean;
  isFavorited?: boolean;
  brandName: string;
  brandCountry: string | null;
}) {
  const allImages = (product.product_images || [])
    .sort((a, b) => a.display_order - b.display_order)
    .map(img => img.image_url);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const mainImage = allImages[0] || "";

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (allImages.length <= 1) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const segmentWidth = width / allImages.length;
    const newIndex = Math.min(Math.floor(x / segmentWidth), allImages.length - 1);
    setCurrentImageIndex(newIndex);
  };

  return (
    <div>
      <div
        style={{ position: "relative", marginBottom: 10 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setCurrentImageIndex(0)}
      >
        <Link
          href={`/product/${product.slug || product.id}`}
          style={{ textDecoration: "none", color: "black" }}
        >
          {allImages.length > 0 ? (
            <img
              src={allImages[currentImageIndex]}
              alt={product.name}
              style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", display: "block", userSelect: "none" }}
              draggable={false}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div style={{ width: "100%", aspectRatio: "3/4", background: "#f5f5f5" }} />
          )}
        </Link>

        {/* NEW Badge */}
        {isNew && (
          <div style={{
            position: "absolute",
            top: 8,
            left: 8,
            background: "#F5F5F5",
            color: "#999",
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: 0.5,
            padding: "4px 8px",
            textTransform: "uppercase"
          }}>
            NEW
          </div>
        )}

        {/* Image indicators */}
        {allImages.length > 1 && (
          <div
            style={{
              position: "absolute",
              bottom: 8,
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              gap: 4,
              pointerEvents: "none",
            }}
          >
            {allImages.map((_, idx) => (
              <div
                key={idx}
                style={{
                  width: 4,
                  height: 4,
                  background: currentImageIndex === idx ? "#000" : "rgba(255,255,255,0.6)",
                  border: currentImageIndex === idx ? "none" : "1px solid rgba(0,0,0,0.15)",
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Brand Name */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        marginBottom: 4
      }}>
        <div style={{
          fontSize: 11,
          color: "#000",
          letterSpacing: 0.5,
          textTransform: "uppercase",
          fontWeight: 700
        }}>
          {brandName}
        </div>
        {brandCountry && (
          <span style={{
            fontSize: 16,
            lineHeight: 1
          }}>
            {getCountryFlag(brandCountry)}
          </span>
        )}
      </div>

      {/* Product Name */}
      <Link
        href={`/product/${product.slug || product.id}`}
        style={{ textDecoration: "none", color: "black" }}
      >
        <div style={{
          fontSize: 10,
          fontWeight: 400,
          marginBottom: 6,
          color: "#000",
          textTransform: "uppercase",
          letterSpacing: 0.3,
          lineHeight: 1.4
        }}>
          {product.name}
        </div>
      </Link>

      {/* Price and Actions */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#000" }}>
          {formatPrice(product.price, product.currency)}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <QuickAddButton
            productId={product.id}
            productSlug={product.slug}
            productName={product.name}
            brandName={brandName}
            price={product.price}
            currency={product.currency}
            imageUrl={mainImage}
            sizes={product.product_sizes || []}
          />
          <FavoriteButton
            productId={product.id}
            initialIsFavorited={isFavorited}
            size={16}
            variant="inline"
          />
        </div>
      </div>
    </div>
  );
}

export default function BrandPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [brand, setBrand] = useState<Brand | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());
  const [, setCurrencyUpdate] = useState(0);

  useEffect(() => {
    if (slug) {
      fetchBrandData();
    }
    loadFavorites();

    const handleCurrencyChange = () => setCurrencyUpdate(n => n + 1);
    window.addEventListener("currencyChanged", handleCurrencyChange);
    return () => window.removeEventListener("currencyChanged", handleCurrencyChange);
  }, [slug]);

  async function loadFavorites() {
    const ids = await getFavoritedProductIds();
    setFavoritedIds(new Set(ids));
  }

  async function fetchBrandData() {
    if (!supabase) return;

    const { data: brandData, error: brandError } = await supabase
      .from("brands")
      .select("*")
      .eq("slug", slug)
      .single();

    if (brandError || !brandData) {
      console.error("Error fetching brand:", brandError);
      setLoading(false);
      return;
    }

    setBrand(brandData);

    const { data: productsData, error: productsError } = await supabase
      .from("products")
      .select(`
        id,
        name,
        price,
        currency,
        slug,
        created_at,
        product_images(image_url, is_main, display_order),
        product_sizes(size, in_stock)
      `)
      .eq("brand_id", brandData.id)
      .eq("status", "approved")
      .order("created_at", { ascending: false });

    if (productsError) {
      console.error("Error fetching products:", productsError);
    } else {
      setProducts(productsData || []);
    }

    setLoading(false);
  }

  const isNew = (product: Product) => {
    if (!product.created_at) return false;
    const created = new Date(product.created_at);
    const now = new Date();
    const diffDays = (now.getTime() - created.getTime()) / (1000 * 3600 * 24);
    return diffDays <= 30;
  };

  if (loading) return <LoadingLogo />;

  if (!brand) {
    return (
      <div style={{ padding: "80px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 12, color: "#999", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
          Brand not found
        </div>
        <Link href="/brands" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#999", textDecoration: "none" }}>
          ← BRANDS
        </Link>
      </div>
    );
  }

  return (
    <main style={{ padding: "40px 60px", maxWidth: 1600, margin: "0 auto" }}>
      {/* Back */}
      <Link href="/brands" style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 1,
        textTransform: "uppercase",
        color: "#999",
        textDecoration: "none",
        display: "inline-block",
        marginBottom: 40,
      }}>
        ← BRANDS
      </Link>

      {/* Hero */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 40, marginBottom: 48, flexWrap: "wrap" }}>
        {brand.logo_url && (
          <div style={{
            width: 100,
            height: 100,
            background: "#f5f5f5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}>
            <img
              src={brand.logo_url}
              alt={brand.name}
              style={{ width: "70%", height: "70%", objectFit: "contain" }}
              loading="lazy"
              decoding="async"
            />
          </div>
        )}

        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", margin: 0 }}>
              {brand.name}
            </h1>
            {brand.country && (
              <span style={{ fontSize: 22 }}>
                {getCountryFlag(brand.country)}
              </span>
            )}
          </div>

          {(brand.city || brand.country) && (
            <div style={{ fontSize: 10, color: "#999", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 12 }}>
              {[brand.city, brand.country].filter(Boolean).join(", ")}
            </div>
          )}

          {brand.description && (
            <p style={{ fontSize: 13, color: "#666", lineHeight: 1.6, maxWidth: 500, margin: 0 }}>
              {brand.description}
            </p>
          )}
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: "1px solid #e6e6e6", marginBottom: 24 }} />

      {/* Products count */}
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#999", marginBottom: 30 }}>
        {products.length} {products.length === 1 ? "PRODUCT" : "PRODUCTS"}
      </div>

      {/* Products Grid */}
      {products.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#CCCCCC", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>
          NO PRODUCTS AVAILABLE YET
        </div>
      ) : (
        <section style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, rowGap: 40 }}>
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              isNew={isNew(product)}
              isFavorited={favoritedIds.has(product.id)}
              brandName={brand.name}
              brandCountry={brand.country}
            />
          ))}
        </section>
      )}
    </main>
  );
}
