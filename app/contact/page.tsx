"use client";

import { useState } from "react";
import { useIsMobile } from "../lib/useIsMobile";

export default function ContactPage() {
  const isMobile = useIsMobile();
  const [submitted, setSubmitted] = useState(false);

  return (
    <main style={{ padding: isMobile ? "32px 16px 60px" : "60px 24px 80px", maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ fontSize: isMobile ? 24 : 36, fontWeight: 700, letterSpacing: 1.5, marginBottom: 8 }}>
        CONTACT
      </h1>
      <div style={{ width: 40, height: 2, background: "#000", marginBottom: 32 }} />

      <p style={paragraph}>
        Have a question, feedback, or business inquiry? We are here to help. Reach out using the form below or contact us directly.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 24, marginBottom: 40 }}>
        <div style={infoBox}>
          <strong style={{ fontSize: 12, letterSpacing: 1, display: "block", marginBottom: 8 }}>EMAIL</strong>
          <span style={{ fontSize: 14, color: "#333" }}>[hello@allclothes.com]</span>
        </div>
        <div style={infoBox}>
          <strong style={{ fontSize: 12, letterSpacing: 1, display: "block", marginBottom: 8 }}>RESPONSE TIME</strong>
          <span style={{ fontSize: 14, color: "#333" }}>Within 24-48 hours</span>
        </div>
      </div>

      {submitted ? (
        <div style={{ padding: 32, border: "1px solid #e6e6e6", textAlign: "center" }}>
          <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Thank you for reaching out!</p>
          <p style={{ fontSize: 14, color: "#666" }}>We will get back to you as soon as possible.</p>
        </div>
      ) : (
        <form
          onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }}
          style={{ display: "grid", gap: 16 }}
        >
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
            <div>
              <label style={label}>Name</label>
              <input type="text" required style={input} placeholder="Your name" />
            </div>
            <div>
              <label style={label}>Email</label>
              <input type="email" required style={input} placeholder="your@email.com" />
            </div>
          </div>
          <div>
            <label style={label}>Subject</label>
            <input type="text" required style={input} placeholder="What is this about?" />
          </div>
          <div>
            <label style={label}>Message</label>
            <textarea required rows={6} style={{ ...input, resize: "vertical" }} placeholder="Tell us more..." />
          </div>
          <button
            type="submit"
            style={{
              background: "#000",
              color: "#fff",
              border: "none",
              padding: "14px 32px",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 1,
              cursor: "pointer",
              fontFamily: "inherit",
              justifySelf: "start",
            }}
          >
            SEND MESSAGE
          </button>
        </form>
      )}
    </main>
  );
}

const paragraph: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.7,
  color: "#333",
  marginBottom: 16,
};

const infoBox: React.CSSProperties = {
  padding: 20,
  border: "1px solid #e6e6e6",
};

const label: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 1,
  marginBottom: 6,
  color: "#000",
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  border: "1px solid #e6e6e6",
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};
