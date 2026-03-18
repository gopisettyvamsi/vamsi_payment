export const formatCurrency = (amount, currency = "INR") => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export const getMonthName = (monthIndex) => {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return months[monthIndex];
};

export const groupTransactionsByDate = (transactions) => {
  const groups = {};
  transactions.forEach((t) => {
    const date = new Date(t.date).toISOString().split("T")[0];
    if (!groups[date]) groups[date] = [];
    groups[date].push(t);
  });
  return Object.entries(groups).sort(([a], [b]) => new Date(b) - new Date(a));
};

export const parseSMS = (smsBody) => {
  const amount = smsBody.match(/(?:Rs\.?|INR|₹)\s*([\d,]+\.?\d*)/i);
  const isDebit = /debited|debit|paid|sent|withdrawn|purchase/i.test(smsBody);
  const isCredit = /credited|credit|received|refund|deposited/i.test(smsBody);

  if (!amount) return null;

  return {
    amount: parseFloat(amount[1].replace(/,/g, "")),
    type: isCredit ? "income" : isDebit ? "expense" : null,
    description: smsBody.substring(0, 100),
    date: new Date().toISOString(),
    category: "other",
    source: "sms",
  };
};

// Auto-categorize based on description keywords
export const autoCategorizeTx = (description) => {
  const desc = (description || "").toLowerCase();
  const rules = [
    {
      keywords: [
        "swiggy", "zomato", "uber eats", "dominos", "pizza", "mcdonalds",
        "starbucks", "restaurant", "cafe", "dining", "breakfast", "lunch",
        "dinner", "biryani", "burger", "kfc", "subway", "haldirams", "chai",
        "barbeque", "food", "eat", "kitchen", "dhaba", "canteen", "mess",
        "tiffin", "bakery", "ice cream", "dessert", "juice", "coffee", "tea",
        "chicken", "pizzahut", "pizza hut", "baskin robbins", "dunkin",
        "wendy", "taco bell", "panda express", "chipotle", "noodle",
        "dosa", "idli", "thali", "paneer", "dal", "roti", "paratha",
        "momos", "chowmein", "pasta", "sushi", "boba", "smoothie",
        "faasos", "behrouz", "box8", "eatfit", "freshmenu", "rebel foods",
        "chaayos", "third wave", "blue tokai", "sleepy owl",
      ],
      category: "food",
    },
    {
      keywords: [
        "uber", "ola", "rapido", "metro", "bus", "train", "irctc", "fuel",
        "petrol", "diesel", "parking", "toll", "auto", "rickshaw", "cab",
        "taxi", "flight", "airline", "indigo", "spicejet", "vistara",
        "airways", "lyft", "grab", "redbus", "makemytrip", "goibibo",
        "cleartrip", "yatra", "easemytrip", "abhibus", "confirmtkt",
        "railyatri", "ixigo", "air india", "akasa", "go first",
        "bharat petroleum", "indian oil", "hp petrol", "shell",
        "fastag", "nhai", "uber cab", "ola cab", "meru",
      ],
      category: "transport",
    },
    {
      keywords: [
        "amazon", "flipkart", "myntra", "ajio", "meesho", "nykaa", "croma",
        "reliance", "mall", "store", "shop", "retail", "market", "bazaar",
        "clothing", "shoes", "electronics", "gadget", "mobile", "phone",
        "laptop", "snapdeal", "tatacliq", "lenskart", "boat", "noise",
        "pepperfry", "urban ladder", "ikea", "decathlon", "zara", "h&m",
        "uniqlo", "nike", "adidas", "puma", "reebok", "samsung",
        "apple store", "oneplus", "realme", "mi store", "xiaomi",
        "bewakoof", "souled store", "firstcry", "mamaearth", "wow skin",
        "purplle", "sugar cosmetics", "boat lifestyle", "zebronics",
        "jiomart", "bigbasket", "blinkit", "zepto", "instamart",
        "dmart", "grofers", "dunzo", "swiggy instamart",
      ],
      category: "shopping",
    },
    {
      keywords: [
        "electricity", "water", "gas", "internet", "broadband", "wifi",
        "airtel", "jio", "vodafone", "bsnl", "tata", "postpaid", "prepaid",
        "recharge", "dth", "insurance", "premium", "emi", "loan",
        "credit card", "maintenance", "society", "bill", "utility",
        "vi", "act fibernet", "hathway", "tikona", "excitel", "railwire",
        "tata play", "dish tv", "sun direct", "d2h", "lic", "icici lombard",
        "hdfc ergo", "bajaj allianz", "star health", "max bupa",
        "navi insurance", "digit insurance", "acko", "paytm insurance",
        "municipal", "property tax", "house tax", "piped gas",
        "mahanagar gas", "indraprastha gas", "adani gas",
      ],
      category: "bills",
    },
    {
      keywords: [
        "netflix", "hotstar", "prime video", "disney", "spotify", "gaana",
        "youtube", "movie", "cinema", "pvr", "inox", "gaming", "playstation",
        "xbox", "steam", "concert", "event", "ticket", "book", "subscription",
        "entertainment", "jio cinema", "zee5", "sonyliv", "voot", "mxplayer",
        "amazon prime", "apple tv", "hbo", "hulu", "twitch", "discord nitro",
        "nintendo", "epic games", "valorant", "pubg", "cod",
        "bookmyshow", "paytm insider", "insider.in", "skill lync",
        "audible", "kindle unlimited", "apple music", "wynk",
        "hungama", "resso", "jiosaavn", "amazon music",
        "amusement", "theme park", "wonderla", "imagica", "essel world",
      ],
      category: "entertainment",
    },
    {
      keywords: [
        "hospital", "doctor", "clinic", "pharmacy", "medical", "medicine",
        "apollo", "medplus", "1mg", "netmeds", "pharmeasy", "gym", "fitness",
        "yoga", "lab", "diagnostic", "test", "dental", "eye", "health",
        "fortis", "max hospital", "aiims", "manipal", "narayana health",
        "columbia asia", "medanta", "kokilaben", "lilavati", "hinduja",
        "cult.fit", "curefit", "healthify", "practo", "tata 1mg",
        "lybrate", "mfine", "thyrocare", "dr lal path", "srl diagnostics",
        "metropolis", "redcliffe", "orange health", "healthians",
        "optical", "lenskart", "titan eye", "specsmakers",
        "physiotherapy", "ayurvedic", "homeopathy", "wellness",
      ],
      category: "health",
    },
    {
      keywords: [
        "course", "udemy", "coursera", "school", "college", "tuition",
        "book", "exam", "certification", "training", "institute", "class",
        "tutorial", "skillshare", "linkedin learning", "library",
        "university", "coaching", "education", "edx", "khan academy",
        "unacademy", "byju", "vedantu", "toppr", "doubtnut", "extramarks",
        "whitehat", "coding ninja", "scaler", "interviewbit", "leetcode",
        "hackerrank", "pluralsight", "treehouse", "datacamp", "codecademy",
        "brilliant", "masterclass", "great learning", "upgrad",
        "simplilearn", "intellipaat", "edureka", "alma better",
        "stationery", "notebook", "pen", "textbook", "reference book",
      ],
      category: "education",
    },
    {
      keywords: [
        "salary", "stipend", "payroll", "wages", "bonus", "commission",
        "dividend", "monthly pay", "annual bonus", "performance bonus",
        "incentive", "gratuity", "arrear",
      ],
      category: "salary",
    },
    {
      keywords: [
        "freelance", "consulting", "gig", "upwork", "fiverr",
        "project payment", "client payment", "invoice", "toptal",
        "freelancer.com", "guru.com", "99designs", "contra", "moonlight",
        "consultancy", "contract work", "side hustle", "professional fee",
      ],
      category: "freelance",
    },
    {
      keywords: [
        "mutual fund", "stock", "share", "sip", "zerodha", "groww",
        "upstox", "crypto", "bitcoin", "demat", "nps", "ppf", "fd",
        "fixed deposit", "gold", "bond", "etf", "invest", "trading",
        "angel one", "motilal oswal", "hdfc securities", "icici direct",
        "kotak securities", "5paisa", "paytm money", "kuvera", "coin",
        "smallcase", "wazirx", "coinswitch", "coindcx", "binance",
        "ethereum", "nifty", "sensex", "bse", "nse", "sovereign gold",
        "sgb", "recurring deposit", "rd", "liquid fund", "debt fund",
        "equity", "intraday", "delivery", "ipo", "reit",
      ],
      category: "investment",
    },
    {
      keywords: [
        "rent", "lease", "housing", "accommodation", "pg", "hostel",
        "co-living", "flat", "apartment", "house rent", "room rent",
        "paying guest", "coliving", "stanza living", "zolo", "oyo life",
        "nestaway", "nobroker", "magicbricks", "99acres", "housing.com",
        "broker", "brokerage", "security deposit", "caution deposit",
      ],
      category: "rent",
    },
  ];
  for (const rule of rules) {
    if (rule.keywords.some((kw) => desc.includes(kw))) return rule.category;
  }
  return "other";
};

export const parseEmailTransaction = (subject, body, emailDate) => {
  const amount = (body || subject).match(/(?:Rs\.?|INR|₹|\$)\s*([\d,]+\.?\d*)/i);
  const isDebit = /debited|debit|paid|purchase|payment|charged/i.test(body || subject);
  const isCredit = /credited|credit|received|refund|cashback/i.test(body || subject);

  if (!amount) return null;

  // Use email received date if provided, fallback to today
  let date = new Date().toISOString();
  if (emailDate) {
    const parsed = new Date(emailDate);
    if (!isNaN(parsed)) date = parsed.toISOString();
  }

  return {
    amount: parseFloat(amount[1].replace(/,/g, "")),
    type: isCredit ? "income" : isDebit ? "expense" : null,
    description: subject.substring(0, 100),
    date,
    category: autoCategorizeTx(subject + " " + body),
    source: "email",
  };
};

export const parseCSVRow = (row) => {
  return {
    date: row.date || row.Date || row.DATE || new Date().toISOString(),
    amount: parseFloat((row.amount || row.Amount || row.AMOUNT || "0").replace(/,/g, "")),
    type: (row.type || row.Type || row.TYPE || "expense").toLowerCase(),
    category: ((cat) => {
      const val = (cat || "").toLowerCase();
      if (!val || val === "other") {
        const desc = row.description || row.Description || row.DESCRIPTION || row.narration || row.Narration || "";
        return autoCategorizeTx(desc);
      }
      return val;
    })(row.category || row.Category || row.CATEGORY || ""),
    description: row.description || row.Description || row.DESCRIPTION || row.narration || row.Narration || "",
    source: "csv",
  };
};
