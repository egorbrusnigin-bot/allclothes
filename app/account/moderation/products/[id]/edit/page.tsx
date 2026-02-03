"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "../../../../../lib/supabase";
import { isAdmin, getCurrentUserId } from "../../../../../lib/auth";
import Link from "next/link";

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

  const [adminCheck, setAdminCheck] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
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
  const [brandName, setBrandName] = useState("");

  // Product images
  const [images, setImages] = useState<string[]>(["", "", "", "", ""]);
  const [mainImageIndex, setMainImageIndex] = useState(0);
  const [uploadingImages, setUploadingImages] = useState<boolean[]>([
    false,
    false,
    false,
    false,
    false,
  ]);

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
    loadProduct();
  }, []);

  async function checkAdmin() {
    const admin = await isAdmin();
    if (!admin) {
      router.push("/account");
      return;
    }
    setAdminCheck(true);
  }

  async function loadProduct() {
    if (!supabase) return;

    try {
      // Load product
      const { data: product, error: productError } = await supabase
        .from("products")
        .select(`
          *,
          brand:brands(name)
        `)
        .eq("id", productId)
        .single();

      if (productError || !product) {
        alert("Product not found");
        router.push("/account/moderation");
        return;
      }

      // Set product data
      setName(product.name);
      setPrice(product.price.toString());
      setCurrency(product.currency);
      setCategory(product.category || "");
      setDescription(product.description || "");
      setDetails(product.details || "");
      setModelInfo(product.model_info || "");
      setShippingInfo(product.shipping_info || "");
      setCareInstructions(product.care_instructions || "");
      setContactInfo(product.contact_info || "");
      setBrandName(product.brand?.name || "");

      // Load images
      const { data: productImages } = await supabase
        .from("product_images")
        .select("*")
        .eq("product_id", productId)
        .order("display_order");

      if (productImages) {
        const newImages = ["", "", "", "", ""];
        let mainIndex = 0;

        productImages.forEach((img, index) => {
          if (index < 5) {
            newImages[index] = img.image_url;
            if (img.is_main) mainIndex = index;
          }
        });

        setImages(newImages);
        setMainImageIndex(mainIndex);
      }

      // Load sizes
      const { data: productSizes } = await supabase
        .from("product_sizes")
        .select("*")
        .eq("product_id", productId);

      if (productSizes) {
        const newSizes = { ...sizes };
        productSizes.forEach((size) => {
          const sizeKey = size.size as keyof typeof newSizes;
          if (newSizes[sizeKey]) {
            newSizes[sizeKey] = {
              enabled: true,
              quantity: size.quantity,
            };
          }
        });
        setSizes(newSizes);
      }
    } catch (error) {
      console.error("Error loading product:", error);
    } finally {
      setLoading(false);
    }
  }

  async function uploadProductImage(
    file: File,
    index: number
  ): Promise<string | null> {
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

    if (!name || !price) {
      alert("Please fill in required fields: Name and Price");
      return;
    }

    if (!supabase) return;
    setSaving(true);

    try {
      // Update product
      const { error: productError } = await supabase
        .from("products")
        .update({
          name,
          price: parseFloat(price),
          currency,
          category: category || null,
          description: description || null,
          details: details || null,
          model_info: modelInfo || null,
          shipping_info: shippingInfo || null,
          care_instructions: careInstructions || null,
          contact_info: contactInfo || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", productId);

      if (productError) {
        alert(`Error updating product: ${productError.message}`);
        return;
      }

      // Delete old images
      await supabase.from("product_images").delete().eq("product_id", productId);

      // Add new images
      const validImages = images.filter((img) => img.trim() !== "");
      if (validImages.length > 0) {
        const imageInserts = validImages.map((imageUrl, index) => ({
          product_id: productId,
          image_url: imageUrl,
          is_main: index === mainImageIndex,
          display_order: index,
        }));

        await supabase.from("product_images").insert(imageInserts);
      }

      // Delete old sizes
      await supabase.from("product_sizes").delete().eq("product_id", productId);

      // Add new sizes
      const enabledSizes = Object.entries(sizes)
        .filter(([_, data]) => data.enabled)
        .map(([size, data]) => ({
          product_id: productId,
          size,
          in_stock: data.quantity > 0,
          quantity: data.quantity,
        }));

      if (enabledSizes.length > 0) {
        await supabase.from("product_sizes").insert(enabledSizes);
      }

      alert("Product updated successfully!");
      router.push("/account/moderation");
    } catch (error) {
      console.error("Error updating product:", error);
      alert("Failed to update product");
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
          Edit Product
        </h1>
        <p style={{ fontSize: 14, color: "#666" }}>
          Brand: {brandName}
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
                    placeholder={`Image URL ${index + 1}${
                      index === 0 ? " (Main)" : ""
                    }`}
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
                      cursor: uploadingImages[index]
                        ? "not-allowed"
                        : "pointer",
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
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
