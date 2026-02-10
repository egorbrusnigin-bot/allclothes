"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import { getCartItemCount } from "../lib/cart";
import { getDisplayCurrency, setDisplayCurrency, type DisplayCurrency } from "../lib/currency";
import CartDrawer from "./CartDrawer";
import LogoParticles from "./LogoParticles";
import { useIsMobile } from "../lib/useIsMobile";

export default function Header() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [currency, setCurrency] = useState<DisplayCurrency>('EUR');
  const [menuOpen, setMenuOpen] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    checkAuth();
    updateCartCount();
    setCurrency(getDisplayCurrency());

    const { data: authListener } = supabase?.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    }) || { data: { subscription: { unsubscribe: () => {} } } };

    const handleCartUpdate = () => {
      updateCartCount();
    };
    window.addEventListener("cartUpdated", handleCartUpdate);

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

  // Close menu on route change (when user clicks a link)
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

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

  const navLinks = [
    { href: "/catalog", label: "CATALOG" },
    { href: "/brands", label: "BRANDS" },
    { href: "/releases", label: "RELEASES" },
    { href: "/map", label: "MAP" },
    { href: "/gallery", label: "GALLERY" },
  ];

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
          padding: isMobile ? "12px 16px" : "18px 24px",
          display: "grid",
          gridTemplateColumns: isMobile ? "auto 1fr auto" : "1fr auto 1fr",
          alignItems: "center",
        }}
      >
        {/* Mobile: burger button | Desktop: nav */}
        {isMobile ? (
          <button
            onClick={() => setMenuOpen(true)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              flexDirection: "column",
              gap: 5,
              justifySelf: "start",
            }}
            aria-label="Open menu"
          >
            <span style={{ display: "block", width: 22, height: 1.5, background: "#000" }} />
            <span style={{ display: "block", width: 22, height: 1.5, background: "#000" }} />
            <span style={{ display: "block", width: 14, height: 1.5, background: "#000" }} />
          </button>
        ) : (
          <nav style={{ display: "flex", gap: 22, fontSize: 13, letterSpacing: 1 }}>
            {navLinks.map(link => (
              <Link key={link.href} href={link.href} style={{ textDecoration: "none" }}>{link.label}</Link>
            ))}
          </nav>
        )}

        {/* Logo - centered */}
        <Link href="/" style={{ justifySelf: "center", textDecoration: "none", display: "flex", alignItems: "center" }}>
          <LogoParticles />
        </Link>

        {/* Right side */}
        {isMobile ? (
          <div style={{ display: "flex", gap: 14, justifySelf: "end", alignItems: "center" }}>
            <button
              onClick={() => setIsCartOpen(true)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 11,
                letterSpacing: 1,
                padding: 0,
                color: "inherit",
                fontFamily: "inherit",
                fontWeight: 700,
              }}
            >
              CART{cartCount > 0 && ` (${cartCount})`}
            </button>
          </div>
        ) : (
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
        )}
      </header>

      {/* Mobile fullscreen menu */}
      {isMobile && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "#fff",
            zIndex: 100,
            display: "flex",
            flexDirection: "column",
            transform: menuOpen ? "translateX(0)" : "translateX(-100%)",
            transition: "transform 0.3s ease",
          }}
        >
          {/* Menu header */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 16px",
            borderBottom: "1px solid #eee",
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5 }}>MENU</span>
            <button
              onClick={() => setMenuOpen(false)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 24,
                lineHeight: 1,
                padding: 4,
                color: "#000",
              }}
              aria-label="Close menu"
            >
              ×
            </button>
          </div>

          {/* Nav links */}
          <nav style={{ flex: 1, display: "flex", flexDirection: "column", padding: "24px 24px" }}>
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                style={{
                  textDecoration: "none",
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: 2,
                  padding: "16px 0",
                  borderBottom: "1px solid #f0f0f0",
                  color: "#000",
                }}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Bottom section */}
          <div style={{ padding: "24px", borderTop: "1px solid #eee" }}>
            {/* Currency */}
            <div style={{ marginBottom: 20 }}>
              <select
                value={currency}
                onChange={(e) => handleCurrencyChange(e.target.value as DisplayCurrency)}
                style={{
                  WebkitAppearance: "none",
                  appearance: "none" as const,
                  background: "#f5f5f5",
                  border: "1px solid #e6e6e6",
                  borderRadius: 0,
                  fontSize: 13,
                  letterSpacing: 1,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  color: "#000",
                  outline: "none",
                  padding: "12px 16px",
                  width: "100%",
                }}
              >
                <option value="EUR">€ EUR</option>
                <option value="USD">$ USD</option>
                <option value="GBP">£ GBP</option>
              </select>
            </div>

            {/* Account links */}
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              {!isLoggedIn ? (
                <>
                  <Link
                    href="/signup"
                    onClick={() => setMenuOpen(false)}
                    style={{
                      textDecoration: "none",
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: 1,
                      color: "#000",
                      border: "1px solid #000",
                      padding: "12px 0",
                      flex: 1,
                      textAlign: "center",
                    }}
                  >
                    SIGN UP
                  </Link>
                  <Link
                    href="/?login=1"
                    onClick={() => setMenuOpen(false)}
                    style={{
                      textDecoration: "none",
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: 1,
                      background: "#000",
                      color: "#fff",
                      padding: "12px 0",
                      flex: 1,
                      textAlign: "center",
                    }}
                  >
                    LOG IN
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/account" onClick={() => setMenuOpen(false)} style={{ textDecoration: "none", fontSize: 12, fontWeight: 700, letterSpacing: 1, color: "#000", border: "1px solid #e6e6e6", padding: "12px 0", flex: 1, textAlign: "center" }}>ACCOUNT</Link>
                  <Link href="/favorites" onClick={() => setMenuOpen(false)} style={{ textDecoration: "none", fontSize: 12, fontWeight: 700, letterSpacing: 1, color: "#000", border: "1px solid #e6e6e6", padding: "12px 0", flex: 1, textAlign: "center" }}>FAVORITES</Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </>
  );
}
