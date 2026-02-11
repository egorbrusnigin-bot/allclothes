"use client";

import { useIsMobile } from "../lib/useIsMobile";

export default function ShippingPolicyPage() {
  const isMobile = useIsMobile();

  return (
    <main style={{ padding: isMobile ? "32px 16px 60px" : "60px 24px 80px", maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ fontSize: isMobile ? 24 : 36, fontWeight: 700, letterSpacing: 1.5, marginBottom: 8 }}>
        SHIPPING POLICY
      </h1>
      <div style={{ width: 40, height: 2, background: "#000", marginBottom: 32 }} />

      <p style={paragraph}>
        ALLCLOTHES is a global marketplace, and shipping is handled by individual sellers. Below is general information about how shipping works on our platform.
      </p>

      <h2 style={heading}>Processing Time</h2>
      <p style={paragraph}>
        Most orders are processed within <strong>1-3 business days</strong> after payment is confirmed. Processing times may vary depending on the seller and product availability. You will receive a confirmation email once your order has been shipped.
      </p>

      <h2 style={heading}>Delivery Times</h2>
      <div style={{ marginBottom: 24 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr>
              <th style={th}>Region</th>
              <th style={th}>Estimated Delivery</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style={td}>Domestic (same country)</td><td style={td}>3-7 business days</td></tr>
            <tr><td style={td}>Europe</td><td style={td}>5-12 business days</td></tr>
            <tr><td style={td}>North America</td><td style={td}>7-14 business days</td></tr>
            <tr><td style={td}>Asia & Oceania</td><td style={td}>10-18 business days</td></tr>
            <tr><td style={td}>Rest of World</td><td style={td}>10-21 business days</td></tr>
          </tbody>
        </table>
      </div>
      <p style={paragraph}>
        These are estimates and may vary depending on the seller location, shipping carrier, and customs processing.
      </p>

      <h2 style={heading}>Shipping Costs</h2>
      <p style={paragraph}>
        Shipping costs are calculated at checkout based on the seller&apos;s location, the delivery address, and the weight of the items. Some sellers may offer free shipping on orders above a certain amount.
      </p>

      <h2 style={heading}>Tracking</h2>
      <p style={paragraph}>
        Most orders include tracking information. Once your order is shipped, you will receive an email with the tracking number and a link to track your package. If tracking is not available for your shipment, the seller will notify you.
      </p>

      <h2 style={heading}>Customs and Import Duties</h2>
      <p style={paragraph}>
        For international orders, customs duties and import taxes may apply depending on your country&apos;s regulations. These charges are the responsibility of the buyer and are not included in the product price or shipping cost.
      </p>

      <h2 style={heading}>Lost or Damaged Packages</h2>
      <p style={paragraph}>
        If your package is lost or arrives damaged, please contact us at <strong>[support@allclothes.com]</strong> within 7 days of the expected delivery date. We will work with the seller and shipping carrier to resolve the issue.
      </p>

      <h2 style={heading}>Questions</h2>
      <p style={paragraph}>
        If you have any questions about shipping, feel free to reach out through our <a href="/contact" style={{ color: "#000", fontWeight: 600 }}>Contact</a> page.
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

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: "2px solid #000",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0.5,
};

const td: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid #e6e6e6",
  color: "#333",
};
