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

export const parseEmailTransaction = (subject, body) => {
  const amount = (body || subject).match(/(?:Rs\.?|INR|₹|\$)\s*([\d,]+\.?\d*)/i);
  const isDebit = /debited|debit|paid|purchase|payment|charged/i.test(body || subject);
  const isCredit = /credited|credit|received|refund|cashback/i.test(body || subject);

  if (!amount) return null;

  return {
    amount: parseFloat(amount[1].replace(/,/g, "")),
    type: isCredit ? "income" : isDebit ? "expense" : null,
    description: subject.substring(0, 100),
    date: new Date().toISOString(),
    category: "other",
    source: "email",
  };
};

export const parseCSVRow = (row) => {
  return {
    date: row.date || row.Date || row.DATE || new Date().toISOString(),
    amount: parseFloat((row.amount || row.Amount || row.AMOUNT || "0").replace(/,/g, "")),
    type: (row.type || row.Type || row.TYPE || "expense").toLowerCase(),
    category: (row.category || row.Category || row.CATEGORY || "other").toLowerCase(),
    description: row.description || row.Description || row.DESCRIPTION || row.narration || row.Narration || "",
    source: "csv",
  };
};
