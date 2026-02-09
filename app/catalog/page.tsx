"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import { getCountryFlag } from "../lib/countryFlags";
import { getFavoritedProductIds } from "../lib/favorites";
import { formatPrice } from "../lib/currency";
import FavoriteButton from "../components/FavoriteButton";
import QuickAddButton from "../components/QuickAddButton";
import LoadingLogo from "../components/LoadingLogo";

// Fuzzy search - Levenshtein distance
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// Calculate fuzzy match score (0-1, higher is better)
function fuzzyMatch(query: string, text: string): number {
  const q = query.toLowerCase().trim();
  const t = text.toLowerCase();

  // Exact match
  if (t.includes(q)) return 1;

  // Check each word in text
  const words = t.split(/\s+/);
  let bestScore = 0;

  for (const word of words) {
    // Starts with query
    if (word.startsWith(q)) {
      bestScore = Math.max(bestScore, 0.95);
      continue;
    }

    // Levenshtein distance for short queries (typo tolerance)
    if (q.length >= 2) {
      const distance = levenshteinDistance(q, word.substring(0, Math.max(q.length + 2, word.length)));
      const maxLen = Math.max(q.length, word.length);
      const similarity = 1 - (distance / maxLen);

      // Allow up to 2 typos for words >= 4 chars, 1 typo for shorter
      const maxTypos = q.length >= 4 ? 2 : 1;
      if (distance <= maxTypos) {
        bestScore = Math.max(bestScore, similarity * 0.8);
      }
    }
  }

  // Also check full text similarity for multi-word queries
  if (q.includes(" ")) {
    const distance = levenshteinDistance(q, t.substring(0, q.length + 5));
    const similarity = 1 - (distance / Math.max(q.length, t.length));
    if (similarity > 0.6) {
      bestScore = Math.max(bestScore, similarity * 0.7);
    }
  }

  return bestScore;
}

interface Product {
  id: string;
  name: string;
  slug: string;
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

function ProductCard({ product, isNew, isFavorited = false, index = 0 }: { product: Product; isNew: boolean; isFavorited?: boolean; index?: number; }) {
  const allImages = (product.product_images || [])
    .sort((a, b) => a.display_order - b.display_order)
    .map(img => img.image_url);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Stagger animation - each card appears slightly after the previous
    const timer = setTimeout(() => setIsVisible(true), Math.min(index * 30, 300));
    return () => clearTimeout(timer);
  }, [index]);

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
    <div
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(8px)",
        transition: "opacity 0.2s ease, transform 0.2s ease"
      }}
    >
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
            <div style={{ width: "100%", aspectRatio: "3/4", background: "#f8f8f8", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img
                src={allImages[currentImageIndex]}
                alt={product.name}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  display: "block",
                  userSelect: "none"
                }}
                draggable={false}
                loading="lazy"
                decoding="async"
              />
            </div>
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
            <span style={{
              fontSize: 16,
              lineHeight: 1
            }}>
              {getCountryFlag(product.brand.country)}
            </span>
          )}
        </div>
      )}

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
            brandName={product.brand?.name || "Unknown"}
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
            brandId={product.brand_id}
          />
        </div>
      </div>
    </div>
  );
}

export default function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<string>("NEW");
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());

  // Search state with debounce
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Debounce search (short delay for snappy feel)
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Dropdown states
  const [showBrandFilter, setShowBrandFilter] = useState(false);
  const [showSizeFilter, setShowSizeFilter] = useState(false);
  const [showPriceFilter, setShowPriceFilter] = useState(false);

  // Filter states
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");

  const [brands, setBrands] = useState<string[]>([]);
  const sizes = ["XS", "S", "M", "L", "XL", "XXL"];
  const [, setCurrencyUpdate] = useState(0);

  useEffect(() => {
    loadProducts();
    loadFavorites();

    const handleCurrencyChange = () => setCurrencyUpdate(n => n + 1);
    window.addEventListener("currencyChanged", handleCurrencyChange);
    return () => window.removeEventListener("currencyChanged", handleCurrencyChange);
  }, []);

  async function loadFavorites() {
    const ids = await getFavoritedProductIds();
    setFavoritedIds(new Set(ids));
  }

  async function loadProducts() {
    if (!supabase) return;

    const { data, error } = await supabase
      .from("products")
      .select(`
        id,
        name,
        slug,
        price,
        currency,
        category,
        created_at,
        brand_id,
        brands(name, slug, logo_url, country),
        product_images(image_url, is_main, display_order),
        product_sizes(size, in_stock)
      `)
      .eq("status", "approved")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading products:", error);
      setLoading(false);
      return;
    }

    const transformedData = (data || []).map(product => ({
      ...product,
      brand: Array.isArray(product.brands) ? product.brands[0] : product.brands
    }));

    setProducts(transformedData);

    const uniqueBrands = [...new Set(transformedData.map(p => p.brand?.name).filter(Boolean))];
    setBrands(uniqueBrands as string[]);

    setLoading(false);
  }

  // Filter products with fuzzy search
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      // Fuzzy search filter
      if (searchQuery.trim()) {
        const brandName = product.brand?.name || "";
        const productName = product.name || "";

        const brandScore = fuzzyMatch(searchQuery, brandName);
        const productScore = fuzzyMatch(searchQuery, productName);
        const bestScore = Math.max(brandScore, productScore);

        // Require at least 0.5 match score
        if (bestScore < 0.5) return false;
      }

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
  }, [products, searchQuery, selectedBrands, selectedSizes, minPrice, maxPrice]);

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

  const isNew = (product: Product) => {
    if (!product.created_at) return false;
    const created = new Date(product.created_at);
    const now = new Date();
    const diffDays = (now.getTime() - created.getTime()) / (1000 * 3600 * 24);
    return diffDays <= 30;
  };

  if (loading) {
    return <LoadingLogo />;
  }

  return (
    <main style={{ padding: "40px 60px", maxWidth: 1600, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>
          CATALOG
        </h1>
      </div>

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

        {/* Search */}
        <div style={{ position: "relative" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              borderBottom: isSearchFocused || searchInput ? "1px solid #000" : "1px solid transparent",
              paddingBottom: 4,
              transition: "all 0.2s ease"
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ opacity: isSearchFocused || searchInput ? 1 : 0.4, transition: "opacity 0.2s" }}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="SEARCH"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              style={{
                border: "none",
                outline: "none",
                background: "transparent",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: "uppercase",
                width: isSearchFocused || searchInput ? 180 : 60,
                transition: "width 0.3s ease",
                color: "#000"
              }}
            />
            {searchInput && (
              <button
                onClick={() => {
                  setSearchInput("");
                  setSearchQuery("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  fontSize: 10,
                  color: "#999",
                  lineHeight: 1
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <span style={{ color: "#e6e6e6" }}>|</span>

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

          {showBrandFilter && brands.length > 0 && (
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

        {/* Disabled filters */}
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#ccc" }}>COLOR</span>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#ccc" }}>STYLE</span>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#ccc" }}>GENDER</span>

        {/* Clear All */}
        {(selectedBrands.length > 0 || selectedSizes.length > 0 || minPrice || maxPrice || searchInput) && (
          <button
            onClick={() => {
              setSelectedBrands([]);
              setSelectedSizes([]);
              setMinPrice("");
              setMaxPrice("");
              setSearchInput("");
              setSearchQuery("");
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

        {/* Search results info */}
        {searchQuery && (
          <span style={{ fontSize: 11, color: "#666", fontWeight: 500, letterSpacing: 0.5 }}>
            {filteredProducts.length} RESULT{filteredProducts.length !== 1 ? "S" : ""}
          </span>
        )}
      </div>

      {/* Products Grid */}
      {sortedProducts.length === 0 ? (
        <div style={{ textAlign: "center", padding: "100px 0", color: "#CCCCCC", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>
          NO PRODUCTS FOUND
        </div>
      ) : (
        <section style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, rowGap: 40 }}>
          {sortedProducts.map((product, idx) => (
            <ProductCard
              key={`${product.id}-${searchQuery}`}
              product={product}
              isNew={isNew(product)}
              isFavorited={favoritedIds.has(product.id)}
              index={idx}
            />
          ))}
        </section>
      )}
    </main>
  );
}
