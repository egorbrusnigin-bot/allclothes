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
  const [pass, setPass] = useState("");
  const [status, setStatus] = useState("");

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

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      cancelAnimationFrame(t);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  async function signIn() {
    if (!supabase) return setStatus("Supabase not configured (.env.local)");
    setStatus("...");
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) setStatus(error.message);
    else {
      setStatus("");
      close();
      router.push("/account");
    }
  }

  function goToSignup() {
    setMounted(false);
    setShown(false);
    document.body.style.overflow = "";
    router.push("/signup");
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
          width: "min(520px, 100%)",
          borderRadius: 22,
          border: "1px solid rgba(255,255,255,0.35)",
          background: "rgba(255,255,255,0.92)",
          boxShadow: "0 30px 90px rgba(0,0,0,0.25)",
          transform: shown ? "translateY(0px) scale(1)" : "translateY(12px) scale(0.98)",
          opacity: shown ? 1 : 0,
          transition: "transform 180ms ease, opacity 180ms ease",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 18px 6px" }}>
          <div style={{ fontWeight: 800, letterSpacing: 0.5 }}>ALLCLOTHES</div>
          <button onClick={close} style={{ all: "unset", cursor: "pointer", padding: 10, lineHeight: 1, fontSize: 18, opacity: 0.7 }} aria-label="Close">
            ✕
          </button>
        </div>

        <div style={{ padding: "14px 18px 18px", display: "grid", gap: 12 }}>
          <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ padding: 16, border: "1px solid #e6e6e6", borderRadius: 16, background: "#fff" }} />
          <input placeholder="Password" type="password" value={pass} onChange={(e) => setPass(e.target.value)} style={{ padding: 16, border: "1px solid #e6e6e6", borderRadius: 16, background: "#fff" }} />

          <button onClick={signIn} style={{ padding: 16, borderRadius: 18, border: "1px solid #000", background: "#000", color: "#fff" }}>
            Sign in
          </button>

          <button onClick={goToSignup} style={{ padding: 16, borderRadius: 18, border: "1px solid #e6e6e6", background: "#fff" }}>
            Create account
          </button>

          <div style={{ fontSize: 12, color: "#777", minHeight: 18 }}>{status}</div>
        </div>
      </div>
    </div>
  );
}
