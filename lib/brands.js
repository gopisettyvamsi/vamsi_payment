// Maps keywords in transaction descriptions to brand info
const BRANDS = [
  { keywords: ["zomato"], name: "Zomato", domain: "zomato.com", color: "#E23744" },
  { keywords: ["swiggy"], name: "Swiggy", domain: "swiggy.com", color: "#FC8019" },
  { keywords: ["amazon"], name: "Amazon", domain: "amazon.in", color: "#FF9900" },
  { keywords: ["flipkart"], name: "Flipkart", domain: "flipkart.com", color: "#2874F0" },
  { keywords: ["myntra"], name: "Myntra", domain: "myntra.com", color: "#FF3F6C" },
  { keywords: ["phonepe"], name: "PhonePe", domain: "phonepe.com", color: "#5F259F" },
  { keywords: ["google pay", "gpay"], name: "Google Pay", domain: "pay.google.com", color: "#4285F4" },
  { keywords: ["paytm"], name: "Paytm", domain: "paytm.com", color: "#00BAF2" },
  { keywords: ["uber"], name: "Uber", domain: "uber.com", color: "#000000" },
  { keywords: ["ola"], name: "Ola", domain: "olacabs.com", color: "#35B22D" },
  { keywords: ["rapido"], name: "Rapido", domain: "rapido.bike", color: "#FFCF00" },
  { keywords: ["netflix"], name: "Netflix", domain: "netflix.com", color: "#E50914" },
  { keywords: ["spotify"], name: "Spotify", domain: "spotify.com", color: "#1DB954" },
  { keywords: ["youtube", "yt premium"], name: "YouTube", domain: "youtube.com", color: "#FF0000" },
  { keywords: ["hotstar", "disney"], name: "Hotstar", domain: "hotstar.com", color: "#1F2D5A" },
  { keywords: ["sbi", "state bank"], name: "SBI", domain: "sbi.co.in", color: "#1A3C7B" },
  { keywords: ["hdfc"], name: "HDFC", domain: "hdfcbank.com", color: "#004B87" },
  { keywords: ["icici"], name: "ICICI", domain: "icicibank.com", color: "#F58220" },
  { keywords: ["kotak"], name: "Kotak", domain: "kotak.com", color: "#ED1C24" },
  { keywords: ["axis"], name: "Axis", domain: "axisbank.com", color: "#97144D" },
  { keywords: ["indusind"], name: "IndusInd", domain: "indusind.com", color: "#8B1A2B" },
  { keywords: ["bajaj"], name: "Bajaj", domain: "bajajfinserv.in", color: "#00518B" },
  { keywords: ["cred"], name: "CRED", domain: "cred.club", color: "#1A1A2E" },
  { keywords: ["razorpay"], name: "Razorpay", domain: "razorpay.com", color: "#2B84EA" },
  { keywords: ["airtel"], name: "Airtel", domain: "airtel.in", color: "#ED1C24" },
  { keywords: ["jio"], name: "Jio", domain: "jio.com", color: "#0A3A7D" },
  { keywords: ["vi ", "vodafone", "idea"], name: "Vi", domain: "myvi.in", color: "#E60000" },
  { keywords: ["blinkit", "grofers"], name: "Blinkit", domain: "blinkit.com", color: "#F8CB46" },
  { keywords: ["bigbasket"], name: "BigBasket", domain: "bigbasket.com", color: "#84C225" },
  { keywords: ["zerodha"], name: "Zerodha", domain: "zerodha.com", color: "#387ED1" },
  { keywords: ["groww"], name: "Groww", domain: "groww.in", color: "#5367FF" },
  { keywords: ["upstox"], name: "Upstox", domain: "upstox.com", color: "#6933D3" },
  { keywords: ["apple"], name: "Apple", domain: "apple.com", color: "#000000" },
  { keywords: ["google"], name: "Google", domain: "google.com", color: "#4285F4" },
  { keywords: ["microsoft"], name: "Microsoft", domain: "microsoft.com", color: "#00A4EF" },
  { keywords: ["electricity", "electric bill"], name: "Electricity", domain: null, color: "#FBBF24" },
  { keywords: ["water bill"], name: "Water", domain: null, color: "#60A5FA" },
  { keywords: ["gas bill", "piped gas"], name: "Gas", domain: null, color: "#FB923C" },
  { keywords: ["rent"], name: "Rent", domain: null, color: "#F472B6" },
  { keywords: ["salary"], name: "Salary", domain: null, color: "#4ADE80" },
];

export function detectBrand(description) {
  if (!description) return null;
  const lower = description.toLowerCase();
  for (const brand of BRANDS) {
    for (const kw of brand.keywords) {
      if (lower.includes(kw)) return brand;
    }
  }
  return null;
}

export function getBrandLogoUrl(domain) {
  if (!domain) return null;
  // Google's favicon service works reliably from any origin
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}
