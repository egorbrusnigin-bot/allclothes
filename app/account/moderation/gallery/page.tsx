"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { isAdmin } from "../../../lib/auth";
import { useIsMobile } from "../../../lib/useIsMobile";

interface GalleryPost {
  id: string;
  image_url: string;
  title: string;
  caption: string | null;
  link_url: string | null;
  status: string;
  created_at: string;
  brands: {
    id: string;
    name: string;
    logo_url: string | null;
  };
}

export default function ModerationGalleryPage() {
  const [posts, setPosts] = useState<GalleryPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const router = useRouter();
  const isMobile = useIsMobile();

  useEffect(() => {
    checkAdminAndLoad();
  }, []);

  async function checkAdminAndLoad() {
    const admin = await isAdmin();
    if (!admin) {
      router.push("/account");
      return;
    }
    loadPosts();
  }

  async function loadPosts() {
    if (!supabase) return;

    // Загружаем ВСЕ посты через API (service role обходит RLS)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const res = await fetch("/api/gallery/list", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      setPosts(json.posts || []);
    } catch {
      setPosts([]);
    }
    setLoading(false);
  }

  // Модерация через API (service role обходит RLS)
  async function moderatePost(postId: string, action: string, reason?: string) {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch("/api/gallery/moderate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ postId, action, reason }),
    });

    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Failed");
    }
    loadPosts();
  }

  async function handleApprove(postId: string) {
    await moderatePost(postId, "approve");
  }

  async function handleReject(postId: string) {
    const reason = rejectionReasons[postId]?.trim();
    if (!reason) {
      alert("Please provide a rejection reason");
      return;
    }
    await moderatePost(postId, "reject", reason);
    setRejectionReasons((prev) => ({ ...prev, [postId]: "" }));
  }

  async function handleDelete(postId: string) {
    if (!confirm("Delete this post permanently?")) return;
    await moderatePost(postId, "delete");
  }

  const pendingPosts = posts.filter((p) => p.status === "pending");
  const otherPosts = posts.filter((p) => p.status !== "pending");

  if (loading) return <div style={{ padding: 20, color: "#999" }}>Loading...</div>;

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: 0.5, marginBottom: 4 }}>Gallery Moderation</h2>
      <p style={{ fontSize: 13, color: "#666", marginBottom: 24 }}>
        Review and approve gallery posts from brands.
      </p>

      {/* Pending */}
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5, marginBottom: 12 }}>
        PENDING ({pendingPosts.length})
      </div>

      {pendingPosts.length === 0 ? (
        <p style={{ color: "#999", fontSize: 13, marginBottom: 32 }}>No pending posts.</p>
      ) : (
        <div style={{ display: "grid", gap: 16, marginBottom: 32 }}>
          {pendingPosts.map((post) => (
            <div key={post.id} style={{ border: "1px solid #e6e6e6", padding: isMobile ? 12 : 16 }}>
              <div style={{ display: "flex", gap: 16, alignItems: "start", marginBottom: 12 }}>
                <img
                  src={post.image_url}
                  alt={post.title}
                  style={{ width: isMobile ? 100 : 160, height: isMobile ? 100 : 160, objectFit: "cover", flexShrink: 0, background: "#f5f5f5" }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    {post.brands?.logo_url && (
                      <img src={post.brands.logo_url} alt="" style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover" }} />
                    )}
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#666" }}>{post.brands?.name}</span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{post.title}</div>
                  {post.caption && <p style={{ fontSize: 13, color: "#666", margin: "0 0 8px" }}>{post.caption}</p>}
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
                      {post.link_url.replace(/^https?:\/\//, "").substring(0, 40)}
                    </a>
                  )}
                  <span style={{ fontSize: 11, color: "#999" }}>{new Date(post.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  onClick={() => handleApprove(post.id)}
                  style={{ background: "#000", color: "#fff", border: "none", padding: "8px 16px", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, cursor: "pointer", fontFamily: "inherit" }}
                >
                  APPROVE
                </button>
                <input
                  type="text"
                  placeholder="Rejection reason..."
                  value={rejectionReasons[post.id] || ""}
                  onChange={(e) => setRejectionReasons((prev) => ({ ...prev, [post.id]: e.target.value }))}
                  style={{ flex: 1, minWidth: 140, padding: "8px 10px", border: "1px solid #e6e6e6", fontSize: 12, fontFamily: "inherit", outline: "none" }}
                />
                <button
                  onClick={() => handleReject(post.id)}
                  style={{ background: "#fff", color: "#dc3545", border: "1px solid #dc3545", padding: "8px 16px", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, cursor: "pointer", fontFamily: "inherit" }}
                >
                  REJECT
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* All other posts */}
      {otherPosts.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5, marginBottom: 12 }}>
            ALL POSTS ({otherPosts.length})
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {otherPosts.map((post) => (
              <div key={post.id} style={{ border: "1px solid #e6e6e6", padding: 12, display: "flex", gap: 12, alignItems: "center" }}>
                <img src={post.image_url} alt={post.title} style={{ width: 60, height: 60, objectFit: "cover", flexShrink: 0, background: "#f5f5f5" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{post.title}</div>
                  <div style={{ fontSize: 11, color: "#666" }}>{post.brands?.name}</div>
                </div>
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "3px 8px",
                  background: post.status === "approved" ? "#d4edda" : "#f8d7da",
                  color: post.status === "approved" ? "#155724" : "#721c24",
                  textTransform: "uppercase",
                }}>
                  {post.status}
                </span>
                <button
                  onClick={() => handleDelete(post.id)}
                  style={{ fontSize: 11, color: "#dc3545", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
