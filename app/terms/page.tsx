"use client";

import { useIsMobile } from "../lib/useIsMobile";

export default function TermsPage() {
  const isMobile = useIsMobile();

  return (
    <main style={{ padding: isMobile ? "32px 16px 60px" : "60px 24px 80px", maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ fontSize: isMobile ? 24 : 36, fontWeight: 700, letterSpacing: 1.5, marginBottom: 8 }}>
        TERMS AND CONDITIONS
      </h1>
      <div style={{ width: 40, height: 2, background: "#000", marginBottom: 32 }} />

      <p style={paragraph}>
        Please read these Terms and Conditions carefully before using the ALLCLOTHES website and services. By accessing or using our platform, you agree to be bound by these terms.
      </p>

      <h2 style={heading}>1. General</h2>
      <p style={paragraph}>
        ALLCLOTHES is operated by [Company Name], registered at [Address]. These terms govern your use of the website located at allclothes-site.vercel.app and any related services.
      </p>

      <h2 style={heading}>2. Account Registration</h2>
      <p style={paragraph}>
        To make purchases or sell on ALLCLOTHES, you must create an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must be at least 16 years old to create an account.
      </p>

      <h2 style={heading}>3. Products and Orders</h2>
      <p style={paragraph}>
        ALLCLOTHES is a marketplace platform. Products are listed and sold by independent brands and sellers. While we facilitate the transaction, the contractual relationship for the purchase is between you and the seller.
      </p>
      <p style={paragraph}>
        We make every effort to display product information accurately, but we do not guarantee that product descriptions, images, pricing, or other content is accurate, complete, or error-free. We reserve the right to cancel orders if pricing errors are discovered.
      </p>

      <h2 style={heading}>4. Pricing and Payment</h2>
      <p style={paragraph}>
        All prices are displayed in EUR unless you select a different display currency. The final charge will be processed in the seller&apos;s base currency. Payment is processed securely through Stripe. We accept major credit cards, Apple Pay, Google Pay, and other payment methods supported by Stripe.
      </p>

      <h2 style={heading}>5. Shipping</h2>
      <p style={paragraph}>
        Shipping is handled by individual sellers. Delivery times and shipping costs vary depending on the seller&apos;s location and shipping method. Please refer to our <a href="/shipping-policy" style={{ color: "#000", fontWeight: 600 }}>Shipping Policy</a> for more details.
      </p>

      <h2 style={heading}>6. Returns and Refunds</h2>
      <p style={paragraph}>
        Returns and refunds are subject to our <a href="/refund-policy" style={{ color: "#000", fontWeight: 600 }}>Refund Policy</a>. Please review it before making a purchase.
      </p>

      <h2 style={heading}>7. Seller Obligations</h2>
      <p style={paragraph}>
        If you register as a seller on ALLCLOTHES, you agree to provide accurate product information, fulfill orders in a timely manner, and comply with all applicable laws regarding the sale of goods. ALLCLOTHES reserves the right to suspend or terminate seller accounts that violate these terms.
      </p>

      <h2 style={heading}>8. Intellectual Property</h2>
      <p style={paragraph}>
        All content on the ALLCLOTHES website — including the logo, design, text, and software — is the property of [Company Name] or its licensors and is protected by copyright and trademark laws. Product images and descriptions are the property of their respective sellers.
      </p>

      <h2 style={heading}>9. Limitation of Liability</h2>
      <p style={paragraph}>
        ALLCLOTHES acts as a marketplace platform and is not liable for the quality, safety, or legality of items listed by sellers. We are not responsible for any disputes between buyers and sellers, although we will make reasonable efforts to help resolve them.
      </p>

      <h2 style={heading}>10. Governing Law</h2>
      <p style={paragraph}>
        These terms are governed by the laws of [Country/Jurisdiction]. Any disputes arising from these terms will be subject to the exclusive jurisdiction of the courts of [City, Country].
      </p>

      <h2 style={heading}>11. Changes to Terms</h2>
      <p style={paragraph}>
        We reserve the right to modify these terms at any time. Changes will be posted on this page with an updated date. Continued use of the platform after changes constitutes acceptance of the new terms.
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
