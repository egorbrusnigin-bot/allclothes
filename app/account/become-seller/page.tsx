"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type StepNum = 1 | 2 | 3;

interface ImportedProduct {
  name: string;
  slug: string;
  description: string;
  price: number;
  currency: string;
  category: string | null;
  images: string[];
  sizes: Array<{ size: string; in_stock: boolean; quantity: number }>;
  tags: string[];
  // Additional fields like admin has
  sizeChartUrl?: string;
  shippingInfo?: string;
  careInstructions?: string;
  instagramUrl?: string;
  phoneNumber?: string;
}

export default function Page() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>Loading...</div>}>
      <BecomeSellerContent />
    </Suspense>
  );
}

function BecomeSellerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<StepNum>(1);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [isAlreadySeller, setIsAlreadySeller] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importedFromShopify, setImportedFromShopify] = useState(false);
  const [shopifyImportUrl, setShopifyImportUrl] = useState("");
  const [shopifyLoading, setShopifyLoading] = useState(false);
  const [shopifyError, setShopifyError] = useState("");

  // Catalog import
  const [catalogUrl, setCatalogUrl] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [importedProducts, setImportedProducts] = useState<ImportedProduct[]>([]);
  const [editingProduct, setEditingProduct] = useState<ImportedProduct | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Form data
  const [brandName, setBrandName] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [sellerType, setSellerType] = useState("brand");
  const [shopifyLink, setShopifyLink] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [twitterHandle, setTwitterHandle] = useState("");
  const [facebookHandle, setFacebookHandle] = useState("");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [legalName, setLegalName] = useState("");
  // Shipping address for labels
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingPostalCode, setShippingPostalCode] = useState("");
  const [shippingCountry, setShippingCountry] = useState("");
  const [shippingPhone, setShippingPhone] = useState("");

  // Load imported brand data from URL params
  useEffect(() => {
    const importedName = searchParams.get("brandName");
    const importedLogo = searchParams.get("brandLogo");

    if (importedName) {
      setBrandName(importedName);
      setImportedFromShopify(true);
    }
    if (importedLogo) {
      setLogoUrl(importedLogo);
    }
  }, [searchParams]);

  // Import from Shopify URL
  async function importFromShopify() {
    if (!shopifyImportUrl.trim()) {
      setShopifyError("Enter a Shopify store URL");
      return;
    }

    setShopifyLoading(true);
    setShopifyError("");

    try {
      const res = await fetch("/api/shopify/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: shopifyImportUrl }),
      });

      const data = await res.json();

      if (!res.ok) {
        setShopifyError(data.error || "Failed to parse store");
        return;
      }

      // Apply imported data
      if (data.data.name) {
        setBrandName(data.data.name);
      }
      if (data.data.logo) {
        setLogoUrl(data.data.logo);
      }
      setImportedFromShopify(true);
      setShopifyImportUrl("");
    } catch (err) {
      setShopifyError("Failed to connect");
    } finally {
      setShopifyLoading(false);
    }
  }

  // Import catalog from Shopify
  async function importCatalog() {
    if (!catalogUrl.trim()) {
      setCatalogError("Enter a Shopify store or collection URL");
      return;
    }

    setCatalogLoading(true);
    setCatalogError("");

    try {
      const res = await fetch("/api/shopify/import-catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: catalogUrl, limit: 50 }),
      });

      const data = await res.json();

      if (!res.ok) {
        setCatalogError(data.error || "Failed to import catalog");
        return;
      }

      setImportedProducts(data.products);
      setCatalogUrl("");
    } catch (err) {
      setCatalogError("Failed to connect");
    } finally {
      setCatalogLoading(false);
    }
  }

  function updateProduct(index: number, updates: Partial<ImportedProduct>) {
    setImportedProducts(prev => prev.map((p, i) => i === index ? { ...p, ...updates } : p));
  }

  function removeProduct(index: number) {
    setImportedProducts(prev => prev.filter((_, i) => i !== index));
  }

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
        setCity(data.city || "");
        setCountry(data.country || "");
        setSellerType(data.seller_type || "brand");
        setShopifyLink(data.shopify_link || "");
        setContactEmail(data.contact_email || "");
        setInstagramHandle(data.instagram || "");
        setTwitterHandle(data.twitter || "");
        setFacebookHandle(data.facebook || "");
        setPaypalEmail(data.paypal_email || "");
        setLegalName(data.legal_name || "");
        setLogoUrl(data.logo_url || null);
        setShippingAddress(data.shipping_address || "");
        setShippingCity(data.shipping_city || "");
        setShippingPostalCode(data.shipping_postal_code || "");
        setShippingCountry(data.shipping_country || "");
        setShippingPhone(data.shipping_phone || "");
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
        city: city.trim() || null,
        country: country.trim() || null,
        seller_type: sellerType,
        contact_email: contactEmail,
        shopify_link: shopifyLink,
        instagram: instagramHandle.trim() || null,
        twitter: twitterHandle.trim() || null,
        facebook: facebookHandle.trim() || null,
        paypal_email: paypalEmail,
        legal_name: legalName,
        shipping_address: shippingAddress.trim() || null,
        shipping_city: shippingCity.trim() || null,
        shipping_postal_code: shippingPostalCode.trim() || null,
        shipping_country: shippingCountry.trim() || null,
        shipping_phone: shippingPhone.trim() || null,
        pending_products: importedProducts.length > 0 ? JSON.stringify(importedProducts) : null,
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

      alert("Seller profile saved successfully! Your application is now pending review.");
      router.push("/account");
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
            {/* Imported from Shopify indicator */}
            {importedFromShopify && (
              <div style={{
                padding: 16,
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: 8,
                marginBottom: 24,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}>
                <div style={{ fontSize: 20 }}>✓</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#166534" }}>
                    Imported from Shopify
                  </div>
                  <div style={{ fontSize: 11, color: "#15803d" }}>
                    Your brand info has been pre-filled. You can edit if needed.
                  </div>
                </div>
              </div>
            )}

            {/* Shopify Import */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
                IMPORT FROM SHOPIFY
              </div>
              <div style={{ color: "#777", fontSize: 10, marginBottom: 10, letterSpacing: 0.3 }}>
                Paste your store URL to auto-fill name and logo.
              </div>
              <div style={{ display: "flex", gap: 8, maxWidth: 520 }}>
                <input
                  type="text"
                  placeholder="yourstore.myshopify.com"
                  value={shopifyImportUrl}
                  onChange={(e) => {
                    setShopifyImportUrl(e.target.value);
                    setShopifyError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") importFromShopify();
                  }}
                  style={{
                    ...inputStyle,
                    flex: 1,
                    maxWidth: "none",
                  }}
                />
                <button
                  onClick={importFromShopify}
                  disabled={shopifyLoading}
                  style={{
                    padding: "12px 20px",
                    background: shopifyLoading ? "#999" : "#000",
                    color: "#fff",
                    border: "none",
                    fontWeight: 700,
                    fontSize: 11,
                    letterSpacing: 1,
                    cursor: shopifyLoading ? "not-allowed" : "pointer",
                  }}
                >
                  {shopifyLoading ? "..." : "IMPORT"}
                </button>
              </div>
              {shopifyError && (
                <div style={{ color: "#dc2626", fontSize: 11, marginTop: 8 }}>
                  {shopifyError}
                </div>
              )}
            </div>

            {/* Logo */}
            <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>LOGO</div>
            <div style={{ color: "#777", fontSize: 10, marginBottom: 14, letterSpacing: 0.3 }}>
              Add a logo for your brand page.
            </div>

            <label
              style={{
                width: 140,
                height: 140,
                borderRadius: "50%",
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
                    borderRadius: "50%",
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

            {/* City & Country */}
            <div style={{ marginTop: 22 }}>
              <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>LOCATION</div>
              <div style={{ color: "#777", fontSize: 10, marginBottom: 10, letterSpacing: 0.3 }}>Where is your brand based?</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <input
                  placeholder="City"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  style={{ ...inputStyle, maxWidth: "none" }}
                />
                <input
                  placeholder="Country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  style={{ ...inputStyle, maxWidth: "none" }}
                />
              </div>
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
            {/* Catalog Import */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
                IMPORT PRODUCTS FROM SHOPIFY
              </div>
              <div style={{ color: "#777", fontSize: 10, marginBottom: 10, letterSpacing: 0.3 }}>
                Paste your store URL to import all products at once.
              </div>
              <div style={{ display: "flex", gap: 8, maxWidth: 520 }}>
                <input
                  type="text"
                  placeholder="yourstore.myshopify.com or /collections/all"
                  value={catalogUrl}
                  onChange={(e) => {
                    setCatalogUrl(e.target.value);
                    setCatalogError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") importCatalog();
                  }}
                  style={{
                    ...inputStyle,
                    flex: 1,
                    maxWidth: "none",
                  }}
                />
                <button
                  onClick={importCatalog}
                  disabled={catalogLoading}
                  style={{
                    padding: "12px 20px",
                    background: catalogLoading ? "#999" : "#000",
                    color: "#fff",
                    border: "none",
                    fontWeight: 700,
                    fontSize: 11,
                    letterSpacing: 1,
                    cursor: catalogLoading ? "not-allowed" : "pointer",
                  }}
                >
                  {catalogLoading ? "..." : "IMPORT"}
                </button>
              </div>
              {catalogError && (
                <div style={{ color: "#dc2626", fontSize: 11, marginTop: 8 }}>
                  {catalogError}
                </div>
              )}
            </div>

            {/* Imported Products List */}
            {importedProducts.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>
                  IMPORTED PRODUCTS ({importedProducts.length})
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {importedProducts.map((product, index) => (
                    <div
                      key={index}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: 12,
                        background: "#f5f5f5",
                        border: "1px solid #e6e6e6",
                        cursor: "pointer",
                      }}
                      onClick={() => {
                        setEditingProduct(product);
                        setTimeout(() => setModalVisible(true), 10);
                      }}
                    >
                      {product.images[0] ? (
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          style={{ width: 48, height: 48, objectFit: "cover" }}
                        />
                      ) : (
                        <div style={{ width: 48, height: 48, background: "#ddd" }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {product.name}
                        </div>
                        <div style={{ fontSize: 10, color: "#666" }}>
                          {product.currency === "EUR" ? "€" : product.currency === "GBP" ? "£" : "$"}{product.price} · {product.sizes.length} sizes · {product.images.length} images
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeProduct(index);
                        }}
                        style={{
                          all: "unset",
                          cursor: "pointer",
                          padding: 8,
                          fontSize: 16,
                          color: "#999",
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

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

            {/* Social handles */}
            <div style={{ marginTop: 22 }}>
              <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>SOCIAL MEDIA</div>
              <div style={{ color: "#777", fontSize: 10, marginBottom: 12, letterSpacing: 0.3 }}>Optional. Add your social media profiles.</div>

              {/* Instagram */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, background: "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </div>
                <input
                  placeholder="@instagram"
                  value={instagramHandle}
                  onChange={(e) => setInstagramHandle(e.target.value)}
                  style={{ ...inputStyle, maxWidth: "none", flex: 1 }}
                />
              </div>

              {/* Twitter/X */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, background: "#000", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </div>
                <input
                  placeholder="@twitter"
                  value={twitterHandle}
                  onChange={(e) => setTwitterHandle(e.target.value)}
                  style={{ ...inputStyle, maxWidth: "none", flex: 1 }}
                />
              </div>

              {/* Facebook */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, background: "#1877f2", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </div>
                <input
                  placeholder="facebook.com/yourpage"
                  value={facebookHandle}
                  onChange={(e) => setFacebookHandle(e.target.value)}
                  style={{ ...inputStyle, maxWidth: "none", flex: 1 }}
                />
              </div>
            </div>
          </>
        )}

        {/* Product Edit Panel - Right side */}
        {editingProduct && (
          <div
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: 400,
              background: "#fff",
              borderLeft: "1px solid #e6e6e6",
              zIndex: 1000,
              transform: modalVisible ? "translateX(0)" : "translateX(100%)",
              transition: "transform 200ms ease-out",
              display: "flex",
              flexDirection: "column",
              boxShadow: "-4px 0 20px rgba(0,0,0,0.1)",
            }}
          >
            {/* Header */}
            <div style={{
              padding: "16px 20px",
              borderBottom: "1px solid #e6e6e6",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
                Edit Product
              </div>
              <button
                onClick={() => {
                  setModalVisible(false);
                  setTimeout(() => setEditingProduct(null), 200);
                }}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  fontSize: 20,
                  color: "#999",
                  padding: 4,
                }}
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
              {/* Main image */}
              {editingProduct.images[0] && (
                <img
                  src={editingProduct.images[0]}
                  alt=""
                  style={{
                    width: "100%",
                    aspectRatio: "1",
                    objectFit: "cover",
                    marginBottom: 16,
                  }}
                />
              )}

              {/* Thumbnails */}
              {editingProduct.images.length > 1 && (
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    overflowX: "auto",
                    marginBottom: 20,
                    paddingBottom: 4,
                  }}
                >
                  {editingProduct.images.map((img, i) => (
                    <img
                      key={i}
                      src={img}
                      alt=""
                      style={{
                        width: 48,
                        height: 48,
                        objectFit: "cover",
                        flexShrink: 0,
                        border: i === 0 ? "2px solid #000" : "1px solid #e6e6e6",
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Copy from another product */}
              {importedProducts.filter(p =>
                p.slug !== editingProduct.slug &&
                (p.description || p.sizeChartUrl || p.shippingInfo || p.careInstructions || p.instagramUrl || p.phoneNumber)
              ).length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5, color: "#666" }}>
                    Copy info from
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {importedProducts
                      .filter(p =>
                        p.slug !== editingProduct.slug &&
                        (p.description || p.sizeChartUrl || p.shippingInfo || p.careInstructions || p.instagramUrl || p.phoneNumber)
                      )
                      .map((p) => (
                        <button
                          key={p.slug}
                          onClick={() => {
                            const idx = importedProducts.findIndex(prod => prod.slug === editingProduct.slug);
                            if (idx !== -1) {
                              const updates: Partial<ImportedProduct> = {};
                              if (p.description && !editingProduct.description) updates.description = p.description;
                              if (p.sizeChartUrl && !editingProduct.sizeChartUrl) updates.sizeChartUrl = p.sizeChartUrl;
                              if (p.shippingInfo && !editingProduct.shippingInfo) updates.shippingInfo = p.shippingInfo;
                              if (p.careInstructions && !editingProduct.careInstructions) updates.careInstructions = p.careInstructions;
                              if (p.instagramUrl && !editingProduct.instagramUrl) updates.instagramUrl = p.instagramUrl;
                              if (p.phoneNumber && !editingProduct.phoneNumber) updates.phoneNumber = p.phoneNumber;

                              if (Object.keys(updates).length > 0) {
                                updateProduct(idx, updates);
                                setEditingProduct({ ...editingProduct, ...updates });
                              }
                            }
                          }}
                          style={{
                            padding: "6px 12px",
                            background: "#f5f5f5",
                            border: "1px solid #e6e6e6",
                            borderRadius: 6,
                            fontSize: 11,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            transition: "all 150ms",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#000";
                            e.currentTarget.style.color = "#fff";
                            e.currentTarget.style.borderColor = "#000";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "#f5f5f5";
                            e.currentTarget.style.color = "#000";
                            e.currentTarget.style.borderColor = "#e6e6e6";
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                          </svg>
                          {p.name.length > 20 ? p.name.substring(0, 20) + "..." : p.name}
                        </button>
                      ))}
                  </div>
                  <div style={{ fontSize: 9, color: "#999", marginTop: 6 }}>
                    Copies only empty fields (description, shipping, care, contacts)
                  </div>
                </div>
              )}

              {/* Name */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Name</div>
                <input
                  value={editingProduct.name}
                  onChange={(e) => {
                    const idx = importedProducts.findIndex(p => p.slug === editingProduct.slug);
                    if (idx !== -1) {
                      updateProduct(idx, { name: e.target.value });
                      setEditingProduct({ ...editingProduct, name: e.target.value });
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #e6e6e6",
                    fontSize: 13,
                    background: "#f5f5f5",
                    outline: "none",
                  }}
                />
              </div>

              {/* Price & Currency */}
              <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 2 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Price</div>
                  <input
                    type="number"
                    value={editingProduct.price}
                    onChange={(e) => {
                      const idx = importedProducts.findIndex(p => p.slug === editingProduct.slug);
                      if (idx !== -1) {
                        const price = parseFloat(e.target.value) || 0;
                        updateProduct(idx, { price });
                        setEditingProduct({ ...editingProduct, price });
                      }
                    }}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "1px solid #e6e6e6",
                      fontSize: 13,
                      background: "#f5f5f5",
                      outline: "none",
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Currency</div>
                  <select
                    value={editingProduct.currency}
                    onChange={(e) => {
                      const idx = importedProducts.findIndex(p => p.slug === editingProduct.slug);
                      if (idx !== -1) {
                        updateProduct(idx, { currency: e.target.value });
                        setEditingProduct({ ...editingProduct, currency: e.target.value });
                      }
                    }}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "1px solid #e6e6e6",
                      fontSize: 13,
                      background: "#f5f5f5",
                      outline: "none",
                    }}
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
              </div>

              {/* Category */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Category</div>
                <select
                  value={editingProduct.category || ""}
                  onChange={(e) => {
                    const idx = importedProducts.findIndex(p => p.slug === editingProduct.slug);
                    if (idx !== -1) {
                      updateProduct(idx, { category: e.target.value || null });
                      setEditingProduct({ ...editingProduct, category: e.target.value || null });
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #e6e6e6",
                    fontSize: 13,
                    background: "#f5f5f5",
                    outline: "none",
                  }}
                >
                  <option value="">Select category...</option>
                  <option value="hoodie">Hoodie</option>
                  <option value="t-shirt">T-Shirt</option>
                  <option value="pants">Pants</option>
                  <option value="jacket">Jacket</option>
                  <option value="sweatshirt">Sweatshirt</option>
                  <option value="shorts">Shorts</option>
                  <option value="accessories">Accessories</option>
                </select>
              </div>

              {/* Description */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>About / Description</div>
                <textarea
                  value={editingProduct.description}
                  onChange={(e) => {
                    const idx = importedProducts.findIndex(p => p.slug === editingProduct.slug);
                    if (idx !== -1) {
                      updateProduct(idx, { description: e.target.value });
                      setEditingProduct({ ...editingProduct, description: e.target.value });
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #e6e6e6",
                    fontSize: 13,
                    background: "#f5f5f5",
                    outline: "none",
                    minHeight: 60,
                    resize: "vertical",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              {/* Size Chart Image */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Size Chart</div>
                {editingProduct.sizeChartUrl && (
                  <div style={{ marginBottom: 8, position: "relative" }}>
                    <img
                      src={editingProduct.sizeChartUrl}
                      alt="Size chart"
                      style={{ width: "100%", maxHeight: 200, objectFit: "contain", background: "#f5f5f5", border: "1px solid #e6e6e6" }}
                    />
                    <button
                      onClick={() => {
                        const idx = importedProducts.findIndex(p => p.slug === editingProduct.slug);
                        if (idx !== -1) {
                          updateProduct(idx, { sizeChartUrl: "" });
                          setEditingProduct({ ...editingProduct, sizeChartUrl: "" });
                        }
                      }}
                      style={{
                        position: "absolute",
                        top: 4,
                        right: 4,
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: "rgba(0,0,0,0.6)",
                        color: "#fff",
                        border: "none",
                        cursor: "pointer",
                        fontSize: 14,
                      }}
                    >
                      ×
                    </button>
                  </div>
                )}
                <input
                  type="text"
                  value={editingProduct.sizeChartUrl || ""}
                  onChange={(e) => {
                    const idx = importedProducts.findIndex(p => p.slug === editingProduct.slug);
                    if (idx !== -1) {
                      updateProduct(idx, { sizeChartUrl: e.target.value });
                      setEditingProduct({ ...editingProduct, sizeChartUrl: e.target.value });
                    }
                  }}
                  placeholder="https://... or paste image URL"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #e6e6e6",
                    fontSize: 13,
                    background: "#f5f5f5",
                    outline: "none",
                  }}
                />
              </div>

              {/* Shipping Info */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Shipping</div>
                <textarea
                  value={editingProduct.shippingInfo || ""}
                  onChange={(e) => {
                    const idx = importedProducts.findIndex(p => p.slug === editingProduct.slug);
                    if (idx !== -1) {
                      updateProduct(idx, { shippingInfo: e.target.value });
                      setEditingProduct({ ...editingProduct, shippingInfo: e.target.value });
                    }
                  }}
                  placeholder="Free shipping on orders over €100"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #e6e6e6",
                    fontSize: 13,
                    background: "#f5f5f5",
                    outline: "none",
                    minHeight: 50,
                    resize: "vertical",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              {/* Care Instructions */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Washing / Care</div>
                <textarea
                  value={editingProduct.careInstructions || ""}
                  onChange={(e) => {
                    const idx = importedProducts.findIndex(p => p.slug === editingProduct.slug);
                    if (idx !== -1) {
                      updateProduct(idx, { careInstructions: e.target.value });
                      setEditingProduct({ ...editingProduct, careInstructions: e.target.value });
                    }
                  }}
                  placeholder="Machine wash cold, do not bleach"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #e6e6e6",
                    fontSize: 13,
                    background: "#f5f5f5",
                    outline: "none",
                    minHeight: 50,
                    resize: "vertical",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              {/* Contact - Instagram */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Contact</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 36, height: 36, background: "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={editingProduct.instagramUrl || ""}
                    onChange={(e) => {
                      const idx = importedProducts.findIndex(p => p.slug === editingProduct.slug);
                      if (idx !== -1) {
                        updateProduct(idx, { instagramUrl: e.target.value });
                        setEditingProduct({ ...editingProduct, instagramUrl: e.target.value });
                      }
                    }}
                    placeholder="@username or https://instagram.com/..."
                    style={{
                      flex: 1,
                      padding: "10px 12px",
                      border: "1px solid #e6e6e6",
                      fontSize: 13,
                      background: "#f5f5f5",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* Contact - Phone */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 36, height: 36, background: "#22c55e", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                      <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={editingProduct.phoneNumber || ""}
                    onChange={(e) => {
                      const idx = importedProducts.findIndex(p => p.slug === editingProduct.slug);
                      if (idx !== -1) {
                        updateProduct(idx, { phoneNumber: e.target.value });
                        setEditingProduct({ ...editingProduct, phoneNumber: e.target.value });
                      }
                    }}
                    placeholder="+1 234 567 8900"
                    style={{
                      flex: 1,
                      padding: "10px 12px",
                      border: "1px solid #e6e6e6",
                      fontSize: 13,
                      background: "#f5f5f5",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* Sizes */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Sizes ({editingProduct.sizes.length})
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {editingProduct.sizes.map((s, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "8px 12px",
                          background: s.in_stock ? "#f0fdf4" : "#f5f5f5",
                          border: `1px solid ${s.in_stock ? "#bbf7d0" : "#e6e6e6"}`,
                        }}
                      >
                        {/* Toggle */}
                        <button
                          onClick={() => {
                            const idx = importedProducts.findIndex(p => p.slug === editingProduct.slug);
                            if (idx !== -1) {
                              const newSizes = [...editingProduct.sizes];
                              newSizes[i] = { ...newSizes[i], in_stock: !newSizes[i].in_stock };
                              updateProduct(idx, { sizes: newSizes });
                              setEditingProduct({ ...editingProduct, sizes: newSizes });
                            }
                          }}
                          style={{
                            width: 36,
                            height: 20,
                            borderRadius: 10,
                            border: "none",
                            background: s.in_stock ? "#22c55e" : "#d1d5db",
                            cursor: "pointer",
                            position: "relative",
                            transition: "background 150ms",
                          }}
                        >
                          <div style={{
                            width: 16,
                            height: 16,
                            borderRadius: "50%",
                            background: "#fff",
                            position: "absolute",
                            top: 2,
                            left: s.in_stock ? 18 : 2,
                            transition: "left 150ms",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                          }} />
                        </button>

                        {/* Size name */}
                        <div style={{
                          flex: 1,
                          fontSize: 12,
                          fontWeight: 600,
                          color: s.in_stock ? "#166534" : "#999",
                        }}>
                          {s.size}
                        </div>

                        {/* Quantity */}
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ fontSize: 10, color: "#666" }}>Qty:</span>
                          <input
                            type="number"
                            min="0"
                            value={s.quantity}
                            onChange={(e) => {
                              const idx = importedProducts.findIndex(p => p.slug === editingProduct.slug);
                              if (idx !== -1) {
                                const newSizes = [...editingProduct.sizes];
                                const qty = parseInt(e.target.value) || 0;
                                newSizes[i] = { ...newSizes[i], quantity: qty, in_stock: qty > 0 };
                                updateProduct(idx, { sizes: newSizes });
                                setEditingProduct({ ...editingProduct, sizes: newSizes });
                              }
                            }}
                            style={{
                              width: 50,
                              padding: "4px 8px",
                              border: "1px solid #e6e6e6",
                              fontSize: 12,
                              textAlign: "center",
                              background: "#fff",
                              outline: "none",
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
            </div>

            {/* Bottom button */}
            <div style={{ padding: 20, borderTop: "1px solid #e6e6e6" }}>
              <button
                onClick={() => {
                  setModalVisible(false);
                  setTimeout(() => setEditingProduct(null), 200);
                }}
                style={{
                  width: "100%",
                  padding: 12,
                  background: "#000",
                  color: "#fff",
                  border: "none",
                  fontWeight: 700,
                  fontSize: 11,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                Done
              </button>
            </div>
          </div>
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

            {/* Shipping Address Section */}
            <div style={{ marginTop: 36, paddingTop: 24, borderTop: "1px solid #e6e6e6" }}>
              <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>SHIPPING ADDRESS</div>
              <div style={{ color: "#777", fontSize: 10, marginBottom: 14, letterSpacing: 0.3 }}>
                Your return address for shipping labels. This is where items will be shipped from.
              </div>

              {/* Street address */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 10, marginBottom: 6, color: "#444" }}>Street Address</div>
                <input
                  placeholder="123 Main Street, Apt 4B"
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* City and Postal Code */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 10, marginBottom: 6, color: "#444" }}>City</div>
                  <input
                    placeholder="Berlin"
                    value={shippingCity}
                    onChange={(e) => setShippingCity(e.target.value)}
                    style={{ ...inputStyle, maxWidth: "none" }}
                  />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 10, marginBottom: 6, color: "#444" }}>Postal Code</div>
                  <input
                    placeholder="10115"
                    value={shippingPostalCode}
                    onChange={(e) => setShippingPostalCode(e.target.value)}
                    style={{ ...inputStyle, maxWidth: "none" }}
                  />
                </div>
              </div>

              {/* Country */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 10, marginBottom: 6, color: "#444" }}>Country</div>
                <input
                  placeholder="Germany"
                  value={shippingCountry}
                  onChange={(e) => setShippingCountry(e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* Phone */}
              <div>
                <div style={{ fontWeight: 600, fontSize: 10, marginBottom: 6, color: "#444" }}>Phone Number</div>
                <div style={{ color: "#777", fontSize: 9, marginBottom: 6, letterSpacing: 0.3 }}>For courier contact regarding deliveries.</div>
                <input
                  placeholder="+49 123 456 7890"
                  value={shippingPhone}
                  onChange={(e) => setShippingPhone(e.target.value)}
                  style={inputStyle}
                />
              </div>
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
