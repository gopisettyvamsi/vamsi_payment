// Enhanced merchant logo lookup using Clearbit logo API
// Supplements brands.js with a broader merchant domain map

const MERCHANT_DOMAINS = {
  amazon: "amazon.com",
  netflix: "netflix.com",
  spotify: "spotify.com",
  uber: "uber.com",
  swiggy: "swiggy.com",
  zomato: "zomato.com",
  flipkart: "flipkart.com",
  google: "google.com",
  apple: "apple.com",
  microsoft: "microsoft.com",
  starbucks: "starbucks.com",
  mcdonalds: "mcdonalds.com",
  walmart: "walmart.com",
  myntra: "myntra.com",
  phonepe: "phonepe.com",
  paytm: "paytm.com",
  gpay: "google.com",
  bigbasket: "bigbasket.com",
  dunzo: "dunzo.com",
  ola: "olacabs.com",
  airtel: "airtel.in",
  jio: "jio.com",
  hdfc: "hdfcbank.com",
  icici: "icicibank.com",
  sbi: "sbi.co.in",
  axis: "axisbank.com",
};

/**
 * Attempts to match a transaction description to a known merchant
 * and returns a Clearbit logo URL if found.
 *
 * @param {string} description - Transaction description text
 * @returns {string|null} Clearbit logo URL or null if no match
 */
export function getMerchantLogoUrl(description) {
  if (!description) return null;

  const lower = description.toLowerCase();

  for (const [keyword, domain] of Object.entries(MERCHANT_DOMAINS)) {
    if (lower.includes(keyword)) {
      return `https://logo.clearbit.com/${domain}`;
    }
  }

  return null;
}
