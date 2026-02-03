"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "../../../../../lib/supabase";
import { isAdmin } from "../../../../../lib/auth";
import Link from "next/link";

export default function EditBrandPage() {
  const router = useRouter();
  const params = useParams();
  const brandId = params.id as string;

  const [adminCheck, setAdminCheck] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");

  useEffect(() => {
    checkAdmin();
    loadBrand();
  }, []);

  async function checkAdmin() {
    const admin = await isAdmin();
    if (!admin) {
      router.push("/account");
      return;
    }
    setAdminCheck(true);
  }

  async function loadBrand() {
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from("brands")
        .select("*")
        .eq("id", brandId)
        .single();

      if (error || !data) {
        alert("Brand not found");
        router.push("/account/moderation/brands");
        return;
      }

      setName(data.name || "");
      setSlug(data.slug || "");
      setCity(data.city || "");
      setCountry(data.country || "");
      setDescription(data.description || "");
      setLogoUrl(data.logo_url || "");
      setLatitude(data.latitude?.toString() || "");
      setLongitude(data.longitude?.toString() || "");
    } catch (error) {
      console.error("Error loading brand:", error);
    } finally {
      setLoading(false);
    }
  }

  async function uploadLogo(file: File): Promise<string | null> {
    if (!supabase) return null;
    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${slug}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("brand-logos")
        .upload(fileName, file);

      if (uploadError) {
        alert(`Upload error: ${uploadError.message}`);
        return null;
      }

      const { data: urlData } = supabase.storage
        .from("brand-logos")
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error) {
      console.error("Error uploading logo:", error);
      return null;
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setSaving(true);

    try {
      // Auto-geocode if no coordinates but city/country provided
      let finalLat = latitude ? parseFloat(latitude) : null;
      let finalLng = longitude ? parseFloat(longitude) : null;
      if (!finalLat && !finalLng && (city.trim() || country.trim())) {
        try {
          const q = [city.trim(), country.trim()].filter(Boolean).join(", ");
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
            { headers: { "User-Agent": "allclothes-site" } }
          );
          const data = await res.json();
          if (data && data[0]) {
            finalLat = parseFloat(data[0].lat);
            finalLng = parseFloat(data[0].lon);
            setLatitude(data[0].lat);
            setLongitude(data[0].lon);
            alert(`Координаты найдены: ${data[0].lat}, ${data[0].lon}`);
          } else {
            alert("Геокодирование: результат не найден для \"" + q + "\"");
          }
        } catch (geoErr) {
          console.warn("Geocoding failed", geoErr);
          alert("Геокодирование не удалось. Проверьте консоль.");
        }
      }

      const { error } = await supabase
        .from("brands")
        .update({
          name: name.trim(),
          city: city.trim() || null,
          country: country.trim() || null,
          description: description.trim() || null,
          logo_url: logoUrl.trim() || null,
          latitude: finalLat,
          longitude: finalLng,
        })
        .eq("id", brandId);

      if (error) {
        alert(`Error: ${error.message}`);
      } else {
        router.push("/account/moderation/brands");
      }
    } catch (error) {
      console.error("Error saving brand:", error);
      alert("Failed to save brand");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !adminCheck) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#666" }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {/* Header */}
      <div>
        <Link
          href="/account/moderation/brands"
          style={{
            display: "inline-block",
            marginBottom: 16,
            fontSize: 14,
            color: "#666",
            textDecoration: "none",
          }}
        >
          ← Back to Brands
        </Link>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
          Edit Brand
        </h1>
        <p style={{ fontSize: 14, color: "#666" }}>
          Slug: <code>{slug}</code>
        </p>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        style={{
          background: "#fff",
          border: "1px solid #e6e6e6",
          borderRadius: 16,
          padding: 24,
          display: "grid",
          gap: 20,
        }}
      >
        {/* Logo Preview */}
        {logoUrl && (
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              Logo Preview
            </label>
            <div style={{
              width: 120,
              height: 120,
              background: "#f5f5f5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}>
              <img
                src={logoUrl}
                alt={name}
                style={{ width: "70%", height: "70%", objectFit: "contain" }}
              />
            </div>
          </div>
        )}

        {/* Brand Name */}
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            Brand Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "12px 16px",
              border: "1px solid #e6e6e6",
              borderRadius: 12,
              fontSize: 14,
            }}
          />
        </div>

        {/* City and Country */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              City
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Vienna"
              style={{
                width: "100%",
                padding: "12px 16px",
                border: "1px solid #e6e6e6",
                borderRadius: 12,
                fontSize: 14,
              }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              Country
            </label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="e.g. Austria"
              style={{
                width: "100%",
                padding: "12px 16px",
                border: "1px solid #e6e6e6",
                borderRadius: 12,
                fontSize: 14,
              }}
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brand description..."
            rows={3}
            style={{
              width: "100%",
              padding: "12px 16px",
              border: "1px solid #e6e6e6",
              borderRadius: 12,
              fontSize: 14,
              resize: "vertical",
            }}
          />
        </div>

        {/* Logo */}
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            Logo URL
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
              style={{
                flex: 1,
                padding: "12px 16px",
                border: "1px solid #e6e6e6",
                borderRadius: 12,
                fontSize: 14,
              }}
            />
            <label
              style={{
                padding: "12px 20px",
                background: uploading ? "#999" : "#000",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                cursor: uploading ? "not-allowed" : "pointer",
                fontWeight: 600,
                fontSize: 14,
                whiteSpace: "nowrap",
              }}
            >
              {uploading ? "Uploading..." : "Upload"}
              <input
                type="file"
                accept="image/*"
                disabled={uploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const url = await uploadLogo(file);
                    if (url) setLogoUrl(url);
                  }
                  e.target.value = "";
                }}
                style={{ display: "none" }}
              />
            </label>
          </div>
        </div>

        {/* Map Coordinates */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              Latitude
            </label>
            <input
              type="number"
              step="0.0001"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              placeholder="e.g. 48.2082"
              style={{
                width: "100%",
                padding: "12px 16px",
                border: "1px solid #e6e6e6",
                borderRadius: 12,
                fontSize: 14,
              }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              Longitude
            </label>
            <input
              type="number"
              step="0.0001"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              placeholder="e.g. 16.3738"
              style={{
                width: "100%",
                padding: "12px 16px",
                border: "1px solid #e6e6e6",
                borderRadius: 12,
                fontSize: 14,
              }}
            />
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#999", marginTop: -12 }}>
          Map coordinates — brand shows on /map when both are filled in.
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={saving}
          style={{
            padding: "14px 24px",
            background: saving ? "#666" : "#000",
            color: "#fff",
            border: "none",
            borderRadius: 12,
            cursor: saving ? "not-allowed" : "pointer",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
