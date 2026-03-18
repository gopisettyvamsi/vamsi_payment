import { Platform } from "react-native";
import { getCategoryById } from "./categories";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Generates a monthly financial report as a styled HTML string.
 *
 * @param {Object}   opts
 * @param {Array}    opts.transactions  - Array of transaction objects for the month
 * @param {number}   opts.month         - 0-based month index
 * @param {number}   opts.year          - Full year (e.g. 2026)
 * @param {string}   opts.currency      - ISO currency code (default "INR")
 * @param {Function} opts.formatAmount  - Optional (amount) => string formatter
 * @returns {string} Complete HTML document string
 */
export function generateReportHTML({
  transactions = [],
  month,
  year,
  currency = "INR",
  formatAmount,
}) {
  const monthName = MONTH_NAMES[month] ?? `Month ${month}`;
  const generatedDate = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const fmt = formatAmount
    ? formatAmount
    : (amount) =>
        new Intl.NumberFormat("en-IN", {
          style: "currency",
          currency,
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }).format(amount);

  // ---- Compute summary ----
  const incomeTransactions = transactions.filter((t) => t.type === "income");
  const expenseTransactions = transactions.filter((t) => t.type === "expense");
  const totalIncome = incomeTransactions.reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);
  const totalExpenses = expenseTransactions.reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);
  const netBalance = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? ((netBalance / totalIncome) * 100).toFixed(1) : "0.0";
  const txCount = transactions.length;
  const avgTransaction = txCount > 0 ? (totalExpenses / expenseTransactions.length || 0) : 0;

  // ---- Category breakdown (expenses only) ----
  const categoryMap = {};
  expenseTransactions.forEach((t) => {
    const catId = t.category || "other";
    categoryMap[catId] = (categoryMap[catId] || 0) + Math.abs(Number(t.amount) || 0);
  });

  const categoryRows = Object.entries(categoryMap)
    .map(([catId, total]) => {
      const cat = getCategoryById(catId);
      const pct = totalExpenses > 0 ? ((total / totalExpenses) * 100) : 0;
      return { id: catId, label: cat.label, color: cat.color, icon: cat.icon, total, pct };
    })
    .sort((a, b) => b.total - a.total);

  // ---- Top spending days ----
  const dayTotals = {};
  expenseTransactions.forEach((t) => {
    const dateStr = new Date(t.date).toISOString().split("T")[0];
    dayTotals[dateStr] = (dayTotals[dateStr] || 0) + Math.abs(Number(t.amount) || 0);
  });
  const topDays = Object.entries(dayTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([date, amount]) => ({
      date: new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      amount,
    }));

  // ---- Daily spending for mini chart ----
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dailySpend = new Array(daysInMonth).fill(0);
  expenseTransactions.forEach((t) => {
    const d = new Date(t.date).getDate();
    if (d >= 1 && d <= daysInMonth) dailySpend[d - 1] += Math.abs(Number(t.amount) || 0);
  });
  const maxDailySpend = Math.max(...dailySpend, 1);

  // ---- Transaction rows sorted by date desc ----
  const sortedTransactions = [...transactions].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );

  // ---- Build HTML ----
  const categoryRowsHTML = categoryRows
    .map((r) => {
      const barWidth = Math.max(r.pct, 2);
      return `
      <div class="cat-row">
        <div class="cat-info">
          <div class="cat-dot" style="background:${r.color}"></div>
          <span class="cat-name">${escapeHTML(r.label)}</span>
          <span class="cat-pct">${r.pct.toFixed(1)}%</span>
        </div>
        <div class="cat-bar-bg">
          <div class="cat-bar" style="width:${barWidth}%;background:${r.color}"></div>
        </div>
        <div class="cat-amount">${fmt(r.total)}</div>
      </div>`;
    })
    .join("");

  const transactionRowsHTML = sortedTransactions
    .map((t, i) => {
      const cat = getCategoryById(t.category || "other");
      const amount = Math.abs(Number(t.amount) || 0);
      const isIncome = t.type === "income";
      const amountClass = isIncome ? "amount-income" : "amount-expense";
      const sign = isIncome ? "+" : "-";
      const dateStr = new Date(t.date).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      });
      const yearStr = new Date(t.date).getFullYear();

      return `
      <tr class="${i % 2 === 0 ? "row-even" : "row-odd"}">
        <td class="td-date">
          <div class="date-cell">
            <span class="date-day">${dateStr}</span>
            <span class="date-year">${yearStr}</span>
          </div>
        </td>
        <td class="td-desc">
          <div class="desc-cell">
            <span class="desc-text">${escapeHTML(t.description || "-")}</span>
            <span class="desc-cat">
              <span class="cat-badge" style="background:${cat.color}20;color:${cat.color}">${escapeHTML(cat.label)}</span>
            </span>
          </div>
        </td>
        <td class="td-source">${escapeHTML(t.source || "manual")}</td>
        <td class="td-amount ${amountClass}">${sign}${fmt(amount)}</td>
      </tr>`;
    })
    .join("");

  // Daily chart bars
  const chartBarsHTML = dailySpend
    .map((val, i) => {
      const h = Math.max((val / maxDailySpend) * 100, 2);
      const isWeekend = new Date(year, month, i + 1).getDay() % 6 === 0;
      return `<div class="chart-bar-wrap" title="Day ${i + 1}: ${fmt(val)}">
        <div class="chart-bar" style="height:${h}%;background:${val > 0 ? (isWeekend ? '#f59e0b' : '#6366f1') : '#e2e8f0'}"></div>
        ${(i + 1) % 5 === 0 || i === 0 ? `<span class="chart-label">${i + 1}</span>` : ''}
      </div>`;
    })
    .join("");

  const netColor = netBalance >= 0 ? "#059669" : "#dc2626";
  const netBg = netBalance >= 0 ? "#ecfdf5" : "#fef2f2";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Monthly Report - ${escapeHTML(monthName)} ${year}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #ffffff;
      color: #1e293b;
      max-width: 850px;
      margin: 0 auto;
      padding: 0;
    }

    /* ═══ COVER HEADER ═══ */
    .report-header {
      background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%);
      color: #fff;
      padding: 48px 40px 40px;
      position: relative;
      overflow: hidden;
    }
    .report-header::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -20%;
      width: 400px;
      height: 400px;
      background: radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%);
      border-radius: 50%;
    }
    .report-header::after {
      content: '';
      position: absolute;
      bottom: -30%;
      left: -10%;
      width: 300px;
      height: 300px;
      background: radial-gradient(circle, rgba(139,92,246,0.2) 0%, transparent 70%);
      border-radius: 50%;
    }
    .header-content { position: relative; z-index: 1; }
    .brand-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
    }
    .brand-logo {
      width: 40px;
      height: 40px;
      background: rgba(255,255,255,0.15);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      font-weight: 800;
      color: #a5b4fc;
      backdrop-filter: blur(10px);
    }
    .brand-name {
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #c7d2fe;
    }
    .report-title {
      font-size: 32px;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin-bottom: 6px;
    }
    .report-period {
      font-size: 16px;
      color: #a5b4fc;
      font-weight: 500;
    }
    .report-meta {
      display: flex;
      gap: 24px;
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid rgba(255,255,255,0.1);
    }
    .meta-item {
      font-size: 12px;
      color: #a5b4fc;
    }
    .meta-item strong {
      color: #e0e7ff;
      font-weight: 600;
    }

    /* ═══ BODY ═══ */
    .report-body { padding: 32px 40px 40px; }

    /* ═══ SUMMARY CARDS ═══ */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 36px;
    }
    .summary-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
    }
    .summary-card.highlight {
      background: ${netBg};
      border-color: ${netColor}30;
    }
    .summary-label {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }
    .summary-value {
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
    }
    .summary-value.income { color: #059669; }
    .summary-value.expense { color: #dc2626; }
    .summary-value.net { color: ${netColor}; }
    .summary-sub {
      font-size: 11px;
      color: #94a3b8;
      margin-top: 4px;
      font-weight: 500;
    }

    /* ═══ DAILY CHART ═══ */
    .section { margin-bottom: 36px; }
    .section-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 18px;
      padding-bottom: 12px;
      border-bottom: 2px solid #f1f5f9;
    }
    .section-icon {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    }
    .section-title {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
    }
    .section-subtitle {
      font-size: 12px;
      color: #94a3b8;
      margin-left: auto;
      font-weight: 500;
    }

    .chart-container {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px 16px 12px;
    }
    .chart-bars {
      display: flex;
      align-items: flex-end;
      gap: 2px;
      height: 80px;
    }
    .chart-bar-wrap {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      height: 100%;
      justify-content: flex-end;
      position: relative;
    }
    .chart-bar {
      width: 100%;
      border-radius: 3px 3px 0 0;
      min-height: 2px;
      transition: height 0.3s;
    }
    .chart-label {
      font-size: 9px;
      color: #94a3b8;
      margin-top: 4px;
      font-weight: 600;
    }
    .chart-legend {
      display: flex;
      gap: 16px;
      margin-top: 12px;
      justify-content: center;
    }
    .chart-legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: #64748b;
      font-weight: 500;
    }
    .legend-dot {
      width: 8px;
      height: 8px;
      border-radius: 2px;
    }

    /* ═══ CATEGORY BREAKDOWN ═══ */
    .cat-row {
      display: flex;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid #f1f5f9;
      gap: 12px;
    }
    .cat-row:last-child { border-bottom: none; }
    .cat-info {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 160px;
      flex-shrink: 0;
    }
    .cat-dot {
      width: 10px;
      height: 10px;
      border-radius: 3px;
      flex-shrink: 0;
    }
    .cat-name {
      font-size: 13px;
      font-weight: 600;
      color: #334155;
    }
    .cat-pct {
      font-size: 11px;
      color: #94a3b8;
      font-weight: 600;
      margin-left: auto;
    }
    .cat-bar-bg {
      flex: 1;
      height: 8px;
      background: #f1f5f9;
      border-radius: 4px;
      overflow: hidden;
    }
    .cat-bar {
      height: 100%;
      border-radius: 4px;
      transition: width 0.5s;
    }
    .cat-amount {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
      width: 100px;
      text-align: right;
      flex-shrink: 0;
    }

    /* ═══ TOP DAYS ═══ */
    .top-days {
      display: flex;
      gap: 12px;
    }
    .top-day-card {
      flex: 1;
      background: #fffbeb;
      border: 1px solid #fef3c7;
      border-radius: 10px;
      padding: 14px;
      text-align: center;
    }
    .top-day-rank {
      font-size: 10px;
      font-weight: 700;
      color: #d97706;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 4px;
    }
    .top-day-date {
      font-size: 14px;
      font-weight: 700;
      color: #92400e;
      margin-bottom: 2px;
    }
    .top-day-amount {
      font-size: 16px;
      font-weight: 800;
      color: #b45309;
    }

    /* ═══ TRANSACTIONS TABLE ═══ */
    .tx-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
    }
    .tx-table thead th {
      background: #f8fafc;
      color: #64748b;
      padding: 12px 16px;
      text-align: left;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 2px solid #e2e8f0;
    }
    .tx-table thead th:last-child { text-align: right; }
    .tx-table tbody td {
      padding: 12px 16px;
      font-size: 13px;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: middle;
    }
    .tx-table tbody tr:last-child td { border-bottom: none; }
    .row-even { background: #ffffff; }
    .row-odd { background: #fafbfc; }

    .td-date { width: 100px; }
    .date-cell { display: flex; flex-direction: column; }
    .date-day { font-weight: 600; color: #334155; }
    .date-year { font-size: 11px; color: #94a3b8; }

    .td-desc { }
    .desc-cell { display: flex; flex-direction: column; gap: 4px; }
    .desc-text { font-weight: 500; color: #1e293b; }
    .cat-badge {
      display: inline-block;
      font-size: 10px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 4px;
      width: fit-content;
    }

    .td-source {
      font-size: 12px;
      color: #94a3b8;
      font-weight: 500;
      text-transform: capitalize;
      width: 80px;
    }

    .td-amount {
      text-align: right;
      font-weight: 700;
      font-size: 13px;
      white-space: nowrap;
      width: 120px;
    }
    .amount-income { color: #059669; }
    .amount-expense { color: #dc2626; }

    /* ═══ FOOTER ═══ */
    .report-footer {
      background: #f8fafc;
      border-top: 2px solid #e2e8f0;
      padding: 24px 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .footer-brand {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .footer-logo {
      width: 24px;
      height: 24px;
      background: #6366f1;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 800;
      color: #fff;
    }
    .footer-text {
      font-size: 12px;
      color: #64748b;
      font-weight: 500;
    }
    .footer-date {
      font-size: 11px;
      color: #94a3b8;
    }
    .footer-confidential {
      font-size: 10px;
      color: #cbd5e1;
      text-transform: uppercase;
      letter-spacing: 2px;
      font-weight: 600;
    }

    /* ═══ PRINT STYLES ═══ */
    @media print {
      body { max-width: 100%; }
      .report-header {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        color-adjust: exact;
      }
      .summary-card, .cat-bar-bg, .top-day-card, .chart-container,
      .tx-table thead th, .row-odd, .report-footer, .cat-badge {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        color-adjust: exact;
      }
      .chart-bar, .cat-bar, .cat-dot, .legend-dot, .brand-logo, .footer-logo {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        color-adjust: exact;
      }
    }

    /* ═══ PAGE BREAK ═══ */
    .page-break {
      page-break-before: always;
      break-before: page;
      margin-top: 0;
    }
  </style>
</head>
<body>

  <!-- ═══ HEADER ═══ -->
  <div class="report-header">
    <div class="header-content">
      <div class="brand-row">
        <div class="brand-logo">V</div>
        <div class="brand-name">Vamsify Pay</div>
      </div>
      <div class="report-title">Financial Report</div>
      <div class="report-period">${escapeHTML(monthName)} ${year}</div>
      <div class="report-meta">
        <div class="meta-item">Generated on <strong>${generatedDate}</strong></div>
        <div class="meta-item"><strong>${txCount}</strong> transactions</div>
        <div class="meta-item">Currency: <strong>${escapeHTML(currency)}</strong></div>
      </div>
    </div>
  </div>

  <div class="report-body">

    <!-- ═══ SUMMARY ═══ -->
    <div class="summary-grid">
      <div class="summary-card">
        <div class="summary-label">Total Income</div>
        <div class="summary-value income">${fmt(totalIncome)}</div>
        <div class="summary-sub">${incomeTransactions.length} transaction${incomeTransactions.length !== 1 ? 's' : ''}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Total Expenses</div>
        <div class="summary-value expense">${fmt(totalExpenses)}</div>
        <div class="summary-sub">${expenseTransactions.length} transaction${expenseTransactions.length !== 1 ? 's' : ''}</div>
      </div>
      <div class="summary-card highlight">
        <div class="summary-label">Net Balance</div>
        <div class="summary-value net">${fmt(netBalance)}</div>
        <div class="summary-sub">${savingsRate}% savings rate</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Avg Expense</div>
        <div class="summary-value">${expenseTransactions.length > 0 ? fmt(avgTransaction) : '-'}</div>
        <div class="summary-sub">per transaction</div>
      </div>
    </div>

    <!-- ═══ DAILY SPENDING ═══ -->
    <div class="section">
      <div class="section-header">
        <div class="section-icon" style="background:#eef2ff">📊</div>
        <div class="section-title">Daily Spending</div>
        <div class="section-subtitle">${daysInMonth} days in ${escapeHTML(monthName)}</div>
      </div>
      <div class="chart-container">
        <div class="chart-bars">
          ${chartBarsHTML}
        </div>
        <div class="chart-legend">
          <div class="chart-legend-item"><div class="legend-dot" style="background:#6366f1"></div> Weekday</div>
          <div class="chart-legend-item"><div class="legend-dot" style="background:#f59e0b"></div> Weekend</div>
        </div>
      </div>
    </div>

    <!-- ═══ TOP SPENDING DAYS ═══ -->
    ${topDays.length > 0 ? `
    <div class="section">
      <div class="section-header">
        <div class="section-icon" style="background:#fffbeb">🔥</div>
        <div class="section-title">Top Spending Days</div>
      </div>
      <div class="top-days">
        ${topDays.map((d, i) => `
          <div class="top-day-card">
            <div class="top-day-rank">${i === 0 ? '#1 Highest' : i === 1 ? '#2' : '#3'}</div>
            <div class="top-day-date">${d.date}</div>
            <div class="top-day-amount">${fmt(d.amount)}</div>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}

    <!-- ═══ CATEGORY BREAKDOWN ═══ -->
    <div class="section">
      <div class="section-header">
        <div class="section-icon" style="background:#f0fdf4">📁</div>
        <div class="section-title">Category Breakdown</div>
        <div class="section-subtitle">${categoryRows.length} categor${categoryRows.length !== 1 ? 'ies' : 'y'}</div>
      </div>
      ${categoryRowsHTML || '<p style="color:#94a3b8;text-align:center;padding:20px;">No expense data</p>'}
    </div>

    <!-- ═══ TRANSACTIONS ═══ -->
    <div class="section page-break">
      <div class="section-header">
        <div class="section-icon" style="background:#faf5ff">📋</div>
        <div class="section-title">All Transactions</div>
        <div class="section-subtitle">${txCount} total</div>
      </div>
      <table class="tx-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Source</th>
            <th style="text-align:right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${transactionRowsHTML || '<tr><td colspan="4" style="padding:24px;text-align:center;color:#94a3b8;">No transactions this month</td></tr>'}
        </tbody>
      </table>
    </div>

  </div>

  <!-- ═══ FOOTER ═══ -->
  <div class="report-footer">
    <div class="footer-brand">
      <div class="footer-logo">V</div>
      <div>
        <div class="footer-text">Vamsify Pay</div>
        <div class="footer-date">Generated ${generatedDate}</div>
      </div>
    </div>
    <div class="footer-confidential">Confidential</div>
  </div>

</body>
</html>`;
}

/**
 * Shares or prints the HTML report.
 *
 * - Web: opens a new window and triggers window.print()
 * - Native (iOS/Android): writes HTML to a temp file via expo-file-system
 *   and opens the share sheet via expo-sharing.
 *
 * @param {string} html  - Full HTML document string
 * @param {number} month - 0-based month index
 * @param {number} year  - Full year
 */
export async function shareReport(html, month, year) {
  const monthName = MONTH_NAMES[month] ?? `Month_${month}`;
  const fileName = `Vamsify_Pay_Report_${monthName}_${year}.html`;

  if (Platform.OS === "web") {
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 400);
    }
    return;
  }

  try {
    const FileSystem = await import("expo-file-system");
    const Sharing = await import("expo-sharing");

    const fileUri = FileSystem.cacheDirectory + fileName;
    await FileSystem.writeAsStringAsync(fileUri, html, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const isSharingAvailable = await Sharing.isAvailableAsync();
    if (isSharingAvailable) {
      await Sharing.shareAsync(fileUri, {
        mimeType: "text/html",
        dialogTitle: `Share Report - ${monthName} ${year}`,
        UTI: "public.html",
      });
    } else {
      throw new Error("Sharing is not available on this device.");
    }
  } catch (error) {
    console.error("Failed to share report:", error);
    throw error;
  }
}

// ---- Helpers ----

function escapeHTML(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
