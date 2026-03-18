export const CATEGORIES = [
  { id: "food", label: "Food & Dining", icon: "silverware-fork-knife", color: "#FB923C" },
  { id: "transport", label: "Transport", icon: "car", color: "#60A5FA" },
  { id: "shopping", label: "Shopping", icon: "cart", color: "#667eea" },
  { id: "bills", label: "Bills & Utilities", icon: "flash", color: "#F87171" },
  { id: "entertainment", label: "Entertainment", icon: "movie", color: "#A78BFA" },
  { id: "health", label: "Health", icon: "hospital", color: "#2DD4BF" },
  { id: "education", label: "Education", icon: "school", color: "#818CF8" },
  { id: "salary", label: "Salary", icon: "cash", color: "#4ADE80" },
  { id: "freelance", label: "Freelance", icon: "laptop", color: "#38BDF8" },
  { id: "investment", label: "Investment", icon: "chart-line", color: "#FBBF24" },
  { id: "rent", label: "Rent", icon: "home", color: "#F472B6" },
  { id: "other", label: "Other", icon: "dots-horizontal", color: "#94A3B8" },
];

export const getCategoryById = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
