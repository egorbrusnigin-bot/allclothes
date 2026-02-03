"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { isAdmin } from "../../lib/auth";

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

export default function ModerationPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminCheck, setAdminCheck] = useState(false);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [rejectingProduct, setRejectingProduct] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    checkAdmin();
  }, []);

  useEffect(() => {
    if (adminCheck) {
      loadProducts();
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

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
            PRODUCT MODERATION
          </h1>
          <p style={{ fontSize: 11, color: "#666", letterSpacing: 0.3 }}>
            Review and approve products from sellers
          </p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
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

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid #e6e6e6", paddingBottom: 8 }}>
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
          PENDING ({products.filter((p) => p.status === "pending").length})
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
    </div>
  );
}
