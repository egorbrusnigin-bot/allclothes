// Server-side exchange rate fetcher with in-memory cache
// Fetches from ECB-based API, caches for 1 hour

let cachedRates: { usdToEur: number; gbpToEur: number } | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

const FALLBACK_RATES = { usdToEur: 0.92, gbpToEur: 1.17 };

export async function getServerExchangeRates(): Promise<{ usdToEur: number; gbpToEur: number }> {
  if (cachedRates && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedRates;
  }

  try {
    const res = await fetch("https://api.exchangerate-api.com/v4/latest/EUR", {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    cachedRates = {
      usdToEur: 1 / data.rates.USD,
      gbpToEur: 1 / data.rates.GBP,
    };
    cacheTimestamp = Date.now();
    console.log("Exchange rates updated:", cachedRates);
    return cachedRates;
  } catch (err) {
    console.error("Failed to fetch exchange rates, using fallback:", err);
    return cachedRates || FALLBACK_RATES;
  }
}

export async function convertToEURServer(price: number, currency: string): Promise<number> {
  const cur = currency.toUpperCase();
  if (cur === "EUR") return price;

  const rates = await getServerExchangeRates();
  if (cur === "USD") return price * rates.usdToEur;
  if (cur === "GBP") return price * rates.gbpToEur;
  return price;
}
