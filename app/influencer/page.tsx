"use client";

import { useIsMobile } from "../lib/useIsMobile";

export default function InfluencerPage() {
  const isMobile = useIsMobile();

  return (
    <main style={{ padding: isMobile ? "32px 16px 60px" : "60px 24px 80px", maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ fontSize: isMobile ? 24 : 36, fontWeight: 700, letterSpacing: 1.5, marginBottom: 8 }}>
        INFLUENCER PROGRAM
      </h1>
      <div style={{ width: 40, height: 2, background: "#000", marginBottom: 32 }} />

      <p style={paragraph}>
        Love streetwear? Have an audience that trusts your taste? Join the ALLCLOTHES Influencer Program and earn while sharing brands you genuinely believe in.
      </p>

      <h2 style={heading}>How It Works</h2>
      <div style={{ display: "grid", gap: 20, marginBottom: 24 }}>
        <div style={stepBox}>
          <span style={stepNumber}>1</span>
          <div>
            <strong>Apply</strong>
            <p style={{ ...paragraph, marginBottom: 0 }}>Fill out a short application telling us about yourself and your audience. We review applications within 5 business days.</p>
          </div>
        </div>
        <div style={stepBox}>
          <span style={stepNumber}>2</span>
          <div>
            <strong>Get Your Code</strong>
            <p style={{ ...paragraph, marginBottom: 0 }}>Once approved, you will receive a unique promo code and affiliate link. Share them on your social channels, blog, or wherever your audience hangs out.</p>
          </div>
        </div>
        <div style={stepBox}>
          <span style={stepNumber}>3</span>
          <div>
            <strong>Earn Commission</strong>
            <p style={{ ...paragraph, marginBottom: 0 }}>Every sale made through your link or code earns you a commission. Track your performance through a dedicated dashboard.</p>
          </div>
        </div>
      </div>

      <h2 style={heading}>What You Get</h2>
      <ul style={{ ...paragraph, paddingLeft: 20 }}>
        <li style={{ marginBottom: 8 }}>Commission on every referred sale</li>
        <li style={{ marginBottom: 8 }}>Exclusive early access to new drops and collections</li>
        <li style={{ marginBottom: 8 }}>Free product samples from partner brands</li>
        <li style={{ marginBottom: 8 }}>Feature on the ALLCLOTHES social channels</li>
        <li style={{ marginBottom: 8 }}>Dedicated support from our partnerships team</li>
      </ul>

      <h2 style={heading}>Who We Are Looking For</h2>
      <p style={paragraph}>
        We work with creators of all sizes — from micro-influencers with 1K followers to established names. What matters most is authenticity and a genuine connection with streetwear culture. If your audience trusts your recommendations, we want to hear from you.
      </p>

      <h2 style={heading}>Apply Now</h2>
      <p style={paragraph}>
        Interested? Send us an email at <strong>[email@allclothes.com]</strong> with your social media links, audience size, and a brief intro about yourself. We will get back to you shortly.
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

const stepBox: React.CSSProperties = {
  display: "flex",
  gap: 16,
  alignItems: "flex-start",
  padding: 16,
  border: "1px solid #e6e6e6",
};

const stepNumber: React.CSSProperties = {
  width: 28,
  height: 28,
  background: "#000",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 13,
  fontWeight: 700,
  flexShrink: 0,
};
