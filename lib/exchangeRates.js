import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_KEY = "exchange_rates_cache";
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours

export const POPULAR_CURRENCIES = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "\u20ac" },
  { code: "GBP", name: "British Pound", symbol: "\u00a3" },
  { code: "INR", name: "Indian Rupee", symbol: "\u20b9" },
  { code: "JPY", name: "Japanese Yen", symbol: "\u00a5" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "AED", name: "UAE Dirham", symbol: "\u062f.\u0625" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF" },
];

export async function fetchRates(baseCurrency) {
  try {
    // Check cache first
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const cached = JSON.parse(raw);
      const age = Date.now() - cached.timestamp;
      if (age < CACHE_DURATION && cached.base === baseCurrency) {
        return cached.rates;
      }
    }

    const res = await fetch(
      `https://open.er-api.com/v6/latest/${baseCurrency}`
    );
    const data = await res.json();

    if (data.result !== "success") return null;

    // Cache the result
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        base: baseCurrency,
        rates: data.rates,
        timestamp: Date.now(),
      })
    );

    return data.rates;
  } catch {
    return null;
  }
}

export function convertAmount(amount, fromCurrency, toCurrency, rates) {
  if (!rates || !rates[fromCurrency] || !rates[toCurrency]) return null;
  if (fromCurrency === toCurrency) return amount;

  const inBase = amount / rates[fromCurrency];
  return inBase * rates[toCurrency];
}
