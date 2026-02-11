"use client";

import { useIsMobile } from "../lib/useIsMobile";

export default function ImprintPage() {
  const isMobile = useIsMobile();

  return (
    <main style={{ padding: isMobile ? "32px 16px 60px" : "60px 24px 80px", maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ fontSize: isMobile ? 24 : 36, fontWeight: 700, letterSpacing: 1.5, marginBottom: 8 }}>
        IMPRINT
      </h1>
      <div style={{ width: 40, height: 2, background: "#000", marginBottom: 32 }} />

      <p style={{ ...paragraph, color: "#999", marginBottom: 32 }}>
        Information in accordance with Section 5 TMG (German Telemedia Act)
      </p>

      <div style={{ display: "grid", gap: 28 }}>
        <div>
          <h2 style={heading}>Company</h2>
          <p style={paragraph}>[Company Name]</p>
        </div>

        <div>
          <h2 style={heading}>Address</h2>
          <p style={paragraph}>
            [Street Address]<br />
            [Postal Code, City]<br />
            [Country]
          </p>
        </div>

        <div>
          <h2 style={heading}>Contact</h2>
          <p style={paragraph}>
            Email: [hello@allclothes.com]<br />
            Phone: [+00 000 000 0000]
          </p>
        </div>

        <div>
          <h2 style={heading}>Represented by</h2>
          <p style={paragraph}>[Managing Director / CEO Name]</p>
        </div>

        <div>
          <h2 style={heading}>Commercial Register</h2>
          <p style={paragraph}>
            Registered at: [Court / Registry]<br />
            Registration Number: [HRB XXXXXX]
          </p>
        </div>

        <div>
          <h2 style={heading}>VAT Identification Number</h2>
          <p style={paragraph}>
            VAT ID: [DE XXXXXXXXX]
          </p>
        </div>

        <div>
          <h2 style={heading}>Dispute Resolution</h2>
          <p style={paragraph}>
            The European Commission provides a platform for online dispute resolution (OS): <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" style={{ color: "#000", fontWeight: 600 }}>https://ec.europa.eu/consumers/odr</a>
          </p>
          <p style={paragraph}>
            We are not willing or obliged to participate in dispute resolution proceedings before a consumer arbitration board.
          </p>
        </div>
      </div>
    </main>
  );
}

const heading: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  letterSpacing: 0.5,
  marginBottom: 8,
  marginTop: 0,
};

const paragraph: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.7,
  color: "#333",
  marginBottom: 0,
  marginTop: 0,
};
