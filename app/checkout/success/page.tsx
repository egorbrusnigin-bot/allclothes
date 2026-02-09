"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { clearCart } from "../../lib/cart";
import Link from "next/link";

function SuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "pending" | "success" | "failed">("loading");
  const [attempts, setAttempts] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    checkPayment();
  }, []);

  // Retry on pending status
  useEffect(() => {
    if (status === "pending" && attempts < 10) {
      timerRef.current = setTimeout(() => {
        checkPayment();
      }, 2000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [status, attempts]);

  async function checkPayment() {
    if (!supabase) {
      router.push("/");
      return;
    }

    // Get Stripe redirect parameters
    const paymentIntent = searchParams.get("payment_intent");
    const redirectStatus = searchParams.get("redirect_status");

    // Also check localStorage for payment intent ID (backup)
    const storedPaymentIntent = localStorage.getItem("stripe_payment_intent");
    const paymentIntentId = paymentIntent || storedPaymentIntent;

    if (!paymentIntentId) {
      // Check if we have a saved order number (page refresh after success)
      const savedOrder = localStorage.getItem("stripe_order_number");
      if (savedOrder) {
        setOrderNumber(savedOrder);
        setStatus("success");
        return;
      }
      router.push("/");
      return;
    }

    // If redirect status indicates failure
    if (redirectStatus === "failed") {
      setStatus("failed");
      return;
    }

    try {
      // Check payment status via API
      const res = await fetch(`/api/stripe/payment-status?payment_intent=${paymentIntentId}`);

      // Check if response is JSON
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        // API not available or returned error, keep polling
        setAttempts((a) => a + 1);
        setStatus("pending");
        return;
      }

      if (!res.ok) {
        // If API doesn't exist yet, wait for webhook to process
        setAttempts((a) => a + 1);
        setStatus("pending");
        return;
      }

      const data = await res.json();

      if (data.status === "succeeded") {
        if (data.orderNumber) {
          setOrderNumber(data.orderNumber);
          setStatus("success");
          clearCart();
          localStorage.removeItem("stripe_payment_intent");
          localStorage.removeItem("checkout_cart_items");
          localStorage.setItem("stripe_order_number", data.orderNumber);
        } else {
          // Payment succeeded but order not yet created (webhook processing)
          setAttempts((a) => a + 1);
          setStatus("pending");
        }
        return;
      }

      if (data.status === "processing" || data.status === "requires_action") {
        setAttempts((a) => a + 1);
        setStatus("pending");
        return;
      }

      if (data.status === "requires_payment_method" || data.status === "canceled") {
        setStatus("failed");
        return;
      }

      // Unknown status, keep polling
      setAttempts((a) => a + 1);
      setStatus("pending");
    } catch {
      // Network error or API not available, keep polling
      setAttempts((a) => a + 1);
      setStatus("pending");
    }
  }

  // ── loading / pending ─────────────────────────────────
  if (status === "loading" || status === "pending") {
    const isTooLong = attempts >= 10;
    return (
      <div style={{ padding: "100px 24px", textAlign: "center" }}>
        {isTooLong ? (
          <>
            <p style={{ fontSize: 13, color: "#999", margin: "0 0 24px" }}>
              Payment is being processed. This may take a moment.
            </p>
            <Link
              href="/account/orders"
              style={{ fontSize: 11, color: "#000", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}
            >
              CHECK MY ORDERS
            </Link>
          </>
        ) : (
          <>
            <p
              style={{
                fontSize: 11,
                color: "#999",
                letterSpacing: 1,
                textTransform: "uppercase",
                margin: "0 0 8px",
              }}
            >
              PROCESSING PAYMENT...
            </p>
            <p style={{ fontSize: 11, color: "#bbb", margin: 0 }}>
              Please wait, do not close this page.
            </p>
          </>
        )}
      </div>
    );
  }

  // ── failed ────────────────────────────────────────────
  if (status === "failed") {
    return (
      <div style={{ maxWidth: 440, margin: "100px auto", padding: "0 24px", textAlign: "center" }}>
        <div
          style={{
            border: "1px solid #e6e6e6",
            padding: 40,
          }}
        >
          <p
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: "#999",
              margin: "0 0 12px",
            }}
          >
            PAYMENT STATUS
          </p>
          <p style={{ fontSize: 16, fontWeight: 700, margin: "0 0 24px", color: "#c00" }}>
            Failed
          </p>
          <p style={{ fontSize: 12, color: "#666", margin: "0 0 24px" }}>
            Your payment could not be processed. No charge has been made.
          </p>
          <Link
            href="/checkout"
            style={{
              display: "inline-block",
              padding: "10px 28px",
              background: "#000",
              color: "#fff",
              textDecoration: "none",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            TRY AGAIN
          </Link>
        </div>
      </div>
    );
  }

  // ── success ───────────────────────────────────────────
  return (
    <div style={{ maxWidth: 440, margin: "100px auto", padding: "0 24px" }}>
      <div style={{ border: "1px solid #e6e6e6", padding: 40 }}>
        {/* checkmark */}
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            border: "2px solid #000",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        {/* title */}
        <h1
          style={{
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            textAlign: "center",
            margin: "0 0 8px",
          }}
        >
          ORDER CONFIRMED
        </h1>

        <p style={{ fontSize: 12, color: "#666", textAlign: "center", margin: "0 0 24px" }}>
          Thank you for your purchase
        </p>

        {/* order number */}
        {orderNumber && (
          <div
            style={{
              textAlign: "center",
              padding: "16px 0",
              borderTop: "1px solid #ebebeb",
              borderBottom: "1px solid #ebebeb",
              marginBottom: 28,
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: "#999",
                marginBottom: 6,
              }}
            >
              ORDER NUMBER
            </div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>#{orderNumber}</div>
          </div>
        )}

        {/* buttons */}
        <div style={{ display: "flex", gap: 12 }}>
          <Link
            href="/account/orders"
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "12px 0",
              background: "#000",
              color: "#fff",
              textDecoration: "none",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            MY ORDERS
          </Link>
          <Link
            href="/"
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "12px 0",
              border: "1px solid #e6e6e6",
              color: "#000",
              textDecoration: "none",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            CONTINUE SHOPPING
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <div style={{ padding: "100px 24px", textAlign: "center" }}>
        <p style={{ fontSize: 11, color: "#999", letterSpacing: 1, textTransform: "uppercase" }}>
          LOADING...
        </p>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
