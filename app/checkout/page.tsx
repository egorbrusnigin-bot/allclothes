"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { supabase } from "../lib/supabase";
import { getCartItems, getCartTotal, clearCart, type CartItem } from "../lib/cart";
import { formatPrice, formatTotal } from "../lib/currency";
import LoadingLogo from "../components/LoadingLogo";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "");

function PaymentForm({
  amount,
  currency,
  onSuccess,
  onError,
}: {
  amount: number;
  currency: string;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements || paying) return;

    setPaying(true);
    onError("");

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/success`,
      },
    });

    if (error) {
      onError(error.message || "Payment failed");
      setPaying(false);
    } else {
      onSuccess();
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: 24 }}>
        <PaymentElement
          options={{
            layout: "tabs",
          }}
        />
      </div>

      <button
        type="submit"
        disabled={!stripe || paying}
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
        {paying ? "PROCESSING..." : `PAY ${formatPrice(amount, currency)}`}
      </button>
    </form>
  );
}

export default function CheckoutPage() {
  const router = useRouter();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [total, setTotal] = useState(0);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [creatingIntent, setCreatingIntent] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState("EUR");

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
    setCurrency(items[0]?.currency || "EUR");
    setLoading(false);
  }

  async function handleProceedToPayment() {
    if (!supabase || creatingIntent) return;
    setCreatingIntent(true);
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

      // Check if response is JSON
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        setError("Server error. Please try again later.");
        setCreatingIntent(false);
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create payment");
        setCreatingIntent(false);
        return;
      }

      // Store payment intent info for success page
      localStorage.setItem("stripe_payment_intent", data.paymentIntentId);
      localStorage.setItem("checkout_cart_items", JSON.stringify(cartItems));

      setClientSecret(data.clientSecret);
      setCurrency(data.currency || "EUR");
    } catch {
      setError("Something went wrong. Please try again.");
      setCreatingIntent(false);
    }
  }

  function handlePaymentSuccess() {
    clearCart();
  }

  // ── loading ───────────────────────────────────────────
  if (loading) {
    return <LoadingLogo />;
  }

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
                {formatPrice(item.price * item.quantity, item.currency)}
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
            {formatTotal(total)}
          </span>
        </div>
      </div>

      {/* Payment section */}
      {!clientSecret ? (
        <>
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

          {/* proceed button */}
          <button
            onClick={handleProceedToPayment}
            disabled={creatingIntent || !email}
            style={{
              width: "100%",
              padding: "14px",
              background: creatingIntent || !email ? "#888" : "#000",
              color: "#fff",
              border: "none",
              fontSize: 12,
              fontWeight: 700,
              cursor: creatingIntent || !email ? "not-allowed" : "pointer",
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            {creatingIntent ? "LOADING..." : "PROCEED TO PAYMENT"}
          </button>
        </>
      ) : (
        <>
          {/* Stripe Elements */}
          <div style={{ marginBottom: 16 }}>
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
              PAYMENT DETAILS
            </div>
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

          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: {
                theme: "stripe",
                variables: {
                  colorPrimary: "#000000",
                  fontFamily: "system-ui, sans-serif",
                  borderRadius: "0px",
                },
              },
            }}
          >
            <PaymentForm
              amount={total}
              currency={currency}
              onSuccess={handlePaymentSuccess}
              onError={(msg) => setError(msg)}
            />
          </Elements>

          {/* back button */}
          <button
            onClick={() => {
              setClientSecret(null);
              setError(null);
            }}
            style={{
              width: "100%",
              padding: "12px",
              background: "transparent",
              color: "#666",
              border: "1px solid #e6e6e6",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: 1,
              marginTop: 12,
            }}
          >
            ← BACK
          </button>
        </>
      )}

      {/* Security note */}
      <div
        style={{
          marginTop: 24,
          padding: "12px 16px",
          background: "#f9f9f9",
          border: "1px solid #e6e6e6",
          fontSize: 10,
          color: "#666",
          textAlign: "center",
        }}
      >
        🔒 Secure payment powered by Stripe
      </div>
    </div>
  );
}
