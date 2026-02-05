const CACHE_KEY = 'exchange_rate_cache';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const DISPLAY_CURRENCY_KEY = 'display_currency';

export type DisplayCurrency = 'EUR' | 'USD' | 'GBP';

// Currency symbols map
export function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    EUR: '€',
    USD: '$',
    GBP: '£'
  };
  return symbols[currency] || currency;
}

// Get/set display currency
export function getDisplayCurrency(): DisplayCurrency {
  if (typeof window === 'undefined') return 'EUR';
  return (localStorage.getItem(DISPLAY_CURRENCY_KEY) as DisplayCurrency) || 'EUR';
}

export function setDisplayCurrency(currency: DisplayCurrency): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DISPLAY_CURRENCY_KEY, currency);
  window.dispatchEvent(new Event('currencyChanged'));
}

// Get cached exchange rates or fetch new ones
export async function getExchangeRates(): Promise<{ usdToEur: number; gbpToEur: number }> {
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const { rates, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          return rates;
        }
      } catch {
        // Invalid cache
      }
    }
  }

  try {
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/EUR');
    const data = await res.json();
    const rates = {
      usdToEur: 1 / data.rates.USD,
      gbpToEur: 1 / data.rates.GBP
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        rates,
        timestamp: Date.now()
      }));
    }
    return rates;
  } catch {
    return { usdToEur: 0.92, gbpToEur: 1.17 };
  }
}

// Synchronous version
export function getExchangeRatesSync(): { usdToEur: number; gbpToEur: number; eurToUsd: number; eurToGbp: number } {
  const defaults = { usdToEur: 0.92, gbpToEur: 1.17, eurToUsd: 1.09, eurToGbp: 0.85 };
  if (typeof window === 'undefined') return defaults;

  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    try {
      const { rates } = JSON.parse(cached);
      return {
        ...rates,
        eurToUsd: 1 / rates.usdToEur,
        eurToGbp: 1 / rates.gbpToEur
      };
    } catch {
      // Invalid cache
    }
  }
  return defaults;
}

// Convert any currency to EUR (base currency for calculations)
export function convertToEUR(price: number, currency: string): number {
  const rates = getExchangeRatesSync();

  if (currency === 'EUR') return price;
  if (currency === 'USD') return price * rates.usdToEur;
  if (currency === 'GBP') return price * rates.gbpToEur;
  return price;
}

// Convert EUR to display currency
export function convertFromEUR(priceInEUR: number, displayCurrency: DisplayCurrency): number {
  if (displayCurrency === 'EUR') return priceInEUR;

  const rates = getExchangeRatesSync();
  if (displayCurrency === 'USD') return priceInEUR * rates.eurToUsd;
  if (displayCurrency === 'GBP') return priceInEUR * rates.eurToGbp;
  return priceInEUR;
}

// Format price - converts to EUR first, then to display currency
export function formatPrice(price: number, fromCurrency: string = 'EUR', displayCurrency?: DisplayCurrency): string {
  const display = displayCurrency ?? getDisplayCurrency();
  const priceInEUR = convertToEUR(price, fromCurrency);
  const finalPrice = convertFromEUR(priceInEUR, display);
  const symbol = getCurrencySymbol(display);
  return `${symbol}${finalPrice.toFixed(2)}`;
}

// Format total (already in EUR) for display
export function formatTotal(totalInEUR: number, displayCurrency?: DisplayCurrency): string {
  const display = displayCurrency ?? getDisplayCurrency();
  const finalPrice = convertFromEUR(totalInEUR, display);
  const symbol = getCurrencySymbol(display);
  return `${symbol}${finalPrice.toFixed(2)}`;
}
