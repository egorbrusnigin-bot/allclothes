"use client";

import { useIsMobile } from "../lib/useIsMobile";

export default function RefundPolicyPage() {
  const isMobile = useIsMobile();

  return (
    <main style={{ padding: isMobile ? "32px 16px 60px" : "60px 24px 80px", maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ fontSize: isMobile ? 24 : 36, fontWeight: 700, letterSpacing: 1.5, marginBottom: 8 }}>
        REFUND POLICY
      </h1>
      <div style={{ width: 40, height: 2, background: "#000", marginBottom: 32 }} />

      <p style={paragraph}>
        We want you to be completely satisfied with your purchase. If something is not right, here is how our refund process works.
      </p>

      <h2 style={heading}>Return Window</h2>
      <p style={paragraph}>
        You have <strong>14 days</strong> from the date of delivery to request a return. After 14 days, we are unfortunately unable to offer a refund or exchange.
      </p>

      <h2 style={heading}>Eligibility</h2>
      <p style={paragraph}>To be eligible for a return, your item must be:</p>
      <ul style={{ ...paragraph, paddingLeft: 20 }}>
        <li style={{ marginBottom: 8 }}>Unused and in the same condition that you received it</li>
        <li style={{ marginBottom: 8 }}>In the original packaging with all tags attached</li>
        <li style={{ marginBottom: 8 }}>Accompanied by the receipt or proof of purchase</li>
      </ul>
      <p style={paragraph}>
        Items that are damaged, worn, washed, or altered cannot be returned. Sale items and gift cards are non-refundable.
      </p>

      <h2 style={heading}>How to Request a Return</h2>
      <ol style={{ ...paragraph, paddingLeft: 20 }}>
        <li style={{ marginBottom: 8 }}>Contact us at <strong>[returns@allclothes.com]</strong> with your order number and reason for return</li>
        <li style={{ marginBottom: 8 }}>We will provide you with a return shipping address and instructions</li>
        <li style={{ marginBottom: 8 }}>Ship the item back at your own expense (unless the item was defective or incorrect)</li>
        <li style={{ marginBottom: 8 }}>Once we receive and inspect the item, we will process your refund</li>
      </ol>

      <h2 style={heading}>Refund Processing</h2>
      <p style={paragraph}>
        Once your return is received and inspected, we will send you an email notification. If approved, your refund will be processed to your original payment method within <strong>5-10 business days</strong>. Please note that your bank or credit card company may take additional time to post the refund to your account.
      </p>

      <h2 style={heading}>Exchanges</h2>
      <p style={paragraph}>
        We only replace items if they are defective or damaged. If you need to exchange an item for the same product in a different size, contact us at <strong>[returns@allclothes.com]</strong>.
      </p>

      <h2 style={heading}>Defective or Incorrect Items</h2>
      <p style={paragraph}>
        If you received a defective or incorrect item, please contact us immediately. We will cover the return shipping costs and send you a replacement or full refund at no additional charge.
      </p>

      <p style={{ ...paragraph, marginTop: 32, color: "#999", fontSize: 12 }}>
        Last updated: February 2025
      </p>
    </main>
  );
}

const heading: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  letterSpacing: 0.5,
  marginTop: 32,
  marginBottom: 12,
};

const paragraph: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.7,
  color: "#333",
  marginBottom: 16,
};
