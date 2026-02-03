"use client";

import { useState, useEffect, useRef } from "react";
import { addToCart } from "../lib/cart";

interface QuickAddButtonProps {
  productId: string;
  productSlug: string;
  productName: string;
  brandName: string;
  price: number;
  currency: string;
  imageUrl: string;
  sizes: Array<{
    size: string;
    in_stock: boolean;
  }>;
}

export default function QuickAddButton({
  productId,
  productSlug,
  productName,
  brandName,
  price,
  currency,
  imageUrl,
  sizes,
}: QuickAddButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (isOpen) {
          setIsClosing(true);
          setTimeout(() => {
            setIsOpen(false);
            setIsClosing(false);
          }, 200);
        }
      }
    }

    // Close other popups when this one opens
    function handleCloseOthers() {
      if (isOpen) {
        setIsClosing(true);
        setTimeout(() => {
          setIsOpen(false);
          setIsClosing(false);
        }, 200);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("closeQuickAddPopups", handleCloseOthers);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("closeQuickAddPopups", handleCloseOthers);
    };
  }, [isOpen]);

  function handleToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (isOpen) {
      setIsClosing(true);
      setTimeout(() => {
        setIsOpen(false);
        setIsClosing(false);
      }, 200);
    } else {
      // Close all other popups
      window.dispatchEvent(new Event("closeQuickAddPopups"));
      setIsOpen(true);
    }
  }

  function handleSizeSelect(size: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const success = addToCart({
      productId,
      productSlug,
      productName,
      brandName,
      price,
      currency,
      size,
      quantity: 1,
      imageUrl,
    });

    if (success) {
      // Close the popup
      setIsClosing(true);
      setTimeout(() => {
        setIsOpen(false);
        setIsClosing(false);
      }, 200);

      // Open cart drawer
      window.dispatchEvent(new Event("openCart"));
    }
  }

  const allSizes = ["XS", "S", "M", "L", "XL", "XXL"];
  const productSizes = allSizes.map(size => {
    const dbSize = sizes?.find(s => s.size === size);
    return dbSize || { size, in_stock: false };
  });

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        onClick={handleToggle}
        aria-label="Quick add to cart"
        title="Quick add to cart"
        style={{
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#000"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="9" cy="21" r="1"></circle>
          <circle cx="20" cy="21" r="1"></circle>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
        </svg>
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            border: "none",
            padding: "12px",
            minWidth: 180,
            zIndex: 1000,
            animation: isClosing ? "slideDown 0.2s ease-out" : "slideUp 0.2s ease-out",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
          }}
        >
          <div style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: "uppercase",
            marginBottom: 8,
            color: "#666"
          }}>
            SELECT SIZE
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {productSizes.map((sizeObj) => (
              <button
                key={sizeObj.size}
                onClick={(e) => sizeObj.in_stock && handleSizeSelect(sizeObj.size, e)}
                disabled={!sizeObj.in_stock}
                style={{
                  padding: "8px 4px",
                  border: "1px solid rgba(0, 0, 0, 0.1)",
                  background: sizeObj.in_stock ? "rgba(255, 255, 255, 0.5)" : "rgba(0, 0, 0, 0.05)",
                  color: sizeObj.in_stock ? "#000" : "#ccc",
                  cursor: sizeObj.in_stock ? "pointer" : "not-allowed",
                  fontSize: 11,
                  fontWeight: 600,
                  textAlign: "center",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  if (sizeObj.in_stock) {
                    e.currentTarget.style.background = "#000";
                    e.currentTarget.style.color = "#fff";
                  }
                }}
                onMouseLeave={(e) => {
                  if (sizeObj.in_stock) {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.5)";
                    e.currentTarget.style.color = "#000";
                  }
                }}
              >
                {sizeObj.size}
              </button>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideDown {
          from {
            opacity: 1;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            transform: translateY(-8px);
          }
        }
      `}</style>
    </div>
  );
}
