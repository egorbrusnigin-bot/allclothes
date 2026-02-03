"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";

type StepNum = 1 | 2 | 3;

export default function Page() {
  const router = useRouter();
  const [step, setStep] = useState<StepNum>(1);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [isAlreadySeller, setIsAlreadySeller] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form data
  const [brandName, setBrandName] = useState("");
  const [description, setDescription] = useState("");
  const [sellerType, setSellerType] = useState("brand");
  const [shopifyLink, setShopifyLink] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [socialHandle, setSocialHandle] = useState("");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [legalName, setLegalName] = useState("");

  // animation state for content
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    setEntered(false);
    const t = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(t);
  }, [step]);

  // Check if user is already a seller
  useEffect(() => {
    checkIfSeller();
  }, []);

  async function checkIfSeller() {
    if (!supabase) {
      setCheckingStatus(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setCheckingStatus(false);
        return;
      }

      const { data, error } = await supabase
        .from("sellers")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (data && !error) {
        setIsAlreadySeller(true);
        // Load existing data
        setBrandName(data.brand_name || "");
        setDescription(data.description || "");
        setSellerType(data.seller_type || "brand");
        setShopifyLink(data.shopify_link || "");
        setContactEmail(data.contact_email || "");
        setSocialHandle(data.telegram || data.instagram || "");
        setPaypalEmail(data.paypal_email || "");
        setLegalName(data.legal_name || "");
        setLogoUrl(data.logo_url || null);
      }
    } catch (error) {
      console.error("Error checking seller status:", error);
    }

    setCheckingStatus(false);
  }

  const bg = useMemo(
    () => ({
      minHeight: "calc(100vh - 84px)",
      backgroundColor: "#fff",
      padding: "34px 24px 80px",
    }),
    []
  );

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  async function uploadLogo(): Promise<string | null> {
    if (!supabase || !logoFile) return null;

    const fileExt = logoFile.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("brand-logos")
      .upload(fileName, logoFile);

    if (uploadError) {
      console.error("Error uploading logo:", uploadError);
      return null;
    }

    const { data } = supabase.storage
      .from("brand-logos")
      .getPublicUrl(fileName);

    return data.publicUrl;
  }

  async function handleFinish() {
    if (!supabase) {
      alert("Supabase not configured");
      return;
    }

    if (!brandName) {
      alert("Please enter a brand name");
      return;
    }

    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        alert("You must be logged in");
        setSaving(false);
        return;
      }

      let finalLogoUrl = logoUrl;

      // Upload logo if new file selected
      if (logoFile) {
        const uploadedUrl = await uploadLogo();
        if (uploadedUrl) {
          finalLogoUrl = uploadedUrl;
        }
      }

      const sellerData = {
        user_id: user.id,
        brand_name: brandName,
        logo_url: finalLogoUrl,
        description,
        seller_type: sellerType,
        contact_email: contactEmail,
        shopify_link: shopifyLink,
        telegram: socialHandle.startsWith("@") ? socialHandle : "",
        instagram: !socialHandle.startsWith("@") ? socialHandle : "",
        paypal_email: paypalEmail,
        legal_name: legalName,
        status: "pending",
      };

      if (isAlreadySeller) {
        // Update existing seller
        const { error } = await supabase
          .from("sellers")
          .update(sellerData)
          .eq("user_id", user.id);

        if (error) {
          alert("Error updating seller profile: " + error.message);
          setSaving(false);
          return;
        }
      } else {
        // Create new seller
        const { error } = await supabase
          .from("sellers")
          .insert([sellerData]);

        if (error) {
          alert("Error creating seller profile: " + error.message);
          setSaving(false);
          return;
        }
      }

      alert("Seller profile saved successfully!");
      router.push("/account/admin");
    } catch (error) {
      console.error("Error saving seller profile:", error);
      alert("An error occurred while saving");
    }

    setSaving(false);
  }

  const next = () => {
    if (step === 3) {
      handleFinish();
    } else {
      setStep((s) => (s === 1 ? 2 : 3));
    }
  };

  const prev = () => setStep((s) => (s === 3 ? 2 : s === 2 ? 1 : 1));

  if (checkingStatus) {
    return (
      <main style={bg}>
        <div style={{ textAlign: "center", padding: 40 }}>Loading...</div>
      </main>
    );
  }

  if (isAlreadySeller) {
    return (
      <main style={bg}>
        <div style={{ maxWidth: 760, margin: "0 auto", textAlign: "center", paddingTop: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>✓</div>
          <h1 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1.5 }}>
            YOU'RE ALREADY A SELLER!
          </h1>
          <p style={{ fontSize: 11, color: "#666", marginBottom: 32, lineHeight: 1.6, letterSpacing: 0.3 }}>
            You've already completed the seller registration. You can now manage your brands and products in the admin panel.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <Link
              href="/account/seller"
              style={{
                padding: "12px 24px",
                background: "#000",
                color: "#fff",
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 11,
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              GO TO SELLER PANEL
            </Link>
            <Link
              href="/account"
              style={{
                padding: "12px 24px",
                background: "#fff",
                color: "#000",
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 11,
                letterSpacing: 1,
                textTransform: "uppercase",
                border: "1px solid #e6e6e6",
              }}
            >
              BACK TO ACCOUNT
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={bg}>
      {/* Stepper */}
      <div
        style={{
          maxWidth: 760,
          margin: "0 auto 22px",
          display: "flex",
          justifyContent: "center",
          gap: 18,
          alignItems: "center",
          color: "#777",
          fontSize: 10,
          userSelect: "none",
        }}
      >
        <Step n={1} label="BASIC INFO" active={step === 1} onClick={() => setStep(1)} />
        <div style={{ width: 36, height: 1, background: "#e7e7e7" }} />
        <Step n={2} label="DATA" active={step === 2} onClick={() => setStep(2)} />
        <div style={{ width: 36, height: 1, background: "#e7e7e7" }} />
        <Step n={3} label="PAYOUT" active={step === 3} onClick={() => setStep(3)} />
      </div>

      {/* Animated content wrapper */}
      <div
        style={{
          maxWidth: 760,
          margin: "0 auto",
          opacity: entered ? 1 : 0,
          transform: entered ? "translateY(0px)" : "translateY(10px)",
          transition: "opacity 180ms ease, transform 180ms ease",
        }}
      >
        {step === 1 && (
          <>
            {/* Logo */}
            <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>LOGO</div>
            <div style={{ color: "#777", fontSize: 10, marginBottom: 14, letterSpacing: 0.3 }}>
              Add a logo for your brand page.
            </div>

            <label
              style={{
                width: 140,
                height: 140,
                background: "#d9d9d9",
                display: "grid",
                placeItems: "center",
                overflow: "hidden",
                cursor: "pointer",
                border: "1px solid #cfcfcf",
              }}
              title="Upload logo"
            >
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="logo"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: 54,
                    height: 54,
                    border: "1px dashed #111",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 22,
                  }}
                >
                  +
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                style={{ display: "none" }}
              />
            </label>

            <div style={{ height: 26 }} />

            {/* Brand name */}
            <div style={{ marginTop: 22 }}>
              <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>BRAND NAME</div>
              <div style={{ color: "#777", fontSize: 10, marginBottom: 10, letterSpacing: 0.3 }}>Maximum 30 characters.</div>
              <input
                placeholder="Name"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                maxLength={30}
                style={inputStyle}
              />
            </div>

            {/* Description */}
            <div style={{ marginTop: 22 }}>
              <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>DESCRIPTION</div>
              <div style={{ color: "#777", fontSize: 10, marginBottom: 10, letterSpacing: 0.3 }}>Describe your brand and what you do.</div>
              <textarea
                placeholder="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{
                  ...inputStyle,
                  minHeight: 180,
                  resize: "vertical",
                }}
              />
            </div>

            {/* Seller type */}
            <div style={{ marginTop: 22 }}>
              <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>SELLER TYPE</div>
              <div style={{ color: "#777", fontSize: 10, marginBottom: 10, letterSpacing: 0.3 }}>Choose who you are.</div>
              <select
                value={sellerType}
                onChange={(e) => setSellerType(e.target.value)}
                style={inputStyle}
              >
                <option value="brand">Brand</option>
                <option value="store">Store</option>
                <option value="creator">Creator</option>
              </select>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>SHOPIFY STORE LINK</div>
            <div style={{ color: "#777", fontSize: 10, marginBottom: 10, letterSpacing: 0.3 }}>
              Automatic import works only for Shopify product links (must contain <b>/products/</b>).
            </div>

            <input
              placeholder="https://yourstore.com/products/your-item"
              value={shopifyLink}
              onChange={(e) => setShopifyLink(e.target.value)}
              style={inputStyle}
            />

            <div style={{ marginTop: 10, color: "#777", fontSize: 10, letterSpacing: 0.3 }}>
              Example:{" "}
              <span style={{ color: "#111" }}>
                https://previousstudios.com/en/products/green-dream-dept-zip
              </span>
            </div>

            {/* Contact email */}
            <div style={{ marginTop: 22 }}>
              <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>CONTACT EMAIL</div>
              <div style={{ color: "#777", fontSize: 10, marginBottom: 10, letterSpacing: 0.3 }}>We'll use it for moderation.</div>
              <input
                placeholder="brand@email.com"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                type="email"
                style={inputStyle}
              />
            </div>

            {/* Social handle */}
            <div style={{ marginTop: 22 }}>
              <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>TELEGRAM / IG</div>
              <div style={{ color: "#777", fontSize: 10, marginBottom: 10, letterSpacing: 0.3 }}>Optional.</div>
              <input
                placeholder="@username"
                value={socialHandle}
                onChange={(e) => setSocialHandle(e.target.value)}
                style={inputStyle}
              />
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>PAYOUT</div>
            <div style={{ color: "#777", fontSize: 10, marginBottom: 14, letterSpacing: 0.3 }}>
              This step will be payout details (later).
            </div>

            {/* PayPal email */}
            <div style={{ marginTop: 22 }}>
              <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>PAYPAL EMAIL</div>
              <div style={{ color: "#777", fontSize: 10, marginBottom: 10, letterSpacing: 0.3 }}>Where you want to receive payouts.</div>
              <input
                placeholder="paypal@email.com"
                value={paypalEmail}
                onChange={(e) => setPaypalEmail(e.target.value)}
                type="email"
                style={inputStyle}
              />
            </div>

            {/* Legal name */}
            <div style={{ marginTop: 22 }}>
              <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>LEGAL NAME</div>
              <div style={{ color: "#777", fontSize: 10, marginBottom: 10, letterSpacing: 0.3 }}>For invoices / verification.</div>
              <input
                placeholder="Full name / Company"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                style={inputStyle}
              />
            </div>
          </>
        )}

        {/* Buttons */}
        <div style={{ marginTop: 36, display: "flex", gap: 12 }}>
          <button
            onClick={prev}
            disabled={step === 1}
            style={{
              background: "#fff",
              color: "#111",
              border: "1px solid #e6e6e6",
              padding: "12px 20px",
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: 1,
              textTransform: "uppercase",
              cursor: step === 1 ? "not-allowed" : "pointer",
              opacity: step === 1 ? 0.5 : 1,
            }}
          >
            BACK
          </button>

          <button
            onClick={next}
            disabled={saving}
            style={{
              background: "#000",
              color: "#fff",
              border: "none",
              padding: "12px 20px",
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: 1,
              textTransform: "uppercase",
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "SAVING..." : step === 3 ? "FINISH" : "NEXT"}
          </button>
        </div>
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 520,
  padding: "12px 14px",
  border: "1px solid #e6e6e6",
  background: "#f5f5f5",
  color: "#111",
  outline: "none",
  fontSize: 13,
};

function Step({
  n,
  label,
  active,
  onClick,
}: {
  n: number;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        all: "unset",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 10,
        opacity: active ? 1 : 0.65,
        transition: "opacity 180ms ease, transform 180ms ease",
      }}
    >
      <div
        style={{
          width: 24,
          height: 24,
          display: "grid",
          placeItems: "center",
          border: "1px solid #111",
          background: active ? "#111" : "transparent",
          color: active ? "#fff" : "#111",
          fontWeight: 700,
          fontSize: 10,
        }}
      >
        {n}
      </div>
      <div style={{ fontWeight: 700, color: "#111", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
    </button>
  );
}
