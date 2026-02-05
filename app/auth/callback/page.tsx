"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState("Verifying...");
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"loading" | "otp">("loading");

  useEffect(() => {
    handleCallback();
  }, []);

  async function handleCallback() {
    if (!supabase) {
      setStatus("Supabase not configured");
      return;
    }

    // Get the session from the OAuth callback
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session) {
      setStatus("Authentication failed");
      setTimeout(() => router.push("/"), 2000);
      return;
    }

    const userEmail = session.user.email;
    if (!userEmail) {
      setStatus("No email found");
      setTimeout(() => router.push("/"), 2000);
      return;
    }

    setEmail(userEmail);

    // Sign out temporarily - user needs to verify OTP first
    await supabase.auth.signOut();

    // Send OTP code to their email
    setStatus("Sending verification code...");
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: userEmail,
      options: {
        shouldCreateUser: false,
      },
    });

    if (otpError) {
      setStatus(otpError.message);
      return;
    }

    setStatus("");
    setStep("otp");
    setLoading(false);
  }

  async function verifyOtp() {
    if (!supabase || !email) return;

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

    setLoading(false);

    if (error) {
      setStatus(error.message);
      return;
    }

    // Success - redirect to account
    router.push("/account");
  }

  async function resendCode() {
    if (!supabase || !email) return;

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
          width: "min(400px, 100%)",
          background: "#fff",
          borderRadius: 4,
          border: "1px solid #e6e6e6",
          boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #f0f0f0",
            fontWeight: 800,
            letterSpacing: 0.5,
            fontSize: 16,
          }}
        >
          ALLCLOTHES
        </div>

        <div style={{ padding: "32px 24px" }}>
          {step === "loading" ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 14, color: "#666" }}>{status}</div>
            </div>
          ) : (
            <>
              <h1
                style={{
                  fontSize: 24,
                  fontWeight: 800,
                  marginBottom: 8,
                  letterSpacing: 0.5,
                }}
              >
                Enter verification code
              </h1>
              <p style={{ fontSize: 14, color: "#666", marginBottom: 32 }}>
                We sent a 6-digit code to {email}
              </p>

              <div style={{ display: "grid", gap: 16 }}>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="000000"
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
                    cursor: loading || otp.length < 6 ? "not-allowed" : "pointer",
                    fontWeight: 600,
                    opacity: loading || otp.length < 6 ? 0.5 : 1,
                  }}
                >
                  {loading ? "Verifying..." : "Verify & Continue"}
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
                    textAlign: "center",
                  }}
                >
                  Resend code
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
