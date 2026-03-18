import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";

/**
 * Opens camera or gallery to capture/pick a receipt image.
 * Returns { uri, cancelled } where uri is the local image path.
 */
export const pickReceiptImage = async () => {
  // Check if ImagePicker is available (may differ on web)
  if (!ImagePicker || !ImagePicker.launchImageLibraryAsync) {
    console.warn("expo-image-picker is not available on this platform");
    return { uri: null, cancelled: true };
  }

  // Request permissions
  if (Platform.OS !== "web") {
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    const libraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (cameraPermission.status !== "granted" && libraryPermission.status !== "granted") {
      console.warn("Camera and media library permissions are required to scan receipts");
      return { uri: null, cancelled: true };
    }
  }

  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (result.canceled) {
      return { uri: null, cancelled: true };
    }

    const uri = result.assets && result.assets.length > 0
      ? result.assets[0].uri
      : null;

    return { uri, cancelled: false };
  } catch (error) {
    console.error("Error picking receipt image:", error);
    return { uri: null, cancelled: true };
  }
};

/**
 * Parses receipt text and extracts amount, date, merchant, and category.
 * Useful for manual text entry or future OCR integration.
 *
 * @param {string} text - Raw receipt text
 * @returns {{ amount: number|null, date: string|null, merchant: string|null, category: string|null }}
 */
export const parseReceiptText = (text) => {
  if (!text || typeof text !== "string") {
    return { amount: null, date: null, merchant: null, category: null };
  }

  const amount = extractAmount(text);
  const date = extractDate(text);
  const merchant = extractMerchant(text);
  const category = guessCategory(merchant, text);

  return { amount, date, merchant, category };
};

// --- Internal helpers ---

/**
 * Extracts the most likely total amount from receipt text.
 * Matches patterns like "Total: $45.99", "Rs. 500", "INR 1,234.56", "₹500", "Amount: 299"
 */
const extractAmount = (text) => {
  // Prioritise lines with "total" or "amount" keywords
  const totalPatterns = [
    /(?:total|amount|grand\s*total|net\s*amount|balance\s*due)[:\s]*[$₹]?\s*([\d,]+\.?\d*)/i,
    /(?:total|amount|grand\s*total|net\s*amount|balance\s*due)[:\s]*(?:Rs\.?|INR)\s*([\d,]+\.?\d*)/i,
  ];

  for (const pattern of totalPatterns) {
    const match = text.match(pattern);
    if (match) {
      return parseFloat(match[1].replace(/,/g, ""));
    }
  }

  // Fallback: find any currency amount
  const currencyPatterns = [
    /[$₹]\s*([\d,]+\.?\d*)/,
    /(?:Rs\.?|INR)\s*([\d,]+\.?\d*)/i,
  ];

  let largest = null;
  for (const pattern of currencyPatterns) {
    const matches = text.matchAll(new RegExp(pattern, "gi"));
    for (const match of matches) {
      const val = parseFloat(match[1].replace(/,/g, ""));
      if (val && (!largest || val > largest)) {
        largest = val;
      }
    }
  }

  return largest;
};

/**
 * Extracts a date from receipt text.
 * Handles DD/MM/YYYY, MM/DD/YYYY, DD-Mon-YYYY, YYYY-MM-DD patterns.
 */
const extractDate = (text) => {
  const monthNames = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    january: 0, february: 1, march: 2, april: 3, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  };

  // DD-Mon-YYYY or DD Mon YYYY (e.g. 15-Mar-2025, 15 March 2025)
  const dmy = text.match(/(\d{1,2})[\s\-]+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[,\s\-]+(\d{4})/i);
  if (dmy) {
    const day = parseInt(dmy[1], 10);
    const month = monthNames[dmy[2].toLowerCase()];
    const year = parseInt(dmy[3], 10);
    if (month !== undefined) {
      return new Date(year, month, day).toISOString().split("T")[0];
    }
  }

  // YYYY-MM-DD
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy2 = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmy2) {
    const a = parseInt(dmy2[1], 10);
    const b = parseInt(dmy2[2], 10);
    const year = parseInt(dmy2[3], 10);

    // If first number > 12, it must be DD/MM/YYYY
    if (a > 12) {
      const mm = String(b).padStart(2, "0");
      const dd = String(a).padStart(2, "0");
      return `${year}-${mm}-${dd}`;
    }
    // If second number > 12, it must be MM/DD/YYYY
    if (b > 12) {
      const mm = String(a).padStart(2, "0");
      const dd = String(b).padStart(2, "0");
      return `${year}-${mm}-${dd}`;
    }
    // Ambiguous — assume DD/MM/YYYY (common in India)
    const mm = String(b).padStart(2, "0");
    const dd = String(a).padStart(2, "0");
    return `${year}-${mm}-${dd}`;
  }

  return null;
};

/**
 * Extracts the merchant name from receipt text.
 * Takes the first non-empty line that doesn't look like a date or amount.
 */
const extractMerchant = (text) => {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);

  const datePattern = /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/;
  const amountPattern = /^[$₹]?\s*[\d,]+\.?\d*$|^(?:Rs\.?|INR)\s*[\d,]+\.?\d*$/i;
  const skipPatterns = /^(total|subtotal|tax|gst|cgst|sgst|amount|date|time|invoice|receipt|bill|order|ref|phone|tel|fax|email)/i;

  for (const line of lines) {
    if (datePattern.test(line)) continue;
    if (amountPattern.test(line)) continue;
    if (skipPatterns.test(line)) continue;
    // Skip very short lines (likely codes or numbers)
    if (line.length < 3) continue;
    return line;
  }

  return null;
};

/**
 * Guesses a spending category based on merchant name and receipt content.
 */
const guessCategory = (merchant, text) => {
  const combined = `${merchant || ""} ${text}`.toLowerCase();

  const categoryKeywords = {
    food: ["restaurant", "cafe", "coffee", "pizza", "burger", "swiggy", "zomato", "food", "dining", "eat", "bakery", "kitchen"],
    groceries: ["grocery", "supermarket", "mart", "bigbasket", "blinkit", "zepto", "vegetables", "fruits", "provisions", "dmart", "reliance fresh"],
    transport: ["uber", "ola", "cab", "taxi", "metro", "bus", "fuel", "petrol", "diesel", "parking", "toll"],
    shopping: ["amazon", "flipkart", "myntra", "mall", "store", "shop", "retail", "clothing", "apparel"],
    medical: ["pharmacy", "hospital", "clinic", "doctor", "medical", "medicine", "apollo", "medplus", "health"],
    entertainment: ["movie", "cinema", "netflix", "spotify", "gaming", "pvr", "inox", "theatre", "theater"],
    utilities: ["electricity", "water", "gas", "internet", "broadband", "airtel", "jio", "vi", "bsnl", "recharge", "bill"],
    education: ["school", "college", "university", "course", "tuition", "books", "stationery", "udemy", "coursera"],
  };

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    for (const keyword of keywords) {
      if (combined.includes(keyword)) {
        return category;
      }
    }
  }

  return null;
};
