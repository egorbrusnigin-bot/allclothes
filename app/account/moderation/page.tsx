"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { isAdmin } from "../../lib/auth";

interface PendingProduct {
  name: string;
  slug: string;
  description: string;
  price: number;
  currency: string;
  category: string | null;
  images: string[];
  sizes: Array<{ size: string; in_stock: boolean; quantity: number }>;
  tags: string[];
  sizeChartUrl?: string;
  shippingInfo?: string;
  careInstructions?: string;
  instagramUrl?: string;
  phoneNumber?: string;
}

interface Seller {
  id: string;
  user_id: string;
  brand_name: string;
  logo_url: string | null;
  description: string | null;
  city: string | null;
  country: string | null;
  seller_type: string;
  contact_email: string | null;
  instagram: string | null;
  twitter: string | null;
  facebook: string | null;
  shopify_link: string | null;
  paypal_email: string | null;
  legal_name: string | null;
  shipping_address: string | null;
  shipping_city: string | null;
  shipping_postal_code: string | null;
  shipping_country: string | null;
  shipping_phone: string | null;
  status: string;
  created_at: string;
  pending_products: string | null;
}

interface Product {
  id: string;
  slug: string;
  name: string;
  price: number;
  currency: string;
  status: string;
  description?: string;
  category?: string;
  brand?: {
    name: string;
  };
  product_images?: Array<{
    image_url: string;
    is_main: boolean;
  }>;
  owner_id: string;
}

function FieldDisplay({ label, value, fullWidth }: { label: string; value: string | null | undefined; fullWidth?: boolean }) {
  const isEmpty = !value || value.trim() === "";
  return (
    <div style={{ gridColumn: fullWidth ? "1 / -1" : undefined }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, color: "#999" }}>
        {label}
      </div>
      <div style={{
        fontSize: 12,
        color: isEmpty ? "#ccc" : "#333",
        fontStyle: isEmpty ? "italic" : "normal",
        padding: "8px 10px",
        background: isEmpty ? "#fafafa" : "#f5f5f5",
        border: `1px solid ${isEmpty ? "#eee" : "#e6e6e6"}`,
        whiteSpace: fullWidth ? "pre-wrap" : "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        minHeight: fullWidth ? 60 : "auto",
      }}>
        {isEmpty ? "— not filled —" : value}
      </div>
    </div>
  );
}

export default function ModerationPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminCheck, setAdminCheck] = useState(false);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [rejectingProduct, setRejectingProduct] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [activeTab, setActiveTab] = useState<"products" | "sellers">("sellers");
  const [expandedSeller, setExpandedSeller] = useState<string | null>(null);

  useEffect(() => {
    checkAdmin();
  }, []);

  useEffect(() => {
    if (adminCheck) {
      loadProducts();
      loadSellers();
    }
  }, [adminCheck, filter]);

  async function checkAdmin() {
    const admin = await isAdmin();
    if (!admin) {
      router.push("/account");
      return;
    }
    setAdminCheck(true);
  }

  async function loadSellers() {
    if (!supabase) return;

    try {
      let query = supabase
        .from("sellers")
        .select("*")
        .order("created_at", { ascending: false });

      if (filter === "pending") {
        query = query.eq("status", "pending");
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error loading sellers:", error);
      } else {
        setSellers(data || []);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  }

  async function loadProducts() {
    if (!supabase) return;

    try {
      let query = supabase
        .from("products")
        .select(`
          *,
          brands(name),
          product_images(image_url, is_main)
        `)
        .order("created_at", { ascending: false });

      if (filter === "pending") {
        query = query.eq("status", "pending");
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error loading products:", error);
      } else {
        // Transform brands to brand
        const transformedData = (data || []).map((item: any) => ({
          ...item,
          brand: Array.isArray(item.brands) ? item.brands[0] : item.brands
        }));
        setProducts(transformedData);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleApproveSeller(sellerId: string, seller: Seller) {
    if (!supabase) return;

    try {
      // 1. Update seller status to approved
      const { data: updateData, error: sellerError } = await supabase
        .from("sellers")
        .update({ status: "approved" })
        .eq("id", sellerId)
        .select();

      console.log("Seller update result:", { updateData, sellerError });

      if (sellerError) {
        alert(`Error approving seller: ${sellerError.message || JSON.stringify(sellerError)}`);
        return;
      }

      if (!updateData || updateData.length === 0) {
        alert("Failed to update seller status - RLS might be blocking the update. Check if you have admin role in user_roles table.");
        return;
      }

      // Verify the status was actually changed
      const updatedSeller = updateData[0];
      if (updatedSeller.status !== "approved") {
        alert(`Update returned but status is still "${updatedSeller.status}". RLS might be blocking the actual update.`);
        return;
      }

      console.log("Seller status successfully updated to:", updatedSeller.status);

      // 2. Check if brand already exists for this user
      const { data: existingUserBrand } = await supabase
        .from("brands")
        .select("id, name")
        .eq("owner_id", seller.user_id)
        .single();

      let brandData: { id: string } | null = null;

      if (existingUserBrand) {
        // Brand already exists for this user, use it
        brandData = { id: existingUserBrand.id };
        console.log(`Using existing brand: ${existingUserBrand.name}`);
      } else {
        // Create new brand - generate unique slug
        let baseSlug = seller.brand_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        let slug = baseSlug;
        let counter = 1;

        // Check if slug exists and find unique one
        while (true) {
          const { data: existingBrand } = await supabase
            .from("brands")
            .select("id")
            .eq("slug", slug)
            .single();

          if (!existingBrand) {
            break; // Slug is unique
          }
          slug = `${baseSlug}-${counter}`;
          counter++;
        }

        // Geocode city/country to get coordinates
        let latitude: number | null = null;
        let longitude: number | null = null;

        if (seller.city || seller.country) {
          try {
            const query = [seller.city, seller.country].filter(Boolean).join(", ");
            const geoRes = await fetch(
              `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
              { headers: { "User-Agent": "allclothes-site" } }
            );
            const geoData = await geoRes.json();
            if (geoData && geoData[0]) {
              latitude = parseFloat(geoData[0].lat);
              longitude = parseFloat(geoData[0].lon);

              // If only country (no city), add random offset so brands don't overlap
              if (!seller.city?.trim() && seller.country?.trim()) {
                latitude += (Math.random() - 0.5) * 4;
                longitude += (Math.random() - 0.5) * 6;
              }
              console.log(`Geocoded "${query}" to:`, latitude, longitude);
            }
          } catch (geoErr) {
            console.warn("Geocoding failed:", geoErr);
          }
        }

        const { data: newBrandData, error: brandError } = await supabase
          .from("brands")
          .insert({
            name: seller.brand_name,
            slug: slug,
            logo_url: seller.logo_url,
            description: seller.description,
            city: seller.city,
            country: seller.country,
            latitude,
            longitude,
            owner_id: seller.user_id,
          })
          .select("id")
          .single();

        if (brandError) {
          console.error("Error creating brand:", brandError);
          alert(`Seller approved but brand creation failed: ${brandError.message}`);
          loadSellers();
          return;
        }
        brandData = newBrandData;
      }

      // 3. Create products from pending_products
      let productsCreated = 0;
      if (seller.pending_products && brandData) {
        try {
          const pendingProducts: PendingProduct[] = JSON.parse(seller.pending_products);

          for (const product of pendingProducts) {
            // Create product
            const productSlug = product.slug || product.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

            const { data: productData, error: productError } = await supabase
              .from("products")
              .insert({
                name: product.name,
                slug: productSlug,
                description: product.description,
                price: product.price,
                currency: product.currency,
                category: product.category,
                brand_id: brandData.id,
                owner_id: seller.user_id,
                status: "pending", // Products still need review
              })
              .select("id")
              .single();

            if (productError) {
              console.error("Error creating product:", productError.message, productError.code, productError.details);
              alert(`Failed to create product "${product.name}": ${productError.message || "RLS policy violation"}`);
              continue;
            }

            // Create product images
            if (product.images && product.images.length > 0) {
              const imageInserts = product.images.map((url, index) => ({
                product_id: productData.id,
                image_url: url,
                is_main: index === 0,
                display_order: index,
              }));

              await supabase.from("product_images").insert(imageInserts);
            }

            // Create product sizes
            if (product.sizes && product.sizes.length > 0) {
              const sizeInserts = product.sizes.map((s) => ({
                product_id: productData.id,
                size: s.size,
                in_stock: s.in_stock,
                quantity: s.quantity,
              }));

              await supabase.from("product_sizes").insert(sizeInserts);
            }

            productsCreated++;
          }
        } catch (parseError) {
          console.error("Error parsing pending products:", parseError);
        }
      }

      // Double-check the seller status in DB
      const { data: checkSeller } = await supabase
        .from("sellers")
        .select("status")
        .eq("id", sellerId)
        .single();

      console.log("Final seller status check:", checkSeller);

      if (productsCreated > 0) {
        alert(`Seller approved! ${existingUserBrand ? "Using existing brand" : "Brand created"} with ${productsCreated} products (pending review).\n\nDB status: ${checkSeller?.status}`);
      } else {
        alert(`Seller approved! ${existingUserBrand ? "Brand already exists" : "Brand created"}\n\nDB status: ${checkSeller?.status}`);
      }

      loadSellers();
      loadProducts(); // Refresh products list
    } catch (error) {
      console.error("Error approving seller:", error);
      alert(`Error: ${error}`);
      loadSellers(); // Refresh anyway to show current state
      loadProducts();
    }
  }

  async function handleRejectSeller(sellerId: string) {
    if (!supabase) return;

    const reason = prompt("Rejection reason:");
    if (!reason) return;

    try {
      const { error } = await supabase
        .from("sellers")
        .update({ status: "rejected" })
        .eq("id", sellerId);

      if (error) {
        alert(`Error: ${error.message}`);
      } else {
        loadSellers();
      }
    } catch (error) {
      console.error("Error rejecting seller:", error);
    }
  }

  async function handleApprove(productId: string) {
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from("products")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          rejection_reason: null,
        })
        .eq("id", productId);

      if (error) {
        alert(`Error: ${error.message}`);
      } else {
        loadProducts();
      }
    } catch (error) {
      console.error("Error approving product:", error);
    }
  }

  async function handleReject(productId: string) {
    if (!rejectionReason.trim()) {
      alert("Please provide a rejection reason");
      return;
    }
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from("products")
        .update({
          status: "rejected",
          rejection_reason: rejectionReason,
        })
        .eq("id", productId);

      if (error) {
        alert(`Error: ${error.message}`);
      } else {
        setRejectingProduct(null);
        setRejectionReason("");
        loadProducts();
      }
    } catch (error) {
      console.error("Error rejecting product:", error);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#666" }}>
        Loading...
      </div>
    );
  }

  const pendingSellers = sellers.filter(s => s.status === "pending");
  const pendingProducts = products.filter(p => p.status === "pending");

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
            MODERATION
          </h1>
          <p style={{ fontSize: 11, color: "#666", letterSpacing: 0.3 }}>
            Review sellers and products
          </p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <Link
            href="/account/moderation/analytics"
            style={{
              padding: "10px 20px",
              background: "#fff",
              color: "#000",
              border: "1px solid #e6e6e6",
              textDecoration: "none",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            Analytics
          </Link>
          <button
            onClick={() => router.push("/account/moderation/brands")}
            style={{
              padding: "10px 20px",
              background: "#fff",
              color: "#000",
              border: "1px solid #e6e6e6",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            MANAGE BRANDS
          </button>
          <button
            onClick={() => router.push("/account/moderation/products/new")}
            style={{
              padding: "10px 20px",
              background: "#000",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            + CREATE PRODUCT
          </button>
        </div>
      </div>

      {/* Main Tabs: Sellers / Products */}
      <div style={{ display: "flex", gap: 0, borderBottom: "2px solid #e6e6e6" }}>
        <button
          onClick={() => setActiveTab("sellers")}
          style={{
            padding: "12px 24px",
            background: "transparent",
            color: activeTab === "sellers" ? "#000" : "#999",
            border: "none",
            borderBottom: activeTab === "sellers" ? "2px solid #000" : "2px solid transparent",
            marginBottom: -2,
            cursor: "pointer",
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 1,
          }}
        >
          SELLERS {pendingSellers.length > 0 && <span style={{ background: "#ef4444", color: "#fff", padding: "2px 6px", borderRadius: 10, fontSize: 9, marginLeft: 6 }}>{pendingSellers.length}</span>}
        </button>
        <button
          onClick={() => setActiveTab("products")}
          style={{
            padding: "12px 24px",
            background: "transparent",
            color: activeTab === "products" ? "#000" : "#999",
            border: "none",
            borderBottom: activeTab === "products" ? "2px solid #000" : "2px solid transparent",
            marginBottom: -2,
            cursor: "pointer",
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 1,
          }}
        >
          PRODUCTS {pendingProducts.length > 0 && <span style={{ background: "#f59e0b", color: "#fff", padding: "2px 6px", borderRadius: 10, fontSize: 9, marginLeft: 6 }}>{pendingProducts.length}</span>}
        </button>
      </div>

      {/* Sellers Tab */}
      {activeTab === "sellers" && (
        <>
          {/* Filter */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setFilter("pending")}
              style={{
                padding: "8px 16px",
                background: filter === "pending" ? "#000" : "#fff",
                color: filter === "pending" ? "#fff" : "#000",
                border: "1px solid #e6e6e6",
                cursor: "pointer",
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              PENDING ({pendingSellers.length})
            </button>
            <button
              onClick={() => setFilter("all")}
              style={{
                padding: "8px 16px",
                background: filter === "all" ? "#000" : "#fff",
                color: filter === "all" ? "#fff" : "#000",
                border: "1px solid #e6e6e6",
                cursor: "pointer",
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              ALL ({sellers.length})
            </button>
          </div>

          {/* Sellers List */}
          {sellers.length === 0 ? (
            <div style={{ padding: 60, textAlign: "center", background: "#fff", border: "1px solid #e6e6e6", color: "#999" }}>
              <p style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>
                NO {filter === "pending" ? "PENDING " : ""}SELLERS
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {sellers.map((seller) => {
                const isExpanded = expandedSeller === seller.id;
                let pendingProducts: PendingProduct[] = [];
                try {
                  if (seller.pending_products) {
                    pendingProducts = JSON.parse(seller.pending_products);
                  }
                } catch {}

                return (
                <div
                  key={seller.id}
                  style={{
                    background: "#fff",
                    border: "1px solid #e6e6e6",
                  }}
                >
                  {/* Header - always visible */}
                  <div
                    onClick={() => setExpandedSeller(isExpanded ? null : seller.id)}
                    style={{
                      padding: 20,
                      cursor: "pointer",
                      display: "flex",
                      gap: 16,
                    }}
                  >
                    {/* Logo */}
                    {seller.logo_url ? (
                      <img
                        src={seller.logo_url}
                        alt={seller.brand_name}
                        style={{ width: 120, height: 120, objectFit: "contain", background: "#f5f5f5", borderRadius: 8 }}
                      />
                    ) : (
                      <div style={{ width: 120, height: 120, background: "#000", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 32, fontWeight: 800 }}>
                        {seller.brand_name.charAt(0).toUpperCase()}
                      </div>
                    )}

                    {/* Info */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 700 }}>{seller.brand_name}</h3>
                        <span
                          style={{
                            padding: "4px 10px",
                            background: seller.status === "pending" ? "#fef3c7" : seller.status === "approved" ? "#d1fae5" : "#fee2e2",
                            color: seller.status === "pending" ? "#f59e0b" : seller.status === "approved" ? "#10b981" : "#ef4444",
                            fontSize: 9,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                          }}
                        >
                          {seller.status}
                        </span>
                        <span style={{ fontSize: 10, color: "#999", padding: "4px 8px", background: "#f5f5f5" }}>
                          {seller.seller_type}
                        </span>
                        <span style={{ marginLeft: "auto", fontSize: 18, color: "#999", transition: "transform 200ms", transform: isExpanded ? "rotate(180deg)" : "rotate(0)" }}>
                          ▼
                        </span>
                      </div>

                      {(seller.city || seller.country) && (
                        <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>
                          {[seller.city, seller.country].filter(Boolean).join(", ")}
                        </div>
                      )}

                      {seller.contact_email && (
                        <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>
                          {seller.contact_email}
                        </div>
                      )}

                      {pendingProducts.length > 0 && (
                        <div style={{ marginTop: 8, padding: "6px 10px", background: "#f0f9ff", border: "1px solid #bae6fd", display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 14 }}>📦</span>
                          <span style={{ fontSize: 10, fontWeight: 600, color: "#0369a1" }}>
                            {pendingProducts.length} product{pendingProducts.length !== 1 ? "s" : ""} to import
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div style={{ borderTop: "1px solid #e6e6e6", padding: 20 }}>
                      {/* All Fields Grid */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
                        {/* Basic Info */}
                        <FieldDisplay label="Brand Name" value={seller.brand_name} />
                        <FieldDisplay label="Logo URL" value={seller.logo_url} />
                        <FieldDisplay label="Seller Type" value={seller.seller_type} />
                        <FieldDisplay label="City" value={seller.city} />
                        <FieldDisplay label="Country" value={seller.country} />
                        <FieldDisplay label="Description" value={seller.description} fullWidth />

                        {/* Contact */}
                        <FieldDisplay label="Contact Email" value={seller.contact_email} />
                        <FieldDisplay label="Instagram" value={seller.instagram} />
                        <FieldDisplay label="Twitter" value={seller.twitter} />
                        <FieldDisplay label="Facebook" value={seller.facebook} />
                        <FieldDisplay label="Shopify Link" value={seller.shopify_link} />

                        {/* Payout */}
                        <FieldDisplay label="PayPal Email" value={seller.paypal_email} />
                        <FieldDisplay label="Legal Name" value={seller.legal_name} />

                        {/* Shipping */}
                        <FieldDisplay label="Shipping Address" value={seller.shipping_address} />
                        <FieldDisplay label="Shipping City" value={seller.shipping_city} />
                        <FieldDisplay label="Shipping Postal Code" value={seller.shipping_postal_code} />
                        <FieldDisplay label="Shipping Country" value={seller.shipping_country} />
                        <FieldDisplay label="Shipping Phone" value={seller.shipping_phone} />

                        {/* Meta */}
                        <FieldDisplay label="User ID" value={seller.user_id} />
                        <FieldDisplay label="Created" value={new Date(seller.created_at).toLocaleString()} />
                      </div>

                      {/* Pending Products */}
                      {pendingProducts.length > 0 && (
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, color: "#666" }}>
                            PRODUCTS TO IMPORT ({pendingProducts.length})
                          </div>
                          <div style={{ display: "grid", gap: 16 }}>
                            {pendingProducts.map((product, idx) => (
                              <div key={idx} style={{ border: "1px solid #e6e6e6", background: "#fafafa", padding: 16 }}>
                                <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                                  {/* Images */}
                                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", width: 200, flexShrink: 0 }}>
                                    {product.images?.length > 0 ? (
                                      product.images.map((img, i) => (
                                        <img
                                          key={i}
                                          src={img}
                                          alt={`${product.name} ${i + 1}`}
                                          style={{
                                            width: i === 0 ? 200 : 60,
                                            height: i === 0 ? 200 : 60,
                                            objectFit: "cover",
                                            border: "1px solid #e6e6e6",
                                          }}
                                        />
                                      ))
                                    ) : (
                                      <div style={{ width: 200, height: 200, background: "#eee", display: "flex", alignItems: "center", justifyContent: "center", color: "#999", fontSize: 11 }}>
                                        No images
                                      </div>
                                    )}
                                  </div>

                                  {/* Product Info */}
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{product.name}</div>

                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 12 }}>
                                      <div>
                                        <div style={{ fontSize: 9, color: "#999", textTransform: "uppercase" }}>Price</div>
                                        <div style={{ fontSize: 13, fontWeight: 600 }}>
                                          {product.currency === "EUR" ? "€" : product.currency === "GBP" ? "£" : "$"}{product.price}
                                        </div>
                                      </div>
                                      <div>
                                        <div style={{ fontSize: 9, color: "#999", textTransform: "uppercase" }}>Category</div>
                                        <div style={{ fontSize: 12 }}>{product.category || "—"}</div>
                                      </div>
                                      <div>
                                        <div style={{ fontSize: 9, color: "#999", textTransform: "uppercase" }}>Slug</div>
                                        <div style={{ fontSize: 12, fontFamily: "monospace" }}>{product.slug || "—"}</div>
                                      </div>
                                    </div>

                                    {/* Description */}
                                    <div style={{ marginBottom: 12 }}>
                                      <div style={{ fontSize: 9, color: "#999", textTransform: "uppercase", marginBottom: 4 }}>Description</div>
                                      <div style={{ fontSize: 11, color: "#333", lineHeight: 1.5, whiteSpace: "pre-wrap", maxHeight: 100, overflow: "auto", padding: 8, background: "#fff", border: "1px solid #e6e6e6" }}>
                                        {product.description || "— not filled —"}
                                      </div>
                                    </div>

                                    {/* Sizes */}
                                    <div style={{ marginBottom: 12 }}>
                                      <div style={{ fontSize: 9, color: "#999", textTransform: "uppercase", marginBottom: 4 }}>Sizes ({product.sizes?.length || 0})</div>
                                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                        {product.sizes?.length > 0 ? product.sizes.map((s, i) => (
                                          <div key={i} style={{
                                            padding: "4px 8px",
                                            background: s.in_stock ? "#d1fae5" : "#fee2e2",
                                            border: `1px solid ${s.in_stock ? "#10b981" : "#ef4444"}`,
                                            fontSize: 10,
                                            fontWeight: 600,
                                          }}>
                                            {s.size} ({s.quantity})
                                          </div>
                                        )) : <span style={{ fontSize: 11, color: "#999" }}>— no sizes —</span>}
                                      </div>
                                    </div>

                                    {/* Additional Info */}
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                      <div>
                                        <div style={{ fontSize: 9, color: "#999", textTransform: "uppercase", marginBottom: 2 }}>Size Chart URL</div>
                                        <div style={{ fontSize: 10, color: product.sizeChartUrl ? "#333" : "#ccc" }}>
                                          {product.sizeChartUrl || "— not filled —"}
                                        </div>
                                      </div>
                                      <div>
                                        <div style={{ fontSize: 9, color: "#999", textTransform: "uppercase", marginBottom: 2 }}>Shipping Info</div>
                                        <div style={{ fontSize: 10, color: product.shippingInfo ? "#333" : "#ccc" }}>
                                          {product.shippingInfo || "— not filled —"}
                                        </div>
                                      </div>
                                      <div>
                                        <div style={{ fontSize: 9, color: "#999", textTransform: "uppercase", marginBottom: 2 }}>Care Instructions</div>
                                        <div style={{ fontSize: 10, color: product.careInstructions ? "#333" : "#ccc" }}>
                                          {product.careInstructions || "— not filled —"}
                                        </div>
                                      </div>
                                      <div>
                                        <div style={{ fontSize: 9, color: "#999", textTransform: "uppercase", marginBottom: 2 }}>Instagram</div>
                                        <div style={{ fontSize: 10, color: product.instagramUrl ? "#333" : "#ccc" }}>
                                          {product.instagramUrl || "— not filled —"}
                                        </div>
                                      </div>
                                      <div>
                                        <div style={{ fontSize: 9, color: "#999", textTransform: "uppercase", marginBottom: 2 }}>Phone</div>
                                        <div style={{ fontSize: 10, color: product.phoneNumber ? "#333" : "#ccc" }}>
                                          {product.phoneNumber || "— not filled —"}
                                        </div>
                                      </div>
                                      <div>
                                        <div style={{ fontSize: 9, color: "#999", textTransform: "uppercase", marginBottom: 2 }}>Tags</div>
                                        <div style={{ fontSize: 10, color: product.tags?.length ? "#333" : "#ccc" }}>
                                          {product.tags?.length ? product.tags.join(", ") : "— no tags —"}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      {seller.status === "pending" && (
                        <div style={{ display: "flex", gap: 8, marginTop: 20, paddingTop: 20, borderTop: "1px solid #e6e6e6" }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleApproveSeller(seller.id, seller); }}
                            style={{
                              flex: 1,
                              padding: "12px 16px",
                              background: "#10b981",
                              color: "#fff",
                              border: "none",
                              cursor: "pointer",
                              fontWeight: 700,
                              fontSize: 11,
                              letterSpacing: 0.5,
                              textTransform: "uppercase",
                            }}
                          >
                            APPROVE & CREATE BRAND
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRejectSeller(seller.id); }}
                            style={{
                              flex: 1,
                              padding: "12px 16px",
                              background: "#ef4444",
                              color: "#fff",
                              border: "none",
                              cursor: "pointer",
                              fontWeight: 700,
                              fontSize: 11,
                              letterSpacing: 0.5,
                              textTransform: "uppercase",
                            }}
                          >
                            REJECT
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
              })}
            </div>
          )}
        </>
      )}

      {/* Products Tab */}
      {activeTab === "products" && (
        <>
      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => setFilter("pending")}
          style={{
            padding: "8px 16px",
            background: filter === "pending" ? "#000" : "#fff",
            color: filter === "pending" ? "#fff" : "#000",
            border: "1px solid #e6e6e6",
            cursor: "pointer",
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          PENDING ({pendingProducts.length})
        </button>
        <button
          onClick={() => setFilter("all")}
          style={{
            padding: "8px 16px",
            background: filter === "all" ? "#000" : "#fff",
            color: filter === "all" ? "#fff" : "#000",
            border: "1px solid #e6e6e6",
            cursor: "pointer",
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          ALL PRODUCTS ({products.length})
        </button>
      </div>

      {/* Products List */}
      {products.length === 0 ? (
        <div
          style={{
            padding: 60,
            textAlign: "center",
            background: "#fff",
            border: "1px solid #e6e6e6",
            color: "#CCCCCC",
          }}
        >
          <p style={{ fontSize: 12, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
            NO {filter === "pending" ? "PENDING" : ""} PRODUCTS
          </p>
          <p style={{ fontSize: 11, letterSpacing: 0.5 }}>
            {filter === "pending" && "All products have been reviewed"}
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {products.map((product) => {
            const mainImage = product.product_images?.find((img) => img.is_main);
            const isRejecting = rejectingProduct === product.id;

            return (
              <div
                key={product.id}
                style={{
                  padding: 20,
                  background: "#fff",
                  border: "1px solid #e6e6e6",
                  display: "grid",
                  gap: 16,
                }}
              >
                <div style={{ display: "flex", gap: 16 }}>
                  {/* Product Image */}
                  {mainImage ? (
                    <img
                      src={mainImage.image_url}
                      alt={product.name}
                      style={{
                        width: 120,
                        height: 160,
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 120,
                        height: 160,
                        background: "#f0f0f0",
                      }}
                    />
                  )}

                  {/* Product Info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        {product.name}
                      </h3>
                      <span
                        style={{
                          padding: "4px 10px",
                          background: product.status === "pending" ? "#fef3c7" : "#e5e7eb",
                          color: product.status === "pending" ? "#f59e0b" : "#6b7280",
                          fontSize: 9,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        {product.status.toUpperCase()}
                      </span>
                    </div>

                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                      {product.currency} {product.price.toFixed(2)}
                    </div>

                    {product.brand && (
                      <div style={{ fontSize: 10, color: "#666", marginBottom: 4, letterSpacing: 0.3 }}>
                        Brand: {product.brand.name}
                      </div>
                    )}

                    {product.category && (
                      <div style={{ fontSize: 10, color: "#666", marginBottom: 8, letterSpacing: 0.3 }}>
                        Category: {product.category}
                      </div>
                    )}

                    {product.description && (
                      <div style={{ fontSize: 10, color: "#444", marginTop: 12, lineHeight: 1.4 }}>
                        {product.description}
                      </div>
                    )}
                  </div>
                </div>

                {/* Rejection Reason Input */}
                {isRejecting && (
                  <div
                    style={{
                      padding: 12,
                      background: "#fef3c7",
                      border: "1px solid #fde68a",
                    }}
                  >
                    <label style={{ display: "block", fontSize: 10, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
                      REJECTION REASON
                    </label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Explain why this product is being rejected..."
                      rows={3}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        border: "1px solid #e6e6e6",
                        fontSize: 11,
                        resize: "vertical",
                      }}
                    />
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: "flex", gap: 8 }}>
                  {product.status === "pending" && !isRejecting && (
                    <>
                      <button
                        onClick={() => handleApprove(product.id)}
                        style={{
                          flex: 1,
                          padding: "10px 16px",
                          background: "#10b981",
                          color: "#fff",
                          border: "none",
                          cursor: "pointer",
                          fontWeight: 700,
                          fontSize: 10,
                          letterSpacing: 0.5,
                          textTransform: "uppercase",
                        }}
                      >
                        ✓ APPROVE
                      </button>
                      <button
                        onClick={() => setRejectingProduct(product.id)}
                        style={{
                          flex: 1,
                          padding: "10px 16px",
                          background: "#ef4444",
                          color: "#fff",
                          border: "none",
                          cursor: "pointer",
                          fontWeight: 700,
                          fontSize: 10,
                          letterSpacing: 0.5,
                          textTransform: "uppercase",
                        }}
                      >
                        ✕ REJECT
                      </button>
                      <button
                        onClick={() => router.push(`/account/moderation/products/${product.id}/edit`)}
                        style={{
                          padding: "10px 16px",
                          background: "#fff",
                          color: "#000",
                          border: "1px solid #e6e6e6",
                          cursor: "pointer",
                          fontWeight: 700,
                          fontSize: 10,
                          letterSpacing: 0.5,
                          textTransform: "uppercase",
                        }}
                      >
                        ✎ EDIT
                      </button>
                    </>
                  )}

                  {product.status !== "pending" && !isRejecting && (
                    <button
                      onClick={() => router.push(`/account/moderation/products/${product.id}/edit`)}
                      style={{
                        padding: "10px 16px",
                        background: "#000",
                        color: "#fff",
                        border: "none",
                        cursor: "pointer",
                        fontWeight: 700,
                        fontSize: 10,
                        letterSpacing: 0.5,
                        textTransform: "uppercase",
                      }}
                    >
                      ✎ EDIT PRODUCT
                    </button>
                  )}

                  {isRejecting && (
                    <>
                      <button
                        onClick={() => {
                          setRejectingProduct(null);
                          setRejectionReason("");
                        }}
                        style={{
                          flex: 1,
                          padding: "10px 16px",
                          background: "#fff",
                          color: "#000",
                          border: "1px solid #e6e6e6",
                          cursor: "pointer",
                          fontWeight: 700,
                          fontSize: 10,
                          letterSpacing: 0.5,
                          textTransform: "uppercase",
                        }}
                      >
                        CANCEL
                      </button>
                      <button
                        onClick={() => handleReject(product.id)}
                        style={{
                          flex: 1,
                          padding: "10px 16px",
                          background: "#ef4444",
                          color: "#fff",
                          border: "none",
                          cursor: "pointer",
                          fontWeight: 700,
                          fontSize: 10,
                          letterSpacing: 0.5,
                          textTransform: "uppercase",
                        }}
                      >
                        CONFIRM REJECTION
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
        </>
      )}
    </div>
  );
}
