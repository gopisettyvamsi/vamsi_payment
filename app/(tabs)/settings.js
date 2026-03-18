import { useState, useEffect, useRef } from "react";
import { View, ScrollView, StyleSheet, TouchableOpacity, Image, Platform, Modal, Pressable, Share, Animated, Dimensions, TextInput as RNTextInput } from "react-native";
import { Text, Switch, TextInput } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { showAlert } from "../../lib/alert";
import { useTheme } from "../../lib/ThemeContext";
import { useCurrency, fmtCurrency } from "../../lib/CurrencyContext";
import { getItem, setItem, KEYS } from "../../lib/storage";
import { CATEGORIES, getCategoryById } from "../../lib/categories";
import { generateReportHTML, shareReport as sharePdfReport } from "../../lib/pdfReport";
import { fetchRates, convertAmount, POPULAR_CURRENCIES } from "../../lib/exchangeRates";
import { exportToGoogleSheets } from "../../lib/googleSheets";
import { getSplitBills, saveSplitBill, deleteSplitBill, settleBill, calculateBalances } from "../../lib/splitBills";

let FileSystem = null;
let Sharing = null;
let LocalAuthentication = null;
if (Platform.OS !== "web") {
  FileSystem = require("expo-file-system");
  Sharing = require("expo-sharing");
  LocalAuthentication = require("expo-local-authentication");
}

const EXPORT_RANGES = [
  { key: "week", label: "Last 7 days", icon: "calendar-week", days: 7 },
  { key: "month", label: "Last 30 days", icon: "calendar-month", days: 30 },
  { key: "3month", label: "Last 3 months", icon: "calendar-range", days: 90 },
  { key: "year", label: "This year", icon: "calendar-today", days: null },
  { key: "all", label: "All time", icon: "calendar-star", days: null },
];

export default function Settings() {
  const { theme, isDark, toggleTheme } = useTheme();
  const { currency, setCurrency } = useCurrency();
  const [user, setUser] = useState(null);
  const [budget, setBudget] = useState("");
  const [notif, setNotif] = useState(true);
  const [showExport, setShowExport] = useState(false);
  const [showCatBudgets, setShowCatBudgets] = useState(false);
  const [catBudgets, setCatBudgets] = useState({});
  const [biometricLock, setBiometricLock] = useState(false);
  const [showWrapped, setShowWrapped] = useState(false);
  const [wrappedSlide, setWrappedSlide] = useState(0);
  const [wrappedData, setWrappedData] = useState(null);
  const [showNetWorth, setShowNetWorth] = useState(false);
  const [nwAccounts, setNwAccounts] = useState([]);
  const [nwName, setNwName] = useState("");
  const [nwType, setNwType] = useState("asset");
  const [nwBalance, setNwBalance] = useState("");
  const [nwEditId, setNwEditId] = useState(null);
  const [showPdfReport, setShowPdfReport] = useState(false);
  const [reportMonth, setReportMonth] = useState(new Date().getMonth());
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [generatingReport, setGeneratingReport] = useState(false);
  const [showCurrencyConvert, setShowCurrencyConvert] = useState(false);
  const [convertFrom, setConvertFrom] = useState("INR");
  const [convertTo, setConvertTo] = useState("USD");
  const [convertAmt, setConvertAmt] = useState("");
  const [convertResult, setConvertResult] = useState(null);
  const [exportingSheets, setExportingSheets] = useState(false);
  const [showSplitBills, setShowSplitBills] = useState(false);
  const [splitBills, setSplitBills] = useState([]);
  const [sbTitle, setSbTitle] = useState("");
  const [sbTotal, setSbTotal] = useState("");
  const [sbPaidBy, setSbPaidBy] = useState("");
  const [sbParticipants, setSbParticipants] = useState("");
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const symbol = currency === "USD" ? "$" : currency === "EUR" ? "\u20AC" : "\u20B9";

  const userKey = (key) => user ? `${key}_${user.id}` : key;

  useEffect(() => {
    (async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      setUser(u);
      if (!u) return;
      const uid = u.id;
      const uKey = (key) => `${key}_${uid}`;

      // Load user-scoped settings (with one-time migration from shared keys)
      let savedBudget = await getItem(uKey(KEYS.BUDGET), null);
      if (savedBudget === null) {
        savedBudget = await getItem(KEYS.BUDGET, "");
        await setItem(uKey(KEYS.BUDGET), savedBudget);
      }
      setBudget(savedBudget ? String(savedBudget) : "");

      let savedCatBudgets = await getItem(uKey(KEYS.CATEGORY_BUDGETS), null);
      if (savedCatBudgets === null) {
        savedCatBudgets = await getItem(KEYS.CATEGORY_BUDGETS, {});
        await setItem(uKey(KEYS.CATEGORY_BUDGETS), savedCatBudgets);
      }
      setCatBudgets(savedCatBudgets);

      const savedBiometric = await getItem(KEYS.BIOMETRIC_LOCK, false);
      setBiometricLock(savedBiometric);

      let savedNwAccounts = await getItem(uKey(KEYS.NET_WORTH_ACCOUNTS), null);
      if (savedNwAccounts === null) {
        savedNwAccounts = await getItem(KEYS.NET_WORTH_ACCOUNTS, []);
        await setItem(uKey(KEYS.NET_WORTH_ACCOUNTS), savedNwAccounts);
      }
      setNwAccounts(savedNwAccounts);

      getSplitBills().then(setSplitBills);
    })();
  }, []);

  const updateCurrency = (c) => { setCurrency(c); };
  const updateBudget = (val) => {
    setBudget(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) setItem(userKey(KEYS.BUDGET), num);
    else if (val === "") setItem(userKey(KEYS.BUDGET), "");
  };

  const updateCatBudget = (catId, val) => {
    setCatBudgets(prev => ({ ...prev, [catId]: val }));
  };
  const saveCatBudgets = () => {
    const cleaned = {};
    for (const [key, val] of Object.entries(catBudgets)) {
      const num = parseFloat(val);
      if (!isNaN(num) && num > 0) cleaned[key] = num;
    }
    setItem(userKey(KEYS.CATEGORY_BUDGETS), cleaned);
    setCatBudgets(cleaned);
    setShowCatBudgets(false);
  };
  const catBudgetCount = Object.values(catBudgets).filter(v => { const n = parseFloat(v); return !isNaN(n) && n > 0; }).length;

  const nwAssets = nwAccounts.filter(a => a.type === "asset").reduce((s, a) => s + a.balance, 0);
  const nwLiabilities = nwAccounts.filter(a => a.type === "liability").reduce((s, a) => s + a.balance, 0);
  const nwTotal = nwAssets - nwLiabilities;

  const nwResetForm = () => { setNwName(""); setNwType("asset"); setNwBalance(""); setNwEditId(null); };

  const nwSave = () => {
    const name = nwName.trim();
    if (!name) { showAlert("Missing Name", "Please enter an account name."); return; }
    const balance = parseFloat(nwBalance);
    if (isNaN(balance) || balance < 0) { showAlert("Invalid Balance", "Please enter a valid balance (0 or more)."); return; }
    let updated;
    if (nwEditId) {
      updated = nwAccounts.map(a => a.id === nwEditId ? { ...a, name, type: nwType, balance } : a);
    } else {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
      updated = [...nwAccounts, { id, name, type: nwType, balance }];
    }
    setNwAccounts(updated);
    setItem(userKey(KEYS.NET_WORTH_ACCOUNTS), updated);
    nwResetForm();
  };

  const nwEdit = (account) => {
    setNwEditId(account.id);
    setNwName(account.name);
    setNwType(account.type);
    setNwBalance(String(account.balance));
  };

  const nwDelete = (id) => {
    showAlert("Delete Account", "Remove this account from your net worth tracker?", [
      { text: "Cancel" },
      { text: "Delete", style: "destructive", onPress: () => {
        const updated = nwAccounts.filter(a => a.id !== id);
        setNwAccounts(updated);
        setItem(userKey(KEYS.NET_WORTH_ACCOUNTS), updated);
        if (nwEditId === id) nwResetForm();
      }},
    ]);
  };

  const toggleBiometricLock = async (val) => {
    if (Platform.OS === "web") {
      showAlert("Not Available", "Biometric lock is not available on web.");
      return;
    }
    if (val) {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        if (!hasHardware) {
          showAlert("Not Available", "No biometric hardware detected on this device.");
          return;
        }
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        if (!isEnrolled) {
          showAlert("Not Set Up", "No biometrics enrolled on this device. Please set up Face ID or fingerprint in your device settings.");
          return;
        }
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Confirm to enable biometric lock",
          cancelLabel: "Cancel",
        });
        if (!result.success) return;
      } catch {
        showAlert("Error", "Could not verify biometrics.");
        return;
      }
    }
    setBiometricLock(val);
    await setItem(KEYS.BIOMETRIC_LOCK, val);
  };

  const logout = () => showAlert("Logout", "Are you sure?", [
    { text: "Cancel" },
    { text: "Logout", style: "destructive", onPress: () => supabase.auth.signOut() },
  ]);

  // PDF Report generation
  const handleGenerateReport = async () => {
    if (!user) return;
    setGeneratingReport(true);
    try {
      const start = new Date(reportYear, reportMonth, 1).toISOString();
      const end = new Date(reportYear, reportMonth + 1, 0, 23, 59, 59).toISOString();
      const { data: txns } = await supabase.from("transactions").select("*")
        .eq("user_id", user.id).gte("date", start).lte("date", end).order("date", { ascending: false });
      const html = generateReportHTML({
        transactions: txns || [],
        month: reportMonth,
        year: reportYear,
        currency,
        formatAmount: (amt) => fmtCurrency(amt, currency),
      });
      await sharePdfReport(html, reportMonth, reportYear);
    } catch (e) {
      showAlert("Error", "Failed to generate report: " + e.message);
    }
    setGeneratingReport(false);
  };

  // Currency conversion
  const handleConvert = async () => {
    if (!convertAmt || isNaN(parseFloat(convertAmt))) return;
    try {
      const rates = await fetchRates("USD");
      if (!rates) { setConvertResult("Failed to fetch rates"); return; }
      const result = convertAmount(parseFloat(convertAmt), convertFrom, convertTo, rates);
      if (result !== null) {
        setConvertResult(`${parseFloat(convertAmt).toLocaleString()} ${convertFrom} = ${result.toFixed(2).toLocaleString()} ${convertTo}`);
      } else {
        setConvertResult("Conversion not available");
      }
    } catch {
      setConvertResult("Failed to fetch exchange rates");
    }
  };

  // Google Sheets export
  const handleSheetsExport = async () => {
    if (!user) return;
    setExportingSheets(true);
    try {
      const { data: txns } = await supabase.from("transactions").select("*")
        .eq("user_id", user.id).order("date", { ascending: false });
      await exportToGoogleSheets(txns || []);
    } catch (e) {
      showAlert("Error", "Export failed: " + e.message);
    }
    setExportingSheets(false);
  };

  // Split Bills handlers
  const handleAddSplitBill = async () => {
    if (!sbTitle.trim() || !sbTotal || !sbPaidBy.trim() || !sbParticipants.trim()) {
      showAlert("Missing Info", "Please fill in all fields.");
      return;
    }
    const total = parseFloat(sbTotal);
    if (isNaN(total) || total <= 0) return;
    const names = sbParticipants.split(",").map(n => n.trim()).filter(Boolean);
    if (names.length === 0) return;
    const share = total / names.length;
    const participants = names.map(name => ({ name, share, paid: name === sbPaidBy.trim() ? total : 0 }));
    const bill = await saveSplitBill({ title: sbTitle.trim(), totalAmount: total, paidBy: sbPaidBy.trim(), participants });
    setSplitBills(prev => [...prev, bill]);
    setSbTitle(""); setSbTotal(""); setSbPaidBy(""); setSbParticipants("");
  };

  const handleDeleteBill = async (id) => {
    showAlert("Delete Bill", "Remove this split bill?", [
      { text: "Cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await deleteSplitBill(id);
        setSplitBills(prev => prev.filter(b => b.id !== id));
      }},
    ]);
  };

  const handleSettleBill = async (id) => {
    await settleBill(id);
    setSplitBills(prev => prev.map(b => b.id === id ? { ...b, settled: true } : b));
  };

  const removeDuplicates = () => showAlert("Remove Duplicates", "This will scan and delete duplicate transactions (same amount, description, and date). Continue?", [
    { text: "Cancel" },
    { text: "Remove", style: "destructive", onPress: async () => {
      if (!user) return;
      const { data: all } = await supabase.from("transactions").select("*").eq("user_id", user.id).order("date", { ascending: false });
      if (!all?.length) { showAlert("Done", "No transactions found."); return; }
      const seen = new Map();
      const dupeIds = [];
      for (const tx of all) {
        const d = new Date(tx.date);
        const key = `${tx.amount}|${tx.description}|${d.getFullYear()}-${d.getMonth()}-${d.getDate()}|${tx.type}`;
        if (seen.has(key)) dupeIds.push(tx.id);
        else seen.set(key, tx.id);
      }
      if (!dupeIds.length) { showAlert("Done", "No duplicates found."); return; }
      for (const id of dupeIds) await supabase.from("transactions").delete().eq("id", id);
      showAlert("Done", `Removed ${dupeIds.length} duplicate transaction${dupeIds.length > 1 ? "s" : ""}.`);
    }},
  ]);

  const deleteAcc = () => showAlert("Delete Account", "This will permanently delete everything!", [
    { text: "Cancel" },
    { text: "Delete", style: "destructive", onPress: async () => {
      if (!user) return;
      await supabase.from("transactions").delete().eq("user_id", user.id);
      await supabase.auth.signOut();
    }},
  ]);

  const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  const animateSlide = () => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  };

  const openWrapped = async () => {
    if (!user) return;
    const year = new Date().getFullYear();
    const start = new Date(year, 0, 1).toISOString();
    const end = new Date(year, 11, 31, 23, 59, 59).toISOString();
    const { data } = await supabase.from("transactions").select("*").eq("user_id", user.id).gte("date", start).lte("date", end).order("date", { ascending: false });
    if (!data?.length) { showAlert("No Data", `No transactions found for ${year}`); return; }

    const income = data.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const expense = data.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);

    // Top category
    const catTotals = {};
    data.filter(t => t.type === "expense").forEach(t => {
      const cat = getCategoryById(t.category);
      const label = cat ? cat.label : (t.category || "Other");
      catTotals[label] = (catTotals[label] || 0) + Number(t.amount);
    });
    const topCatEntry = Object.entries(catTotals).sort(([,a],[,b]) => b - a)[0];
    const topCategory = topCatEntry ? { name: topCatEntry[0], amount: topCatEntry[1], pct: expense > 0 ? Math.round((topCatEntry[1] / expense) * 100) : 0 } : null;

    // Biggest expense
    const expenses = data.filter(t => t.type === "expense");
    const biggest = expenses.length > 0 ? expenses.reduce((max, t) => Number(t.amount) > Number(max.amount) ? t : max, expenses[0]) : null;

    // Best month (highest savings = income - expense)
    const monthly = {};
    data.forEach(t => {
      const m = new Date(t.date).getMonth();
      if (!monthly[m]) monthly[m] = { income: 0, expense: 0 };
      if (t.type === "income") monthly[m].income += Number(t.amount);
      else monthly[m].expense += Number(t.amount);
    });
    let bestMonth = null;
    let bestSavings = -Infinity;
    for (const [m, v] of Object.entries(monthly)) {
      const savings = v.income - v.expense;
      if (savings > bestSavings) { bestSavings = savings; bestMonth = Number(m); }
    }

    // Summary stats
    const dayOfYear = Math.ceil((new Date() - new Date(year, 0, 1)) / 86400000) || 1;
    const avgDaily = expense / dayOfYear;
    const savingsRate = income > 0 ? Math.round(((income - expense) / income) * 100) : 0;
    const uniqueCats = new Set(data.map(t => t.category).filter(Boolean)).size;

    setWrappedData({
      year, total: data.length, income, expense, topCategory, biggest, bestMonth,
      bestSavings, avgDaily, savingsRate, uniqueCats,
    });
    setWrappedSlide(0);
    setShowWrapped(true);
    setTimeout(animateSlide, 50);
  };

  const nextWrappedSlide = () => {
    if (wrappedSlide < 4) {
      setWrappedSlide(wrappedSlide + 1);
      animateSlide();
    } else {
      setShowWrapped(false);
    }
  };

  const fmt = (amount) => fmtCurrency(amount, currency);

  const shareReport = async () => {
    if (!user) return;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { data } = await supabase.from("transactions").select("*").eq("user_id", user.id).gte("date", monthStart);
    if (!data?.length) { showAlert("No Data", "No transactions this month"); return; }

    const inc = data.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const exp = data.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
    const catTotals = {};
    data.filter(t => t.type === "expense").forEach(t => { catTotals[t.category] = (catTotals[t.category] || 0) + Number(t.amount); });
    const topCats = Object.entries(catTotals).sort(([,a],[,b]) => b - a).slice(0, 5);

    const monthName = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    const report = `📊 Spending Report - ${monthName}\n\n💰 Income: ₹${inc.toLocaleString()}\n💸 Expenses: ₹${exp.toLocaleString()}\n📈 Net: ₹${(inc - exp).toLocaleString()}\n\n🏷️ Top Categories:\n${topCats.map(([cat, amt]) => `  • ${cat}: ₹${amt.toLocaleString()}`).join("\n")}\n\n📝 ${data.length} transactions\n\n— Generated by Vamsify - Smart Money Tracking`;

    await Share.share({ message: report, title: "Spending Report" });
  };

  const exportCSV = async (range) => {
    setShowExport(false);
    if (!user) return;
    let q = supabase.from("transactions").select("*").eq("user_id", user.id);
    if (range.key === "year") {
      q = q.gte("date", new Date(new Date().getFullYear(), 0, 1).toISOString());
    } else if (range.days) {
      const start = new Date(); start.setDate(start.getDate() - range.days);
      q = q.gte("date", start.toISOString());
    }
    const { data } = await q.order("date", { ascending: false });
    if (!data?.length) { showAlert("No Data", "No transactions found for this period"); return; }
    const headers = "Date,Description,Category,Type,Amount,Source\n";
    const rows = data.map(t => {
      const cat = getCategoryById(t.category);
      const catLabel = cat ? cat.label : (t.category || "");
      return `${new Date(t.date).toISOString().split("T")[0]},"${(t.description || "").replace(/"/g, '""')}",${catLabel},${t.type},${t.amount},${t.source || ""}`;
    }).join("\n");
    const csv = headers + rows;
    const fileName = `vamsify-${range.key}-transactions.csv`;
    if (Platform.OS === "web") {
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url;
      a.download = fileName;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showAlert("Exported", `${data.length} transactions downloaded.`);
    } else {
      try {
        const fileUri = FileSystem.documentDirectory + fileName;
        await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, { mimeType: "text/csv", dialogTitle: "Export Transactions" });
        } else {
          showAlert("Exported", `${data.length} transactions saved.\nSharing is not available on this device.`);
        }
      } catch (e) {
        showAlert("Export Error", "Failed to export CSV: " + e.message);
      }
    }
  };

  const Row = ({ icon, title, sub, right, onPress }) => (
    <TouchableOpacity onPress={onPress} disabled={!onPress} activeOpacity={onPress ? 0.6 : 1} style={s.row}>
      <View style={[s.rowIcon, { backgroundColor: theme.surface }]}>
        <MaterialCommunityIcons name={icon} size={18} color={theme.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.rowTitle, { color: theme.text }]}>{title}</Text>
        {sub ? <Text style={[s.rowSub, { color: theme.textMuted }]}>{sub}</Text> : null}
      </View>
      {right || (onPress && <MaterialCommunityIcons name="chevron-right" size={18} color={theme.textDim} />)}
    </TouchableOpacity>
  );

  return (
    <ScrollView style={[s.container, { backgroundColor: theme.bg }]} showsVerticalScrollIndicator={false}>

      {/* Profile */}
      <View style={[s.profileCard, { backgroundColor: theme.card, borderColor: theme.surfaceBorder }]}>
        <View style={s.profileTop}>
          {user?.user_metadata?.avatar_url || user?.user_metadata?.picture ? (
            <Image source={{ uri: user.user_metadata.avatar_url || user.user_metadata.picture }} style={s.avatarImg} />
          ) : (
            <View style={[s.avatar, { backgroundColor: theme.accent + "14" }]}>
              <Text style={[s.avatarLetter, { color: theme.accent }]}>
                {user?.user_metadata?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "?"}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[s.profileName, { color: theme.text }]}>{user?.user_metadata?.full_name || ""}</Text>
            <Text style={[s.profileEmail, { color: theme.textSecondary }]}>{user?.email || "Loading..."}</Text>
          </View>
        </View>
        <View style={[s.profileMeta, { borderTopColor: theme.divider }]}>
          <View style={s.metaItem}>
            <MaterialCommunityIcons name="calendar-check-outline" size={14} color={theme.textMuted} />
            <Text style={[s.metaText, { color: theme.textMuted }]}>
              Joined {user?.created_at ? new Date(user.created_at).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "..."}
            </Text>
          </View>
          <View style={[s.metaDot, { backgroundColor: theme.textDim }]} />
          <View style={s.metaItem}>
            <MaterialCommunityIcons name="shield-check-outline" size={14} color={theme.textMuted} />
            <Text style={[s.metaText, { color: theme.textMuted }]}>Verified</Text>
          </View>
        </View>
      </View>

      {/* General */}
      <Text style={[s.sectionLabel, { color: theme.textMuted }]}>GENERAL</Text>
      <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.surfaceBorder }]}>
        <Row icon={isDark ? "weather-night" : "white-balance-sunny"} title="Dark Mode" sub={isDark ? "On" : "Off"}
          right={<Switch value={isDark} onValueChange={toggleTheme} color={theme.accent} />} />
        <View style={[s.sep, { backgroundColor: theme.divider }]} />
        <Row icon="swap-horizontal" title="Currency" sub={currency}
          right={
            <View style={s.chipRow}>
              {["INR", "USD", "EUR"].map(c => (
                <TouchableOpacity key={c} onPress={() => updateCurrency(c)} activeOpacity={0.7}
                  style={[s.chip, { backgroundColor: currency === c ? theme.accent : theme.surface }]}>
                  <Text style={[s.chipText, { color: currency === c ? "#fff" : theme.textMuted }]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
          } />
        <View style={[s.sep, { backgroundColor: theme.divider }]} />
        <Row icon="bell-outline" title="Notifications"
          right={<Switch value={notif} onValueChange={setNotif} color={theme.accent} />} />
        <View style={[s.sep, { backgroundColor: theme.divider }]} />
        <View style={s.row}>
          <View style={[s.rowIcon, { backgroundColor: theme.surface }]}>
            <MaterialCommunityIcons name="target" size={18} color={theme.textSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.rowTitle, { color: theme.text }]}>Monthly Budget</Text>
            <Text style={[s.rowSub, { color: theme.textMuted }]}>Spending limit</Text>
          </View>
          <View style={[s.budgetWrap, { backgroundColor: theme.surface }]}>
            <Text style={[s.budgetSymbol, { color: theme.textSecondary }]}>{symbol}</Text>
            <TextInput value={budget} onChangeText={updateBudget} keyboardType="numeric"
              placeholder="0" placeholderTextColor={theme.textDim}
              style={[s.budgetInput, { color: theme.text }]} />
          </View>
        </View>
        <View style={[s.sep, { backgroundColor: theme.divider }]} />
        <Row icon="shape" title="Category Budgets" sub={catBudgetCount > 0 ? `${catBudgetCount} categor${catBudgetCount === 1 ? "y" : "ies"} set` : "Set per-category limits"} onPress={() => setShowCatBudgets(true)} />
        {Platform.OS !== "web" && (
          <>
            <View style={[s.sep, { backgroundColor: theme.divider }]} />
            <Row icon="fingerprint" title="Biometric Lock" sub={biometricLock ? "Face ID / Fingerprint enabled" : "Secure app with biometrics"}
              right={<Switch value={biometricLock} onValueChange={toggleBiometricLock} color={theme.accent} />} />
          </>
        )}
      </View>

      {/* Data */}
      <Text style={[s.sectionLabel, { color: theme.textMuted }]}>DATA</Text>
      <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.surfaceBorder }]}>
        <Row icon="file-delimited-outline" title="Export to CSV" sub="Download transactions as CSV" onPress={() => setShowExport(true)} />
        <View style={[s.sep, { backgroundColor: theme.divider }]} />
        <Row icon="content-duplicate" title="Remove Duplicates" sub="Delete duplicate transactions" onPress={removeDuplicates} />
        <View style={[s.sep, { backgroundColor: theme.divider }]} />
        <Row icon="share-variant" title="Share Report" sub="Share monthly summary" onPress={shareReport} />
        <View style={[s.sep, { backgroundColor: theme.divider }]} />
        <Row icon="chart-timeline-variant" title="Year in Review" sub={`Your ${new Date().getFullYear()} spending wrapped`} onPress={openWrapped} />
        <View style={[s.sep, { backgroundColor: theme.divider }]} />
        <Row icon="bank" title="Net Worth Tracker" sub={nwAccounts.length > 0 ? `Net Worth: ${fmt(nwTotal)}` : "Track your assets & liabilities"} onPress={() => { nwResetForm(); setShowNetWorth(true); }} />
        <View style={[s.sep, { backgroundColor: theme.divider }]} />
        <Row icon="file-pdf-box" title="PDF Monthly Report" sub="Generate & share PDF report" onPress={() => setShowPdfReport(true)} />
        <View style={[s.sep, { backgroundColor: theme.divider }]} />
        <Row icon="currency-usd" title="Currency Converter" sub="Live exchange rates" onPress={() => { setConvertResult(null); setShowCurrencyConvert(true); }} />
        <View style={[s.sep, { backgroundColor: theme.divider }]} />
        <Row icon="google-spreadsheet" title="Export to Google Sheets" sub={exportingSheets ? "Exporting..." : "Sync transactions as CSV"} onPress={handleSheetsExport} />
        <View style={[s.sep, { backgroundColor: theme.divider }]} />
        <Row icon="account-group" title="Split Bills" sub={splitBills.filter(b => !b.settled).length > 0 ? `${splitBills.filter(b => !b.settled).length} active split${splitBills.filter(b => !b.settled).length > 1 ? "s" : ""}` : "Track shared expenses"} onPress={() => setShowSplitBills(true)} />
      </View>

      {/* Account */}
      <Text style={[s.sectionLabel, { color: theme.textMuted }]}>ACCOUNT</Text>
      <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.surfaceBorder }]}>
        <TouchableOpacity onPress={() => {
          showAlert("Change Password", "We'll send a password reset link to your email.", [
            { text: "Cancel" },
            { text: "Send Link", onPress: async () => {
              if (!user?.email) return;
              const redirectUrl = Platform.OS === "web" ? `${window.location.origin}/reset-password` : "payment-tracker://reset-password";
              const { error } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: redirectUrl });
              if (error) showAlert("Error", error.message);
              else showAlert("Check Your Email", `Password reset link sent to ${user.email}`);
            }},
          ]);
        }} activeOpacity={0.6} style={s.row}>
          <View style={[s.rowIcon, { backgroundColor: theme.accent + "18" }]}>
            <MaterialCommunityIcons name="lock-reset" size={18} color={theme.accent} />
          </View>
          <Text style={[s.rowTitle, { color: theme.text }]}>Change Password</Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color={theme.textDim} />
        </TouchableOpacity>
        <View style={[s.sep, { backgroundColor: theme.divider }]} />
        <TouchableOpacity onPress={logout} activeOpacity={0.6} style={s.row}>
          <View style={[s.rowIcon, { backgroundColor: theme.orangeBg }]}>
            <MaterialCommunityIcons name="logout" size={18} color={theme.orange} />
          </View>
          <Text style={[s.rowTitle, { color: theme.orange }]}>Logout</Text>
        </TouchableOpacity>
        <View style={[s.sep, { backgroundColor: theme.divider }]} />
        <TouchableOpacity onPress={deleteAcc} activeOpacity={0.6} style={s.row}>
          <View style={[s.rowIcon, { backgroundColor: theme.redBg }]}>
            <MaterialCommunityIcons name="trash-can-outline" size={18} color={theme.red} />
          </View>
          <Text style={[s.rowTitle, { color: theme.red }]}>Delete Account</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 100 }} />

      {/* Export Range Modal */}
      <Modal transparent visible={showExport} animationType="fade" onRequestClose={() => setShowExport(false)}>
        <View style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowExport(false)} />
          <View style={[s.sheet, { backgroundColor: theme.card }]}>
            <View style={s.sheetHandle}>
              <View style={[s.handleBar, { backgroundColor: theme.textDim }]} />
            </View>
            <Text style={[s.sheetTitle, { color: theme.text }]}>Export transactions</Text>
            <Text style={[s.sheetSub, { color: theme.textMuted }]}>Choose a date range for your CSV export</Text>

            {EXPORT_RANGES.map((r, i) => (
              <TouchableOpacity key={r.key} onPress={() => exportCSV(r)} activeOpacity={0.6}
                style={[s.rangeRow, { borderBottomColor: i < EXPORT_RANGES.length - 1 ? theme.divider : "transparent" }]}>
                <MaterialCommunityIcons name={r.icon} size={18} color={theme.textSecondary} />
                <Text style={[s.rangeLabel, { color: theme.text }]}>{r.label}</Text>
                <MaterialCommunityIcons name="arrow-right" size={16} color={theme.textDim} />
              </TouchableOpacity>
            ))}

            <TouchableOpacity onPress={() => setShowExport(false)} activeOpacity={0.7} style={[s.sheetCancel, { backgroundColor: theme.surface }]}>
              <Text style={[s.cancelText, { color: theme.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Year in Review Modal */}
      <Modal visible={showWrapped} animationType="fade" onRequestClose={() => setShowWrapped(false)}>
        <Pressable style={s.wrappedBg} onPress={nextWrappedSlide}>
          <TouchableOpacity style={s.wrappedClose} onPress={() => setShowWrapped(false)} activeOpacity={0.7}>
            <MaterialCommunityIcons name="close" size={24} color="#fff" />
          </TouchableOpacity>

          {wrappedData && (
            <Animated.View style={[s.wrappedContent, { opacity: fadeAnim }]}>
              {wrappedSlide === 0 && (
                <View style={s.wrappedSlide}>
                  <MaterialCommunityIcons name="sparkles" size={48} color={theme.accent} />
                  <Text style={s.wrappedYear}>Your {wrappedData.year} in Numbers</Text>
                  <View style={s.wrappedStatGroup}>
                    <Text style={s.wrappedBigNum}>{wrappedData.total}</Text>
                    <Text style={s.wrappedLabel}>transactions recorded</Text>
                  </View>
                  <View style={s.wrappedRow}>
                    <View style={s.wrappedStatBox}>
                      <Text style={[s.wrappedAmount, { color: "#4CAF50" }]}>{fmt(wrappedData.income)}</Text>
                      <Text style={s.wrappedLabel}>earned</Text>
                    </View>
                    <View style={s.wrappedStatBox}>
                      <Text style={[s.wrappedAmount, { color: "#FF5252" }]}>{fmt(wrappedData.expense)}</Text>
                      <Text style={s.wrappedLabel}>spent</Text>
                    </View>
                  </View>
                </View>
              )}

              {wrappedSlide === 1 && wrappedData.topCategory && (
                <View style={s.wrappedSlide}>
                  <MaterialCommunityIcons name="trophy" size={48} color="#FFD700" />
                  <Text style={s.wrappedYear}>Top Category</Text>
                  <Text style={s.wrappedHero}>{wrappedData.topCategory.name}</Text>
                  <Text style={[s.wrappedAmount, { color: theme.accent }]}>{fmt(wrappedData.topCategory.amount)}</Text>
                  <Text style={s.wrappedLabel}>{wrappedData.topCategory.pct}% of all spending</Text>
                </View>
              )}

              {wrappedSlide === 2 && wrappedData.biggest && (
                <View style={s.wrappedSlide}>
                  <MaterialCommunityIcons name="cash-remove" size={48} color="#FF5252" />
                  <Text style={s.wrappedYear}>Biggest Single Expense</Text>
                  <Text style={[s.wrappedHero, { color: "#FF5252" }]}>{fmt(Number(wrappedData.biggest.amount))}</Text>
                  <Text style={s.wrappedDesc}>{wrappedData.biggest.description || "No description"}</Text>
                  <Text style={s.wrappedLabel}>{new Date(wrappedData.biggest.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</Text>
                </View>
              )}

              {wrappedSlide === 3 && wrappedData.bestMonth !== null && (
                <View style={s.wrappedSlide}>
                  <MaterialCommunityIcons name="calendar-star" size={48} color="#4CAF50" />
                  <Text style={s.wrappedYear}>Best Month</Text>
                  <Text style={s.wrappedHero}>{MONTH_NAMES[wrappedData.bestMonth]}</Text>
                  <Text style={[s.wrappedAmount, { color: "#4CAF50" }]}>{fmt(wrappedData.bestSavings)}</Text>
                  <Text style={s.wrappedLabel}>saved this month</Text>
                </View>
              )}

              {wrappedSlide === 4 && (
                <View style={s.wrappedSlide}>
                  <MaterialCommunityIcons name="chart-arc" size={48} color={theme.accent} />
                  <Text style={s.wrappedYear}>Summary</Text>
                  <View style={s.wrappedSummaryRow}>
                    <View style={s.wrappedSummaryItem}>
                      <Text style={[s.wrappedBigNum, { fontSize: 32 }]}>{wrappedData.savingsRate}%</Text>
                      <Text style={s.wrappedLabel}>savings rate</Text>
                    </View>
                    <View style={s.wrappedSummaryItem}>
                      <Text style={[s.wrappedBigNum, { fontSize: 28 }]}>{fmt(wrappedData.avgDaily)}</Text>
                      <Text style={s.wrappedLabel}>avg daily spend</Text>
                    </View>
                    <View style={s.wrappedSummaryItem}>
                      <Text style={[s.wrappedBigNum, { fontSize: 32 }]}>{wrappedData.uniqueCats}</Text>
                      <Text style={s.wrappedLabel}>categories used</Text>
                    </View>
                  </View>
                </View>
              )}
            </Animated.View>
          )}

          {/* Slide dots */}
          <View style={s.wrappedDots}>
            {[0, 1, 2, 3, 4].map(i => (
              <View key={i} style={[s.wrappedDot, { backgroundColor: i === wrappedSlide ? theme.accent : "rgba(255,255,255,0.3)" }]} />
            ))}
          </View>

          {/* Next / Finish button */}
          <TouchableOpacity style={[s.wrappedNext, { backgroundColor: theme.accent }]} onPress={nextWrappedSlide} activeOpacity={0.8}>
            <Text style={s.wrappedNextText}>{wrappedSlide < 4 ? "Next" : "Done"}</Text>
          </TouchableOpacity>
        </Pressable>
      </Modal>

      {/* Category Budgets Modal */}
      <Modal transparent visible={showCatBudgets} animationType="fade" onRequestClose={() => setShowCatBudgets(false)}>
        <View style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowCatBudgets(false)} />
          <View style={[s.sheet, { backgroundColor: theme.card, maxHeight: "80%" }]}>
            <View style={s.sheetHandle}>
              <View style={[s.handleBar, { backgroundColor: theme.textDim }]} />
            </View>
            <Text style={[s.sheetTitle, { color: theme.text }]}>Category Budgets</Text>
            <Text style={[s.sheetSub, { color: theme.textMuted }]}>Set monthly spending limits per category</Text>
            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              {CATEGORIES.filter(c => !["salary", "freelance", "investment"].includes(c.id)).map((cat, i, arr) => (
                <View key={cat.id} style={[s.catBudgetRow, { borderBottomColor: i < arr.length - 1 ? theme.divider : "transparent" }]}>
                  <View style={[s.catBudgetIcon, { backgroundColor: cat.color + "18" }]}>
                    <MaterialCommunityIcons name={cat.icon} size={16} color={cat.color} />
                  </View>
                  <Text style={[s.catBudgetLabel, { color: theme.text }]}>{cat.label}</Text>
                  <View style={[s.budgetWrap, { backgroundColor: theme.surface }]}>
                    <Text style={[s.budgetSymbol, { color: theme.textSecondary }]}>{symbol}</Text>
                    <TextInput
                      value={catBudgets[cat.id] != null ? String(catBudgets[cat.id]) : ""}
                      onChangeText={(val) => updateCatBudget(cat.id, val)}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={theme.textDim}
                      style={[s.budgetInput, { color: theme.text }]}
                    />
                  </View>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity onPress={saveCatBudgets} activeOpacity={0.7} style={[s.catBudgetSave, { backgroundColor: theme.accent }]}>
              <Text style={s.catBudgetSaveText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowCatBudgets(false)} activeOpacity={0.7} style={[s.sheetCancel, { backgroundColor: theme.surface }]}>
              <Text style={[s.cancelText, { color: theme.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Net Worth Tracker Modal */}
      <Modal transparent visible={showNetWorth} animationType="fade" onRequestClose={() => setShowNetWorth(false)}>
        <View style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowNetWorth(false)} />
          <View style={[s.sheet, { backgroundColor: theme.card, maxHeight: "85%" }]}>
            <View style={s.sheetHandle}>
              <View style={[s.handleBar, { backgroundColor: theme.textDim }]} />
            </View>
            <Text style={[s.sheetTitle, { color: theme.text }]}>Net Worth Tracker</Text>
            <Text style={[s.sheetSub, { color: theme.textMuted }]}>Track your assets and liabilities</Text>

            {/* Summary */}
            {nwAccounts.length > 0 && (
              <View style={[s.nwSummary, { backgroundColor: theme.surface }]}>
                <View style={s.nwSummaryRow}>
                  <View style={s.nwSummaryItem}>
                    <Text style={[s.nwSummaryLabel, { color: theme.textMuted }]}>Assets</Text>
                    <Text style={[s.nwSummaryVal, { color: "#4CAF50" }]}>{fmt(nwAssets)}</Text>
                  </View>
                  <View style={s.nwSummaryItem}>
                    <Text style={[s.nwSummaryLabel, { color: theme.textMuted }]}>Liabilities</Text>
                    <Text style={[s.nwSummaryVal, { color: "#FF5252" }]}>{fmt(nwLiabilities)}</Text>
                  </View>
                </View>
                <View style={[s.nwNetRow, { borderTopColor: theme.divider }]}>
                  <Text style={[s.nwNetLabel, { color: theme.text }]}>Net Worth</Text>
                  <Text style={[s.nwNetVal, { color: nwTotal >= 0 ? "#4CAF50" : "#FF5252" }]}>{fmt(nwTotal)}</Text>
                </View>
              </View>
            )}

            {/* Add / Edit Form */}
            <View style={s.nwForm}>
              <RNTextInput
                value={nwName}
                onChangeText={setNwName}
                placeholder="Account name"
                placeholderTextColor={theme.textDim}
                style={[s.nwInput, { color: theme.text, backgroundColor: theme.surface }]}
              />
              <View style={s.nwFormRow}>
                <View style={s.chipRow}>
                  {["asset", "liability"].map(t => (
                    <TouchableOpacity key={t} onPress={() => setNwType(t)} activeOpacity={0.7}
                      style={[s.chip, { backgroundColor: nwType === t ? (t === "asset" ? "#4CAF50" : "#FF5252") : theme.surface }]}>
                      <Text style={[s.chipText, { color: nwType === t ? "#fff" : theme.textMuted }]}>
                        {t === "asset" ? "Asset" : "Liability"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={[s.budgetWrap, { backgroundColor: theme.surface }]}>
                  <Text style={[s.budgetSymbol, { color: theme.textSecondary }]}>{symbol}</Text>
                  <RNTextInput
                    value={nwBalance}
                    onChangeText={setNwBalance}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={theme.textDim}
                    style={[s.budgetInput, { color: theme.text }]}
                  />
                </View>
              </View>
              <TouchableOpacity onPress={nwSave} activeOpacity={0.7} style={[s.catBudgetSave, { backgroundColor: theme.accent, marginHorizontal: 0 }]}>
                <Text style={s.catBudgetSaveText}>{nwEditId ? "Update" : "Add Account"}</Text>
              </TouchableOpacity>
              {nwEditId && (
                <TouchableOpacity onPress={nwResetForm} activeOpacity={0.7} style={{ alignItems: "center", marginTop: 6 }}>
                  <Text style={{ color: theme.textSecondary, fontSize: 13, fontWeight: "600" }}>Cancel Edit</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Account List */}
            <ScrollView style={{ maxHeight: 250 }} showsVerticalScrollIndicator={false}>
              {nwAccounts.map((acc, i) => (
                <View key={acc.id} style={[s.nwAccRow, { borderBottomColor: i < nwAccounts.length - 1 ? theme.divider : "transparent" }]}>
                  <View style={[s.catBudgetIcon, { backgroundColor: acc.type === "asset" ? "#4CAF5018" : "#FF525218" }]}>
                    <MaterialCommunityIcons name={acc.type === "asset" ? "arrow-up-circle" : "arrow-down-circle"} size={16} color={acc.type === "asset" ? "#4CAF50" : "#FF5252"} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.catBudgetLabel, { color: theme.text }]}>{acc.name}</Text>
                    <Text style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>{acc.type === "asset" ? "Asset" : "Liability"}</Text>
                  </View>
                  <Text style={[s.nwAccBal, { color: acc.type === "asset" ? "#4CAF50" : "#FF5252" }]}>{fmt(acc.balance)}</Text>
                  <TouchableOpacity onPress={() => nwEdit(acc)} activeOpacity={0.6} style={s.nwAccAction}>
                    <MaterialCommunityIcons name="pencil-outline" size={16} color={theme.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => nwDelete(acc.id)} activeOpacity={0.6} style={s.nwAccAction}>
                    <MaterialCommunityIcons name="trash-can-outline" size={16} color={theme.red || "#FF5252"} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity onPress={() => setShowNetWorth(false)} activeOpacity={0.7} style={[s.sheetCancel, { backgroundColor: theme.surface }]}>
              <Text style={[s.cancelText, { color: theme.textSecondary }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* PDF Report Modal */}
      <Modal transparent visible={showPdfReport} animationType="fade" onRequestClose={() => setShowPdfReport(false)}>
        <View style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowPdfReport(false)} />
          <View style={[s.sheet, { backgroundColor: theme.card, padding: 20 }]}>
            <Text style={[s.sheetTitle, { color: theme.text, paddingHorizontal: 0 }]}>Generate PDF Report</Text>
            <Text style={{ color: theme.textMuted, fontSize: 13, marginTop: 4, marginBottom: 16 }}>Select month and year</Text>

            <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: "600", marginBottom: 6 }}>MONTH</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m, i) => (
                      <TouchableOpacity key={m} onPress={() => setReportMonth(i)}
                        style={[s.chip, { backgroundColor: reportMonth === i ? theme.accent : theme.surface }]}>
                        <Text style={[s.chipText, { color: reportMonth === i ? "#fff" : theme.textMuted }]}>{m}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 6, marginBottom: 20 }}>
              {[2024, 2025, 2026].map(y => (
                <TouchableOpacity key={y} onPress={() => setReportYear(y)}
                  style={[s.chip, { backgroundColor: reportYear === y ? theme.accent : theme.surface }]}>
                  <Text style={[s.chipText, { color: reportYear === y ? "#fff" : theme.textMuted }]}>{y}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity onPress={handleGenerateReport} disabled={generatingReport} activeOpacity={0.7}
              style={{ backgroundColor: theme.accent, paddingVertical: 13, borderRadius: 10, alignItems: "center" }}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>
                {generatingReport ? "Generating..." : "Generate & Share"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowPdfReport(false)} activeOpacity={0.7}
              style={[s.sheetCancel, { backgroundColor: theme.surface, marginHorizontal: 0 }]}>
              <Text style={[s.cancelText, { color: theme.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Currency Converter Modal */}
      <Modal transparent visible={showCurrencyConvert} animationType="fade" onRequestClose={() => setShowCurrencyConvert(false)}>
        <View style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowCurrencyConvert(false)} />
          <View style={[s.sheet, { backgroundColor: theme.card, padding: 20 }]}>
            <Text style={[s.sheetTitle, { color: theme.text, paddingHorizontal: 0 }]}>Currency Converter</Text>
            <Text style={{ color: theme.textMuted, fontSize: 13, marginTop: 4, marginBottom: 16 }}>Live exchange rates</Text>

            <RNTextInput
              value={convertAmt}
              onChangeText={setConvertAmt}
              placeholder="Enter amount"
              placeholderTextColor={theme.textDim}
              keyboardType="numeric"
              style={{
                backgroundColor: theme.surface, borderRadius: 10, padding: 12, fontSize: 16, fontWeight: "600",
                color: theme.text, marginBottom: 12,
              }}
            />

            <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: "600", marginBottom: 6 }}>FROM</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: "row", gap: 4 }}>
                    {POPULAR_CURRENCIES.map(c => (
                      <TouchableOpacity key={c.code} onPress={() => setConvertFrom(c.code)}
                        style={[s.chip, { backgroundColor: convertFrom === c.code ? theme.accent : theme.surface }]}>
                        <Text style={[s.chipText, { color: convertFrom === c.code ? "#fff" : theme.textMuted }]}>{c.code}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: "600", marginBottom: 6 }}>TO</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: "row", gap: 4 }}>
                    {POPULAR_CURRENCIES.map(c => (
                      <TouchableOpacity key={c.code} onPress={() => setConvertTo(c.code)}
                        style={[s.chip, { backgroundColor: convertTo === c.code ? theme.accent : theme.surface }]}>
                        <Text style={[s.chipText, { color: convertTo === c.code ? "#fff" : theme.textMuted }]}>{c.code}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </View>

            {convertResult && (
              <View style={{ backgroundColor: theme.surface, borderRadius: 10, padding: 14, marginBottom: 12, alignItems: "center" }}>
                <Text style={{ color: theme.text, fontSize: 16, fontWeight: "700" }}>{convertResult}</Text>
              </View>
            )}

            <TouchableOpacity onPress={handleConvert} activeOpacity={0.7}
              style={{ backgroundColor: theme.accent, paddingVertical: 13, borderRadius: 10, alignItems: "center" }}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Convert</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowCurrencyConvert(false)} activeOpacity={0.7}
              style={[s.sheetCancel, { backgroundColor: theme.surface, marginHorizontal: 0 }]}>
              <Text style={[s.cancelText, { color: theme.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Split Bills Modal */}
      <Modal transparent visible={showSplitBills} animationType="fade" onRequestClose={() => setShowSplitBills(false)}>
        <View style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowSplitBills(false)} />
          <View style={[s.sheet, { backgroundColor: theme.card, padding: 20, maxHeight: Dimensions.get("window").height * 0.8 }]}>
            <Text style={[s.sheetTitle, { color: theme.text, paddingHorizontal: 0 }]}>Split Bills</Text>
            <Text style={{ color: theme.textMuted, fontSize: 13, marginTop: 4, marginBottom: 12 }}>Track shared expenses with friends</Text>

            {/* Add Bill Form */}
            <RNTextInput value={sbTitle} onChangeText={setSbTitle} placeholder="Bill title (e.g. Dinner)"
              placeholderTextColor={theme.textDim}
              style={{ backgroundColor: theme.surface, borderRadius: 8, padding: 10, fontSize: 14, color: theme.text, marginBottom: 8 }} />
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
              <RNTextInput value={sbTotal} onChangeText={setSbTotal} placeholder="Total amount" keyboardType="numeric"
                placeholderTextColor={theme.textDim}
                style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 8, padding: 10, fontSize: 14, color: theme.text }} />
              <RNTextInput value={sbPaidBy} onChangeText={setSbPaidBy} placeholder="Paid by"
                placeholderTextColor={theme.textDim}
                style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 8, padding: 10, fontSize: 14, color: theme.text }} />
            </View>
            <RNTextInput value={sbParticipants} onChangeText={setSbParticipants} placeholder="Participants (comma separated)"
              placeholderTextColor={theme.textDim}
              style={{ backgroundColor: theme.surface, borderRadius: 8, padding: 10, fontSize: 14, color: theme.text, marginBottom: 10 }} />
            <TouchableOpacity onPress={handleAddSplitBill} activeOpacity={0.7}
              style={{ backgroundColor: theme.accent, paddingVertical: 10, borderRadius: 8, alignItems: "center", marginBottom: 14 }}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Add Bill</Text>
            </TouchableOpacity>

            {/* Bills List */}
            <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
              {splitBills.length === 0 && (
                <Text style={{ color: theme.textDim, textAlign: "center", paddingVertical: 20, fontSize: 13 }}>No split bills yet</Text>
              )}
              {splitBills.map((bill) => (
                <View key={bill.id} style={{ backgroundColor: theme.surface, borderRadius: 10, padding: 12, marginBottom: 8 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ color: theme.text, fontWeight: "700", fontSize: 14 }}>{bill.title}</Text>
                    <Text style={{ color: bill.settled ? theme.green : theme.accent, fontWeight: "700", fontSize: 14 }}>
                      {fmt(bill.totalAmount)}
                    </Text>
                  </View>
                  <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 4 }}>
                    Paid by {bill.paidBy} · {bill.participants?.length || 0} people
                  </Text>
                  {bill.settled ? (
                    <View style={{ backgroundColor: theme.green + "18", borderRadius: 6, padding: 6, marginTop: 8, alignItems: "center" }}>
                      <Text style={{ color: theme.green, fontSize: 12, fontWeight: "600" }}>Settled</Text>
                    </View>
                  ) : (
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                      <TouchableOpacity onPress={() => handleSettleBill(bill.id)} activeOpacity={0.7}
                        style={{ flex: 1, backgroundColor: theme.green + "18", borderRadius: 6, padding: 6, alignItems: "center" }}>
                        <Text style={{ color: theme.green, fontSize: 12, fontWeight: "600" }}>Settle</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteBill(bill.id)} activeOpacity={0.7}
                        style={{ flex: 1, backgroundColor: theme.red + "18", borderRadius: 6, padding: 6, alignItems: "center" }}>
                        <Text style={{ color: theme.red, fontSize: 12, fontWeight: "600" }}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}

              {/* Balances Summary */}
              {(() => {
                const balances = calculateBalances(splitBills);
                if (balances.length === 0) return null;
                return (
                  <View style={{ marginTop: 8 }}>
                    <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 6 }}>WHO OWES WHOM</Text>
                    {balances.map((b, i) => (
                      <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 }}>
                        <Text style={{ color: theme.red, fontSize: 13, fontWeight: "600" }}>{b.from}</Text>
                        <MaterialCommunityIcons name="arrow-right" size={14} color={theme.textDim} />
                        <Text style={{ color: theme.green, fontSize: 13, fontWeight: "600" }}>{b.to}</Text>
                        <Text style={{ color: theme.text, fontSize: 13, fontWeight: "700", marginLeft: "auto" }}>{fmt(b.amount)}</Text>
                      </View>
                    ))}
                  </View>
                );
              })()}
            </ScrollView>

            <TouchableOpacity onPress={() => setShowSplitBills(false)} activeOpacity={0.7}
              style={[s.sheetCancel, { backgroundColor: theme.surface, marginHorizontal: 0 }]}>
              <Text style={[s.cancelText, { color: theme.textSecondary }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },

  /* Profile */
  profileCard: { margin: 16, borderRadius: 14, borderWidth: 1, padding: 20 },
  profileTop: { flexDirection: "row", alignItems: "center", gap: 16 },
  avatar: { width: 56, height: 56, borderRadius: 28, justifyContent: "center", alignItems: "center" },
  avatarImg: { width: 56, height: 56, borderRadius: 28 },
  avatarLetter: { fontSize: 22, fontWeight: "700" },
  profileName: { fontSize: 17, fontWeight: "700" },
  profileEmail: { fontSize: 13, marginTop: 2 },
  profileMeta: { flexDirection: "row", alignItems: "center", marginTop: 16, paddingTop: 16, borderTopWidth: 1, gap: 8 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontSize: 12, fontWeight: "500" },
  metaDot: { width: 3, height: 3, borderRadius: 1.5 },

  /* Sections */
  sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1.5, marginTop: 24, marginBottom: 8, marginLeft: 20 },
  card: { marginHorizontal: 16, borderRadius: 14, overflow: "hidden", borderWidth: 1 },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 13, gap: 12 },
  rowIcon: { width: 34, height: 34, borderRadius: 9, justifyContent: "center", alignItems: "center" },
  rowTitle: { fontSize: 14, fontWeight: "600" },
  rowSub: { fontSize: 12, marginTop: 1 },
  sep: { height: 1, marginLeft: 62 },

  chipRow: { flexDirection: "row", gap: 5 },
  chip: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 7 },
  chipText: { fontSize: 11, fontWeight: "700" },

  budgetWrap: { flexDirection: "row", alignItems: "center", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  budgetSymbol: { fontWeight: "600", fontSize: 14, marginRight: 2 },
  budgetInput: { fontSize: 14, fontWeight: "700", width: 70, textAlign: "right", padding: 0, backgroundColor: "transparent" },

  /* Modal */
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  sheet: { width: 340, borderRadius: 14, paddingBottom: 16, zIndex: 10 },
  sheetHandle: { alignItems: "center", paddingTop: 12, paddingBottom: 4 },
  handleBar: { width: 36, height: 4, borderRadius: 2 },
  sheetTitle: { fontSize: 16, fontWeight: "700", paddingHorizontal: 20, marginTop: 8 },
  sheetSub: { fontSize: 13, paddingHorizontal: 20, marginTop: 4, marginBottom: 12 },
  rangeRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  rangeLabel: { flex: 1, fontSize: 14, fontWeight: "500" },
  sheetCancel: { marginHorizontal: 16, marginTop: 12, alignItems: "center", paddingVertical: 12, borderRadius: 10 },
  cancelText: { fontSize: 14, fontWeight: "600" },

  /* Category Budgets */
  catBudgetRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1 },
  catBudgetIcon: { width: 30, height: 30, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  catBudgetLabel: { flex: 1, fontSize: 13, fontWeight: "600" },
  catBudgetSave: { marginHorizontal: 16, marginTop: 12, alignItems: "center", paddingVertical: 12, borderRadius: 10 },
  catBudgetSaveText: { fontSize: 14, fontWeight: "700", color: "#fff" },

  /* Net Worth Tracker */
  nwSummary: { marginHorizontal: 16, borderRadius: 10, padding: 12, marginBottom: 8 },
  nwSummaryRow: { flexDirection: "row", justifyContent: "space-around" },
  nwSummaryItem: { alignItems: "center", gap: 2 },
  nwSummaryLabel: { fontSize: 11, fontWeight: "600" },
  nwSummaryVal: { fontSize: 15, fontWeight: "700" },
  nwNetRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, marginTop: 10, paddingTop: 10 },
  nwNetLabel: { fontSize: 14, fontWeight: "700" },
  nwNetVal: { fontSize: 18, fontWeight: "800" },
  nwForm: { paddingHorizontal: 16, marginBottom: 8 },
  nwInput: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontWeight: "500", marginBottom: 8 },
  nwFormRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  nwAccRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  nwAccBal: { fontSize: 13, fontWeight: "700", marginRight: 4 },
  nwAccAction: { padding: 4 },

  /* Year in Review / Wrapped */
  wrappedBg: { flex: 1, backgroundColor: "rgba(10,10,20,0.95)", justifyContent: "center", alignItems: "center", paddingHorizontal: 24 },
  wrappedClose: { position: "absolute", top: 56, right: 20, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center" },
  wrappedContent: { flex: 1, justifyContent: "center", alignItems: "center", width: "100%" },
  wrappedSlide: { alignItems: "center", gap: 16, paddingHorizontal: 16 },
  wrappedYear: { fontSize: 28, fontWeight: "800", color: "#fff", textAlign: "center", marginTop: 8 },
  wrappedBigNum: { fontSize: 48, fontWeight: "900", color: "#fff", textAlign: "center" },
  wrappedAmount: { fontSize: 30, fontWeight: "800", textAlign: "center" },
  wrappedHero: { fontSize: 36, fontWeight: "900", color: "#fff", textAlign: "center" },
  wrappedLabel: { fontSize: 15, color: "rgba(255,255,255,0.6)", textAlign: "center", fontWeight: "500" },
  wrappedDesc: { fontSize: 18, color: "rgba(255,255,255,0.8)", textAlign: "center", fontWeight: "600" },
  wrappedStatGroup: { alignItems: "center", marginTop: 12 },
  wrappedRow: { flexDirection: "row", gap: 32, marginTop: 20 },
  wrappedStatBox: { alignItems: "center", gap: 4 },
  wrappedSummaryRow: { gap: 24, marginTop: 12, alignItems: "center" },
  wrappedSummaryItem: { alignItems: "center", gap: 4 },
  wrappedDots: { flexDirection: "row", gap: 8, position: "absolute", bottom: 140, alignSelf: "center" },
  wrappedDot: { width: 8, height: 8, borderRadius: 4 },
  wrappedNext: { position: "absolute", bottom: 70, alignSelf: "center", paddingHorizontal: 48, paddingVertical: 16, borderRadius: 30 },
  wrappedNextText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
