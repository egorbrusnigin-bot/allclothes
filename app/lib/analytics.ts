// Analytics tracking helper

type EventType = "page_view" | "product_view" | "favorite" | "unfavorite" | "order" | "sale";

interface TrackEventParams {
  brandId: string;
  eventType: EventType;
  productId?: string;
  amount?: number;
}

export async function trackEvent({ brandId, eventType, productId, amount }: TrackEventParams) {
  try {
    await fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId, eventType, productId, amount }),
    });
  } catch (error) {
    // Silent fail - analytics shouldn't break the app
    console.error("Analytics track failed:", error);
  }
}

export async function trackBrandPageView(brandId: string) {
  return trackEvent({ brandId, eventType: "page_view" });
}

export async function trackProductView(brandId: string, productId: string) {
  return trackEvent({ brandId, eventType: "product_view", productId });
}

export async function trackFavorite(brandId: string, productId: string) {
  return trackEvent({ brandId, eventType: "favorite", productId });
}

export async function trackUnfavorite(brandId: string, productId: string) {
  return trackEvent({ brandId, eventType: "unfavorite", productId });
}

export async function trackOrder(brandId: string, amount: number) {
  return trackEvent({ brandId, eventType: "order", amount });
}

export async function trackSale(brandId: string, productId: string, amount: number) {
  return trackEvent({ brandId, eventType: "sale", productId, amount });
}

// Get brand analytics (for brand owners)
export async function getBrandAnalytics(brandId: string) {
  try {
    const response = await fetch(`/api/analytics/brand/${brandId}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error("Failed to get brand analytics:", error);
    return null;
  }
}

// Get rankings
export async function getBrandRankings(sortBy?: string, limit?: number) {
  try {
    const params = new URLSearchParams();
    if (sortBy) params.set("sortBy", sortBy);
    if (limit) params.set("limit", limit.toString());

    const response = await fetch(`/api/analytics/rankings?${params}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error("Failed to get rankings:", error);
    return null;
  }
}
