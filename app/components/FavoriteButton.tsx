"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { toggleFavorite } from "../lib/favorites";

interface FavoriteButtonProps {
  productId: string;
  initialIsFavorited: boolean;
  size?: number; // Icon size in pixels
  onToggle?: (isFavorited: boolean) => void; // Callback for parent components
  variant?: "overlay" | "inline"; // overlay = circle with bg, inline = just icon
}

export default function FavoriteButton({
  productId,
  initialIsFavorited,
  size = 24,
  onToggle,
  variant = "overlay"
}: FavoriteButtonProps) {
  const [isFavorited, setIsFavorited] = useState(initialIsFavorited);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    checkAuth();

    const { data: authListener } = supabase?.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    }) || { data: { subscription: { unsubscribe: () => {} } } };

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setIsFavorited(initialIsFavorited);
  }, [initialIsFavorited]);

  async function checkAuth() {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    setIsLoggedIn(!!user);
  }

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    // If not logged in, redirect to login
    if (!isLoggedIn) {
      window.location.href = "/?login=1";
      return;
    }

    // Optimistic update
    const newStatus = !isFavorited;
    setIsFavorited(newStatus);
    setIsAnimating(true);

    // Remove animation class after animation completes
    setTimeout(() => setIsAnimating(false), 300);

    setIsLoading(true);

    // Make API call
    const result = await toggleFavorite(productId, isFavorited);

    if (!result.success) {
      // Revert on error
      setIsFavorited(!newStatus);
      console.error("Failed to toggle favorite:", result.error);
      alert("Failed to update favorites. Please try again.");
    } else {
      // Call onToggle callback if provided
      onToggle?.(newStatus);
    }

    setIsLoading(false);
  }

  const HeartIcon = () => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={isFavorited ? "#ff4444" : "none"}
      stroke={isFavorited ? "#ff4444" : "#000"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transition: "all 0.2s ease",
      }}
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
    </svg>
  );

  if (variant === "inline") {
    return (
      <button
        onClick={handleClick}
        disabled={isLoading}
        aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
        title={isFavorited ? "Remove from favorites" : "Add to favorites"}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          cursor: isLoading ? "not-allowed" : "pointer",
          opacity: isLoading ? 0.6 : 1,
          transform: isAnimating ? "scale(1.15)" : "scale(1)",
          transition: "transform 0.2s ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        onMouseEnter={(e) => {
          if (!isLoading && !isAnimating) {
            e.currentTarget.style.transform = "scale(1.1)";
          }
        }}
        onMouseLeave={(e) => {
          if (!isAnimating) {
            e.currentTarget.style.transform = "scale(1)";
          }
        }}
      >
        <HeartIcon />
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
      title={isFavorited ? "Remove from favorites" : "Add to favorites"}
      style={{
        position: "relative",
        background: "rgba(255, 255, 255, 0.9)",
        border: "none",
        borderRadius: "50%",
        width: size + 16,
        height: size + 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: isLoading ? "not-allowed" : "pointer",
        transition: "all 0.2s ease",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        opacity: isLoading ? 0.6 : 1,
        transform: isAnimating ? "scale(1.2)" : "scale(1)",
      }}
      onMouseEnter={(e) => {
        if (!isLoading) {
          e.currentTarget.style.transform = "scale(1.1)";
          e.currentTarget.style.background = "rgba(255, 255, 255, 1)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isAnimating) {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.background = "rgba(255, 255, 255, 0.9)";
        }
      }}
    >
      <HeartIcon />
    </button>
  );
}
