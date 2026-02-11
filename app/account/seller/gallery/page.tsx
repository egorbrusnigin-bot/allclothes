"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import { useIsMobile } from "../../../lib/useIsMobile";

interface GalleryPost {
  id: string;
  image_url: string;
  title: string;
  caption: string | null;
  link_url: string | null;
  status: string;
  rejection_reason: string | null;
  created_at: string;
}

export default function SellerGalleryPage() {
  const [posts, setPosts] = useState<GalleryPost[]>([]);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    loadBrandAndPosts();
  }, []);

  async function loadBrandAndPosts() {
    if (!supabase) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: brand } = await supabase
      .from("brands")
      .select("id")
      .eq("owner_id", user.id)
      .single();

    if (!brand) {
      setLoading(false);
      return;
    }

    setBrandId(brand.id);

    const { data: postsData } = await supabase
      .from("gallery_posts")
      .select("id, image_url, title, caption, link_url, status, rejection_reason, created_at")
      .eq("brand_id", brand.id)
      .order("created_at", { ascending: false });

    setPosts(postsData || []);
    setLoading(false);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  }

  function processFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !brandId || !imageFile || !title.trim()) return;

    setUploading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const formData = new FormData();
      formData.append("file", imageFile);
      formData.append("brand_id", brandId);
      formData.append("title", title.trim());
      formData.append("caption", caption.trim());
      formData.append("link_url", linkUrl.trim());

      const uploadRes = await fetch("/api/gallery/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        alert("Failed to create post: " + (uploadData.error || "Unknown error"));
        setUploading(false);
        return;
      }

      setTitle("");
      setCaption("");
      setLinkUrl("");
      setImageFile(null);
      setImagePreview(null);
      setShowForm(false);
      loadBrandAndPosts();
    } catch (err) {
      console.error(err);
      alert("Something went wrong");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(postId: string) {
    if (!supabase || !confirm("Delete this post?")) return;
    await supabase.from("gallery_posts").delete().eq("id", postId);
    setPosts(posts.filter((p) => p.id !== postId));
  }

  const statusConfig: Record<string, { bg: string; color: string; label: string }> = {
    pending: { bg: "#fff3cd", color: "#856404", label: "Pending" },
    approved: { bg: "#d4edda", color: "#155724", label: "Live" },
    rejected: { bg: "#f8d7da", color: "#721c24", label: "Rejected" },
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: 1 }}>Loading...</div>
      </div>
    );
  }

  if (!brandId) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No brand found</div>
        <p style={{ fontSize: 13, color: "#666" }}>You need an approved brand to post to the gallery.</p>
      </div>
    );
  }

  const approvedCount = posts.filter(p => p.status === "approved").length;
  const pendingCount = posts.filter(p => p.status === "pending").length;

  return (
    <div style={{ display: "grid", gap: 28 }}>
      {/* Header */}
      <div>
        <div style={{ fontSize: 10, color: "#999", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>
          GALLERY
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: isMobile ? "start" : "center", flexDirection: isMobile ? "column" : "row", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>
              Your Posts
            </h1>
            <p style={{ fontSize: 13, color: "#666", margin: "4px 0 0" }}>
              Lookbooks, behind the scenes, and more. Posts go through moderation.
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            style={{
              background: "#000",
              color: "#fff",
              border: "none",
              padding: "10px 20px",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 1,
              cursor: "pointer",
              fontFamily: "inherit",
              flexShrink: 0,
            }}
          >
            {showForm ? "CANCEL" : "+ NEW POST"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }}>
        <div style={{ background: "#000", color: "#fff", padding: isMobile ? 14 : 20 }}>
          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1, opacity: 0.6, marginBottom: 6 }}>TOTAL</div>
          <div style={{ fontSize: isMobile ? 20 : 28, fontWeight: 800 }}>{posts.length}</div>
        </div>
        <div style={{ background: "#f8f8f8", padding: isMobile ? 14 : 20 }}>
          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: "#999", marginBottom: 6 }}>LIVE</div>
          <div style={{ fontSize: isMobile ? 20 : 28, fontWeight: 800, color: "#155724" }}>{approvedCount}</div>
        </div>
        <div style={{ background: "#f8f8f8", padding: isMobile ? 14 : 20 }}>
          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: "#999", marginBottom: 6 }}>PENDING</div>
          <div style={{ fontSize: isMobile ? 20 : 28, fontWeight: 800, color: "#856404" }}>{pendingCount}</div>
        </div>
      </div>

      {/* Upload form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          style={{
            border: "1px solid #e6e6e6",
            padding: isMobile ? 16 : 24,
            background: "#fafafa",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 20, textTransform: "uppercase" }}>
            New Post
          </div>

          {/* Drag & drop image area */}
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Photo *</label>
            {imagePreview ? (
              <div style={{ position: "relative", display: "inline-block" }}>
                <img
                  src={imagePreview}
                  alt="Preview"
                  style={{
                    maxWidth: "100%",
                    maxHeight: 280,
                    display: "block",
                    border: "1px solid #e6e6e6",
                  }}
                />
                <button
                  type="button"
                  onClick={() => { setImageFile(null); setImagePreview(null); }}
                  style={{
                    position: "absolute", top: 8, right: 8,
                    background: "#000", color: "#fff", border: "none",
                    width: 28, height: 28, cursor: "pointer", fontSize: 16,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  &times;
                </button>
              </div>
            ) : (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById("gallery-file-input")?.click()}
                style={{
                  border: `2px dashed ${dragOver ? "#000" : "#d0d0d0"}`,
                  background: dragOver ? "#f0f0f0" : "#fff",
                  padding: "36px 20px",
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 8, color: "#ccc" }}>+</div>
                <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>
                  Drop an image here or click to browse
                </div>
                <div style={{ fontSize: 11, color: "#aaa" }}>
                  JPG, PNG, WebP
                </div>
                <input
                  id="gallery-file-input"
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  style={{ display: "none" }}
                />
              </div>
            )}
          </div>

          {/* Title + Caption side by side on desktop */}
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            gap: isMobile ? 14 : 16,
            marginBottom: 14,
          }}>
            <div>
              <label style={labelStyle}>Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Spring Collection 2026"
                required
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Caption</label>
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="e.g. Fresh looks for the new season"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Link URL */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>
              Link URL
              <span style={{ fontWeight: 400, color: "#999", marginLeft: 6 }}>optional</span>
            </label>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://yoursite.com/collection"
              style={inputStyle}
            />
            <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>
              Visitors can click through to this link from the gallery
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="submit"
              disabled={uploading || !imageFile || !title.trim()}
              style={{
                background: uploading ? "#999" : "#000",
                color: "#fff",
                border: "none",
                padding: "11px 28px",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 1,
                cursor: uploading ? "default" : "pointer",
                fontFamily: "inherit",
              }}
            >
              {uploading ? "UPLOADING..." : "SUBMIT FOR REVIEW"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              style={{
                background: "none",
                color: "#666",
                border: "1px solid #ddd",
                padding: "11px 20px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Posts grid */}
      {posts.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontSize: 40, marginBottom: 12, color: "#e0e0e0" }}>+</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No posts yet</div>
          <p style={{ fontSize: 13, color: "#999", margin: 0 }}>
            Click &quot;+ New Post&quot; to share your first photo
          </p>
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
          gap: isMobile ? 12 : 16,
        }}>
          {posts.map((post) => {
            const sc = statusConfig[post.status] || statusConfig.pending;
            return (
              <div
                key={post.id}
                style={{
                  border: "1px solid #e6e6e6",
                  overflow: "hidden",
                  background: "#fff",
                }}
              >
                {/* Image */}
                <div style={{ position: "relative", background: "#f5f5f5" }}>
                  <img
                    src={post.image_url}
                    alt={post.title}
                    style={{
                      width: "100%",
                      height: isMobile ? 180 : 220,
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                  <span style={{
                    position: "absolute",
                    top: 10,
                    left: 10,
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    padding: "4px 10px",
                    background: sc.bg,
                    color: sc.color,
                    textTransform: "uppercase",
                  }}>
                    {sc.label}
                  </span>
                </div>

                {/* Info */}
                <div style={{ padding: isMobile ? 12 : 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, letterSpacing: 0.3 }}>
                    {post.title}
                  </div>
                  {post.caption && (
                    <p style={{ fontSize: 12, color: "#666", margin: "0 0 6px" }}>{post.caption}</p>
                  )}
                  {post.link_url && (
                    <a
                      href={post.link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 11,
                        color: "#000",
                        textDecoration: "none",
                        background: "#f0f0f0",
                        padding: "3px 8px",
                        marginBottom: 8,
                      }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                      </svg>
                      {post.link_url.replace(/^https?:\/\//, "").substring(0, 35)}
                      {post.link_url.replace(/^https?:\/\//, "").length > 35 ? "..." : ""}
                    </a>
                  )}
                  {post.status === "rejected" && post.rejection_reason && (
                    <div style={{
                      fontSize: 11,
                      color: "#dc3545",
                      background: "#fdf0f0",
                      padding: "6px 10px",
                      marginBottom: 8,
                    }}>
                      Rejected: {post.rejection_reason}
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                    <span style={{ fontSize: 11, color: "#aaa" }}>
                      {new Date(post.created_at).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => handleDelete(post.id)}
                      style={{
                        fontSize: 11,
                        color: "#999",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        fontFamily: "inherit",
                        transition: "color 0.15s",
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = "#dc3545"}
                      onMouseLeave={e => e.currentTarget.style.color = "#999"}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.5,
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #e6e6e6",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
  background: "#fff",
};
