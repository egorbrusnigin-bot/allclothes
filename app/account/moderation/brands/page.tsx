"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { isAdmin } from "../../../lib/auth";
import { getCountryFlag } from "../../../lib/countryFlags";
import Link from "next/link";

interface Brand {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  city: string | null;
  logo_url: string | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
}

export default function BrandsManagementPage() {
  const router = useRouter();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminCheck, setAdminCheck] = useState(false);

  useEffect(() => {
    checkAdmin();
  }, []);

  useEffect(() => {
    if (adminCheck) {
      loadBrands();
    }
  }, [adminCheck]);

  async function checkAdmin() {
    const admin = await isAdmin();
    if (!admin) {
      router.push("/account");
      return;
    }
    setAdminCheck(true);
  }

  async function loadBrands() {
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from("brands")
        .select("*")
        .order("name", { ascending: true });

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

  if (loading || !adminCheck) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#666" }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div>
        <Link
          href="/account/moderation"
          style={{
            display: "inline-block",
            marginBottom: 16,
            fontSize: 14,
            color: "#666",
            textDecoration: "none",
          }}
        >
          ← Back to Moderation
        </Link>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
          Brands Management
        </h1>
        <p style={{ fontSize: 14, color: "#666" }}>
          Edit brand details, logos, and map locations
        </p>
      </div>

      {brands.length === 0 ? (
        <div
          style={{
            padding: 60,
            textAlign: "center",
            background: "#fff",
            border: "1px solid #e6e6e6",
            borderRadius: 16,
            color: "#666",
          }}
        >
          <p style={{ fontSize: 16 }}>No brands found</p>
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
                borderRadius: 16,
                display: "flex",
                gap: 16,
                alignItems: "center",
              }}
            >
              {/* Logo */}
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 12,
                  background: "#f5f5f5",
                  overflow: "hidden",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {brand.logo_url ? (
                  <img
                    src={brand.logo_url}
                    alt={brand.name}
                    style={{ width: "70%", height: "70%", objectFit: "contain" }}
                  />
                ) : (
                  <span style={{ fontSize: 28, color: "#d0d0d0", fontWeight: 700 }}>
                    {brand.name.charAt(0)}
                  </span>
                )}
              </div>

              {/* Info */}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                    {brand.name}
                  </h3>
                  {brand.country && (
                    <span style={{ fontSize: 18 }}>{getCountryFlag(brand.country)}</span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: "#666" }}>
                  {[brand.city, brand.country].filter(Boolean).join(", ") || "No location"}
                  {brand.latitude && brand.longitude && (
                    <span style={{ color: "#10b981", marginLeft: 8 }}>● on map</span>
                  )}
                </div>
              </div>

              {/* Edit Button */}
              <Link
                href={`/account/moderation/brands/${brand.id}/edit`}
                style={{
                  padding: "10px 20px",
                  background: "#000",
                  color: "#fff",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                Edit
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
