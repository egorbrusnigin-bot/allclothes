"use client";

import { useIsMobile } from "../lib/useIsMobile";

export default function AboutPage() {
  const isMobile = useIsMobile();

  return (
    <main style={{ padding: isMobile ? "32px 16px 60px" : "60px 24px 80px", maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ fontSize: isMobile ? 24 : 36, fontWeight: 700, letterSpacing: 1.5, marginBottom: 8 }}>
        ABOUT US
      </h1>
      <div style={{ width: 40, height: 2, background: "#000", marginBottom: 32 }} />

      <p style={paragraph}>
        ALLCLOTHES is a global streetwear marketplace connecting independent brands with people who care about what they wear. We believe fashion should be bold, personal, and accessible — no matter where you are in the world.
      </p>

      <h2 style={heading}>Our Mission</h2>
      <p style={paragraph}>
        We exist to give emerging streetwear brands a platform to reach a global audience. The fashion industry has long been dominated by a handful of gatekeepers. ALLCLOTHES changes that by providing tools for independent designers to showcase their collections, manage orders, and grow their customer base — all in one place.
      </p>

      <h2 style={heading}>What We Offer</h2>
      <p style={paragraph}>
        For <strong>shoppers</strong>, ALLCLOTHES is a curated catalog of streetwear from around the world. Browse by brand, explore the map to discover labels from different cities, and find pieces that speak to your style.
      </p>
      <p style={paragraph}>
        For <strong>brands</strong>, we offer a seller dashboard with product management, order tracking, and analytics. List your products, connect your Stripe account, and start selling internationally with minimal friction.
      </p>

      <h2 style={heading}>Why Streetwear</h2>
      <p style={paragraph}>
        Streetwear is more than clothing — it is culture, identity, and community. From Tokyo to Berlin, Lagos to Los Angeles, independent labels are shaping how the world dresses. ALLCLOTHES brings these voices together on a single platform.
      </p>

      <h2 style={heading}>Get In Touch</h2>
      <p style={paragraph}>
        Whether you are a brand looking to join the platform, a shopper with a question, or someone who just wants to say hello — we would love to hear from you. Visit our <a href="/contact" style={{ color: "#000", fontWeight: 600 }}>Contact</a> page to reach out.
      </p>
    </main>
  );
}

const heading: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  letterSpacing: 0.5,
  marginTop: 32,
  marginBottom: 12,
};

const paragraph: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.7,
  color: "#333",
  marginBottom: 16,
};
