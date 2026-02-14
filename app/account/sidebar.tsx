"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { useIsMobile } from "../lib/useIsMobile";

const baseItems = [
  { href: "/account/orders", label: "My orders" },
  { href: "/account/messages", label: "My messages" },
  { href: "/account/help", label: "Need help?" },
  { href: "/account/profile", label: "My details" },
];

const bottomItems = [
  { href: "/account/settings", label: "Settings" },
  { href: "/account/docs", label: "Documents" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const isMobile = useIsMobile();
  const [isSeller, setIsSeller] = useState(false);
  const [sellerStatus, setSellerStatus] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    checkUserStatus();
  }, []);

  async function checkUserStatus() {
    if (!supabase) {
      setCheckingStatus(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setIsSeller(false);
        setIsAdmin(false);
        setUserEmail("");
        setCheckingStatus(false);
        return;
      }

      setUserEmail(user.email || "");

      // Check if seller
      const { data: sellerData, error: sellerError } = await supabase
        .from("sellers")
        .select("id, status")
        .eq("user_id", user.id)
        .single();

      if (sellerData && !sellerError) {
        setSellerStatus(sellerData.status);
        if (sellerData.status === "approved") {
          setIsSeller(true);
        }
      }

      // Check if admin
      const { data: profileData } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileData?.role === "admin") {
        setIsAdmin(true);
      } else {
        // Check ADMIN_EMAILS from env
        const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(",").map(e => e.trim()) || [];
        if (adminEmails.includes(user.email || "")) {
          setIsAdmin(true);
        }
      }
    } catch (error) {
      console.error("Error checking user status:", error);
    }

    setCheckingStatus(false);
  }

  async function logout() {
    try {
      if (supabase) await supabase.auth.signOut();
    } finally {
      router.push("/?login=1");
    }
  }

  // Build dynamic menu based on user roles
  const roleItems = [];
  if (isSeller) {
    roleItems.push({ href: "/account/seller", label: "My Shop" });
    roleItems.push({ href: "/account/seller/orders", label: "Seller Orders" });
    roleItems.push({ href: "/account/seller/stripe", label: "Payment Settings" });
    roleItems.push({ href: "/account/seller/gallery", label: "Gallery" });
  } else if (sellerStatus === "pending") {
    roleItems.push({ href: "/account/become-seller", label: "Application Pending" });
  } else if (sellerStatus === "rejected") {
    roleItems.push({ href: "/account/become-seller", label: "Application Rejected" });
  } else {
    roleItems.push({ href: "/account/become-seller", label: "Become a seller" });
  }
  if (isAdmin) {
    roleItems.push({ href: "/account/moderation", label: "Moderation" });
    roleItems.push({ href: "/account/moderation/gallery", label: "Gallery Moderation" });
  }

  const allItems = [
    ...baseItems,
    ...roleItems,
    ...bottomItems,
  ];

  return (
    <aside style={{ display: "grid", gap: isMobile ? 10 : 14 }}>
      {/* Profile header */}
      <div style={{
        border: "1px solid #e6e6e6",
        padding: isMobile ? "14px 16px" : 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#fff",
      }}>
        <div style={{ display: "flex", gap: isMobile ? 10 : 14, alignItems: "center" }}>
          <div style={{
            width: isMobile ? 40 : 60,
            height: isMobile ? 40 : 60,
            background: "#f1f1f1",
            border: "1px solid #e6e6e6",
            flexShrink: 0,
          }} />
          <div>
            <div style={{ fontSize: isMobile ? 12 : 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5 }}>ACCOUNT</div>
            {userEmail && <div style={{ fontSize: 10, color: "#666", marginTop: 4, letterSpacing: 0.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: isMobile ? 180 : "none" }}>{userEmail}</div>}
          </div>
        </div>
      </div>

      {/* Nav items */}
      <div style={{ display: "grid", gap: isMobile ? 8 : 12 }}>
        {allItems.map((it) => {
          const active = pathname === it.href;
          return (
            <Link
              key={it.href}
              href={it.href}
              style={{
                textDecoration: "none",
                color: "#000",
                border: "1px solid #e6e6e6",
                padding: isMobile ? "12px 14px" : "16px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: active ? "#fafafa" : "#fff",
              }}
            >
              <span style={{ fontSize: isMobile ? 11 : 12, fontWeight: active ? 700 : 400, letterSpacing: 0.5 }}>{it.label}</span>
              <span style={{ color: "#777", fontSize: 14 }}>›</span>
            </Link>
          );
        })}

        <button onClick={logout} style={{ all: "unset", cursor: "pointer", border: "1px solid #e6e6e6", padding: isMobile ? "12px 14px" : "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff" }}>
          <span style={{ fontSize: isMobile ? 11 : 12, letterSpacing: 0.5 }}>Log out</span>
          <span style={{ color: "#777", fontSize: 14 }}>›</span>
        </button>
      </div>
    </aside>
  );
}
