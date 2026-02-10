"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import Link from "next/link";
import Header from "../components/Header";
import { useIsMobile } from "../lib/useIsMobile";

interface GalleryPost {
  id: string;
  image_url: string;
  caption: string | null;
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
  const isMobile = useIsMobile();

  useEffect(() => {
    loadPosts();
  }, []);

  async function loadPosts() {
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("gallery_posts")
        .select(`
          id,
          image_url,
          caption,
          created_at,
          brand_id,
          brands (
            id,
            name,
            slug,
            logo_url
          )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        // Table might not exist yet - just show empty gallery
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

  return (
    <>
      <Header />
      <main style={{ padding: isMobile ? "24px 16px" : "40px 24px", maxWidth: 1400, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 40, textAlign: "center" }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12 }}>
            Gallery
          </h1>
          <p style={{ fontSize: 14, color: "#666", maxWidth: 500, margin: "0 auto" }}>
            Photos from our brands — behind the scenes, lookbooks, and more
          </p>
        </div>

        {/* Gallery Grid */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#999" }}>
            Loading...
          </div>
        ) : posts.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📷</div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
              No posts yet
            </h2>
            <p style={{ fontSize: 14, color: "#666" }}>
              Brands will post their photos here soon
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(auto-fill, minmax(300px, 1fr))",
              gap: 16,
            }}
          >
            {posts.map((post) => (
              <div
                key={post.id}
                onClick={() => setSelectedPost(post)}
                style={{
                  cursor: "pointer",
                  position: "relative",
                  aspectRatio: "1",
                  overflow: "hidden",
                  background: "#f5f5f5",
                  borderRadius: 4,
                }}
              >
                <img
                  src={post.image_url}
                  alt={post.caption || "Gallery post"}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transition: "transform 0.3s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "scale(1.05)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                />
                {/* Hover overlay */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: 16,
                    background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
                    color: "#fff",
                    opacity: 0,
                    transition: "opacity 0.3s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = "1";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = "0";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {post.brands?.logo_url && (
                      <img
                        src={post.brands.logo_url}
                        alt={post.brands.name}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          objectFit: "cover",
                          background: "#fff",
                        }}
                      />
                    )}
                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                      {post.brands?.name}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Lightbox Modal */}
        {selectedPost && (
          <div
            onClick={() => setSelectedPost(null)}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.9)",
              zIndex: 100,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: isMobile ? 16 : 40,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: 900,
                maxHeight: "90vh",
                display: "flex",
                flexDirection: "column",
                background: "#fff",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              <img
                src={selectedPost.image_url}
                alt={selectedPost.caption || "Gallery post"}
                style={{
                  maxWidth: "100%",
                  maxHeight: "70vh",
                  objectFit: "contain",
                }}
              />
              <div style={{ padding: 20 }}>
                <Link
                  href={`/brand/${selectedPost.brands?.slug}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    textDecoration: "none",
                    color: "inherit",
                    marginBottom: 12,
                  }}
                >
                  {selectedPost.brands?.logo_url && (
                    <img
                      src={selectedPost.brands.logo_url}
                      alt={selectedPost.brands.name}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        objectFit: "cover",
                        background: "#f5f5f5",
                      }}
                    />
                  )}
                  <span style={{ fontSize: 14, fontWeight: 600 }}>
                    {selectedPost.brands?.name}
                  </span>
                </Link>
                {selectedPost.caption && (
                  <p style={{ fontSize: 14, color: "#333", margin: 0 }}>
                    {selectedPost.caption}
                  </p>
                )}
                <div style={{ fontSize: 12, color: "#999", marginTop: 8 }}>
                  {new Date(selectedPost.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={() => setSelectedPost(null)}
              style={{
                position: "absolute",
                top: 20,
                right: 20,
                background: "none",
                border: "none",
                color: "#fff",
                fontSize: 32,
                cursor: "pointer",
                padding: 10,
              }}
            >
              ×
            </button>
          </div>
        )}
      </main>
    </>
  );
}
