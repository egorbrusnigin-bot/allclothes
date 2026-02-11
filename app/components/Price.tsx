"use client";

import { useState, useEffect } from "react";
import { formatPrice } from "../lib/currency";

// Client-only price component to avoid hydration mismatch
// (formatPrice reads localStorage for display currency and exchange rates)
export default function Price({
  price,
  currency = "EUR",
  style,
}: {
  price: number;
  currency?: string;
  style?: React.CSSProperties;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // On server and first client render, show EUR price directly to avoid mismatch
  if (!mounted) {
    return (
      <span style={style} suppressHydrationWarning>
        €{price.toFixed(2)}
      </span>
    );
  }

  return (
    <span style={style} suppressHydrationWarning>
      {formatPrice(price, currency)}
    </span>
  );
}
