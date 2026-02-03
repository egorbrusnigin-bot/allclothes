"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { supabase } from "../lib/supabase";
import "leaflet/dist/leaflet.css";

// Dynamically import map component to avoid SSR issues
const MapComponent = dynamic(() => import("./MapComponent"), {
  ssr: false,
});

interface Brand {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  logo_url: string | null;
  description: string | null;
}

export default function MapPage() {
  const [brands, setBrands] = useState<Brand[]>([]);

  useEffect(() => {
    fetchBrands();
  }, []);

  async function fetchBrands() {
    if (!supabase) return;

    const { data, error } = await supabase
      .from("brands")
      .select("id, name, slug, country, city, latitude, longitude, logo_url, description")
      .not("latitude", "is", null)
      .not("longitude", "is", null);

    if (error) {
      console.error("Error fetching brands:", error);
      return;
    }

    setBrands(data || []);
  }

  return (
    <main style={{ padding: "48px 24px", maxWidth: 1600, margin: "0 auto" }}>
      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 12, letterSpacing: 1 }}>
        MAP
      </h1>
      <p style={{ fontSize: 15, color: "#666", marginBottom: 32 }}>
        Explore brands by location
      </p>

      <div style={{
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 2px 12px rgba(0,0,0,0.08)"
      }}>
        <MapComponent brands={brands} />
      </div>
    </main>
  );
}
