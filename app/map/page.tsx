"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import { useIsMobile } from "../lib/useIsMobile";
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
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    checkAuth();
    fetchBrands();
  }, []);

  async function checkAuth() {
    if (!supabase) { setIsLoggedIn(false); return; }
    const { data: { user } } = await supabase.auth.getUser();
    setIsLoggedIn(!!user);
  }

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

  // Mobile: show login prompt for non-registered users
  if (isMobile && isLoggedIn === false) {
    return (
      <main style={{ padding: "24px 16px", maxWidth: 1600, margin: "0 auto" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12, letterSpacing: 1 }}>
          MAP
        </h1>
        <p style={{ fontSize: 13, color: "#666", marginBottom: 32 }}>
          Explore brands by location
        </p>
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px 24px",
          border: "1px solid #e6e6e6",
          background: "#fafafa",
          gap: 16,
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🗺️</div>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>
            Sign in to view the map
          </div>
          <div style={{ fontSize: 12, color: "#666", textAlign: "center", maxWidth: 280 }}>
            Log in to explore brand locations around the world
          </div>
          <Link
            href="/?login=1"
            style={{
              textDecoration: "none",
              background: "#000",
              color: "#fff",
              padding: "12px 32px",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 1,
              marginTop: 8,
            }}
          >
            LOG IN
          </Link>
          <Link
            href="/signup"
            style={{
              textDecoration: "none",
              color: "#000",
              fontSize: 11,
              letterSpacing: 0.5,
            }}
          >
            Don&apos;t have an account? Sign up
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main style={{ padding: isMobile ? "24px 16px" : "48px 24px", maxWidth: 1600, margin: "0 auto" }}>
      <h1 style={{ fontSize: isMobile ? 24 : 32, fontWeight: 700, marginBottom: 12, letterSpacing: 1 }}>
        MAP
      </h1>
      <p style={{ fontSize: isMobile ? 13 : 15, color: "#666", marginBottom: isMobile ? 16 : 32 }}>
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
