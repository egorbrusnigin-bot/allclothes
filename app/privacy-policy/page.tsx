"use client";

import { useIsMobile } from "../lib/useIsMobile";

export default function PrivacyPolicyPage() {
  const isMobile = useIsMobile();

  return (
    <main style={{ padding: isMobile ? "32px 16px 60px" : "60px 24px 80px", maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ fontSize: isMobile ? 24 : 36, fontWeight: 700, letterSpacing: 1.5, marginBottom: 8 }}>
        PRIVACY POLICY
      </h1>
      <div style={{ width: 40, height: 2, background: "#000", marginBottom: 32 }} />

      <p style={paragraph}>
        Your privacy is important to us. This Privacy Policy explains how ALLCLOTHES (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) collects, uses, and protects your personal information when you use our website and services.
      </p>

      <h2 style={heading}>1. Information We Collect</h2>
      <p style={paragraph}><strong>Account Information:</strong> When you create an account, we collect your name, email address, and authentication credentials. If you sign up via Google, we receive your name and email from your Google profile.</p>
      <p style={paragraph}><strong>Order Information:</strong> When you make a purchase, we collect your shipping address, billing address, and payment information. Payment processing is handled by Stripe — we do not store your full credit card details.</p>
      <p style={paragraph}><strong>Usage Data:</strong> We automatically collect information about how you interact with our website, including pages visited, time spent, browser type, and device information.</p>
      <p style={paragraph}><strong>Cookies:</strong> We use essential cookies to keep you logged in and functional cookies to remember your preferences (such as currency selection).</p>

      <h2 style={heading}>2. How We Use Your Information</h2>
      <ul style={{ ...paragraph, paddingLeft: 20 }}>
        <li style={li}>To process and fulfill your orders</li>
        <li style={li}>To create and manage your account</li>
        <li style={li}>To communicate with you about your orders and account</li>
        <li style={li}>To improve our website and services</li>
        <li style={li}>To prevent fraud and ensure security</li>
        <li style={li}>To comply with legal obligations</li>
      </ul>

      <h2 style={heading}>3. Data Sharing</h2>
      <p style={paragraph}>We do not sell your personal information. We share your data only with:</p>
      <ul style={{ ...paragraph, paddingLeft: 20 }}>
        <li style={li}><strong>Stripe</strong> — for payment processing</li>
        <li style={li}><strong>Supabase</strong> — for authentication and data storage</li>
        <li style={li}><strong>Sellers</strong> — necessary order details to fulfill your purchase (name, shipping address)</li>
        <li style={li}><strong>Vercel</strong> — for website hosting</li>
      </ul>

      <h2 style={heading}>4. Data Retention</h2>
      <p style={paragraph}>
        We retain your personal information for as long as your account is active or as needed to provide you services. If you delete your account, we will remove your personal data within 30 days, except where we are required by law to retain it.
      </p>

      <h2 style={heading}>5. Your Rights (GDPR)</h2>
      <p style={paragraph}>If you are located in the European Economic Area, you have the right to:</p>
      <ul style={{ ...paragraph, paddingLeft: 20 }}>
        <li style={li}>Access the personal data we hold about you</li>
        <li style={li}>Request correction of inaccurate data</li>
        <li style={li}>Request deletion of your data</li>
        <li style={li}>Object to or restrict processing of your data</li>
        <li style={li}>Request data portability</li>
        <li style={li}>Withdraw consent at any time</li>
      </ul>
      <p style={paragraph}>
        To exercise any of these rights, contact us at <strong>[privacy@allclothes.com]</strong>.
      </p>

      <h2 style={heading}>6. Security</h2>
      <p style={paragraph}>
        We implement appropriate technical and organizational measures to protect your personal data. All data is transmitted over HTTPS, and authentication is managed through secure third-party providers.
      </p>

      <h2 style={heading}>7. Changes to This Policy</h2>
      <p style={paragraph}>
        We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the date below.
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

const li: React.CSSProperties = { marginBottom: 6 };
