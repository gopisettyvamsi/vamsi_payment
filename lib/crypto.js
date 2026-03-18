import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_KEY = "crypto_prices_cache";
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export const POPULAR_COINS = [
  { id: "bitcoin", name: "Bitcoin", symbol: "BTC" },
  { id: "ethereum", name: "Ethereum", symbol: "ETH" },
  { id: "solana", name: "Solana", symbol: "SOL" },
  { id: "dogecoin", name: "Dogecoin", symbol: "DOGE" },
  { id: "ripple", name: "XRP", symbol: "XRP" },
];

const DEFAULT_COINS = POPULAR_COINS.map((c) => c.id);

async function getCachedPrices() {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const cached = JSON.parse(raw);
    if (Date.now() - cached.timestamp < CACHE_DURATION_MS) {
      return cached.data;
    }
    return null;
  } catch {
    return null;
  }
}

async function setCachedPrices(data) {
  try {
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ timestamp: Date.now(), data })
    );
  } catch {
    // Silently ignore cache write failures
  }
}

export async function fetchCryptoPrices(
  coins = DEFAULT_COINS,
  vsCurrency = "usd"
) {
  const cached = await getCachedPrices();
  if (cached) return cached;

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coins.join(",")}&vs_currencies=${vsCurrency}&include_24hr_change=true`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const json = await response.json();

    const result = {};
    for (const coinId of coins) {
      const entry = json[coinId];
      if (entry) {
        result[coinId] = {
          price: entry[vsCurrency] ?? 0,
          change24h: entry[`${vsCurrency}_24h_change`] ?? 0,
        };
      }
    }

    await setCachedPrices(result);
    return result;
  } catch (error) {
    // On network failure, try returning stale cache as fallback
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (raw) {
        return JSON.parse(raw).data;
      }
    } catch {
      // Ignore
    }

    throw error;
  }
}
