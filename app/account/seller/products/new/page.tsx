"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

interface Brand {
  id: string;
  name: string;
}

export default function NewProductPage() {
  const router = useRouter();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [formData, setFormData] = useState({
    brand_id: "",
    name: "",
    slug: "",
    price: "",
    currency: "EUR",
    category: "",
    description: "",
    details: "",
    model_info: "",
  });
  const [status, setStatus] = useState("");

  useEffect(() => {
    loadBrands();
  }, []);

  async function loadBrands() {
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
        .from("brands")
        .select("id, name")
        .eq("owner_id", user.id);

      if (error) {
        console.error("Error loading brands:", error);
      } else {
        setBrands(data || []);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setStatus("Please log in");
        return;
      }

      setStatus("Creating product...");

      const { data, error } = await supabase
        .from("products")
        .insert({
          brand_id: formData.brand_id,
          name: formData.name,
          slug: formData.slug,
          price: parseFloat(formData.price),
          currency: formData.currency,
          category: formData.category,
          description: formData.description,
          details: formData.details,
          model_info: formData.model_info,
          owner_id: user.id,
          status: "draft",
        })
        .select()
        .single();

      if (error) {
        setStatus(`Error: ${error.message}`);
        return;
      }

      setStatus("Product created!");
      setTimeout(() => {
        router.push(`/account/seller/products/${data.id}/edit`);
      }, 1000);
    } catch (error) {
      console.error("Error creating product:", error);
      setStatus("Error creating product");
    }
  }

  if (brands.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>
          Create a Brand First
        </h2>
        <p style={{ fontSize: 14, color: "#666", marginBottom: 24 }}>
          You need to create at least one brand before adding products
        </p>
        <button
          onClick={() => router.push("/account/seller/brands")}
          style={{
            padding: "12px 24px",
            background: "#000",
            color: "#fff",
            border: "none",
            borderRadius: 12,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          Go to Brands
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
        Create New Product
      </h1>
      <p style={{ fontSize: 14, color: "#666", marginBottom: 24 }}>
        Add a new product to your catalog (saved as draft)
      </p>

      <form
        onSubmit={handleSubmit}
        style={{
          background: "#fff",
          border: "1px solid #e6e6e6",
          borderRadius: 16,
          padding: 24,
          display: "grid",
          gap: 16,
        }}
      >
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            Brand *
          </label>
          <select
            required
            value={formData.brand_id}
            onChange={(e) =>
              setFormData({ ...formData, brand_id: e.target.value })
            }
            style={{
              width: "100%",
              padding: "12px 16px",
              border: "1px solid #e6e6e6",
              borderRadius: 12,
              fontSize: 15,
            }}
          >
            <option value="">Select a brand</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            Product Name *
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            style={{
              width: "100%",
              padding: "12px 16px",
              border: "1px solid #e6e6e6",
              borderRadius: 12,
              fontSize: 15,
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            Slug * (URL-friendly, e.g., "red-hoodie")
          </label>
          <input
            type="text"
            required
            value={formData.slug}
            onChange={(e) =>
              setFormData({
                ...formData,
                slug: e.target.value.toLowerCase().replace(/\s+/g, "-"),
              })
            }
            style={{
              width: "100%",
              padding: "12px 16px",
              border: "1px solid #e6e6e6",
              borderRadius: 12,
              fontSize: 15,
            }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              Price *
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              style={{
                width: "100%",
                padding: "12px 16px",
                border: "1px solid #e6e6e6",
                borderRadius: 12,
                fontSize: 15,
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              Currency
            </label>
            <select
              value={formData.currency}
              onChange={(e) =>
                setFormData({ ...formData, currency: e.target.value })
              }
              style={{
                width: "100%",
                padding: "12px 16px",
                border: "1px solid #e6e6e6",
                borderRadius: 12,
                fontSize: 15,
              }}
            >
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
        </div>

        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            Category
          </label>
          <input
            type="text"
            placeholder="e.g., hoodie, t-shirt, pants"
            value={formData.category}
            onChange={(e) =>
              setFormData({ ...formData, category: e.target.value })
            }
            style={{
              width: "100%",
              padding: "12px 16px",
              border: "1px solid #e6e6e6",
              borderRadius: 12,
              fontSize: 15,
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            Description
          </label>
          <textarea
            rows={4}
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            style={{
              width: "100%",
              padding: "12px 16px",
              border: "1px solid #e6e6e6",
              borderRadius: 12,
              fontSize: 15,
              resize: "vertical",
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            Details (e.g., material, weight)
          </label>
          <textarea
            rows={3}
            value={formData.details}
            onChange={(e) =>
              setFormData({ ...formData, details: e.target.value })
            }
            style={{
              width: "100%",
              padding: "12px 16px",
              border: "1px solid #e6e6e6",
              borderRadius: 12,
              fontSize: 15,
              resize: "vertical",
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            Model Info
          </label>
          <input
            type="text"
            placeholder="e.g., Model is 185cm and wears size L"
            value={formData.model_info}
            onChange={(e) =>
              setFormData({ ...formData, model_info: e.target.value })
            }
            style={{
              width: "100%",
              padding: "12px 16px",
              border: "1px solid #e6e6e6",
              borderRadius: 12,
              fontSize: 15,
            }}
          />
        </div>

        {status && (
          <div
            style={{
              padding: 12,
              background: status.includes("Error") ? "#fee" : "#efe",
              border: `1px solid ${status.includes("Error") ? "#fcc" : "#cfc"}`,
              borderRadius: 12,
              fontSize: 13,
            }}
          >
            {status}
          </div>
        )}

        <div style={{ display: "flex", gap: 12 }}>
          <button
            type="button"
            onClick={() => router.push("/account/seller/products")}
            style={{
              flex: 1,
              padding: "14px 24px",
              background: "#fff",
              color: "#000",
              border: "1px solid #e6e6e6",
              borderRadius: 12,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            style={{
              flex: 2,
              padding: "14px 24px",
              background: "#000",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Create Product (Draft)
          </button>
        </div>

        <div
          style={{
            padding: 12,
            background: "#f9f9f9",
            borderRadius: 12,
            fontSize: 12,
            color: "#666",
          }}
        >
          Note: You can add images and sizes after creating the product by editing it.
        </div>
      </form>
    </div>
  );
}
