"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import { getCartItemCount } from "../lib/cart";
import { getDisplayCurrency, setDisplayCurrency, type DisplayCurrency } from "../lib/currency";
import CartDrawer from "./CartDrawer";

export default function Header() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [currency, setCurrency] = useState<DisplayCurrency>('EUR');

  useEffect(() => {
    checkAuth();
    updateCartCount();
    setCurrency(getDisplayCurrency());

    const { data: authListener } = supabase?.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    }) || { data: { subscription: { unsubscribe: () => {} } } };

    // Listen for cart updates
    const handleCartUpdate = () => {
      updateCartCount();
    };
    window.addEventListener("cartUpdated", handleCartUpdate);

    // Listen for cart open requests
    const handleOpenCart = () => {
      setIsCartOpen(true);
    };
    window.addEventListener("openCart", handleOpenCart);

    return () => {
      authListener?.subscription?.unsubscribe();
      window.removeEventListener("cartUpdated", handleCartUpdate);
      window.removeEventListener("openCart", handleOpenCart);
    };
  }, []);

  async function checkAuth() {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    setIsLoggedIn(!!user);
  }

  function updateCartCount() {
    const count = getCartItemCount();
    setCartCount(count);
  }

  function handleCurrencyChange(newCurrency: DisplayCurrency) {
    setCurrency(newCurrency);
    setDisplayCurrency(newCurrency);
  }

  return (
    <>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "rgba(255,255,255,0.9)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          borderBottom: "1px solid #eee",
          padding: "18px 24px",
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
        }}
      >
      <nav style={{ display: "flex", gap: 22, fontSize: 13, letterSpacing: 1 }}>
        <Link href="/catalog" style={{ textDecoration: "none" }}>CATALOG</Link>
        <Link href="/brands" style={{ textDecoration: "none" }}>BRANDS</Link>
        <Link href="/releases" style={{ textDecoration: "none" }}>RELEASES</Link>
        <Link href="/map" style={{ textDecoration: "none" }}>MAP</Link>
      </nav>

      <Link href="/" style={{ justifySelf: "center", textDecoration: "none", display: "flex", alignItems: "center" }}>
        <img src="/ALLCLOTHES.png" alt="ALLCLOTHES" style={{ height: 14 }} />
      </Link>

      <div style={{ display: "flex", gap: 22, justifySelf: "end", alignItems: "center", fontSize: 13, letterSpacing: 1 }}>
        <select
          value={currency}
          onChange={(e) => handleCurrencyChange(e.target.value as DisplayCurrency)}
          style={{
            background: "none",
            border: "none",
            fontSize: 13,
            letterSpacing: 1,
            cursor: "pointer",
            fontFamily: "inherit",
            color: "inherit",
            outline: "none",
          }}
        >
          <option value="EUR">€ EUR</option>
          <option value="USD">$ USD</option>
          <option value="GBP">£ GBP</option>
        </select>
        {!isLoggedIn ? (
          <>
            <Link href="/signup" style={{ textDecoration: "none" }}>SIGN UP</Link>
            <Link
              href="/?login=1"
              style={{
                textDecoration: "none",
                background: "#000",
                color: "#fff",
                padding: "8px 14px",
              }}
            >
              LOG IN
            </Link>
          </>
        ) : (
          <>
            <Link href="/account" style={{ textDecoration: "none" }}>ACCOUNT</Link>
            <Link href="/favorites" style={{ textDecoration: "none" }}>FAVORITES</Link>
          </>
        )}
        <button
          onClick={() => setIsCartOpen(true)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 13,
            letterSpacing: 1,
            padding: 0,
            color: "inherit",
            fontFamily: "inherit",
            textDecoration: "none",
          }}
        >
          CART {cartCount > 0 && `(${cartCount})`}
        </button>
      </div>
    </header>

    <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </>
  );
}
