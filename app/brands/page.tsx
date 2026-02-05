"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "../lib/supabase";
import { getCountryFlag } from "../lib/countryFlags";

interface Brand {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  city: string | null;
  logo_url: string | null;
  description: string | null;
}

function BrandCard({ brand }: { brand: Brand }) {
  return (
    <Link href={`/brand/${brand.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
      <div
        style={{ cursor: "pointer", transition: "transform 0.2s ease" }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-4px)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
        }}
      >
        {/* Logo tile */}
        <div style={{
          width: "100%",
          aspectRatio: "1",
          background: "#f5f5f5",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          marginBottom: 10,
          position: "relative",
        }}>
          {brand.logo_url ? (
            <div style={{ width: "55%", height: "55%", position: "relative" }}>
              <Image
                src={brand.logo_url}
                alt={brand.name}
                fill
                sizes="150px"
                style={{ objectFit: "contain" }}
                loading="lazy"
              />
            </div>
          ) : (
            <div style={{
              fontSize: 32,
              fontWeight: 700,
              color: "#d0d0d0",
              textTransform: "uppercase",
              letterSpacing: 2,
            }}>
              {brand.name.charAt(0)}
            </div>
          )}
        </div>

        {/* Name + Flag */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.5,
            textTransform: "uppercase",
            color: "#000",
          }}>
            {brand.name}
          </div>
          {brand.country && (
            <span style={{ fontSize: 16, lineHeight: 1 }}>
              {getCountryFlag(brand.country)}
            </span>
          )}
        </div>

        {/* Location */}
        {(brand.city || brand.country) && (
          <div style={{
            fontSize: 9,
            color: "#999",
            letterSpacing: 0.3,
            textTransform: "uppercase",
          }}>
            {[brand.city, brand.country].filter(Boolean).join(", ")}
          </div>
        )}
      </div>
    </Link>
  );
}

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchBrands();
  }, []);

  async function fetchBrands() {
    if (!supabase) return;

    const { data, error } = await supabase
      .from("brands")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching brands:", error);
    } else {
      setBrands(data || []);
    }
    setLoaded(true);
  }

  return (
    <main style={{ padding: "40px 60px", maxWidth: 1600, margin: "0 auto" }}>
      <div style={{ marginBottom: 50 }}>
        <h1 style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>
          BRANDS
        </h1>
      </div>

      {loaded && brands.length === 0 ? (
        <div style={{ textAlign: "center", padding: "100px 0", color: "#CCCCCC", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>
          NO BRANDS FOUND
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 20,
          rowGap: 40,
        }}>
          {brands.map((brand) => (
            <BrandCard key={brand.id} brand={brand} />
          ))}
        </div>
      )}
    </main>
  );
}
