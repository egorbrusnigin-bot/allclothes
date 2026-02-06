"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface ShopifyData {
  name: string;
  logo: string | null;
  domain: string;
}

export default function BecomeSellerPage() {
  const router = useRouter();
  const [shopifyUrl, setShopifyUrl] = useState("");
  const [shopifyData, setShopifyData] = useState<ShopifyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function parseShopifyUrl() {
    if (!shopifyUrl.trim()) {
      setError("Please enter a Shopify store URL");
      return;
    }

    setLoading(true);
    setError("");
    setShopifyData(null);

    try {
      const res = await fetch("/api/shopify/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: shopifyUrl }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to parse store");
        return;
      }

      setShopifyData(data.data);
    } catch (err) {
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  }

  function goToSignup() {
    if (shopifyData) {
      const params = new URLSearchParams();
      params.set("brandName", shopifyData.name);
      if (shopifyData.logo) {
        params.set("brandLogo", shopifyData.logo);
      }
      router.push(`/signup?${params.toString()}`);
    } else {
      router.push("/signup");
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#fff" }}>
      {/* Hero Section */}
      <section
        style={{
          padding: "80px 24px",
          textAlign: "center",
          background: "#000",
          color: "#fff",
        }}
      >
        <h1
          style={{
            fontSize: "clamp(32px, 6vw, 56px)",
            fontWeight: 800,
            letterSpacing: 1,
            marginBottom: 16,
          }}
        >
          SELL ON ALLCLOTHES
        </h1>
        <p
          style={{
            fontSize: "clamp(14px, 2vw, 18px)",
            color: "rgba(255,255,255,0.7)",
            maxWidth: 600,
            margin: "0 auto 32px",
            lineHeight: 1.6,
          }}
        >
          Join the leading streetwear marketplace. Reach thousands of buyers and grow your brand globally.
        </p>
        <button
          onClick={goToSignup}
          style={{
            padding: "18px 48px",
            borderRadius: 14,
            border: "1px solid #fff",
            background: "#fff",
            color: "#000",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: 1,
            transition: "all 150ms ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "#fff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#fff";
            e.currentTarget.style.color = "#000";
          }}
        >
          BECOME A SELLER
        </button>
      </section>

      {/* Shopify Import Section */}
      <section style={{ padding: "60px 24px", background: "#fff", borderBottom: "1px solid #e6e6e6" }}>
        <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12, letterSpacing: 0.5 }}>
            ALREADY HAVE A SHOPIFY STORE?
          </h2>
          <p style={{ fontSize: 14, color: "#666", marginBottom: 24, lineHeight: 1.6 }}>
            Paste your Shopify store URL to automatically import your brand name and logo
          </p>

          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <input
              type="text"
              placeholder="yourstore.myshopify.com or yourstore.com"
              value={shopifyUrl}
              onChange={(e) => {
                setShopifyUrl(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") parseShopifyUrl();
              }}
              style={{
                flex: 1,
                padding: "14px 16px",
                border: "1px solid #e6e6e6",
                borderRadius: 8,
                fontSize: 14,
              }}
            />
            <button
              onClick={parseShopifyUrl}
              disabled={loading}
              style={{
                padding: "14px 24px",
                background: loading ? "#999" : "#000",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 14,
                cursor: loading ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {loading ? "Loading..." : "Import"}
            </button>
          </div>

          {error && (
            <div style={{
              padding: 12,
              background: "#fff3f3",
              border: "1px solid #fecaca",
              borderRadius: 8,
              fontSize: 13,
              color: "#dc2626",
              marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          {shopifyData && (
            <div style={{
              padding: 24,
              background: "#f9fafb",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              display: "flex",
              alignItems: "center",
              gap: 16,
              textAlign: "left",
            }}>
              {shopifyData.logo ? (
                <img
                  src={shopifyData.logo}
                  alt={shopifyData.name}
                  style={{
                    width: 64,
                    height: 64,
                    objectFit: "contain",
                    borderRadius: 8,
                    background: "#fff",
                    border: "1px solid #e6e6e6",
                  }}
                />
              ) : (
                <div style={{
                  width: 64,
                  height: 64,
                  background: "#000",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontSize: 24,
                  fontWeight: 800,
                }}>
                  {shopifyData.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
                  {shopifyData.name}
                </div>
                <div style={{ fontSize: 12, color: "#666" }}>
                  {shopifyData.domain}
                </div>
              </div>
              <button
                onClick={goToSignup}
                style={{
                  padding: "12px 24px",
                  background: "#000",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Continue
              </button>
            </div>
          )}
        </div>
      </section>

      {/* How It Works */}
      <section style={{ padding: "80px 24px", maxWidth: 1000, margin: "0 auto" }}>
        <h2
          style={{
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: 0.5,
            marginBottom: 48,
            textAlign: "center",
          }}
        >
          HOW IT WORKS
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 32,
          }}
        >
          {/* Step 1 */}
          <div
            style={{
              padding: 32,
              border: "1px solid #e6e6e6",
              borderRadius: 20,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: "#000",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: 18,
                marginBottom: 20,
              }}
            >
              1
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
              Create Your Account
            </h3>
            <p style={{ fontSize: 14, color: "#666", lineHeight: 1.6 }}>
              Sign up as a seller and complete your brand profile. Add your logo, description, and social links.
            </p>
          </div>

          {/* Step 2 */}
          <div
            style={{
              padding: 32,
              border: "1px solid #e6e6e6",
              borderRadius: 20,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: "#000",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: 18,
                marginBottom: 20,
              }}
            >
              2
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
              Upload Your Products
            </h3>
            <p style={{ fontSize: 14, color: "#666", lineHeight: 1.6 }}>
              List your items with photos, descriptions, sizes, and prices. Our team reviews each product for quality.
            </p>
          </div>

          {/* Step 3 */}
          <div
            style={{
              padding: 32,
              border: "1px solid #e6e6e6",
              borderRadius: 20,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: "#000",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: 18,
                marginBottom: 20,
              }}
            >
              3
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
              Start Selling
            </h3>
            <p style={{ fontSize: 14, color: "#666", lineHeight: 1.6 }}>
              Once approved, your products appear in our catalog. Handle shipping and we handle payments securely.
            </p>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section style={{ padding: "80px 24px", background: "#fafafa" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <h2
            style={{
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: 0.5,
              marginBottom: 48,
              textAlign: "center",
            }}
          >
            WHY SELL WITH US
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 24,
            }}
          >
            <div style={{ textAlign: "center", padding: 24 }}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>🌍</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
                Global Reach
              </h3>
              <p style={{ fontSize: 13, color: "#666", lineHeight: 1.5 }}>
                Reach streetwear enthusiasts from around the world
              </p>
            </div>

            <div style={{ textAlign: "center", padding: 24 }}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>💳</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
                Secure Payments
              </h3>
              <p style={{ fontSize: 13, color: "#666", lineHeight: 1.5 }}>
                We handle all payments securely through trusted providers
              </p>
            </div>

            <div style={{ textAlign: "center", padding: 24 }}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>📊</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
                Analytics Dashboard
              </h3>
              <p style={{ fontSize: 13, color: "#666", lineHeight: 1.5 }}>
                Track your sales, views, and customer engagement
              </p>
            </div>

            <div style={{ textAlign: "center", padding: 24 }}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>🤝</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
                Low Fees
              </h3>
              <p style={{ fontSize: 13, color: "#666", lineHeight: 1.5 }}>
                Competitive commission rates that help you maximize profit
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Commission Info */}
      <section style={{ padding: "80px 24px", maxWidth: 800, margin: "0 auto" }}>
        <h2
          style={{
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: 0.5,
            marginBottom: 32,
            textAlign: "center",
          }}
        >
          SIMPLE PRICING
        </h2>

        <div
          style={{
            padding: 40,
            border: "2px solid #000",
            borderRadius: 20,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 48, fontWeight: 800, marginBottom: 8 }}>10%</div>
          <div style={{ fontSize: 16, color: "#666", marginBottom: 24 }}>
            commission per sale
          </div>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "grid",
              gap: 12,
              textAlign: "left",
              maxWidth: 300,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            <li style={{ fontSize: 14, color: "#333", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#000" }}>✓</span> No monthly fees
            </li>
            <li style={{ fontSize: 14, color: "#333", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#000" }}>✓</span> No listing fees
            </li>
            <li style={{ fontSize: 14, color: "#333", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#000" }}>✓</span> Payout within 7 days
            </li>
            <li style={{ fontSize: 14, color: "#333", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#000" }}>✓</span> 24/7 seller support
            </li>
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: "80px 24px", background: "#fafafa" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <h2
            style={{
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: 0.5,
              marginBottom: 48,
              textAlign: "center",
            }}
          >
            FREQUENTLY ASKED QUESTIONS
          </h2>

          <div style={{ display: "grid", gap: 24 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
                How long does approval take?
              </h3>
              <p style={{ fontSize: 14, color: "#666", lineHeight: 1.6 }}>
                Brand applications are typically reviewed within 24-48 hours. Product listings are reviewed within a few hours.
              </p>
            </div>

            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
                Who handles shipping?
              </h3>
              <p style={{ fontSize: 14, color: "#666", lineHeight: 1.6 }}>
                You ship directly to customers. We provide shipping labels and tracking integration for a seamless experience.
              </p>
            </div>

            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
                What products can I sell?
              </h3>
              <p style={{ fontSize: 14, color: "#666", lineHeight: 1.6 }}>
                We focus on streetwear, including clothing, accessories, and footwear. All products must be authentic and meet our quality standards.
              </p>
            </div>

            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
                How do I get paid?
              </h3>
              <p style={{ fontSize: 14, color: "#666", lineHeight: 1.6 }}>
                Payments are processed automatically and sent to your bank account or PayPal within 7 days of order completion.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section
        style={{
          padding: "80px 24px",
          textAlign: "center",
          background: "#000",
          color: "#fff",
        }}
      >
        <h2
          style={{
            fontSize: "clamp(24px, 4vw, 36px)",
            fontWeight: 800,
            letterSpacing: 0.5,
            marginBottom: 16,
          }}
        >
          READY TO START SELLING?
        </h2>
        <p
          style={{
            fontSize: 14,
            color: "rgba(255,255,255,0.7)",
            maxWidth: 500,
            margin: "0 auto 32px",
            lineHeight: 1.6,
          }}
        >
          Join hundreds of streetwear brands already selling on ALLCLOTHES
        </p>
        <button
          onClick={goToSignup}
          style={{
            padding: "18px 48px",
            borderRadius: 14,
            border: "1px solid #fff",
            background: "#fff",
            color: "#000",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: 1,
            transition: "all 150ms ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "#fff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#fff";
            e.currentTarget.style.color = "#000";
          }}
        >
          BECOME A SELLER
        </button>

        <div style={{ marginTop: 24 }}>
          <Link
            href="/"
            style={{
              color: "rgba(255,255,255,0.5)",
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            ← Back to store
          </Link>
        </div>
      </section>
    </main>
  );
}
