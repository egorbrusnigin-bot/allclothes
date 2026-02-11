"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import Link from "next/link";
import { useIsMobile } from "../lib/useIsMobile";

interface GalleryPost {
  id: string;
  image_url: string;
  title: string;
  caption: string | null;
  link_url: string | null;
  created_at: string;
  brand_id: string;
  brands: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
  };
}

export default function GalleryPage() {
  const [posts, setPosts] = useState<GalleryPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<GalleryPost | null>(null);
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const isMobile = useIsMobile();
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    loadPosts();
  }, []);

  // Fade-in animation for cards
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).style.opacity = "1";
            (entry.target as HTMLElement).style.transform = "translateY(0)";
          }
        });
      },
      { threshold: 0.1 }
    );
    return () => observerRef.current?.disconnect();
  }, []);

  function cardRef(el: HTMLDivElement | null) {
    if (el && observerRef.current) {
      observerRef.current.observe(el);
    }
  }

  async function loadPosts() {
    if (!supabase) { setLoading(false); return; }

    try {
      const { data, error } = await supabase
        .from("gallery_posts")
        .select(`
          id, image_url, title, caption, link_url, created_at, brand_id,
          brands ( id, name, slug, logo_url )
        `)
        .eq("status", "approved")
        .order("created_at", { ascending: false });

      if (error) {
        if (error.code === "42P01" || error.message?.includes("does not exist")) {
          console.log("Gallery table not created yet");
        } else {
          console.error("Error loading gallery:", error.message || error);
        }
        setPosts([]);
      } else {
        setPosts((data as unknown as GalleryPost[]) || []);
      }
    } catch (err) {
      console.error("Error:", err);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }

  function openLightbox(post: GalleryPost) {
    setSelectedPost(post);
    requestAnimationFrame(() => setLightboxVisible(true));
  }

  function closeLightbox() {
    setLightboxVisible(false);
    setTimeout(() => setSelectedPost(null), 250);
  }


  return (
    <main style={{ margin: 0, padding: 0 }}>
      {/* Header */}
      <div style={{
        padding: isMobile ? "16px 4px 10px" : "24px 40px 14px",
      }}>
        <h1 style={{
          fontSize: isMobile ? 28 : 42,
          fontWeight: 800,
          letterSpacing: -1,
          margin: 0,
          lineHeight: 1,
        }}>
          Gallery
        </h1>
        <p style={{
          fontSize: isMobile ? 12 : 14,
          color: "#666",
          margin: "8px 0 0",
          maxWidth: 400,
        }}>
          Lookbooks, editorials, and behind the scenes from our brands
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 80, color: "#999" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>Loading...</div>
        </div>
      ) : posts.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 24px" }}>
          <div style={{ fontSize: 48, color: "#e0e0e0", marginBottom: 16 }}>+</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>No posts yet</h2>
          <p style={{ fontSize: 14, color: "#666" }}>Brands will share their photos here soon</p>
        </div>
      ) : (
        <div>
          {/* All posts in grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
            gap: isMobile ? 12 : 16,
            padding: isMobile ? "0 4px" : "0 40px",
          }}>
            {posts.map((post, i) => (
              <div
                key={post.id}
                ref={cardRef}
                onClick={() => openLightbox(post)}
                style={{
                  cursor: "pointer",
                  overflow: "hidden",
                  opacity: 0,
                  transform: "translateY(20px)",
                  transition: `opacity 0.6s ease ${i * 0.08}s, transform 0.6s ease ${i * 0.08}s`,
                }}
              >
                {/* Image at natural aspect ratio */}
                <div style={{ overflow: "hidden", background: "#f0f0f0" }}>
                  <img
                    src={post.image_url}
                    alt={post.title}
                    style={{
                      width: "100%",
                      display: "block",
                      transition: "transform 0.4s ease",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.03)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                  />
                </div>
                {/* Text below image */}
                <div style={{ padding: isMobile ? "6px 0 0" : "8px 0 0" }}>
                  <div style={{
                    fontSize: isMobile ? 13 : 15,
                    fontWeight: 700,
                    letterSpacing: 0.3,
                    textTransform: "uppercase",
                    lineHeight: 1.3,
                    marginBottom: 4,
                  }}>
                    {post.title}
                  </div>
                  <div style={{
                    fontSize: isMobile ? 11 : 13,
                    color: "#666",
                    lineHeight: 1.4,
                  }}>
                    {post.caption && <span>{post.caption}</span>}
                    {post.caption && post.link_url && <span> · </span>}
                    {post.link_url && (
                      <a
                        href={post.link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          color: "#666",
                          textDecoration: "underline",
                          textUnderlineOffset: 2,
                        }}
                      >
                        {post.link_url.replace(/^https?:\/\//, "").split("/")[0]}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {selectedPost && (
        <div
          onClick={closeLightbox}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: lightboxVisible ? "rgba(0,0,0,0.92)" : "rgba(0,0,0,0)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: isMobile ? 0 : 20,
            transition: "background 0.25s ease",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 1000,
              width: isMobile ? "100%" : "auto",
              maxHeight: "95vh",
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              background: "#fff",
              overflow: "hidden",
              opacity: lightboxVisible ? 1 : 0,
              transform: lightboxVisible ? "scale(1)" : "scale(0.95)",
              transition: "opacity 0.25s ease, transform 0.25s ease",
            }}
          >
            <img
              src={selectedPost.image_url}
              alt={selectedPost.title}
              style={{
                width: isMobile ? "100%" : "auto",
                maxWidth: isMobile ? "100%" : 600,
                maxHeight: isMobile ? "50vh" : "90vh",
                objectFit: "cover",
                display: "block",
                flexShrink: 0,
              }}
            />
            <div style={{
              padding: isMobile ? 20 : 32,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              minWidth: isMobile ? "auto" : 280,
              maxWidth: 400,
            }}>
              <Link
                href={`/brand/${selectedPost.brands?.slug}`}
                style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "inherit", marginBottom: 16 }}
              >
                {selectedPost.brands?.logo_url && (
                  <img
                    src={selectedPost.brands.logo_url}
                    alt={selectedPost.brands.name}
                    style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", background: "#f5f5f5" }}
                  />
                )}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{selectedPost.brands?.name}</div>
                  <div style={{ fontSize: 11, color: "#999" }}>
                    {new Date(selectedPost.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </div>
                </div>
              </Link>
              <div style={{
                fontSize: isMobile ? 20 : 24,
                fontWeight: 800,
                letterSpacing: -0.5,
                marginBottom: 10,
                lineHeight: 1.2,
              }}>
                {selectedPost.title}
              </div>
              {selectedPost.caption && (
                <p style={{ fontSize: 14, color: "#666", margin: "0 0 16px", lineHeight: 1.5 }}>
                  {selectedPost.caption}
                </p>
              )}
              {selectedPost.link_url && (
                <a
                  href={selectedPost.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    fontSize: 12,
                    color: "#fff",
                    textDecoration: "none",
                    background: "#000",
                    padding: "12px 24px",
                    fontWeight: 700,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  Visit Link
                </a>
              )}
            </div>
          </div>
          <button
            onClick={closeLightbox}
            style={{
              position: "absolute",
              top: isMobile ? 12 : 20,
              right: isMobile ? 12 : 20,
              background: "rgba(255,255,255,0.1)",
              border: "none",
              color: "#fff",
              fontSize: 24,
              cursor: "pointer",
              padding: "8px 12px",
              lineHeight: 1,
            }}
          >
            &times;
          </button>
        </div>
      )}
    </main>
  );
}
