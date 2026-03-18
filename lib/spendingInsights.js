import { getCategoryById } from "./categories";

/**
 * Generate AI-like spending insights from transaction data.
 *
 * @param {Array}    transactions  – full transaction list
 * @param {Function} fmt           – currency formatter (amount) => string
 * @returns {Array}  Array of { icon, color, title, text } insight objects
 */
export function generateInsights(transactions = [], fmt = (v) => v.toFixed(2)) {
  const insights = [];
  if (!transactions.length) return insights;

  const expenses = transactions.filter((t) => t.type === "expense");
  const incomes = transactions.filter((t) => t.type === "income");
  const totalExpense = expenses.reduce((s, t) => s + Number(t.amount), 0);
  const totalIncome = incomes.reduce((s, t) => s + Number(t.amount), 0);

  // 1. Top spending day of the week
  const dayTotals = [0, 0, 0, 0, 0, 0, 0];
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  expenses.forEach((t) => {
    const dow = new Date(t.date).getDay();
    dayTotals[dow] += Number(t.amount);
  });
  const topDayIdx = dayTotals.indexOf(Math.max(...dayTotals));
  if (dayTotals[topDayIdx] > 0) {
    insights.push({
      icon: "calendar-week",
      color: "#60A5FA",
      title: "Big Spender Day",
      text: `You spend the most on ${dayNames[topDayIdx]}s (${fmt(dayTotals[topDayIdx])} total)`,
    });
  }

  // 2. Biggest single transaction
  if (expenses.length > 0) {
    const biggest = expenses.reduce((a, b) => (Number(a.amount) > Number(b.amount) ? a : b));
    const cat = getCategoryById(biggest.category);
    insights.push({
      icon: "arrow-top-right-bold-box",
      color: "#F87171",
      title: "Biggest Expense",
      text: `${biggest.description || cat.label}: ${fmt(Number(biggest.amount))}`,
    });
  }

  // 3. Most frequent merchant / description
  const descCounts = {};
  expenses.forEach((t) => {
    const key = (t.description || "").toLowerCase().trim();
    if (!key) return;
    descCounts[key] = (descCounts[key] || 0) + 1;
  });
  const sortedDescs = Object.entries(descCounts).sort(([, a], [, b]) => b - a);
  if (sortedDescs.length > 0 && sortedDescs[0][1] >= 2) {
    insights.push({
      icon: "store",
      color: "#A78BFA",
      title: "Most Visited",
      text: `${sortedDescs[0][0]} — ${sortedDescs[0][1]} transactions`,
    });
  }

  // 4. Weekend vs weekday spending
  const weekdaySpend = expenses
    .filter((t) => { const d = new Date(t.date).getDay(); return d >= 1 && d <= 5; })
    .reduce((s, t) => s + Number(t.amount), 0);
  const weekendSpend = totalExpense - weekdaySpend;
  if (totalExpense > 0) {
    const weekendPct = Math.round((weekendSpend / totalExpense) * 100);
    insights.push({
      icon: weekendPct > 40 ? "party-popper" : "briefcase-outline",
      color: weekendPct > 40 ? "#FBBF24" : "#2DD4BF",
      title: "Weekend Spending",
      text: weekendPct > 40
        ? `${weekendPct}% of spending happens on weekends`
        : `Only ${weekendPct}% on weekends — disciplined!`,
    });
  }

  // 5. Savings tip based on top category
  const catTotals = {};
  expenses.forEach((t) => {
    catTotals[t.category] = (catTotals[t.category] || 0) + Number(t.amount);
  });
  const topCats = Object.entries(catTotals).sort(([, a], [, b]) => b - a);
  if (topCats.length > 0) {
    const topCat = getCategoryById(topCats[0][0]);
    const tips = {
      food: "Try meal prepping to reduce food expenses",
      shopping: "Consider a 24-hour rule before big purchases",
      entertainment: "Look for free events or shared subscriptions",
      transport: "Carpooling or public transit can save significantly",
      bills: "Review subscriptions for unused services",
    };
    const tip = tips[topCats[0][0]];
    if (tip) {
      insights.push({
        icon: "lightbulb-on-outline",
        color: "#4ADE80",
        title: "Savings Tip",
        text: tip,
      });
    }
  }

  // 6. Income vs expense ratio
  if (totalIncome > 0 && totalExpense > 0) {
    const ratio = (totalExpense / totalIncome * 100).toFixed(0);
    insights.push({
      icon: "scale-balance",
      color: ratio > 80 ? "#F87171" : "#4ADE80",
      title: "Expense Ratio",
      text: `You spend ${ratio}% of what you earn`,
    });
  }

  return insights.slice(0, 6);
}
