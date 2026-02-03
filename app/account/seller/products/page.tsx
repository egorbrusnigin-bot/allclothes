"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import Link from "next/link";

interface Product {
  id: string;
  slug: string;
  name: string;
  price: number;
  currency: string;
  status: "draft" | "pending" | "approved" | "rejected";
  rejection_reason?: string;
  brand_id: string;
  brand?: {
    name: string;
  };
  product_images?: Array<{
    image_url: string;
    is_main: boolean;
  }>;
}

const STATUS_CONFIG = {
  draft: { label: "Draft", color: "#6b7280", bg: "#f3f4f6" },
  pending: { label: "Pending Review", color: "#f59e0b", bg: "#fef3c7" },
  approved: { label: "Approved", color: "#10b981", bg: "#d1fae5" },
  rejected: { label: "Rejected", color: "#ef4444", bg: "#fee2e2" },
};

export default function SellerProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "draft" | "pending" | "approved" | "rejected">("all");

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    if (!supabase) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/?login=1");
        return;
      }

      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          brand:brands(name),
          product_images(image_url, is_main)
        `)
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading products:", error);
      } else {
        setProducts(data || []);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitForReview(productId: string) {
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from("products")
        .update({
          status: "pending",
          submitted_at: new Date().toISOString(),
        })
        .eq("id", productId);

      if (error) {
        alert(`Error: ${error.message}`);
      } else {
        loadProducts();
      }
    } catch (error) {
      console.error("Error submitting product:", error);
    }
  }

  async function handleDelete(productId: string) {
    if (!confirm("Delete this product?")) return;
    if (!supabase) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", productId)
        .eq("owner_id", user.id);

      if (error) {
        alert(`Error: ${error.message}`);
      } else {
        loadProducts();
      }
    } catch (error) {
      console.error("Error deleting product:", error);
    }
  }

  const filteredProducts = products.filter(
    (p) => filter === "all" || p.status === filter
  );

  const counts = {
    all: products.length,
    draft: products.filter((p) => p.status === "draft").length,
    pending: products.filter((p) => p.status === "pending").length,
    approved: products.filter((p) => p.status === "approved").length,
    rejected: products.filter((p) => p.status === "rejected").length,
  };

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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
            MY PRODUCTS
          </h1>
          <p style={{ fontSize: 11, color: "#666", letterSpacing: 0.3 }}>
            Manage your product catalog
          </p>
        </div>
        <Link
          href="/account/seller/products/new"
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
            textDecoration: "none",
            display: "inline-block",
          }}
        >
          + CREATE PRODUCT
        </Link>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid #e6e6e6", paddingBottom: 8 }}>
        {(["all", "draft", "pending", "approved", "rejected"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "8px 16px",
              background: filter === f ? "#000" : "#fff",
              color: filter === f ? "#fff" : "#000",
              border: "1px solid #e6e6e6",
              cursor: "pointer",
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            {f.toUpperCase()} ({counts[f]})
          </button>
        ))}
      </div>

      {/* Products List */}
      {filteredProducts.length === 0 ? (
        <div
          style={{
            padding: 60,
            textAlign: "center",
            background: "#fff",
            border: "1px solid #e6e6e6",
            color: "#CCCCCC",
          }}
        >
          <p style={{ fontSize: 12, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>
            {filter === "all" ? "NO PRODUCTS YET" : `NO ${filter.toUpperCase()} PRODUCTS`}
          </p>
          <p style={{ fontSize: 11, letterSpacing: 0.5 }}>
            {filter === "all" && "Create your first product to get started"}
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {filteredProducts.map((product) => {
            const mainImage = product.product_images?.find((img) => img.is_main);
            const statusConfig = STATUS_CONFIG[product.status];

            return (
              <div
                key={product.id}
                style={{
                  padding: 20,
                  background: "#fff",
                  border: "1px solid #e6e6e6",
                  display: "flex",
                  gap: 16,
                }}
              >
                {/* Product Image */}
                {mainImage ? (
                  <img
                    src={mainImage.image_url}
                    alt={product.name}
                    style={{
                      width: 100,
                      height: 133,
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 100,
                      height: 133,
                      background: "#f0f0f0",
                    }}
                  />
                )}

                {/* Product Info */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      {product.name}
                    </div>
                    <span
                      style={{
                        padding: "4px 10px",
                        background: statusConfig.bg,
                        color: statusConfig.color,
                        fontSize: 9,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      {statusConfig.label.toUpperCase()}
                    </span>
                  </div>

                  <div style={{ fontSize: 12, color: "#000", fontWeight: 700, marginBottom: 4 }}>
                    {product.currency} {product.price.toFixed(2)}
                  </div>

                  {product.brand && (
                    <div style={{ fontSize: 10, color: "#999", letterSpacing: 0.3 }}>
                      Brand: {product.brand.name}
                    </div>
                  )}

                  {product.status === "rejected" && product.rejection_reason && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: 10,
                        background: "#fee",
                        border: "1px solid #fcc",
                        fontSize: 10,
                        color: "#dc2626",
                        lineHeight: 1.4,
                      }}
                    >
                      <strong>Rejection Reason:</strong> {product.rejection_reason}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, justifyContent: "center" }}>
                  {product.status === "draft" && (
                    <button
                      onClick={() => handleSubmitForReview(product.id)}
                      style={{
                        padding: "8px 16px",
                        background: "#10b981",
                        color: "#fff",
                        border: "none",
                        cursor: "pointer",
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      SUBMIT
                    </button>
                  )}

                  <Link
                    href={`/account/seller/products/${product.id}/edit`}
                    style={{
                      padding: "8px 16px",
                      background: "#fff",
                      color: "#000",
                      border: "1px solid #e6e6e6",
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      textDecoration: "none",
                      textAlign: "center",
                    }}
                  >
                    EDIT
                  </Link>

                  {(product.status === "draft" || product.status === "rejected") && (
                    <button
                      onClick={() => handleDelete(product.id)}
                      style={{
                        padding: "8px 16px",
                        background: "#fff",
                        color: "#dc2626",
                        border: "1px solid #fee",
                        cursor: "pointer",
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      DELETE
                    </button>
                  )}

                  {product.status === "approved" && (
                    <Link
                      href={`/product/${product.slug}`}
                      style={{
                        padding: "8px 16px",
                        background: "#f0f0f0",
                        color: "#000",
                        border: "1px solid #e6e6e6",
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        textDecoration: "none",
                        textAlign: "center",
                      }}
                    >
                      VIEW LIVE
                    </Link>
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
