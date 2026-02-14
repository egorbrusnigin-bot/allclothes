"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

interface StripeStatus {
  connected: boolean;
  onboarding_complete: boolean;
  payouts_enabled: boolean;
  balance: {
    available: Array<{ amount: number; currency: string }>;
    pending: Array<{ amount: number; currency: string }>;
  } | null;
}

export default function SellerStripePage() {
  return (
    <Suspense fallback={<div style={{ padding: 48, textAlign: "center" }}>Loading...</div>}>
      <SellerStripeContent />
    </Suspense>
  );
}

function SellerStripeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState<StripeStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    // Check for success/refresh params from Stripe redirect
    const success = searchParams.get("success");
    const refresh = searchParams.get("refresh");

    if (success === "1") {
      setSuccessMessage("Stripe account connected successfully!");
      // Clear the URL params
      window.history.replaceState({}, "", "/account/seller/stripe");
    }

    if (refresh === "1") {
      setError("Please complete the onboarding process.");
      window.history.replaceState({}, "", "/account/seller/stripe");
    }

    loadStatus();
  }, [searchParams]);

  async function loadStatus() {
    if (!supabase) {
      router.push("/?login=1");
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/?login=1");
      return;
    }

    try {
      const res = await fetch("/api/stripe/connect", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      // Check if response is JSON
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.error("API returned non-JSON response");
        setStatus({ connected: false, onboarding_complete: false, payouts_enabled: false, balance: null });
        setLoading(false);
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        // Don't redirect - show error on page instead
        setError(data.error || "Failed to load status");
        setStatus({ connected: false, onboarding_complete: false, payouts_enabled: false, balance: null });
        setLoading(false);
        return;
      }

      setStatus(data);
    } catch (err) {
      console.error("Failed to load Stripe status:", err);
      // Show default status instead of error
      setStatus({ connected: false, onboarding_complete: false, payouts_enabled: false, balance: null });
    }

    setLoading(false);
  }

  async function handleConnect() {
    if (!supabase || connecting) return;
    setConnecting(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/?login=1");
        return;
      }

      const res = await fetch("/api/stripe/connect", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      // Check if response is JSON
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server error. Please try again later.");
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to connect");
      }

      // Redirect to Stripe onboarding
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start onboarding");
      setConnecting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: 400 }}>
        <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: 1 }}>
          Loading...
        </div>
      </div>
    );
  }

  const availableBalance = status?.balance?.available?.[0]?.amount || 0;
  const pendingBalance = status?.balance?.pending?.[0]?.amount || 0;
  const currency = status?.balance?.available?.[0]?.currency || "EUR";

  return (
    <div style={{ display: "grid", gap: 32 }}>
      {/* Header */}
      <div>
        <Link
          href="/account/seller"
          style={{
            fontSize: 11,
            color: "#666",
            textDecoration: "none",
            display: "inline-block",
            marginBottom: 16,
          }}
        >
          ← Back to Dashboard
        </Link>
        <div style={{ fontSize: 10, color: "#999", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>
          PAYMENT SETTINGS
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>
          Stripe Connect
        </h1>
      </div>

      {/* Success message */}
      {successMessage && (
        <div
          style={{
            padding: "14px 18px",
            background: "#f0fff4",
            border: "1px solid #86efac",
            color: "#166534",
            fontSize: 13,
          }}
        >
          {successMessage}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div
          style={{
            padding: "14px 18px",
            background: "#fff0f0",
            border: "1px solid #ffcccc",
            color: "#c00",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {/* Status Card */}
      <div style={{ border: "1px solid #e6e6e6", padding: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 20 }}>
          CONNECTION STATUS
        </div>

        {!status?.connected ? (
          // Not connected
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444" }} />
              <span style={{ fontSize: 14, fontWeight: 600 }}>Not Connected</span>
            </div>
            <p style={{ fontSize: 13, color: "#666", marginBottom: 20, lineHeight: 1.6 }}>
              Connect your Stripe account to receive payments directly from customers.
              Stripe handles all payment processing securely.
            </p>
            <button
              onClick={handleConnect}
              disabled={connecting}
              style={{
                padding: "14px 28px",
                background: connecting ? "#888" : "#000",
                color: "#fff",
                border: "none",
                fontSize: 12,
                fontWeight: 700,
                cursor: connecting ? "not-allowed" : "pointer",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              {connecting ? "CONNECTING..." : "CONNECT STRIPE"}
            </button>
          </div>
        ) : !status.onboarding_complete ? (
          // Connected but onboarding incomplete
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b" }} />
              <span style={{ fontSize: 14, fontWeight: 600 }}>Onboarding Incomplete</span>
            </div>
            <p style={{ fontSize: 13, color: "#666", marginBottom: 20, lineHeight: 1.6 }}>
              Your Stripe account is connected but onboarding is not complete.
              Please finish setting up your account to start receiving payments.
            </p>
            <button
              onClick={handleConnect}
              disabled={connecting}
              style={{
                padding: "14px 28px",
                background: connecting ? "#888" : "#000",
                color: "#fff",
                border: "none",
                fontSize: 12,
                fontWeight: 700,
                cursor: connecting ? "not-allowed" : "pointer",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              {connecting ? "LOADING..." : "COMPLETE ONBOARDING"}
            </button>
          </div>
        ) : (
          // Fully connected
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e" }} />
              <span style={{ fontSize: 14, fontWeight: 600 }}>Connected & Active</span>
            </div>

            {/* Payouts status */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              {status.payouts_enabled ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  <span style={{ fontSize: 13, color: "#666" }}>Payouts enabled</span>
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span style={{ fontSize: 13, color: "#666" }}>Payouts pending verification</span>
                </>
              )}
            </div>

            {/* Balance */}
            {status.balance && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div style={{ background: "#f5f5f5", padding: 16 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
                    {currency.toUpperCase()} {availableBalance.toFixed(2)}
                  </div>
                  <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Available
                  </div>
                </div>
                <div style={{ background: "#f5f5f5", padding: 16 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
                    {currency.toUpperCase()} {pendingBalance.toFixed(2)}
                  </div>
                  <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Pending
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info section */}
      <div style={{ border: "1px solid #e6e6e6", padding: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>
          HOW IT WORKS
        </div>
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ width: 24, height: 24, background: "#000", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
              1
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Customer pays</div>
              <div style={{ fontSize: 12, color: "#666" }}>Payment is processed securely through Stripe</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ width: 24, height: 24, background: "#000", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
              2
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Automatic split</div>
              <div style={{ fontSize: 12, color: "#666" }}>90% goes to you, 10% platform fee</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ width: 24, height: 24, background: "#000", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
              3
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Direct payout</div>
              <div style={{ fontSize: 12, color: "#666" }}>Funds are transferred to your bank automatically</div>
            </div>
          </div>
        </div>
      </div>

      {/* Commission info */}
      <div style={{ background: "#f9f9f9", padding: 20, fontSize: 12, color: "#666" }}>
        <strong>Platform fee:</strong> 10% per transaction<br />
        <strong>Stripe fee:</strong> ~2.9% + €0.25 per successful charge<br />
        <strong>Payout schedule:</strong> Automatic, typically 2-7 business days
      </div>
    </div>
  );
}
