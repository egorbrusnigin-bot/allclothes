"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getCartItems, getCartTotal, type CartItem } from "../lib/cart";

export default function CheckoutPage() {
  const router = useRouter();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [total, setTotal] = useState(0);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    if (!supabase) {
      router.push("/?login=1");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/?login=1");
      return;
    }

    const items = getCartItems();
    if (items.length === 0) {
      router.push("/");
      return;
    }

    setCartItems(items);
    setTotal(getCartTotal());
    setEmail(user.email || "");
    setLoading(false);
  }

  async function handlePay() {
    if (!supabase || paying) return;
    setPaying(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/?login=1");
        return;
      }

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ cartItems, email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Payment failed");
        setPaying(false);
        return;
      }

      // Store invoiceId for the success page
      localStorage.setItem("lava_invoice_id", data.invoiceId);

      // Redirect to lava.top payment page
      window.location.href = data.paymentUrl;
    } catch {
      setError("Something went wrong. Please try again.");
      setPaying(false);
    }
  }

  // ── loading ───────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: "center" }}>
        <p style={{ fontSize: 11, color: "#999", letterSpacing: 1, textTransform: "uppercase", margin: 0 }}>
          Loading...
        </p>
      </div>
    );
  }

  const currency = cartItems[0]?.currency || "EUR";

  // ── render ────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "60px 24px" }}>
      {/* title */}
      <h1
        style={{
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          margin: "0 0 32px",
        }}
      >
        CHECKOUT
      </h1>

      {/* cart summary */}
      <div style={{ border: "1px solid #e6e6e6", padding: 22, marginBottom: 24 }}>
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: "#999",
            marginBottom: 16,
          }}
        >
          ORDER SUMMARY
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          {cartItems.map((item) => (
            <div
              key={`${item.productId}-${item.size}`}
              style={{
                display: "grid",
                gridTemplateColumns: "60px 1fr auto",
                gap: 14,
                alignItems: "start",
              }}
            >
              {/* image */}
              <img
                src={item.imageUrl}
                alt={item.productName}
                style={{ width: 60, height: 80, objectFit: "cover" }}
              />

              {/* info */}
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    marginBottom: 3,
                  }}
                >
                  {item.brandName}
                </div>
                <div style={{ fontSize: 12, color: "#1a1a1a", marginBottom: 3 }}>
                  {item.productName}
                </div>
                <div style={{ fontSize: 10, color: "#999" }}>
                  SIZE: {item.size} · QTY: {item.quantity}
                </div>
              </div>

              {/* price */}
              <div style={{ fontSize: 13, fontWeight: 700 }}>
                {item.currency} {(item.price * item.quantity).toFixed(2)}
              </div>
            </div>
          ))}
        </div>

        {/* divider + total */}
        <div style={{ height: 1, background: "#ebebeb", margin: "18px 0 14px" }} />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: "#999",
            }}
          >
            TOTAL
          </span>
          <span style={{ fontSize: 16, fontWeight: 700 }}>
            {currency} {total.toFixed(2)}
          </span>
        </div>
      </div>

      {/* email */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: "#999",
            marginBottom: 8,
          }}
        >
          EMAIL
        </div>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          style={{
            width: "100%",
            padding: "10px 12px",
            border: "1px solid #e6e6e6",
            fontSize: 13,
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* error */}
      {error && (
        <div
          style={{
            padding: "10px 14px",
            background: "#fff0f0",
            border: "1px solid #ffcccc",
            marginBottom: 16,
            fontSize: 13,
            color: "#c00",
          }}
        >
          {error}
        </div>
      )}

      {/* pay button */}
      <button
        onClick={handlePay}
        disabled={paying}
        style={{
          width: "100%",
          padding: "14px",
          background: paying ? "#888" : "#000",
          color: "#fff",
          border: "none",
          fontSize: 12,
          fontWeight: 700,
          cursor: paying ? "not-allowed" : "pointer",
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        {paying ? "PROCESSING..." : `PAY ${currency} ${total.toFixed(2)}`}
      </button>
    </div>
  );
}
