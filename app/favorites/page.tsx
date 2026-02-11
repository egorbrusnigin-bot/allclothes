"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import { getFavoriteProducts } from "../lib/favorites";
import { getCountryFlag } from "../lib/countryFlags";
import Price from "../components/Price";
import FavoriteButton from "../components/FavoriteButton";
import QuickAddButton from "../components/QuickAddButton";
import LoadingLogo from "../components/LoadingLogo";
import { useIsMobile } from "../lib/useIsMobile";

interface Product {
  id: string;
  slug: string;
  name: string;
  price: number;
  currency: string;
  category: string | null;
  created_at?: string;
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
  }>;
}

function ProductCard({
  product,
  isNew,
  onRemove
}: {
  product: Product;
  isNew: boolean;
  onRemove: (productId: string) => void;
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
    const segmentWidth = rect.width / allImages.length;
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
        <Link href={`/product/${product.slug || product.id}`}>
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

        {allImages.length > 1 && (
          <div style={{
            position: "absolute",
            bottom: 8,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: 4,
            pointerEvents: "none",
          }}>
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

      {product.brand && (
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
            {product.brand.name}
          </div>
          {product.brand.country && (
            <span style={{ fontSize: 16, lineHeight: 1 }}>
              {getCountryFlag(product.brand.country)}
            </span>
          )}
        </div>
      )}

      <Link href={`/product/${product.slug || product.id}`}>
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
          <Price price={product.price} currency={product.currency} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <QuickAddButton
            productId={product.id}
            productSlug={product.slug}
            productName={product.name}
            brandName={product.brand?.name || "Unknown"}
            price={product.price}
            currency={product.currency}
            imageUrl={mainImage}
            sizes={product.product_sizes || []}
          />
          <FavoriteButton
            productId={product.id}
            initialIsFavorited={true}
            size={16}
            variant="inline"
            brandId={product.brand_id}
            onToggle={(isFavorited) => {
              if (!isFavorited) {
                onRemove(product.id);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default function FavoritesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Filter states
  const [sortBy, setSortBy] = useState<string>("NEW");
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");

  // Dropdown states
  const [showBrandFilter, setShowBrandFilter] = useState(false);
  const [showSizeFilter, setShowSizeFilter] = useState(false);
  const [showPriceFilter, setShowPriceFilter] = useState(false);

  const [brands, setBrands] = useState<string[]>([]);
  const sizes = ["XS", "S", "M", "L", "XL", "XXL"];
  const [, setCurrencyUpdate] = useState(0);
  const isMobile = useIsMobile();

  useEffect(() => {
    checkAuth();
    loadFavorites();

    const { data: authListener } = supabase?.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
      if (session) {
        loadFavorites();
      } else {
        setProducts([]);
      }
    }) || { data: { subscription: { unsubscribe: () => {} } } };

    const handleCurrencyChange = () => setCurrencyUpdate(n => n + 1);
    window.addEventListener("currencyChanged", handleCurrencyChange);

    return () => {
      authListener?.subscription?.unsubscribe();
      window.removeEventListener("currencyChanged", handleCurrencyChange);
    };
  }, []);

  async function checkAuth() {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    setIsLoggedIn(!!user);
  }

  async function loadFavorites() {
    setLoading(true);
    const data = await getFavoriteProducts();
    setProducts(data);

    // Extract unique brands
    const uniqueBrands = [...new Set(data.map(p => p.brand?.name).filter(Boolean))];
    setBrands(uniqueBrands as string[]);

    setLoading(false);
  }

  function handleRemoveFromFavorites(productId: string) {
    // Optimistically remove from UI
    setProducts(prev => prev.filter(p => p.id !== productId));
  }

  const isNew = (product: Product) => {
    if (!product.created_at) return false;
    const created = new Date(product.created_at);
    const now = new Date();
    const diffDays = (now.getTime() - created.getTime()) / (1000 * 3600 * 24);
    return diffDays <= 30;
  };

  // Filter products
  const filteredProducts = products.filter(product => {
    if (selectedBrands.length > 0 && !selectedBrands.includes(product.brand?.name || "")) {
      return false;
    }

    if (selectedSizes.length > 0) {
      const productSizes = product.product_sizes?.map(s => s.size) || [];
      if (!selectedSizes.some(size => productSizes.includes(size))) {
        return false;
      }
    }

    const price = product.price;
    if (minPrice && price < parseFloat(minPrice)) return false;
    if (maxPrice && price > parseFloat(maxPrice)) return false;

    return true;
  });

  // Sort products
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === "NEW") {
      return 0;
    } else if (sortBy === "PRICE_LOW") {
      return a.price - b.price;
    } else if (sortBy === "PRICE_HIGH") {
      return b.price - a.price;
    }
    return 0;
  });

  if (loading) {
    return <LoadingLogo />;
  }

  if (!isLoggedIn) {
    return (
      <main style={{ maxWidth: 1600, margin: "48px auto", padding: isMobile ? "24px 16px" : "40px 60px" }}>
        <h1 style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 50 }}>
          FAVORITES
        </h1>
        <div style={{
          textAlign: "center",
          padding: "100px 20px",
          color: "#999",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
          </div>
          <p style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: 1 }}>
            Please log in to view your favorites
          </p>
          <Link
            href="/?login=1"
            style={{
              textDecoration: "none",
              padding: "12px 24px",
              borderRadius: 24,
              border: "1px solid #000",
              background: "#000",
              color: "#fff",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Log in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main style={{ padding: isMobile ? "24px 16px" : "40px 60px", maxWidth: 1600, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>
          FAVORITES
        </h1>
        {products.length > 0 && (
          <p style={{ fontSize: 11, color: "#999", marginTop: 8, letterSpacing: 0.5 }}>
            {sortedProducts.length} {sortedProducts.length === 1 ? "ITEM" : "ITEMS"}
          </p>
        )}
      </div>

      {products.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "100px 0",
          color: "#CCCCCC",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
          </div>
          <p style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>
            NO FAVORITES YET
          </p>
          <p style={{ fontSize: 11, color: "#999", maxWidth: 400, lineHeight: 1.6 }}>
            Start adding products to your favorites by clicking the heart icon on product cards
          </p>
          <Link
            href="/catalog"
            style={{
              textDecoration: "none",
              padding: "12px 24px",
              borderRadius: 24,
              border: "1px solid #000",
              background: "#000",
              color: "#fff",
              fontSize: 13,
              fontWeight: 500,
              marginTop: 12
            }}
          >
            Browse Catalog
          </Link>
        </div>
      ) : (
        <>
          {/* Filters Bar */}
          <div style={{
            display: "flex",
            gap: 20,
            marginBottom: 50,
            paddingBottom: 20,
            borderBottom: "1px solid #e6e6e6",
            alignItems: "center",
            flexWrap: "wrap"
          }}>
            {/* Sort Button */}
            <button
              onClick={() => setSortBy(sortBy === "NEW" ? "PRICE_LOW" : sortBy === "PRICE_LOW" ? "PRICE_HIGH" : "NEW")}
              style={{
                padding: 0,
                background: "none",
                border: "none",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: "uppercase",
                cursor: "pointer",
                color: "#000"
              }}
            >
              {sortBy === "NEW" ? "BY RECENCY ↓" : sortBy === "PRICE_LOW" ? "PRICE ↓" : "PRICE ↑"}
            </button>

            {/* Brand Filter */}
            {brands.length > 0 && (
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => {
                    setShowBrandFilter(!showBrandFilter);
                    setShowSizeFilter(false);
                    setShowPriceFilter(false);
                  }}
                  style={{
                    padding: 0,
                    background: "none",
                    border: "none",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    cursor: "pointer",
                    color: selectedBrands.length > 0 ? "#000" : "#999"
                  }}
                >
                  BRAND {selectedBrands.length > 0 && `(${selectedBrands.length})`}
                </button>

                {showBrandFilter && (
                  <div style={{
                    position: "absolute",
                    top: 45,
                    left: 0,
                    background: "#fff",
                    border: "1px solid #e6e6e6",
                    borderRadius: 12,
                    padding: "16px",
                    minWidth: 200,
                    zIndex: 100,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                  }}>
                    {brands.map(brand => (
                      <label key={brand} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 13, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={selectedBrands.includes(brand)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedBrands([...selectedBrands, brand]);
                            } else {
                              setSelectedBrands(selectedBrands.filter(b => b !== brand));
                            }
                          }}
                          style={{ width: 16, height: 16 }}
                        />
                        <span>{brand}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Size Filter */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => {
                  setShowSizeFilter(!showSizeFilter);
                  setShowBrandFilter(false);
                  setShowPriceFilter(false);
                }}
                style={{
                  padding: 0,
                  background: "none",
                  border: "none",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  cursor: "pointer",
                  color: selectedSizes.length > 0 ? "#000" : "#999"
                }}
              >
                SIZE {selectedSizes.length > 0 && `(${selectedSizes.length})`}
              </button>

              {showSizeFilter && (
                <div style={{
                  position: "absolute",
                  top: 45,
                  left: 0,
                  background: "#fff",
                  border: "1px solid #e6e6e6",
                  borderRadius: 12,
                  padding: "16px",
                  zIndex: 100,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {sizes.map(size => (
                      <button
                        key={size}
                        onClick={() => {
                          if (selectedSizes.includes(size)) {
                            setSelectedSizes(selectedSizes.filter(s => s !== size));
                          } else {
                            setSelectedSizes([...selectedSizes, size]);
                          }
                        }}
                        style={{
                          padding: "10px 16px",
                          border: selectedSizes.includes(size) ? "2px solid #000" : "1px solid #e6e6e6",
                          background: selectedSizes.includes(size) ? "#000" : "#fff",
                          color: selectedSizes.includes(size) ? "#fff" : "#000",
                          cursor: "pointer",
                          fontSize: 13,
                          fontWeight: 600,
                          borderRadius: 8
                        }}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Price Filter */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => {
                  setShowPriceFilter(!showPriceFilter);
                  setShowBrandFilter(false);
                  setShowSizeFilter(false);
                }}
                style={{
                  padding: 0,
                  background: "none",
                  border: "none",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  cursor: "pointer",
                  color: (minPrice || maxPrice) ? "#000" : "#999"
                }}
              >
                PRICE
              </button>

              {showPriceFilter && (
                <div style={{
                  position: "absolute",
                  top: 45,
                  left: 0,
                  background: "#fff",
                  border: "1px solid #e6e6e6",
                  borderRadius: 12,
                  padding: "16px",
                  zIndex: 100,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <input
                      type="number"
                      placeholder="Min"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      style={{
                        width: 80,
                        padding: "10px 12px",
                        border: "1px solid #e6e6e6",
                        borderRadius: 8,
                        fontSize: 13
                      }}
                    />
                    <span style={{ fontSize: 13, color: "#999" }}>-</span>
                    <input
                      type="number"
                      placeholder="Max"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      style={{
                        width: 80,
                        padding: "10px 12px",
                        border: "1px solid #e6e6e6",
                        borderRadius: 8,
                        fontSize: 13
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Clear All */}
            {(selectedBrands.length > 0 || selectedSizes.length > 0 || minPrice || maxPrice) && (
              <button
                onClick={() => {
                  setSelectedBrands([]);
                  setSelectedSizes([]);
                  setMinPrice("");
                  setMaxPrice("");
                }}
                style={{
                  padding: 0,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  color: "#000",
                  textDecoration: "underline",
                  marginLeft: "auto"
                }}
              >
                CLEAR ALL
              </button>
            )}
          </div>

          {/* Products Grid */}
          <section style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: isMobile ? 12 : 20, rowGap: isMobile ? 24 : 40 }}>
            {sortedProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                isNew={isNew(product)}
                onRemove={handleRemoveFromFavorites}
              />
            ))}
          </section>
        </>
      )}
    </main>
  );
}
