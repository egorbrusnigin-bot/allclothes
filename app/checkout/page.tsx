"use client";

import type React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { supabase } from "../lib/supabase";
import { getCartItems, getCartTotal, clearCart, type CartItem } from "../lib/cart";
import { formatPrice, convertToEUR } from "../lib/currency";
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
  const [elementReady, setElementReady] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements || paying || !elementReady) return;

    setPaying(true);
    onError("");

    try {
      // Submit the form data from Elements first
      const { error: submitError } = await elements.submit();
      if (submitError) {
        onError(submitError.message || "Payment validation failed");
        setPaying(false);
        return;
      }

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
    } catch (err) {
      onError("Payment failed. Please try again.");
      setPaying(false);
    }
  }

  const isDisabled = !stripe || !elementReady || paying;

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: 24 }}>
        <PaymentElement
          options={{
            layout: "tabs",
          }}
          onReady={() => setElementReady(true)}
        />
      </div>

      <button
        type="submit"
        disabled={isDisabled}
        style={{
          width: "100%",
          padding: "14px",
          background: isDisabled ? "#888" : "#000",
          color: "#fff",
          border: "none",
          fontSize: 12,
          fontWeight: 700,
          cursor: isDisabled ? "not-allowed" : "pointer",
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        {paying ? "PROCESSING..." : !elementReady ? "LOADING..." : `PAY ${formatPrice(amount, currency)}`}
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

  // Адрес доставки
  const [fullName, setFullName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("");

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
    // Всё конвертируем в EUR (платформа работает в евро)
    setTotal(getCartTotal());
    setEmail(user.email || "");
    setCurrency("EUR");
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
        body: JSON.stringify({
          cartItems,
          email,
          shippingAddress: { fullName, address, city, postalCode, country },
        }),
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
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "40px 16px" }}>
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

              {/* price — конвертируем в EUR */}
              <div style={{ fontSize: 13, fontWeight: 700 }}>
                €{(convertToEUR(item.price, item.currency) * item.quantity).toFixed(2)}
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
            €{total.toFixed(2)}
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

          {/* shipping address */}
          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: "#999",
                marginBottom: 12,
              }}
            >
              SHIPPING ADDRESS
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full name"
                required
                style={inputStyle}
              />
              <AddressAutocomplete
                value={address}
                onChange={setAddress}
                onSelect={(place) => {
                  setAddress(place.address);
                  if (place.city) setCity(place.city);
                  if (place.postalCode) setPostalCode(place.postalCode);
                  if (place.country) setCountry(place.country);
                }}
                placeholder="Start typing address..."
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <GeoAutocomplete
                  value={city}
                  onChange={setCity}
                  onSelect={(text) => setCity(text)}
                  placeholder="City"
                  geoTypes="place,municipality"
                />
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="Postal code"
                  required
                  style={inputStyle}
                />
              </div>
              <GeoAutocomplete
                value={country}
                onChange={setCountry}
                onSelect={(text) => setCountry(text)}
                placeholder="Country"
                geoTypes="country"
              />
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

          {/* proceed button */}
          <button
            onClick={handleProceedToPayment}
            disabled={creatingIntent || !email || !fullName || !address || !city || !country}
            style={{
              width: "100%",
              padding: "14px",
              background: creatingIntent || !email || !fullName || !address || !city || !country ? "#888" : "#000",
              color: "#fff",
              border: "none",
              fontSize: 12,
              fontWeight: 700,
              cursor: creatingIntent || !email || !fullName || !address || !city || !country ? "not-allowed" : "pointer",
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

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #e6e6e6",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

// Простой автокомплит для города/страны через MapTiler
function GeoAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  geoTypes,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (text: string) => void;
  placeholder?: string;
  geoTypes: string;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    onChange(v);
    if (!key || v.length < 2) {
      setSuggestions([]);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(v)}.json?key=${key}&types=${geoTypes}&limit=5&language=en`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.features) {
          setSuggestions(data.features.map((f: any) => f.text || f.place_name));
          setShowSuggestions(true);
          setActiveIndex(-1);
        }
      } catch {
        setSuggestions([]);
      }
    }, 300);
  }

  function select(text: string) {
    onSelect(text);
    setSuggestions([]);
    setShowSuggestions(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      select(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  }

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        required
        style={inputStyle}
        autoComplete="off"
      />
      {showSuggestions && suggestions.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "#fff",
            border: "1px solid #e6e6e6",
            borderTop: "none",
            zIndex: 50,
            maxHeight: 200,
            overflowY: "auto",
          }}
        >
          {suggestions.map((s, i) => (
            <div
              key={i}
              onClick={() => select(s)}
              style={{
                padding: "10px 12px",
                fontSize: 12,
                cursor: "pointer",
                background: i === activeIndex ? "#f5f5f5" : "#fff",
                borderBottom: i < suggestions.length - 1 ? "1px solid #f0f0f0" : "none",
              }}
              onMouseEnter={() => setActiveIndex(i)}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Автокомплит адреса через MapTiler Geocoding API
interface PlaceResult {
  address: string;
  city: string;
  postalCode: string;
  country: string;
}

interface GeoFeature {
  place_name: string;
  text: string;
  context?: Array<{ id: string; text: string; short_code?: string }>;
  address?: string;
}

function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (place: PlaceResult) => void;
  placeholder?: string;
}) {
  const [suggestions, setSuggestions] = useState<GeoFeature[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;

  // Закрытие при клике вне
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const search = useCallback(
    (query: string) => {
      if (!key || query.length < 3) {
        setSuggestions([]);
        return;
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        try {
          const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${key}&types=address,place&limit=5&language=en`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.features) {
            setSuggestions(data.features);
            setShowSuggestions(true);
            setActiveIndex(-1);
          }
        } catch {
          setSuggestions([]);
        }
      }, 300);
    },
    [key]
  );

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    onChange(v);
    search(v);
  }

  function selectSuggestion(feature: GeoFeature) {
    const ctx = feature.context || [];
    const getCtx = (prefix: string) =>
      ctx.find((c) => c.id.startsWith(prefix))?.text || "";

    const streetNumber = feature.address || "";
    const streetName = feature.text || "";
    const fullAddress = streetNumber
      ? `${streetName} ${streetNumber}`
      : feature.place_name?.split(",")[0] || streetName;

    onSelect({
      address: fullAddress,
      city:
        getCtx("place") ||
        getCtx("municipality") ||
        getCtx("district") ||
        "",
      postalCode: getCtx("postal_code"),
      country: getCtx("country"),
    });
    setSuggestions([]);
    setShowSuggestions(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  }

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <input
        type="text"
        value={value}
        onChange={handleInputChange}
        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        required
        style={inputStyle}
        autoComplete="off"
      />
      {showSuggestions && suggestions.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "#fff",
            border: "1px solid #e6e6e6",
            borderTop: "none",
            zIndex: 50,
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          {suggestions.map((s, i) => (
            <div
              key={i}
              onClick={() => selectSuggestion(s)}
              style={{
                padding: "10px 12px",
                fontSize: 12,
                cursor: "pointer",
                background: i === activeIndex ? "#f5f5f5" : "#fff",
                borderBottom:
                  i < suggestions.length - 1 ? "1px solid #f0f0f0" : "none",
              }}
              onMouseEnter={() => setActiveIndex(i)}
            >
              {s.place_name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
