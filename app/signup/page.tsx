"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [accountType, setAccountType] = useState<"buyer" | "seller" | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup() {
    if (!supabase) {
      setStatus("Supabase not configured");
      return;
    }

    if (!email || !password) {
      setStatus("Please fill in all fields");
      return;
    }

    setLoading(true);
    setStatus("Creating account...");

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setStatus(error.message);
      return;
    }

    // Успешная регистрация
    setStatus("");

    // Redirect based on account type
    if (accountType === "seller") {
      router.push("/account/become-seller");
    } else {
      router.push("/");
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "#fafafa",
      }}
    >
      <div
        style={{
          width: "min(520px, 100%)",
          background: "#fff",
          borderRadius: 22,
          border: "1px solid #e6e6e6",
          boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "20px 24px",
            borderBottom: "1px solid #f0f0f0",
          }}
        >
          <div style={{ fontWeight: 800, letterSpacing: 0.5, fontSize: 16 }}>
            ALLCLOTHES
          </div>
          <Link
            href="/"
            style={{
              all: "unset",
              cursor: "pointer",
              padding: 10,
              lineHeight: 1,
              fontSize: 18,
              opacity: 0.7,
            }}
          >
            ✕
          </Link>
        </div>

        {/* Content */}
        <div style={{ padding: "32px 24px" }}>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 800,
              marginBottom: 8,
              letterSpacing: 0.5,
            }}
          >
            Create account
          </h1>
          <p style={{ fontSize: 14, color: "#666", marginBottom: 32 }}>
            {step === 1
              ? "Choose your account type to get started"
              : "Enter your details to create your account"}
          </p>

          {/* Step 1: Account Type Selection */}
          {step === 1 && (
            <div style={{ display: "grid", gap: 16 }}>
              <button
                onClick={() => {
                  setAccountType("buyer");
                  setStep(2);
                }}
                style={{
                  padding: 24,
                  border: "2px solid #e6e6e6",
                  borderRadius: 16,
                  background: "#fff",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 180ms ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#000";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#e6e6e6";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
                  Buyer Account
                </div>
                <div style={{ fontSize: 13, color: "#666", lineHeight: 1.5 }}>
                  Browse and purchase streetwear from various brands
                </div>
              </button>

              <button
                onClick={() => {
                  setAccountType("seller");
                  setStep(2);
                }}
                style={{
                  padding: 24,
                  border: "2px solid #e6e6e6",
                  borderRadius: 16,
                  background: "#fff",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 180ms ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#000";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#e6e6e6";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
                  Seller Account
                </div>
                <div style={{ fontSize: 13, color: "#666", lineHeight: 1.5 }}>
                  Create your brand and sell your streetwear products
                </div>
              </button>
            </div>
          )}

          {/* Step 2: Email & Password */}
          {step === 2 && (
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 8,
                    color: "#333",
                  }}
                >
                  Email address
                </label>
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSignup();
                  }}
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    border: "1px solid #e6e6e6",
                    borderRadius: 12,
                    background: "#fff",
                    fontSize: 15,
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 8,
                    color: "#333",
                  }}
                >
                  Password
                </label>
                <input
                  type="password"
                  placeholder="Create a strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSignup();
                  }}
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    border: "1px solid #e6e6e6",
                    borderRadius: 12,
                    background: "#fff",
                    fontSize: 15,
                  }}
                />
              </div>

              <div
                style={{
                  padding: 12,
                  background: "#f9f9f9",
                  borderRadius: 12,
                  fontSize: 12,
                  color: "#666",
                  lineHeight: 1.6,
                }}
              >
                <strong style={{ color: "#333" }}>
                  {accountType === "seller" ? "Seller Account" : "Buyer Account"}
                </strong>
                <br />
                {accountType === "seller"
                  ? "After signup, you'll complete your brand profile"
                  : "You can start browsing and shopping immediately"}
              </div>

              {status && (
                <div
                  style={{
                    padding: 12,
                    background: status.includes("...") ? "#f0f9ff" : "#fff3f3",
                    border: `1px solid ${status.includes("...") ? "#bfdbfe" : "#fecaca"}`,
                    borderRadius: 12,
                    fontSize: 13,
                    color: status.includes("...") ? "#1e40af" : "#dc2626",
                  }}
                >
                  {status}
                </div>
              )}

              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button
                  onClick={() => {
                    setStep(1);
                    setAccountType(null);
                    setStatus("");
                  }}
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: 16,
                    borderRadius: 16,
                    border: "1px solid #e6e6e6",
                    background: "#fff",
                    cursor: loading ? "not-allowed" : "pointer",
                    fontWeight: 600,
                    opacity: loading ? 0.5 : 1,
                  }}
                >
                  Back
                </button>
                <button
                  onClick={handleSignup}
                  disabled={loading}
                  style={{
                    flex: 2,
                    padding: 16,
                    borderRadius: 16,
                    border: "1px solid #000",
                    background: "#000",
                    color: "#fff",
                    cursor: loading ? "not-allowed" : "pointer",
                    fontWeight: 600,
                    opacity: loading ? 0.7 : 1,
                  }}
                >
                  {loading ? "Creating..." : "Create account"}
                </button>
              </div>
            </div>
          )}

          {/* Login link */}
          <div
            style={{
              marginTop: 24,
              paddingTop: 24,
              borderTop: "1px solid #f0f0f0",
              textAlign: "center",
              fontSize: 13,
              color: "#666",
            }}
          >
            Already have an account?{" "}
            <Link
              href="/?login=1"
              style={{
                color: "#000",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
