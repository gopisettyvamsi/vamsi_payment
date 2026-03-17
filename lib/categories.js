export const CATEGORIES = [
  { id: "food", label: "Food & Dining", icon: "silverware-fork-knife", color: "#FF6B6B" },
  { id: "transport", label: "Transport", icon: "car", color: "#4ECDC4" },
  { id: "shopping", label: "Shopping", icon: "cart", color: "#45B7D1" },
  { id: "bills", label: "Bills & Utilities", icon: "flash", color: "#FFA07A" },
  { id: "entertainment", label: "Entertainment", icon: "movie", color: "#98D8C8" },
  { id: "health", label: "Health", icon: "hospital", color: "#F7DC6F" },
  { id: "education", label: "Education", icon: "school", color: "#BB8FCE" },
  { id: "salary", label: "Salary", icon: "cash", color: "#82E0AA" },
  { id: "freelance", label: "Freelance", icon: "laptop", color: "#85C1E9" },
  { id: "investment", label: "Investment", icon: "chart-line", color: "#F8C471" },
  { id: "rent", label: "Rent", icon: "home", color: "#D7BDE2" },
  { id: "other", label: "Other", icon: "dots-horizontal", color: "#AEB6BF" },
];

export const getCategoryById = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
