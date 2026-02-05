"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getCartItems,
  getCartTotal,
  removeFromCart,
  updateCartItemQuantity,
  getRecentlyViewed,
  type CartItem,
  type RecentlyViewedProduct,
} from "../lib/cart";
import { formatPrice, formatTotal } from "../lib/currency";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const router = useRouter();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      loadCart();
      loadRecentlyViewed();
    }
  }, [isOpen]);

  useEffect(() => {
    // Listen for cart updates
    const handleCartUpdate = () => {
      loadCart();
    };

    // Listen for currency changes
    const handleCurrencyChange = () => {
      loadCart();
    };

    window.addEventListener("cartUpdated", handleCartUpdate);
    window.addEventListener("currencyChanged", handleCurrencyChange);
    return () => {
      window.removeEventListener("cartUpdated", handleCartUpdate);
      window.removeEventListener("currencyChanged", handleCurrencyChange);
    };
  }, []);

  function loadCart() {
    const items = getCartItems();
    setCartItems(items);
    setTotal(getCartTotal());
  }

  function loadRecentlyViewed() {
    const recent = getRecentlyViewed();
    setRecentlyViewed(recent.slice(0, 4)); // Show only 4
  }

  function handleRemove(productId: string, size: string) {
    removeFromCart(productId, size);
    loadCart();
  }

  function handleQuantityChange(productId: string, size: string, newQuantity: number) {
    updateCartItemQuantity(productId, size, newQuantity);
    loadCart();
  }

  function handleClose() {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 300); // Match animation duration
  }

  if (!isOpen && !isClosing) return null;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={handleClose}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.5)",
          zIndex: 999,
          animation: isClosing ? "fadeOut 0.3s ease-out" : "fadeIn 0.3s ease-out",
        }}
      />

      {/* Drawer */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(500px, 100vw)",
          background: "#fff",
          zIndex: 1000,
          boxShadow: "-2px 0 8px rgba(0,0,0,0.1)",
          display: "flex",
          flexDirection: "column",
          animation: isClosing ? "slideOutRight 0.3s ease-out" : "slideInRight 0.3s ease-out",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "24px 24px 20px",
            borderBottom: "1px solid #e6e6e6",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h2
            style={{
              fontSize: 16,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 1.5,
            }}
          >
            CART
          </h2>
          <button
            onClick={handleClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 24,
              cursor: "pointer",
              padding: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Cart Items */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "24px",
          }}
        >
          {cartItems.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "60px 20px",
                color: "#999",
              }}
            >
              <p style={{ fontSize: 14, marginBottom: 8 }}>Cart is empty</p>
              <p style={{ fontSize: 12 }}>Add items to checkout</p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 24 }}>
              {cartItems.map((item) => (
                <div
                  key={`${item.productId}-${item.size}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "80px 1fr",
                    gap: 16,
                    paddingBottom: 24,
                    borderBottom: "1px solid #f0f0f0",
                  }}
                >
                  {/* Image */}
                  <Link href={`/product/${item.productSlug}`} onClick={handleClose}>
                    <img
                      src={item.imageUrl}
                      alt={item.productName}
                      style={{
                        width: 80,
                        height: 106,
                        objectFit: "cover",
                      }}
                      loading="lazy"
                      decoding="async"
                    />
                  </Link>

                  {/* Info */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                          marginBottom: 4,
                        }}
                      >
                        {item.brandName}
                      </div>
                      <Link
                        href={`/product/${item.productSlug}`}
                        onClick={handleClose}
                        style={{
                          fontSize: 12,
                          color: "#000",
                          textDecoration: "none",
                          display: "block",
                          marginBottom: 4,
                        }}
                      >
                        {item.productName}
                      </Link>
                      <div style={{ fontSize: 11, color: "#666" }}>
                        SIZE: {item.size}
                      </div>
                    </div>

                    {/* Price */}
                    <div style={{ fontSize: 13, fontWeight: 700 }}>
                      {formatPrice(item.price * item.quantity, item.currency)}
                    </div>

                    {/* Quantity Controls */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontSize: 11, color: "#666" }}>QTY:</span>
                        <button
                          onClick={() =>
                            handleQuantityChange(
                              item.productId,
                              item.size,
                              item.quantity - 1
                            )
                          }
                          style={{
                            width: 24,
                            height: 24,
                            border: "1px solid #e6e6e6",
                            background: "#fff",
                            cursor: "pointer",
                            fontSize: 16,
                            lineHeight: 1,
                          }}
                        >
                          −
                        </button>
                        <span style={{ fontSize: 13, fontWeight: 600, minWidth: 20, textAlign: "center" }}>
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            handleQuantityChange(
                              item.productId,
                              item.size,
                              item.quantity + 1
                            )
                          }
                          style={{
                            width: 24,
                            height: 24,
                            border: "1px solid #e6e6e6",
                            background: "#fff",
                            cursor: "pointer",
                            fontSize: 16,
                            lineHeight: 1,
                          }}
                        >
                          +
                        </button>
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => handleRemove(item.productId, item.size)}
                        style={{
                          background: "none",
                          border: "none",
                          fontSize: 10,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                          textDecoration: "underline",
                          cursor: "pointer",
                          color: "#999",
                        }}
                      >
                        REMOVE
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recently Viewed */}
          {recentlyViewed.length > 0 && (
            <div style={{ marginTop: 40 }}>
              <h3
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  marginBottom: 16,
                }}
              >
                RECENTLY VIEWED ITEMS:
              </h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: 16,
                }}
              >
                {recentlyViewed.map((product) => (
                  <Link
                    key={product.productId}
                    href={`/product/${product.productSlug}`}
                    onClick={handleClose}
                    style={{ textDecoration: "none", color: "#000" }}
                  >
                    <img
                      src={product.imageUrl}
                      alt={product.productName}
                      style={{
                        width: "100%",
                        aspectRatio: "3/4",
                        objectFit: "cover",
                        marginBottom: 8,
                      }}
                      loading="lazy"
                      decoding="async"
                    />
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        marginBottom: 4,
                      }}
                    >
                      {product.brandName}
                    </div>
                    <div
                      style={{
                        fontSize: 9,
                        marginBottom: 4,
                        lineHeight: 1.3,
                      }}
                    >
                      {product.productName}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700 }}>
                      {formatPrice(product.price, product.currency)}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {cartItems.length > 0 && (
          <div
            style={{
              padding: "20px 24px",
              borderTop: "1px solid #e6e6e6",
              background: "#fff",
            }}
          >
            {/* Total */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
                paddingBottom: 16,
                borderBottom: "1px solid #e6e6e6",
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                TOTAL
              </span>
              <span style={{ fontSize: 16, fontWeight: 700 }}>
                {formatTotal(total)}
              </span>
            </div>

            {/* Checkout Button */}
            <button
              style={{
                width: "100%",
                padding: "14px",
                background: "#000",
                color: "#fff",
                border: "none",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
              onClick={() => {
                onClose();
                router.push("/checkout");
              }}
            >
              CHECKOUT
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes fadeOut {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }

        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }

        @keyframes slideOutRight {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(100%);
          }
        }
      `}</style>
    </>
  );
}
