"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import Link from "next/link";

interface Brand {
  id: string;
  slug: string;
  name: string;
  country: string;
  description?: string;
  logo_url?: string;
  status: string;
}

export default function SellerBrandsPage() {
  const router = useRouter();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    country: "",
    description: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
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
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading brands:", error);
      } else {
        setBrands(data || []);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(brand: Brand) {
    setEditingBrand(brand);
    setFormData({
      name: brand.name,
      slug: brand.slug,
      country: brand.country,
      description: brand.description || "",
    });
    setImagePreview(brand.logo_url || "");
    setShowForm(true);
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
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

      setStatus("Saving...");

      let logoUrl = editingBrand?.logo_url || "";

      // Upload image if new one is selected
      if (imageFile) {
        const fileExt = imageFile.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("brand-logos")
          .upload(fileName, imageFile);

        if (uploadError) {
          setStatus(`Upload error: ${uploadError.message}`);
          return;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("brand-logos").getPublicUrl(fileName);

        logoUrl = publicUrl;
      }

      if (editingBrand) {
        // Update existing brand
        const { error } = await supabase
          .from("brands")
          .update({
            name: formData.name,
            slug: formData.slug,
            country: formData.country,
            description: formData.description,
            logo_url: logoUrl,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingBrand.id)
          .eq("owner_id", user.id);

        if (error) {
          setStatus(`Error: ${error.message}`);
          return;
        }
      } else {
        // Create new brand
        const { error } = await supabase.from("brands").insert({
          name: formData.name,
          slug: formData.slug,
          country: formData.country,
          description: formData.description,
          logo_url: logoUrl,
          owner_id: user.id,
          status: "approved",
        });

        if (error) {
          setStatus(`Error: ${error.message}`);
          return;
        }
      }

      setStatus("Saved successfully!");
      setShowForm(false);
      setEditingBrand(null);
      setFormData({ name: "", slug: "", country: "", description: "" });
      setImageFile(null);
      setImagePreview("");
      loadBrands();
    } catch (error) {
      console.error("Error saving brand:", error);
      setStatus("Error saving brand");
    }
  }

  async function handleDelete(brand: Brand) {
    if (!confirm(`Delete brand "${brand.name}"?`)) return;
    if (!supabase) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("brands")
        .delete()
        .eq("id", brand.id)
        .eq("owner_id", user.id);

      if (error) {
        alert(`Error: ${error.message}`);
      } else {
        loadBrands();
      }
    } catch (error) {
      console.error("Error deleting brand:", error);
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
            MY BRANDS
          </h1>
          <p style={{ fontSize: 11, color: "#666", letterSpacing: 0.3 }}>
            Manage your brand profiles
          </p>
        </div>
        <button
          onClick={() => {
            setEditingBrand(null);
            setFormData({ name: "", slug: "", country: "", description: "" });
            setImageFile(null);
            setImagePreview("");
            setShowForm(true);
          }}
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
          + CREATE BRAND
        </button>
      </div>

      {/* Brand Form */}
      {showForm && (
        <div
          style={{
            background: "#fff",
            border: "1px solid #e6e6e6",
            padding: 24,
          }}
        >
          <h2 style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>
            {editingBrand ? "EDIT BRAND" : "CREATE NEW BRAND"}
          </h2>

          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
                BRAND NAME *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #e6e6e6",
                  fontSize: 13,
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
                SLUG * (URL-FRIENDLY)
              </label>
              <input
                type="text"
                required
                value={formData.slug}
                onChange={(e) =>
                  setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })
                }
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #e6e6e6",
                  fontSize: 13,
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
                COUNTRY
              </label>
              <input
                type="text"
                value={formData.country}
                onChange={(e) =>
                  setFormData({ ...formData, country: e.target.value })
                }
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #e6e6e6",
                  fontSize: 13,
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
                DESCRIPTION
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={4}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #e6e6e6",
                  fontSize: 13,
                  resize: "vertical",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
                LOGO
              </label>
              {imagePreview && (
                <img
                  src={imagePreview}
                  alt="Preview"
                  style={{
                    width: 200,
                    height: 200,
                    objectFit: "cover",
                    marginBottom: 12,
                  }}
                />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                style={{ fontSize: 12 }}
              />
            </div>

            {status && (
              <div
                style={{
                  padding: 10,
                  background: status.includes("Error") ? "#fee" : "#efe",
                  border: `1px solid ${status.includes("Error") ? "#fcc" : "#cfc"}`,
                  fontSize: 11,
                }}
              >
                {status}
              </div>
            )}

            <div style={{ display: "flex", gap: 12 }}>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingBrand(null);
                  setStatus("");
                }}
                style={{
                  flex: 1,
                  padding: "12px 20px",
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
                CANCEL
              </button>
              <button
                type="submit"
                style={{
                  flex: 1,
                  padding: "12px 20px",
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
                {editingBrand ? "UPDATE BRAND" : "CREATE BRAND"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Brands List */}
      {brands.length === 0 ? (
        <div
          style={{
            padding: 60,
            textAlign: "center",
            background: "#fff",
            border: "1px solid #e6e6e6",
            color: "#CCCCCC",
          }}
        >
          <p style={{ fontSize: 12, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>NO BRANDS YET</p>
          <p style={{ fontSize: 11, letterSpacing: 0.5 }}>Create your first brand to get started</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {brands.map((brand) => (
            <div
              key={brand.id}
              style={{
                padding: 20,
                background: "#fff",
                border: "1px solid #e6e6e6",
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}
            >
              {brand.logo_url ? (
                <img
                  src={brand.logo_url}
                  alt={brand.name}
                  style={{
                    width: 80,
                    height: 80,
                    objectFit: "cover",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 80,
                    height: 80,
                    background: "#f0f0f0",
                  }}
                />
              )}

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  {brand.name}
                </div>
                <div style={{ fontSize: 10, color: "#666", letterSpacing: 0.3 }}>
                  {brand.country || "No country specified"}
                </div>
                {brand.description && (
                  <div style={{ fontSize: 10, color: "#999", marginTop: 8, lineHeight: 1.4 }}>
                    {brand.description}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => handleEdit(brand)}
                  style={{
                    padding: "8px 16px",
                    background: "#fff",
                    border: "1px solid #e6e6e6",
                    cursor: "pointer",
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  EDIT
                </button>
                <button
                  onClick={() => handleDelete(brand)}
                  style={{
                    padding: "8px 16px",
                    background: "#fff",
                    border: "1px solid #fee",
                    cursor: "pointer",
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    color: "#dc2626",
                  }}
                >
                  DELETE
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
