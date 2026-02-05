"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function AuthModal() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const isOpen = sp.get("login") === "1";

  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const closeUrl = useMemo(() => {
    const next = new URLSearchParams(sp.toString());
    next.delete("login");
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }, [sp, pathname]);

  function close() {
    setShown(false);
    setTimeout(() => {
      setMounted(false);
      setEmail("");
      setPassword("");
      setStatus("");
      router.replace(closeUrl);
    }, 180);
  }

  useEffect(() => {
    if (!isOpen) return;

    setMounted(true);
    const t = requestAnimationFrame(() => setShown(true));

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    document.body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      cancelAnimationFrame(t);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  async function signIn() {
    if (!supabase) return setStatus("Supabase not configured");
    if (!email || !password) return setStatus("Fill in all fields");

    setLoading(true);
    setStatus("Signing in...");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    setLoading(false);

    if (error) {
      setStatus(error.message);
    } else {
      setStatus("");
      close();
      router.push("/account");
    }
  }

  async function signInWithGoogle() {
    if (!supabase) return setStatus("Supabase not configured");
    setLoading(true);
    setStatus("Connecting to Google...");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);
    if (error) setStatus(error.message);
  }

  if (!mounted) return null;

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: shown ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0)",
        backdropFilter: shown ? "blur(10px)" : "blur(0px)",
        WebkitBackdropFilter: shown ? "blur(10px)" : "blur(0px)",
        transition: "background 180ms ease, backdrop-filter 180ms ease",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "min(400px, 100%)",
          borderRadius: 4,
          background: "#fff",
          boxShadow: "0 25px 80px rgba(0,0,0,0.2)",
          transform: shown ? "translateY(0) scale(1)" : "translateY(12px) scale(0.98)",
          opacity: shown ? 1 : 0,
          transition: "transform 180ms ease, opacity 180ms ease",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 20px 0" }}>
          <div style={{ fontWeight: 800, letterSpacing: 0.5 }}>LOG IN</div>
          <button
            onClick={close}
            style={{ all: "unset", cursor: "pointer", padding: 8, fontSize: 18, opacity: 0.5 }}
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <div style={{ padding: 20, display: "grid", gap: 14 }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && signIn()}
            style={{
              padding: 14,
              border: "1px solid #e0e0e0",
              borderRadius: 4,
              fontSize: 15,
              outline: "none",
            }}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && signIn()}
            style={{
              padding: 14,
              border: "1px solid #e0e0e0",
              borderRadius: 4,
              fontSize: 15,
              outline: "none",
            }}
          />

          <button
            onClick={signIn}
            disabled={loading}
            style={{
              padding: 14,
              borderRadius: 4,
              border: "none",
              background: "#000",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "..." : "Sign in"}
          </button>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, height: 1, background: "#e0e0e0" }} />
            <span style={{ fontSize: 12, color: "#999" }}>or</span>
            <div style={{ flex: 1, height: 1, background: "#e0e0e0" }} />
          </div>

          {/* Google */}
          <button
            onClick={signInWithGoogle}
            disabled={loading}
            style={{
              padding: 14,
              borderRadius: 4,
              border: "1px solid #e0e0e0",
              background: "#fff",
              fontSize: 14,
              fontWeight: 500,
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          {/* Status */}
          {status && (
            <div style={{
              padding: 10,
              borderRadius: 4,
              background: status.includes("...") ? "#f5f5f5" : "#fef2f2",
              color: status.includes("...") ? "#666" : "#dc2626",
              fontSize: 13,
              textAlign: "center",
            }}>
              {status}
            </div>
          )}

          {/* Sign up link */}
          <div style={{ textAlign: "center", fontSize: 13, color: "#666", marginTop: 4 }}>
            Don't have an account?{" "}
            <a
              href="/signup"
              style={{ color: "#000", fontWeight: 600, textDecoration: "none" }}
              onClick={() => {
                document.body.style.overflow = "";
              }}
            >
              Sign up
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
