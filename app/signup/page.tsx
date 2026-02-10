"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import Link from "next/link";

interface ImportedBrand {
  name: string;
  logo: string | null;
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>Loading...</div>}>
      <SignupContent />
    </Suspense>
  );
}

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [accountType, setAccountType] = useState<"buyer" | "seller" | null>(null);
  const [importedBrand, setImportedBrand] = useState<ImportedBrand | null>(null);

  // Check for imported brand data from Shopify
  useEffect(() => {
    const brandName = searchParams.get("brandName");
    const brandLogo = searchParams.get("brandLogo");

    if (brandName) {
      setImportedBrand({
        name: brandName,
        logo: brandLogo,
      });
      // Auto-select seller account type
      setAccountType("seller");
      setStep(2);
    }
  }, [searchParams]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function signInWithGoogle() {
    if (!supabase) {
      setStatus("Supabase not configured");
      return;
    }
    setStatus("Connecting to Google...");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) setStatus(error.message);
  }

  async function handleSignup() {
    if (!supabase) {
      setStatus("Supabase not configured");
      return;
    }

    if (!email || !password) {
      setStatus("Please fill in all fields");
      return;
    }

    if (password.length < 8) {
      setStatus("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    setStatus("Sending verification code...");

    try {
      // Send OTP code - this will create the user if they don't exist
      const { data, error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          data: {
            account_type: accountType,
          },
        },
      });

      console.log("OTP Response:", { data, error: otpError });

      setLoading(false);

      if (otpError) {
        setStatus(otpError.message);
        return;
      }

      // Move to OTP verification step
      setStatus("");
      setStep(3);
      console.log("Step set to 3");
    } catch (err) {
      console.error("Signup error:", err);
      setLoading(false);
      setStatus("An unexpected error occurred. Please try again.");
    }
  }

  async function verifyOtp() {
    if (!supabase) {
      setStatus("Supabase not configured");
      return;
    }

    if (!otp || otp.length < 6) {
      setStatus("Please enter the verification code");
      return;
    }

    setLoading(true);
    setStatus("Verifying...");

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "email",
    });

    if (error) {
      setLoading(false);
      setStatus(error.message);
      return;
    }

    // Try to set the password for the user
    setStatus("Setting up your account...");
    const { error: updateError } = await supabase.auth.updateUser({
      password: password,
      data: {
        account_type: accountType,
      },
    });

    setLoading(false);

    // Ignore "same password" error - user already has this password
    if (updateError && !updateError.message.includes("different from the old password")) {
      setStatus(updateError.message);
      return;
    }

    // Success - redirect
    setStatus("");
    if (accountType === "seller") {
      // Pass imported brand data if available
      if (importedBrand) {
        const params = new URLSearchParams();
        params.set("brandName", importedBrand.name);
        if (importedBrand.logo) {
          params.set("brandLogo", importedBrand.logo);
        }
        router.push(`/account/become-seller?${params.toString()}`);
      } else {
        router.push("/account/become-seller");
      }
    } else {
      router.push("/");
    }
  }

  async function resendCode() {
    if (!supabase) return;

    setLoading(true);
    setStatus("Sending new code...");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
      },
    });

    setLoading(false);

    if (error) {
      setStatus(error.message);
    } else {
      setStatus("New code sent!");
      setTimeout(() => setStatus(""), 3000);
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
          borderRadius: 4,
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
            {step === 3 ? "Verify your email" : "Create account"}
          </h1>
          <p style={{ fontSize: 14, color: "#666", marginBottom: 32 }}>
            {step === 1 && "Choose your account type to get started"}
            {step === 2 && (importedBrand ? "Complete your account to start selling" : "Enter your details to create your account")}
            {step === 3 && `We sent a verification code to ${email}`}
          </p>

          {/* Imported Brand Preview */}
          {importedBrand && step === 2 && (
            <div style={{
              padding: 16,
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: 8,
              marginBottom: 24,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}>
              {importedBrand.logo ? (
                <img
                  src={importedBrand.logo}
                  alt={importedBrand.name}
                  style={{
                    width: 40,
                    height: 40,
                    objectFit: "contain",
                    borderRadius: 6,
                    background: "#fff",
                  }}
                />
              ) : (
                <div style={{
                  width: 40,
                  height: 40,
                  background: "#000",
                  borderRadius: 6,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontSize: 16,
                  fontWeight: 700,
                }}>
                  {importedBrand.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#166534" }}>
                  {importedBrand.name}
                </div>
                <div style={{ fontSize: 11, color: "#15803d" }}>
                  Imported from Shopify
                </div>
              </div>
              <button
                onClick={() => {
                  setImportedBrand(null);
                  setAccountType(null);
                  setStep(1);
                  // Clear URL params
                  router.replace("/signup");
                }}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  fontSize: 18,
                  color: "#666",
                  padding: 4,
                }}
              >
                ×
              </button>
            </div>
          )}

          {/* Step 1: Account Type Selection */}
          {step === 1 ? (
            <div key="step1" style={{ display: "grid", gap: 16 }}>
              <button
                onClick={() => {
                  setAccountType("buyer");
                  setStep(2);
                }}
                style={{
                  padding: 24,
                  border: "2px solid #e6e6e6",
                  borderRadius: 4,
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
                  borderRadius: 4,
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
          ) : step === 2 ? (
            <div key="step2" style={{ display: "grid", gap: 16 }}>
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
                    borderRadius: 4,
                    background: "#fff",
                    fontSize: 15,
                    boxSizing: "border-box",
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
                  placeholder="Min 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSignup();
                  }}
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    border: "1px solid #e6e6e6",
                    borderRadius: 4,
                    background: "#fff",
                    fontSize: 15,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div
                style={{
                  padding: 12,
                  background: "#f9f9f9",
                  borderRadius: 4,
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
                    borderRadius: 4,
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
                    borderRadius: 4,
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
                    borderRadius: 4,
                    border: "1px solid #000",
                    background: "#000",
                    color: "#fff",
                    cursor: loading ? "not-allowed" : "pointer",
                    fontWeight: 600,
                    opacity: loading ? 0.7 : 1,
                  }}
                >
                  {loading ? "Sending code..." : "Continue"}
                </button>
              </div>

              {/* Divider */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
                <div style={{ flex: 1, height: 1, background: "#e6e6e6" }} />
                <span style={{ fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: 1 }}>or</span>
                <div style={{ flex: 1, height: 1, background: "#e6e6e6" }} />
              </div>

              {/* Google Sign Up */}
              <button
                onClick={signInWithGoogle}
                disabled={loading}
                style={{
                  width: "100%",
                  padding: 16,
                  borderRadius: 4,
                  border: "1px solid #e6e6e6",
                  background: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  cursor: loading ? "not-allowed" : "pointer",
                  transition: "all 150ms ease",
                  opacity: loading ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.borderColor = "#000";
                    e.currentTarget.style.background = "#fafafa";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#e6e6e6";
                  e.currentTarget.style.background = "#fff";
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span style={{ fontWeight: 500, fontSize: 14 }}>Continue with Google</span>
              </button>
            </div>
          ) : (
            <div key="step3" style={{ display: "grid", gap: 16 }}>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Enter 6-digit code"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") verifyOtp();
                }}
                style={{
                  width: "100%",
                  padding: "18px 16px",
                  border: "1px solid #e6e6e6",
                  borderRadius: 4,
                  background: "#fff",
                  fontSize: 24,
                  fontWeight: 600,
                  letterSpacing: 8,
                  textAlign: "center",
                }}
              />

              {status && (
                <div
                  style={{
                    padding: 12,
                    background: status.includes("...") || status.includes("sent") ? "#f0f9ff" : "#fff3f3",
                    border: `1px solid ${status.includes("...") || status.includes("sent") ? "#bfdbfe" : "#fecaca"}`,
                    borderRadius: 4,
                    fontSize: 13,
                    color: status.includes("...") || status.includes("sent") ? "#1e40af" : "#dc2626",
                  }}
                >
                  {status}
                </div>
              )}

              <button
                onClick={verifyOtp}
                disabled={loading || otp.length < 6}
                style={{
                  width: "100%",
                  padding: 16,
                  borderRadius: 4,
                  border: "1px solid #000",
                  background: "#000",
                  color: "#fff",
                  cursor: (loading || otp.length < 6) ? "not-allowed" : "pointer",
                  fontWeight: 600,
                  opacity: (loading || otp.length < 6) ? 0.5 : 1,
                }}
              >
                {loading ? "Verifying..." : "Verify & Create Account"}
              </button>

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <button
                  onClick={() => {
                    setStep(2);
                    setOtp("");
                    setStatus("");
                  }}
                  disabled={loading}
                  style={{
                    all: "unset",
                    cursor: loading ? "not-allowed" : "pointer",
                    fontSize: 13,
                    color: "#666",
                  }}
                >
                  ← Change email
                </button>

                <button
                  onClick={resendCode}
                  disabled={loading}
                  style={{
                    all: "unset",
                    cursor: loading ? "not-allowed" : "pointer",
                    fontSize: 13,
                    color: "#666",
                    textDecoration: "underline",
                  }}
                >
                  Resend code
                </button>
              </div>
            </div>
          )}

          {/* Login link */}
          {step !== 3 ? (
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
                Log in
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
