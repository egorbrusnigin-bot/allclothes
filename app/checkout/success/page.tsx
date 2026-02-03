"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { getCartItems, clearCart, type CartItem } from "../../lib/cart";

export default function CheckoutSuccessPage() {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "pending" | "success" | "failed">("loading");
  const [attempts, setAttempts] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    confirm();
  }, []);

  // retry on pending status change
  useEffect(() => {
    if (status === "pending" && attempts < 10) {
      timerRef.current = setTimeout(() => {
        confirm();
      }, 3000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [status, attempts]);

  async function confirm() {
    if (!supabase) {
      router.push("/");
      return;
    }

    const invoiceId = localStorage.getItem("lava_invoice_id");
    if (!invoiceId) {
      router.push("/");
      return;
    }

    const cartItems = getCartItems();
    if (cartItems.length === 0) {
      // Cart was already cleared (e.g. page refresh after success)
      // Check if we already have an order number stored
      const savedOrder = localStorage.getItem("lava_order_number");
      if (savedOrder) {
        setOrderNumber(savedOrder);
        setStatus("success");
        return;
      }
      router.push("/");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/?login=1");
        return;
      }

      const res = await fetch("/api/checkout/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ invoiceId, cartItems }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("failed");
        return;
      }

      // Order confirmed
      if (data.orderNumber) {
        setOrderNumber(data.orderNumber);
        setStatus("success");
        clearCart();
        localStorage.removeItem("lava_invoice_id");
        localStorage.setItem("lava_order_number", data.orderNumber);
        return;
      }

      // Still processing
      if (data.status === "NEW" || data.status === "IN_PROGRESS") {
        setAttempts((a) => a + 1);
        setStatus("pending");
        return;
      }

      // Failed payment
      setStatus("failed");
    } catch {
      setStatus("failed");
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
              Payment is taking longer than expected.
            </p>
            <a
              href="/account/orders"
              style={{ fontSize: 11, color: "#000", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}
            >
              CHECK MY ORDERS
            </a>
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
          <a
            href="/"
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
            BACK TO CART
          </a>
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

        {/* buttons */}
        <div style={{ display: "flex", gap: 12 }}>
          <a
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
          </a>
          <a
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
          </a>
        </div>
      </div>
    </div>
  );
}
