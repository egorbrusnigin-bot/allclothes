"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import { isAdmin, getCurrentUserId } from "../../../../lib/auth";
import Link from "next/link";

interface Brand {
  id: string;
  name: string;
  slug: string;
}

export default function NewProductPage() {
  const router = useRouter();
  const [adminCheck, setAdminCheck] = useState(false);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Shopify import
  const [shopifyUrl, setShopifyUrl] = useState("");
  const [importing, setImporting] = useState(false);

  // Form state
  const [brandMode, setBrandMode] = useState<"existing" | "new">("existing");
  const [brandId, setBrandId] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [details, setDetails] = useState("");
  const [modelInfo, setModelInfo] = useState("");
  const [shippingInfo, setShippingInfo] = useState("");
  const [careInstructions, setCareInstructions] = useState("");
  const [contactInfo, setContactInfo] = useState("");

  // New brand fields
  const [newBrandName, setNewBrandName] = useState("");
  const [newBrandCity, setNewBrandCity] = useState("");
  const [newBrandCountry, setNewBrandCountry] = useState("");
  const [newBrandDescription, setNewBrandDescription] = useState("");
  const [newBrandLogoUrl, setNewBrandLogoUrl] = useState("");

  // Product images (up to 5 images)
  const [images, setImages] = useState<string[]>(["", "", "", "", ""]);
  const [mainImageIndex, setMainImageIndex] = useState(0);
  const [uploadingImages, setUploadingImages] = useState<boolean[]>([false, false, false, false, false]);

  // Brand logo upload
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Product sizes
  const [sizes, setSizes] = useState<{
    S: { enabled: boolean; quantity: number };
    M: { enabled: boolean; quantity: number };
    L: { enabled: boolean; quantity: number };
    XL: { enabled: boolean; quantity: number };
    XXL: { enabled: boolean; quantity: number };
  }>({
    S: { enabled: false, quantity: 0 },
    M: { enabled: false, quantity: 0 },
    L: { enabled: false, quantity: 0 },
    XL: { enabled: false, quantity: 0 },
    XXL: { enabled: false, quantity: 0 },
  });

  useEffect(() => {
    checkAdmin();
    loadBrands();
  }, []);

  async function checkAdmin() {
    const admin = await isAdmin();
    if (!admin) {
      router.push("/account");
      return;
    }
    setAdminCheck(true);
  }

  async function loadBrands() {
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("brands")
        .select("id, name, slug")
        .order("name");

      console.log("Loaded brands:", data?.length || 0);
      if (data && data.length > 0) {
        console.log("Brands:", data.map(b => b.name).join(", "));
      }

      if (error) {
        console.warn("Could not load brands:", error.message || error);
        setBrands([]);
      } else {
        setBrands(data || []);
        console.log("Showing all brands:", data?.length || 0);
      }
    } catch (error) {
      console.warn("Error loading brands:", error);
      setBrands([]);
    } finally {
      setLoading(false);
    }
  }

  async function importFromShopify() {
    if (!shopifyUrl.trim()) {
      alert("Please enter a Shopify product URL");
      return;
    }

    setImporting(true);

    try {
      // Convert URL to JSON endpoint
      // https://site.com/products/name?variant=123 -> https://site.com/products/name.json
      let jsonUrl = shopifyUrl.split("?")[0]; // Remove query params
      if (!jsonUrl.endsWith(".json")) {
        jsonUrl += ".json";
      }

      const response = await fetch(jsonUrl);
      if (!response.ok) {
        throw new Error("Failed to fetch product data");
      }

      const data = await response.json();
      const product = data.product;

      if (!product) {
        throw new Error("Invalid product data");
      }

      // Auto-fill form fields
      setName(product.title || "");

      // Get price from first variant
      if (product.variants && product.variants.length > 0) {
        setPrice(product.variants[0].price || "");
      }

      // Auto-detect brand from vendor field
      if (product.vendor) {
        const vendorName = product.vendor.trim();
        console.log("Detecting brand from vendor:", vendorName);

        // Normalize brand name for comparison (remove spaces, lowercase)
        const normalizeForComparison = (str: string) =>
          str.toLowerCase().replace(/[\s-_]+/g, '');

        const normalizedVendor = normalizeForComparison(vendorName);

        // Check if brand exists in database (case-insensitive, ignore spaces)
        const existingBrand = brands.find(
          (b) => normalizeForComparison(b.name) === normalizedVendor
        );

        if (existingBrand) {
          // Brand exists - select it automatically
          console.log("Found existing brand:", existingBrand.name);
          setBrandMode("existing");
          setBrandId(existingBrand.id);
        } else {
          // Brand doesn't exist - suggest creating new one
          console.log("Brand not found, suggesting new brand:", vendorName);
          setBrandMode("new");
          setNewBrandName(vendorName);
        }
      }

      // Fetch and parse sections from Shopify HTML page using backend API
      try {
        const sectionsResponse = await fetch("/api/parse-shopify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: shopifyUrl }),
        });

        if (sectionsResponse.ok) {
          const sections = await sectionsResponse.json();

          // Populate form fields with parsed sections
          if (sections.aboutUs) setDescription(sections.aboutUs);
          if (sections.sizeChart) setModelInfo(sections.sizeChart);
          if (sections.shipping) setShippingInfo(sections.shipping);
          if (sections.washing) setCareInstructions(sections.washing);
          if (sections.contact) setContactInfo(sections.contact);
          if (sections.details) setDetails(sections.details);
        } else {
          console.warn("Failed to parse product sections from HTML");
        }
      } catch (error) {
        console.error("Error parsing product sections:", error);
        // Don't fail entire import if section parsing fails
      }

      // Set category based on product_type
      if (product.product_type) {
        const type = product.product_type.toLowerCase();
        if (type.includes("hoodie")) setCategory("hoodie");
        else if (type.includes("t-shirt") || type.includes("tee")) setCategory("t-shirt");
        else if (type.includes("pant")) setCategory("pants");
        else if (type.includes("jacket")) setCategory("jacket");
        else if (type.includes("sweatshirt")) setCategory("sweatshirt");
        else if (type.includes("long sleeve") || type.includes("longsleeve")) setCategory("longsleeve");
        else if (type.includes("short")) setCategory("shorts");
      }

      // Import images (up to 5)
      if (product.images && product.images.length > 0) {
        const newImages = ["", "", "", "", ""];
        product.images.slice(0, 5).forEach((img: any, index: number) => {
          newImages[index] = img.src || "";
        });
        setImages(newImages);
        setMainImageIndex(0); // First image is main
      }

      // Import sizes from variants
      if (product.variants && product.variants.length > 0) {
        const newSizes = {
          S: { enabled: false, quantity: 0 },
          M: { enabled: false, quantity: 0 },
          L: { enabled: false, quantity: 0 },
          XL: { enabled: false, quantity: 0 },
          XXL: { enabled: false, quantity: 0 },
        };

        product.variants.forEach((variant: any) => {
          const size = variant.title?.toUpperCase();
          if (size && size in newSizes) {
            newSizes[size as keyof typeof newSizes] = {
              enabled: variant.available || false,
              quantity: variant.inventory_quantity || 0,
            };
          }
        });

        setSizes(newSizes);
      }

      alert("Product imported successfully! Please review and adjust the fields as needed.");
    } catch (error) {
      console.error("Import error:", error);
      alert("Failed to import product. Make sure the URL is a valid Shopify product link.");
    } finally {
      setImporting(false);
    }
  }

  async function uploadBrandLogo(file: File): Promise<string | null> {
    if (!supabase) return null;
    setUploadingLogo(true);

    try {
      const userId = await getCurrentUserId();
      if (!userId) return null;

      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("brand-logos")
        .upload(fileName, file);

      if (uploadError) {
        alert(`Error uploading logo: ${uploadError.message}`);
        return null;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("brand-logos").getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error("Error uploading logo:", error);
      return null;
    } finally {
      setUploadingLogo(false);
    }
  }

  async function uploadProductImage(file: File, index: number): Promise<string | null> {
    if (!supabase) return null;

    const newUploadingImages = [...uploadingImages];
    newUploadingImages[index] = true;
    setUploadingImages(newUploadingImages);

    try {
      const userId = await getCurrentUserId();
      if (!userId) return null;

      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}/${Date.now()}_${index}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(fileName, file);

      if (uploadError) {
        alert(`Error uploading image: ${uploadError.message}`);
        return null;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("product-images").getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error("Error uploading image:", error);
      return null;
    } finally {
      newUploadingImages[index] = false;
      setUploadingImages(newUploadingImages);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validation
    if (!name || !price) {
      alert("Please fill in required fields: Name and Price");
      return;
    }

    if (brandMode === "existing" && !brandId) {
      alert("Please select a brand");
      return;
    }

    if (brandMode === "new" && !newBrandName) {
      alert("Please enter brand name");
      return;
    }

    if (!supabase) return;
    setSaving(true);

    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        alert("Could not get user ID");
        return;
      }

      let finalBrandId = brandId;

      // Create new brand if needed
      if (brandMode === "new") {
        const brandSlug = newBrandName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");

        // Geocode city + country → coordinates for map
        let latitude: number | null = null;
        let longitude: number | null = null;
        const geocodeQuery = [newBrandCity, newBrandCountry].filter(Boolean).join(", ");
        if (geocodeQuery) {
          try {
            const geoRes = await fetch(
              `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(geocodeQuery)}&format=json&limit=1`,
              { headers: { "User-Agent": "allclothes-site" } }
            );
            const geoData = await geoRes.json();
            if (geoData && geoData[0]) {
              latitude = parseFloat(geoData[0].lat);
              longitude = parseFloat(geoData[0].lon);
            }
          } catch {
            console.warn("Geocoding failed, brand will be created without coordinates");
          }
        }

        const { data: newBrand, error: brandError } = await supabase
          .from("brands")
          .insert({
            slug: brandSlug,
            name: newBrandName,
            city: newBrandCity || null,
            country: newBrandCountry || null,
            description: newBrandDescription || null,
            logo_url: newBrandLogoUrl || null,
            owner_id: userId,
            latitude,
            longitude,
          })
          .select()
          .single();

        if (brandError) {
          alert(`Error creating brand: ${brandError.message}`);
          return;
        }

        finalBrandId = newBrand.id;
      }

      // Generate slug from product name
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      // Create product as admin (status = approved)
      const { data: product, error } = await supabase
        .from("products")
        .insert({
          brand_id: finalBrandId,
          slug,
          name,
          price: parseFloat(price),
          currency,
          category: category || null,
          description: description.trim() || null,
          details: details.trim() || null,
          model_info: modelInfo.trim() || null,
          shipping_info: shippingInfo.trim() || null,
          care_instructions: careInstructions.trim() || null,
          contact_info: contactInfo.trim() || null,
          owner_id: userId,
          status: "approved", // Admin products are pre-approved
          approved_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        alert(`Error creating product: ${error.message}`);
        return;
      }

      // Add product images
      const validImages = images.filter((img) => img.trim() !== "");
      if (validImages.length > 0) {
        const imageInserts = validImages.map((imageUrl, index) => ({
          product_id: product.id,
          image_url: imageUrl,
          is_main: index === mainImageIndex,
          display_order: index,
        }));

        const { error: imagesError } = await supabase
          .from("product_images")
          .insert(imageInserts);

        if (imagesError) {
          console.error("Error adding images:", imagesError);
        }
      }

      // Add product sizes
      const enabledSizes = Object.entries(sizes)
        .filter(([_, data]) => data.enabled)
        .map(([size, data]) => ({
          product_id: product.id,
          size,
          in_stock: data.quantity > 0,
          quantity: data.quantity,
        }));

      if (enabledSizes.length > 0) {
        const { error: sizesError } = await supabase
          .from("product_sizes")
          .insert(enabledSizes);

        if (sizesError) {
          console.error("Error adding sizes:", sizesError);
        }
      }

      alert(
        brandMode === "new"
          ? "Brand and product created successfully!"
          : "Product created successfully!"
      );
      router.push("/account/moderation");
    } catch (error) {
      console.error("Error creating product:", error);
      alert("Failed to create product");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !adminCheck) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#666" }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {/* Header */}
      <div>
        <Link
          href="/account/moderation"
          style={{
            display: "inline-block",
            marginBottom: 16,
            fontSize: 14,
            color: "#666",
            textDecoration: "none",
          }}
        >
          ← Back to Moderation
        </Link>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
          Create New Product
        </h1>
        <p style={{ fontSize: 14, color: "#666" }}>
          Products created by admin are automatically approved
        </p>
      </div>

      {/* Shopify Import Section */}
      <div
        style={{
          background: "#f0f9ff",
          border: "1px solid #bae6fd",
          borderRadius: 16,
          padding: 24,
          display: "grid",
          gap: 12,
        }}
      >
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
            🛍️ Import from Shopify
          </h3>
          <p style={{ fontSize: 13, color: "#666" }}>
            Paste a Shopify product URL to automatically import all product details, images, and variants
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="url"
            value={shopifyUrl}
            onChange={(e) => setShopifyUrl(e.target.value)}
            placeholder="https://store.com/products/product-name"
            style={{
              flex: 1,
              padding: "12px 16px",
              border: "1px solid #e6e6e6",
              borderRadius: 12,
              fontSize: 14,
            }}
          />
          <button
            type="button"
            onClick={importFromShopify}
            disabled={importing || !shopifyUrl.trim()}
            style={{
              padding: "12px 24px",
              background: importing ? "#999" : "#0ea5e9",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              cursor: importing || !shopifyUrl.trim() ? "not-allowed" : "pointer",
              fontWeight: 600,
              fontSize: 14,
              whiteSpace: "nowrap",
            }}
          >
            {importing ? "Importing..." : "Import"}
          </button>
        </div>
        <p style={{ fontSize: 12, color: "#666" }}>
          Example: https://previousstudios.com/en/products/dream-dept-zip-black
        </p>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        style={{
          background: "#fff",
          border: "1px solid #e6e6e6",
          borderRadius: 16,
          padding: 24,
          display: "grid",
          gap: 20,
        }}
      >
        {/* Brand Mode Selection */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 12,
            }}
          >
            Brand *
          </label>
          <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                value="existing"
                checked={brandMode === "existing"}
                onChange={(e) => setBrandMode(e.target.value as "existing")}
                style={{ cursor: "pointer" }}
              />
              <span style={{ fontSize: 14 }}>Select existing brand</span>
            </label>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                value="new"
                checked={brandMode === "new"}
                onChange={(e) => setBrandMode(e.target.value as "new")}
                style={{ cursor: "pointer" }}
              />
              <span style={{ fontSize: 14 }}>Create new brand</span>
            </label>
          </div>

          {/* Existing Brand Selection */}
          {brandMode === "existing" && (
            <select
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              style={{
                width: "100%",
                padding: "12px 16px",
                border: "1px solid #e6e6e6",
                borderRadius: 12,
                fontSize: 14,
              }}
            >
              <option value="">Select a brand...</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          )}

          {/* New Brand Form */}
          {brandMode === "new" && (
            <div style={{ display: "grid", gap: 12 }}>
              <input
                type="text"
                value={newBrandName}
                onChange={(e) => setNewBrandName(e.target.value)}
                placeholder="Brand name (e.g. Supreme)"
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  border: "1px solid #e6e6e6",
                  borderRadius: 12,
                  fontSize: 14,
                }}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <input
                  type="text"
                  value={newBrandCity}
                  onChange={(e) => setNewBrandCity(e.target.value)}
                  placeholder="City (e.g. Vienna)"
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    border: "1px solid #e6e6e6",
                    borderRadius: 12,
                    fontSize: 14,
                  }}
                />
                <input
                  type="text"
                  value={newBrandCountry}
                  onChange={(e) => setNewBrandCountry(e.target.value)}
                  placeholder="Country (e.g. USA)"
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    border: "1px solid #e6e6e6",
                    borderRadius: 12,
                    fontSize: 14,
                  }}
                />
              </div>
              <textarea
                value={newBrandDescription}
                onChange={(e) => setNewBrandDescription(e.target.value)}
                placeholder="Brand description..."
                rows={2}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  border: "1px solid #e6e6e6",
                  borderRadius: 12,
                  fontSize: 14,
                  resize: "vertical",
                }}
              />
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    marginBottom: 8,
                    color: "#666",
                  }}
                >
                  Brand Logo
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    value={newBrandLogoUrl}
                    onChange={(e) => setNewBrandLogoUrl(e.target.value)}
                    placeholder="Logo URL or upload file"
                    style={{
                      flex: 1,
                      padding: "12px 16px",
                      border: "1px solid #e6e6e6",
                      borderRadius: 12,
                      fontSize: 14,
                    }}
                  />
                  <label
                    style={{
                      padding: "12px 20px",
                      background: uploadingLogo ? "#999" : "#000",
                      color: "#fff",
                      border: "none",
                      borderRadius: 12,
                      cursor: uploadingLogo ? "not-allowed" : "pointer",
                      fontWeight: 600,
                      fontSize: 14,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {uploadingLogo ? "Uploading..." : "Upload"}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingLogo}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const url = await uploadBrandLogo(file);
                          if (url) {
                            setNewBrandLogoUrl(url);
                          }
                        }
                        e.target.value = "";
                      }}
                      style={{ display: "none" }}
                    />
                  </label>
                </div>
                {newBrandLogoUrl && (
                  <img
                    src={newBrandLogoUrl}
                    alt="Brand logo preview"
                    style={{
                      marginTop: 8,
                      maxWidth: 120,
                      maxHeight: 120,
                      objectFit: "contain",
                      border: "1px solid #e6e6e6",
                      borderRadius: 8,
                      padding: 8,
                    }}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Product Name */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            Product Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Heavy Weight Hoodie"
            required
            style={{
              width: "100%",
              padding: "12px 16px",
              border: "1px solid #e6e6e6",
              borderRadius: 12,
              fontSize: 14,
            }}
          />
        </div>

        {/* Price and Currency */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
          <div>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              Price *
            </label>
            <input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="99.99"
              required
              style={{
                width: "100%",
                padding: "12px 16px",
                border: "1px solid #e6e6e6",
                borderRadius: 12,
                fontSize: 14,
              }}
            />
          </div>
          <div>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              Currency
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              style={{
                width: "100%",
                padding: "12px 16px",
                border: "1px solid #e6e6e6",
                borderRadius: 12,
                fontSize: 14,
              }}
            >
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
        </div>

        {/* Category */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 16px",
              border: "1px solid #e6e6e6",
              borderRadius: 12,
              fontSize: 14,
            }}
          >
            <option value="">Select category...</option>
            <option value="hoodie">Hoodie</option>
            <option value="t-shirt">T-Shirt</option>
            <option value="pants">Pants</option>
            <option value="jacket">Jacket</option>
            <option value="sweatshirt">Sweatshirt</option>
            <option value="longsleeve">Longsleeve</option>
            <option value="shorts">Shorts</option>
            <option value="accessories">Accessories</option>
          </select>
        </div>

        {/* About Us Section */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            👤 ABOUT US
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brand and product description"
            rows={4}
            style={{
              width: "100%",
              padding: "12px 16px",
              border: "1px solid #e6e6e6",
              borderRadius: 12,
              fontSize: 14,
              resize: "vertical",
            }}
          />
        </div>

        {/* Size Chart Section */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            📋 SIZE CHART
          </label>
          <textarea
            value={modelInfo}
            onChange={(e) => setModelInfo(e.target.value)}
            placeholder="e.g. Model height: 180cm, wearing size M"
            rows={3}
            style={{
              width: "100%",
              padding: "12px 16px",
              border: "1px solid #e6e6e6",
              borderRadius: 12,
              fontSize: 14,
              resize: "vertical",
            }}
          />
        </div>

        {/* Shipping Section */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            📦 SHIPPING
          </label>
          <textarea
            value={shippingInfo}
            onChange={(e) => setShippingInfo(e.target.value)}
            placeholder="e.g. Free shipping on orders over €100&#10;Standard delivery: 3-5 business days&#10;Express delivery: 1-2 business days"
            rows={3}
            style={{
              width: "100%",
              padding: "12px 16px",
              border: "1px solid #e6e6e6",
              borderRadius: 12,
              fontSize: 14,
              resize: "vertical",
            }}
          />
        </div>

        {/* Washing Section */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            🧺 WASHING
          </label>
          <textarea
            value={careInstructions}
            onChange={(e) => setCareInstructions(e.target.value)}
            placeholder="e.g. Machine wash cold&#10;Do not bleach&#10;Tumble dry low&#10;Iron on low heat"
            rows={4}
            style={{
              width: "100%",
              padding: "12px 16px",
              border: "1px solid #e6e6e6",
              borderRadius: 12,
              fontSize: 14,
              resize: "vertical",
            }}
          />
        </div>

        {/* Contact Section */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            💬 CONTACT
          </label>
          <textarea
            value={contactInfo}
            onChange={(e) => setContactInfo(e.target.value)}
            placeholder="e.g. Email: support@brand.com&#10;Phone: +1234567890&#10;Instagram: @brandname"
            rows={3}
            style={{
              width: "100%",
              padding: "12px 16px",
              border: "1px solid #e6e6e6",
              borderRadius: 12,
              fontSize: 14,
              resize: "vertical",
            }}
          />
        </div>

        {/* Details (not displayed on product page, optional) */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 8,
              color: "#999"
            }}
          >
            Details (optional, for internal use)
          </label>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="e.g. 460 GSM Heavy Weight, 100% Cotton"
            rows={2}
            style={{
              width: "100%",
              padding: "12px 16px",
              border: "1px solid #e6e6e6",
              borderRadius: 12,
              fontSize: 14,
              resize: "vertical",
            }}
          />
        </div>

        {/* Product Images */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            Product Images (up to 5)
          </label>
          <div style={{ display: "grid", gap: 16 }}>
            {images.map((img, index) => (
              <div key={index}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="text"
                    value={img}
                    onChange={(e) => {
                      const newImages = [...images];
                      newImages[index] = e.target.value;
                      setImages(newImages);
                    }}
                    placeholder={`Image URL ${index + 1}${index === 0 ? " (Main)" : ""}`}
                    style={{
                      flex: 1,
                      padding: "12px 16px",
                      border: "1px solid #e6e6e6",
                      borderRadius: 12,
                      fontSize: 14,
                    }}
                  />
                  <label
                    style={{
                      padding: "12px 16px",
                      background: uploadingImages[index] ? "#999" : "#000",
                      color: "#fff",
                      border: "none",
                      borderRadius: 12,
                      cursor: uploadingImages[index] ? "not-allowed" : "pointer",
                      fontWeight: 600,
                      fontSize: 13,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {uploadingImages[index] ? "..." : "Upload"}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingImages[index]}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const url = await uploadProductImage(file, index);
                          if (url) {
                            const newImages = [...images];
                            newImages[index] = url;
                            setImages(newImages);
                          }
                        }
                        e.target.value = "";
                      }}
                      style={{ display: "none" }}
                    />
                  </label>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      whiteSpace: "nowrap",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="mainImage"
                      checked={mainImageIndex === index}
                      onChange={() => setMainImageIndex(index)}
                      disabled={!img.trim()}
                      style={{ cursor: "pointer" }}
                    />
                    Main
                  </label>
                </div>
                {img && (
                  <img
                    src={img}
                    alt={`Product ${index + 1}`}
                    style={{
                      marginTop: 8,
                      maxWidth: 200,
                      maxHeight: 200,
                      objectFit: "cover",
                      border: "1px solid #e6e6e6",
                      borderRadius: 8,
                    }}
                  />
                )}
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "#666", marginTop: 8 }}>
            Upload image files or paste URLs. The main image will be displayed as the primary product photo.
          </p>
        </div>

        {/* Product Sizes */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 12,
            }}
          >
            Available Sizes
          </label>
          <div style={{ display: "grid", gap: 12 }}>
            {(["S", "M", "L", "XL", "XXL"] as const).map((size) => (
              <div
                key={size}
                style={{
                  display: "grid",
                  gridTemplateColumns: "60px 1fr 120px",
                  gap: 12,
                  alignItems: "center",
                  padding: "12px 16px",
                  border: "1px solid #e6e6e6",
                  borderRadius: 12,
                  background: sizes[size].enabled ? "#fafafa" : "#fff",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={sizes[size].enabled}
                    onChange={(e) => {
                      setSizes({
                        ...sizes,
                        [size]: {
                          ...sizes[size],
                          enabled: e.target.checked,
                        },
                      });
                    }}
                    style={{ cursor: "pointer" }}
                  />
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{size}</span>
                </label>

                <div style={{ fontSize: 13, color: "#666" }}>
                  {sizes[size].enabled ? "Available" : "Not available"}
                </div>

                <input
                  type="number"
                  min="0"
                  value={sizes[size].quantity}
                  onChange={(e) => {
                    setSizes({
                      ...sizes,
                      [size]: {
                        ...sizes[size],
                        quantity: parseInt(e.target.value) || 0,
                      },
                    });
                  }}
                  disabled={!sizes[size].enabled}
                  placeholder="Qty"
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #e6e6e6",
                    borderRadius: 8,
                    fontSize: 14,
                    background: sizes[size].enabled ? "#fff" : "#f5f5f5",
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Note */}
        <div
          style={{
            padding: 16,
            background: "#fef3c7",
            border: "1px solid #fde68a",
            borderRadius: 12,
            fontSize: 13,
            color: "#92400e",
          }}
        >
          <strong>Note:</strong>{" "}
          {brandMode === "new"
            ? "New brands and products created by admin are automatically approved and will appear on the site immediately."
            : "Products created by admin are automatically approved and will appear on the site immediately."}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={saving}
          style={{
            padding: "14px 24px",
            background: saving ? "#666" : "#000",
            color: "#fff",
            border: "none",
            borderRadius: 12,
            cursor: saving ? "not-allowed" : "pointer",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          {saving
            ? "Creating..."
            : brandMode === "new"
            ? "Create Brand & Product"
            : "Create Product"}
        </button>
      </form>
    </div>
  );
}
