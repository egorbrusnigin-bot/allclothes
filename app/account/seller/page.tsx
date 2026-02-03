import { redirect } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { isSeller, getCurrentUserId } from "../../lib/auth";

export default async function SellerDashboard() {
  // Check if user is a seller
  const seller = await isSeller();
  if (!seller) {
    redirect("/account/become-seller");
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    redirect("/?login=1");
  }

  // Load stats
  let brandCount = 0;
  let productCount = 0;
  let pendingCount = 0;
  let approvedCount = 0;

  if (supabase) {
    // Count brands
    const { count: brandsCount } = await supabase
      .from("brands")
      .select("*", { count: "exact", head: true })
      .eq("owner_id", userId);
    brandCount = brandsCount || 0;

    // Count total products
    const { count: productsCount } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("owner_id", userId);
    productCount = productsCount || 0;

    // Count pending products
    const { count: pending } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("owner_id", userId)
      .eq("status", "pending");
    pendingCount = pending || 0;

    // Count approved products
    const { count: approved } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("owner_id", userId)
      .eq("status", "approved");
    approvedCount = approved || 0;
  }

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
          Seller Dashboard
        </h1>
        <p style={{ fontSize: 14, color: "#666" }}>
          Manage your brands and products
        </p>
      </div>

      {/* Stats Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
        }}
      >
        <div
          style={{
            padding: 24,
            background: "#fff",
            border: "1px solid #e6e6e6",
            borderRadius: 16,
          }}
        >
          <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>
            {brandCount}
          </div>
          <div style={{ fontSize: 14, color: "#666" }}>Total Brands</div>
        </div>

        <div
          style={{
            padding: 24,
            background: "#fff",
            border: "1px solid #e6e6e6",
            borderRadius: 16,
          }}
        >
          <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>
            {productCount}
          </div>
          <div style={{ fontSize: 14, color: "#666" }}>Total Products</div>
        </div>

        <div
          style={{
            padding: 24,
            background: "#fff",
            border: "1px solid #e6e6e6",
            borderRadius: 16,
          }}
        >
          <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 8, color: "#f59e0b" }}>
            {pendingCount}
          </div>
          <div style={{ fontSize: 14, color: "#666" }}>Pending Review</div>
        </div>

        <div
          style={{
            padding: 24,
            background: "#fff",
            border: "1px solid #e6e6e6",
            borderRadius: 16,
          }}
        >
          <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 8, color: "#10b981" }}>
            {approvedCount}
          </div>
          <div style={{ fontSize: 14, color: "#666" }}>Approved</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>
          Quick Actions
        </h2>
        <div style={{ display: "grid", gap: 12 }}>
          <Link
            href="/account/seller/brands"
            style={{
              textDecoration: "none",
              color: "#000",
              padding: 20,
              background: "#fff",
              border: "1px solid #e6e6e6",
              borderRadius: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                Manage Brands
              </div>
              <div style={{ fontSize: 13, color: "#666" }}>
                View and edit your brands
              </div>
            </div>
            <span style={{ fontSize: 20, color: "#777" }}>→</span>
          </Link>

          <Link
            href="/account/seller/products"
            style={{
              textDecoration: "none",
              color: "#000",
              padding: 20,
              background: "#fff",
              border: "1px solid #e6e6e6",
              borderRadius: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                Manage Products
              </div>
              <div style={{ fontSize: 13, color: "#666" }}>
                View, create, and edit your products
              </div>
            </div>
            <span style={{ fontSize: 20, color: "#777" }}>→</span>
          </Link>

          <Link
            href="/account/seller/products/new"
            style={{
              textDecoration: "none",
              color: "#fff",
              padding: 20,
              background: "#000",
              border: "1px solid #000",
              borderRadius: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                Create New Product
              </div>
              <div style={{ fontSize: 13, color: "#e6e6e6" }}>
                Add a new product to your catalog
              </div>
            </div>
            <span style={{ fontSize: 20, color: "#e6e6e6" }}>+</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
