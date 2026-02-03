"use client";
import { useEffect } from "react";

export default function OverscrollGuard() {
  useEffect(() => {
    const html = document.documentElement;

    const onScroll = () => {
      const atBottom =
        html.scrollTop > 0 &&
        html.scrollTop + html.clientHeight >= html.scrollHeight - 2;
      html.style.background = atBottom ? "#0a0a0a" : "";
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return null;
}
