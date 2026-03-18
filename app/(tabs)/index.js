import { useState, useEffect, useCallback, useRef } from "react";
import { View, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, Image, useWindowDimensions, Animated, Easing, Modal, Pressable, Alert } from "react-native";
import { Text, TextInput } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AreaChart from "../../lib/AreaChart";
import DonutChart from "../../lib/DonutChart";
import CalendarHeatmap from "../../lib/CalendarHeatmap";
import { useRouter, useFocusEffect } from "expo-router";
import { supabase } from "../../lib/supabase";
import { getMonthName } from "../../lib/helpers";
import { getCategoryById } from "../../lib/categories";
import { useTheme } from "../../lib/ThemeContext";
import { SkeletonBalance, SkeletonCard } from "../../lib/Skeleton";
import { getItem, setItem, KEYS } from "../../lib/storage";
import { useCurrency, fmtCurrency } from "../../lib/CurrencyContext";
import { detectBrand, getBrandLogoUrl } from "../../lib/brands";
import { fetchCryptoPrices, POPULAR_COINS } from "../../lib/crypto";
import { generateInsights } from "../../lib/spendingInsights";
import { getMerchantLogoUrl } from "../../lib/merchantLogos";

/* ── Animated counting number ── */
function AnimatedNumber({ value, formatter, style, duration = 800 }) {
  const [display, setDisplay] = useState(0);
  const animRef = useRef(null);
  const prevValue = useRef(0);

  useEffect(() => {
    const from = prevValue.current;
    const to = value;
    prevValue.current = to;
    if (from === to) { setDisplay(to); return; }
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplay(from + (to - from) * eased);
      if (progress < 1) animRef.current = requestAnimationFrame(animate);
    };
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [value, duration]);

  return <Text style={style}>{formatter ? formatter(Math.round(display)) : Math.round(display)}</Text>;
}

/* ── Fade-in + slide-up wrapper ── */
function FadeIn({ children, delay = 0, style }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 400, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

/* ── Budget section with animated bar ── */
function BudgetSection({ budget, expense, theme, fmt }) {
  const barWidth = useRef(new Animated.Value(0)).current;
  const pct = Math.min((expense / budget) * 100, 100);

  useEffect(() => {
    barWidth.setValue(0);
    Animated.timing(barWidth, { toValue: pct, duration: 1000, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [pct]);

  const widthInterp = barWidth.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] });
  const barColor = pct > 90 ? theme.red : pct > 70 ? theme.orange : theme.green;

  return (
    <View style={s.section}>
      <Text style={[s.sectionTitle, { color: theme.text }]}>Budget</Text>
      <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.surfaceBorder }]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 14 }}>
          <Text style={[s.label, { color: theme.textMuted }]}>Spent</Text>
          <View style={{ flexDirection: "row" }}>
            <AnimatedNumber value={expense} formatter={fmt} style={{ color: theme.text, fontWeight: "600", fontSize: 14 }} />
            <Text style={{ color: theme.textDim, fontWeight: "600", fontSize: 14 }}> / {fmt(budget)}</Text>
          </View>
        </View>
        <View style={[s.barBg, { backgroundColor: theme.surface }]}>
          <Animated.View style={[s.barFill, { width: widthInterp, backgroundColor: barColor }]} />
        </View>
        <Text style={[s.barHint, { color: theme.textMuted }]}>
          {expense >= budget ? "Budget exceeded" : `${fmt(budget - expense)} remaining`}
        </Text>
      </View>
    </View>
  );
}

export default function Dashboard() {
  const { theme } = useTheme();
  const { width: screenW } = useWindowDimensions();
  const chartW = Math.min(screenW, 420) - 72;
  const [txns, setTxns] = useState([]);
  const [allTxns, setAllTxns] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState("month");
  const [budget, setBudget] = useState(0);
  const [showValues, setShowValues] = useState(false);
  const { currency } = useCurrency();
  const fmt = (amt) => fmtCurrency(amt, currency);
  const masked = "\u2022\u2022\u2022\u2022\u2022\u2022";
  const router = useRouter();
  const [goals, setGoals] = useState([]);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalSaved, setGoalSaved] = useState("");
  const [editingGoal, setEditingGoal] = useState(null);
  const [showMore, setShowMore] = useState(false);
  const [heatmapMonth, setHeatmapMonth] = useState(new Date().getMonth());
  const [heatmapYear, setHeatmapYear] = useState(new Date().getFullYear());
  const moreRotation = useRef(new Animated.Value(0)).current;
  const [cryptoPrices, setCryptoPrices] = useState(null);

  useEffect(() => {
    fetchCryptoPrices().then(setCryptoPrices).catch(() => {});
  }, []);
  const [userId, setUserId] = useState(null);
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      const uKey = (key) => `${key}_${user.id}`;

      // Load user-scoped budget (with migration)
      let userBudget = await getItem(uKey(KEYS.BUDGET), null);
      if (userBudget === null) {
        userBudget = await getItem(KEYS.BUDGET, 0);
        await setItem(uKey(KEYS.BUDGET), userBudget);
      }
      setBudget(userBudget || 0);

      // Load user-scoped savings goals (with migration)
      let userGoals = await getItem(uKey(KEYS.SAVINGS_GOALS), null);
      if (userGoals === null) {
        const oldGoals = await getItem(KEYS.SAVINGS_GOALS, []);
        await setItem(uKey(KEYS.SAVINGS_GOALS), oldGoals);
        userGoals = oldGoals;
      }
      setGoals(userGoals);
    });
  }, []);

  const saveGoals = async (updated) => {
    setGoals(updated);
    if (userId) await setItem(`${KEYS.SAVINGS_GOALS}_${userId}`, updated);
    else await setItem(KEYS.SAVINGS_GOALS, updated);
  };

  const handleAddGoal = () => {
    if (!goalName.trim() || !goalTarget.trim()) return;
    const target = parseFloat(goalTarget);
    const saved = parseFloat(goalSaved) || 0;
    if (isNaN(target) || target <= 0) return;
    let updated;
    if (editingGoal) {
      updated = goals.map(g => g.id === editingGoal.id ? { ...g, saved: Math.min(saved, g.target) } : g);
    } else {
      updated = [...goals, { id: Date.now(), name: goalName.trim(), target, saved: Math.min(saved, target) }];
    }
    saveGoals(updated);
    setGoalName(""); setGoalTarget(""); setGoalSaved(""); setEditingGoal(null); setShowGoalModal(false);
  };

  const handleTapGoal = (goal) => {
    setEditingGoal(goal); setGoalName(goal.name); setGoalTarget(String(goal.target)); setGoalSaved(String(goal.saved));
    setShowGoalModal(true);
  };

  const handleDeleteGoal = (goal) => {
    Alert.alert("Delete Goal", `Remove "${goal.name}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => saveGoals(goals.filter(g => g.id !== goal.id)) },
    ]);
  };

  const fetch_ = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    let q = supabase.from("transactions").select("*").eq("user_id", user.id);
    if (period !== "all") {
      const now = new Date();
      let start;
      if (period === "week") start = new Date(now.getTime() - 7 * 86400000);
      else if (period === "month") start = new Date(now.getFullYear(), now.getMonth(), 1);
      else start = new Date(now.getFullYear(), 0, 1);
      q = q.gte("date", start.toISOString());
    }
    const { data } = await q.order("date", { ascending: false });
    setTxns(data || []);
    // Also fetch all transactions (unfiltered) for heatmap calendar
    const { data: all } = await supabase.from("transactions").select("*").eq("user_id", user.id).order("date", { ascending: false });
    setAllTxns(all || []);
    setIsLoading(false);
  }, [period]);

  useEffect(() => { fetch_(); }, [fetch_]);
  useFocusEffect(useCallback(() => { fetch_(); }, [fetch_]));
  const onRefresh = async () => { setRefreshing(true); await fetch_(); setRefreshing(false); };

  const income = txns.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expense = txns.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const balance = income - expense;

  const getTrendData = () => {
    const now = new Date();
    if (period === "week") {
      const days = [];
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000);
        days.push({ label: dayNames[d.getDay()], date: d.toISOString().split("T")[0] });
      }
      const sumByType = (type) => days.map(day =>
        txns.filter(t => new Date(t.date).toISOString().split("T")[0] === day.date && t.type === type)
          .reduce((s, t) => s + Number(t.amount), 0)
      );
      return { labels: days.map(d => d.label), income: sumByType("income"), expense: sumByType("expense") };
    }
    if (period === "month") {
      const weeks = [];
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      for (let w = 0; w < 5; w++) {
        const wStart = new Date(start.getTime() + w * 7 * 86400000);
        if (wStart.getMonth() !== now.getMonth() && w > 0) break;
        const wEnd = new Date(wStart.getTime() + 6 * 86400000);
        weeks.push({ label: `W${w + 1}`, start: wStart, end: wEnd });
      }
      const sumByType = (type) => weeks.map(w =>
        txns.filter(t => { const d = new Date(t.date); return d >= w.start && d <= w.end && t.type === type; })
          .reduce((s, t) => s + Number(t.amount), 0)
      );
      return { labels: weeks.map(w => w.label), income: sumByType("income"), expense: sumByType("expense") };
    }
    let monthCount = period === "year" ? 12 : 12;
    if (period === "all" && txns.length > 0) {
      const oldest = new Date(txns[txns.length - 1].date);
      monthCount = Math.min((now.getFullYear() - oldest.getFullYear()) * 12 + (now.getMonth() - oldest.getMonth()) + 1, 24);
      monthCount = Math.max(monthCount, 3);
    }
    const ms = [];
    for (let i = monthCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      ms.push({ label: getMonthName(d.getMonth()), y: d.getFullYear(), m: d.getMonth() });
    }
    const sumByType = (type) => ms.map(m =>
      txns.filter(t => { const d = new Date(t.date); return d.getMonth() === m.m && d.getFullYear() === m.y && t.type === type; })
        .reduce((s, t) => s + Number(t.amount), 0)
    );
    // Show only every Nth label to avoid congestion (max ~6-7 labels visible)
    const maxLabels = 7;
    const step = ms.length > maxLabels ? Math.ceil(ms.length / maxLabels) : 1;
    const labels = ms.map((m, i) => i % step === 0 || i === ms.length - 1 ? m.label : "");
    return { labels, income: sumByType("income"), expense: sumByType("expense") };
  };

  const getCatData = () => {
    const tots = {};
    txns.filter(t => t.type === "expense").forEach(t => { tots[t.category] = (tots[t.category] || 0) + Number(t.amount); });
    return Object.entries(tots).sort(([,a],[,b]) => b - a).slice(0, 6).map(([id, amt]) => {
      const cat = getCategoryById(id);
      return { label: cat.label, value: amt, color: cat.color, id };
    });
  };

  // Smart spending insights
  const getInsights = () => {
    const insights = [];
    const expenses = txns.filter(t => t.type === "expense");
    const incomes = txns.filter(t => t.type === "income");
    if (!expenses.length) return insights;

    // Top spending category
    const catTotals = {};
    expenses.forEach(t => { catTotals[t.category] = (catTotals[t.category] || 0) + Number(t.amount); });
    const sorted = Object.entries(catTotals).sort(([,a],[,b]) => b - a);
    if (sorted.length > 0) {
      const topCat = getCategoryById(sorted[0][0]);
      const topPct = Math.round((sorted[0][1] / expense) * 100);
      insights.push({ icon: "fire", color: "#FB923C", text: `${topCat.label} is your #1 expense at ${topPct}%` });
    }

    // Savings rate
    if (income > 0) {
      const savingsRate = Math.round(((income - expense) / income) * 100);
      if (savingsRate > 0) insights.push({ icon: "piggy-bank", color: "#4ADE80", text: `You're saving ${savingsRate}% of your income` });
      else insights.push({ icon: "alert-circle", color: "#F87171", text: `You're overspending by ${fmt(expense - income)}` });
    }

    // Average daily spend
    const days = period === "week" ? 7 : period === "month" ? new Date().getDate() : period === "year" ? Math.ceil((new Date() - new Date(new Date().getFullYear(), 0, 1)) / 86400000) : 30;
    const dailyAvg = Math.round(expense / Math.max(days, 1));
    insights.push({ icon: "calendar-clock", color: "#60A5FA", text: `Avg daily spend: ${fmt(dailyAvg)}` });

    // Transaction count
    const txCount = expenses.length;
    insights.push({ icon: "receipt", color: "#A78BFA", text: `${txCount} expense${txCount > 1 ? "s" : ""} in this period` });

    return insights.slice(0, 4);
  };

  // Recurring transactions detection
  const getRecurring = () => {
    const descMap = {};
    txns.filter(t => t.type === "expense").forEach(t => {
      const key = (t.description || "").toLowerCase().trim();
      if (!key) return;
      if (!descMap[key]) descMap[key] = { count: 0, total: 0, lastAmt: 0, description: t.description, category: t.category };
      descMap[key].count++;
      descMap[key].total += Number(t.amount);
      descMap[key].lastAmt = Number(t.amount);
    });
    return Object.values(descMap).filter(d => d.count >= 2).sort((a, b) => b.count - a.count).slice(0, 4);
  };

  // Gamification badges
  const getBadges = () => {
    const badges = [];
    const expenses = txns.filter(t => t.type === "expense");
    const incomes = txns.filter(t => t.type === "income");
    const totalTx = txns.length;

    // First transaction
    if (totalTx >= 1) badges.push({ icon: "star", color: "#FBBF24", label: "First Step", desc: "Added first transaction" });
    // 10 transactions
    if (totalTx >= 10) badges.push({ icon: "fire", color: "#FB923C", label: "Active User", desc: "10+ transactions" });
    // 50 transactions
    if (totalTx >= 50) badges.push({ icon: "trophy", color: "#A78BFA", label: "Power User", desc: "50+ transactions" });
    // Saver - income > expense
    if (income > expense && income > 0) badges.push({ icon: "piggy-bank", color: "#4ADE80", label: "Smart Saver", desc: "Income exceeds expenses" });
    // Budget set
    if (budget > 0) badges.push({ icon: "shield-check", color: "#60A5FA", label: "Budget Master", desc: "Budget is set" });
    // Under budget
    if (budget > 0 && expense < budget) badges.push({ icon: "medal", color: "#2DD4BF", label: "Under Budget", desc: "Staying within limits" });
    // Diversified - 3+ categories used
    const cats = new Set(expenses.map(t => t.category));
    if (cats.size >= 3) badges.push({ icon: "chart-pie", color: "#F472B6", label: "Diversified", desc: "3+ spending categories" });
    // Early bird - transaction before 9am
    if (txns.some(t => new Date(t.date).getHours() < 9)) badges.push({ icon: "weather-sunny", color: "#FBBF24", label: "Early Bird", desc: "Transaction before 9 AM" });

    return badges;
  };

  // Budget streak (days under budget in current month)
  const getBudgetStreak = () => {
    if (!budget) return 0;
    const now = new Date();
    const dailyBudget = budget / 30;
    let streak = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dayStr = d.toISOString().split("T")[0];
      const dayExpense = txns.filter(t => t.type === "expense" && new Date(t.date).toISOString().split("T")[0] === dayStr)
        .reduce((s, t) => s + Number(t.amount), 0);
      if (dayExpense <= dailyBudget) streak++;
      else break;
    }
    return streak;
  };

  // Spending prediction / forecast
  const getAnomalies = () => {
    const anomalies = [];
    const expenses = txns.filter(t => t.type === "expense");
    if (expenses.length < 2) return anomalies;

    // Category averages for current period
    const catTxns = {};
    expenses.forEach(t => {
      const cat = t.category;
      if (!catTxns[cat]) catTxns[cat] = [];
      catTxns[cat].push(Number(t.amount));
    });

    // Flag individual transactions > 2.5x category average
    Object.entries(catTxns).forEach(([catId, amounts]) => {
      if (amounts.length < 2) return;
      const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      amounts.forEach(amt => {
        if (amt > avg * 2.5) {
          const cat = getCategoryById(catId);
          const ratio = Math.round(amt / avg);
          anomalies.push({
            icon: "alert-circle-outline",
            color: "#EF4444",
            text: `Unusual: ${cat.label} expense of ${fmt(amt)} (${ratio}x your average)`,
            type: "spike",
          });
        }
      });
    });

    // Period-over-period comparison per category
    const now = new Date();
    let prevStart, prevEnd;
    if (period === "week") {
      prevEnd = new Date(now.getTime() - 7 * 86400000);
      prevStart = new Date(prevEnd.getTime() - 7 * 86400000);
    } else if (period === "month") {
      const pm = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      const py = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      prevStart = new Date(py, pm, 1);
      prevEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (period === "year") {
      prevStart = new Date(now.getFullYear() - 1, 0, 1);
      prevEnd = new Date(now.getFullYear() - 1, 11, 31);
    } else {
      prevStart = null;
    }

    if (prevStart) {
      const prevExpenses = txns.filter(t => {
        if (t.type !== "expense") return false;
        const d = new Date(t.date);
        return d >= prevStart && d <= prevEnd;
      });
      const prevCatTotals = {};
      prevExpenses.forEach(t => {
        prevCatTotals[t.category] = (prevCatTotals[t.category] || 0) + Number(t.amount);
      });
      const currCatTotals = {};
      expenses.forEach(t => {
        currCatTotals[t.category] = (currCatTotals[t.category] || 0) + Number(t.amount);
      });
      Object.entries(currCatTotals).forEach(([catId, currTotal]) => {
        const prevTotal = prevCatTotals[catId];
        if (prevTotal && prevTotal > 0) {
          const increase = ((currTotal - prevTotal) / prevTotal) * 100;
          if (increase >= 50) {
            const cat = getCategoryById(catId);
            anomalies.push({
              icon: "trending-up",
              color: "#F97316",
              text: `${cat.label} spending is ${Math.round(increase)}% higher than last ${period === "week" ? "week" : period === "month" ? "month" : "year"}`,
              type: "surge",
            });
          }
        }
      });
    }

    return anomalies.slice(0, 3);
  };

  const getSpendingPrediction = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysLeft = daysInMonth - dayOfMonth;

    // Current month expenses from all txns (not just filtered)
    const currentMonthExpenses = txns.filter(t => {
      if (t.type !== "expense") return false;
      const d = new Date(t.date);
      return d.getFullYear() === year && d.getMonth() === month;
    });
    const currentTotal = currentMonthExpenses.reduce((s, t) => s + Number(t.amount), 0);
    if (currentTotal === 0 || dayOfMonth === 0) return null;

    const avgDaily = currentTotal / dayOfMonth;
    const projectedMonthEnd = Math.round(avgDaily * daysInMonth);

    // Last month total from txns data
    const lastMonth = month === 0 ? 11 : month - 1;
    const lastMonthYear = month === 0 ? year - 1 : year;
    const lastMonthTotal = txns.filter(t => {
      if (t.type !== "expense") return false;
      const d = new Date(t.date);
      return d.getFullYear() === lastMonthYear && d.getMonth() === lastMonth;
    }).reduce((s, t) => s + Number(t.amount), 0);

    // Trend compared to last month
    let trend = "neutral";
    if (lastMonthTotal > 0) {
      const pctChange = ((projectedMonthEnd - lastMonthTotal) / lastMonthTotal) * 100;
      trend = pctChange > 5 ? "up" : pctChange < -5 ? "down" : "neutral";
    }

    return { projectedMonthEnd, avgDaily: Math.round(avgDaily), daysLeft, lastMonthTotal, trend };
  };

  const TxItem = ({ t, isLast }) => {
    const cat = getCategoryById(t.category);
    const brand = detectBrand(t.description);
    const logoUrl = brand ? getBrandLogoUrl(brand.domain) : getMerchantLogoUrl(t.description);
    const iconColor = brand?.color || cat.color;
    const initial = brand?.name?.[0] || (t.description || cat.label)[0]?.toUpperCase() || "?";

    return (
      <View style={[s.txRow, !isLast && { borderBottomWidth: 1, borderBottomColor: theme.divider }]}>
        <View style={[s.txIcon, { backgroundColor: iconColor + "12" }]}>
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={s.txLogo} resizeMode="contain" onError={() => {}} />
          ) : (
            <Text style={{ color: iconColor, fontWeight: "700", fontSize: 15 }}>{initial}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.txDesc, { color: theme.text }]} numberOfLines={1}>
            {brand?.name || t.description || cat.label}
          </Text>
          <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 2 }}>{cat.label}</Text>
        </View>
        <Text style={[s.txAmt, { color: t.type === "income" ? theme.green : theme.red }]}>
          {t.type === "income" ? "+" : "-"} {fmt(t.amount)}
        </Text>
      </View>
    );
  };

  return (
    <ScrollView style={[s.container, { backgroundColor: theme.bg }]} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}>

      {isLoading && (
        <View>
          <SkeletonBalance />
          <View style={{ marginTop: 16, paddingHorizontal: 16 }}>
            <SkeletonCard /><SkeletonCard /><SkeletonCard />
          </View>
        </View>
      )}

      {!isLoading && (
        <>
          {/* Balance Card */}
          <View style={s.balanceWrap}>
            <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.surfaceBorder, padding: 20 }]}>
              <View style={s.balanceHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={[s.label, { color: theme.textMuted, letterSpacing: 1 }]}>TOTAL BALANCE</Text>
                  <TouchableOpacity onPress={() => setShowValues(!showValues)} activeOpacity={0.6} hitSlop={8}>
                    <MaterialCommunityIcons
                      name={showValues ? "eye-outline" : "eye-off-outline"}
                      size={16} color={theme.textMuted} />
                  </TouchableOpacity>
                </View>
                <View style={s.periodRow}>
                  {["week", "month", "year", "all"].map(p => (
                    <TouchableOpacity key={p} onPress={() => setPeriod(p)}
                      style={[s.periodBtn, { backgroundColor: theme.surface }, period === p && { backgroundColor: theme.accent }]}>
                      <Text style={[s.periodText, { color: theme.textMuted }, period === p && { color: "#fff" }]}>
                        {p === "week" ? "7D" : p === "month" ? "1M" : p === "year" ? "1Y" : "All"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {showValues
                ? <AnimatedNumber value={balance} formatter={fmt} style={[s.balanceAmt, { color: theme.text }]} />
                : <Text style={[s.balanceAmt, { color: theme.text, letterSpacing: 4 }]}>{masked}</Text>
              }

              <View style={[s.balanceStats, { borderTopColor: theme.divider }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.label, { color: theme.textMuted }]}>Income</Text>
                  {showValues
                    ? <AnimatedNumber value={income} formatter={fmt} style={[s.statAmt, { color: theme.green }]} />
                    : <Text style={[s.statAmt, { color: theme.green, letterSpacing: 3 }]}>{masked}</Text>
                  }
                </View>
                <View style={[s.statDivider, { backgroundColor: theme.divider }]} />
                <View style={{ flex: 1, alignItems: "flex-end" }}>
                  <Text style={[s.label, { color: theme.textMuted }]}>Expense</Text>
                  {showValues
                    ? <AnimatedNumber value={expense} formatter={fmt} style={[s.statAmt, { color: theme.red }]} />
                    : <Text style={[s.statAmt, { color: theme.red, letterSpacing: 3 }]}>{masked}</Text>
                  }
                </View>
              </View>
            </View>
          </View>

          {/* Quick Actions */}
          <View style={s.actionsRow}>
            {[
              { icon: "arrow-up", label: "Send", onPress: () => router.push("/(tabs)/add") },
              { icon: "arrow-down", label: "Receive", onPress: () => router.push("/(tabs)/add") },
              { icon: "file-import-outline", label: "Import", onPress: () => router.push("/(tabs)/import") },
              { icon: "file-export-outline", label: "Export", onPress: () => router.push("/(tabs)/settings") },
            ].map((a, i) => (
              <TouchableOpacity key={i} onPress={a.onPress} style={s.actionItem} activeOpacity={0.7}>
                <View style={[s.actionIcon, { backgroundColor: theme.surface }]}>
                  <MaterialCommunityIcons name={a.icon} size={20} color={theme.textSecondary} />
                </View>
                <Text style={[s.actionLabel, { color: theme.textMuted }]}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Trend Chart */}
          {txns.length > 0 && (() => {
            const trend = getTrendData();
            return (
              <FadeIn style={s.section}>
                <Text style={[s.sectionTitle, { color: theme.text }]}>Trend</Text>
                <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.surfaceBorder, padding: 14 }]}>
                  <AreaChart
                    labels={trend.labels}
                    series={[
                      { data: trend.income, color: theme.green, label: "Income" },
                      { data: trend.expense, color: theme.red, label: "Expense" },
                    ]}
                    width={chartW}
                    height={200}
                    theme={theme}
                  />
                </View>
              </FadeIn>
            );
          })()}

          {/* Category Donut */}
          {getCatData().length > 0 && (
            <FadeIn delay={100} style={s.section}>
              <Text style={[s.sectionTitle, { color: theme.text }]}>Spending Breakdown</Text>
              <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.surfaceBorder, padding: 20, alignItems: "center" }]}>
                <DonutChart
                  data={getCatData()}
                  size={170}
                  stroke={26}
                  theme={theme}
                  centerValue={fmt(expense)}
                  centerLabel="Total"
                />
              </View>
            </FadeIn>
          )}

          {/* Crypto Prices */}
          {cryptoPrices && (
            <FadeIn delay={120} style={s.section}>
              <Text style={[s.sectionTitle, { color: theme.text }]}>Crypto Prices</Text>
              <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.surfaceBorder }]}>
                {POPULAR_COINS.map((coin, i) => {
                  const data = cryptoPrices[coin.id];
                  if (!data) return null;
                  const change = data.change24h || 0;
                  const isUp = change >= 0;
                  return (
                    <View key={coin.id} style={[s.insightRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.divider }]}>
                      <View style={[s.insightIcon, { backgroundColor: (isUp ? theme.green : theme.red) + "18" }]}>
                        <Text style={{ fontSize: 16 }}>{coin.symbol === "BTC" ? "\u20BF" : coin.symbol === "ETH" ? "\u039E" : coin.symbol[0]}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.text, fontWeight: "600", fontSize: 14 }}>{coin.name}</Text>
                        <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 2 }}>{coin.symbol}</Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ color: theme.text, fontWeight: "700", fontSize: 14 }}>
                          ${data.price >= 1 ? data.price.toLocaleString("en-US", { maximumFractionDigits: 2 }) : data.price.toFixed(4)}
                        </Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 }}>
                          <MaterialCommunityIcons name={isUp ? "arrow-up" : "arrow-down"} size={12} color={isUp ? theme.green : theme.red} />
                          <Text style={{ color: isUp ? theme.green : theme.red, fontSize: 11, fontWeight: "600" }}>
                            {Math.abs(change).toFixed(2)}%
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </FadeIn>
          )}

          {/* AI Spending Insights */}
          {txns.length > 2 && (() => {
            const aiInsights = generateInsights(txns, fmt);
            return aiInsights.length > 0 && (
              <FadeIn delay={140} style={s.section}>
                <Text style={[s.sectionTitle, { color: theme.text }]}>AI Insights</Text>
                <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.surfaceBorder }]}>
                  {aiInsights.map((ins, i) => (
                    <View key={i} style={[s.insightRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.divider }]}>
                      <View style={[s.insightIcon, { backgroundColor: ins.color + "18" }]}>
                        <MaterialCommunityIcons name={ins.icon} size={18} color={ins.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.text, fontWeight: "700", fontSize: 13 }}>{ins.title}</Text>
                        <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 2, lineHeight: 17 }}>{ins.text}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </FadeIn>
            );
          })()}

          {/* ─── More Insights Toggle ─── */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              const next = !showMore;
              setShowMore(next);
              Animated.timing(moreRotation, { toValue: next ? 1 : 0, duration: 250, useNativeDriver: true }).start();
            }}
            style={[s.moreToggle, { borderColor: theme.surfaceBorder, backgroundColor: theme.card }]}
          >
            <MaterialCommunityIcons name="lightning-bolt" size={16} color={theme.accent} />
            <Text style={{ color: theme.text, fontWeight: "700", fontSize: 13, flex: 1 }}>
              {showMore ? "Hide Insights" : "More Insights"}
            </Text>
            <Animated.View style={{ transform: [{ rotate: moreRotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] }) }] }}>
              <MaterialCommunityIcons name="chevron-down" size={20} color={theme.textMuted} />
            </Animated.View>
          </TouchableOpacity>

          {/* ─── Collapsible Secondary Sections ─── */}
          {showMore && (
            <>
              {/* Smart Insights */}
              {(() => {
                const insights = getInsights();
                return insights.length > 0 && (
                  <FadeIn style={s.section}>
                    <Text style={[s.sectionTitle, { color: theme.text }]}>Insights</Text>
                    <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.surfaceBorder }]}>
                      {insights.map((ins, i) => (
                        <View key={i} style={[s.insightRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.divider }]}>
                          <View style={[s.insightIcon, { backgroundColor: ins.color + "18" }]}>
                            <MaterialCommunityIcons name={ins.icon} size={18} color={ins.color} />
                          </View>
                          <Text style={[s.insightText, { color: theme.text }]}>{ins.text}</Text>
                        </View>
                      ))}
                    </View>
                  </FadeIn>
                );
              })()}

              {/* Alerts */}
              {(() => {
                const anomalies = getAnomalies();
                return anomalies.length > 0 && (
                  <FadeIn style={s.section}>
                    <Text style={[s.sectionTitle, { color: theme.text }]}>Alerts</Text>
                    <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.surfaceBorder }]}>
                      {anomalies.map((a, i) => (
                        <View key={i} style={[s.insightRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.divider }]}>
                          <View style={[s.insightIcon, { backgroundColor: a.color + "18" }]}>
                            <MaterialCommunityIcons name={a.icon} size={18} color={a.color} />
                          </View>
                          <Text style={[s.insightText, { color: theme.text }]}>{a.text}</Text>
                        </View>
                      ))}
                    </View>
                  </FadeIn>
                );
              })()}

              {/* Forecast */}
              {(() => {
                const prediction = getSpendingPrediction();
                if (!prediction) return null;
                const { projectedMonthEnd, avgDaily, daysLeft, lastMonthTotal, trend } = prediction;
                const trendPct = lastMonthTotal > 0 ? Math.abs(Math.round(((projectedMonthEnd - lastMonthTotal) / lastMonthTotal) * 100)) : 0;
                const budgetStatus = budget > 0
                  ? projectedMonthEnd > budget ? "over" : projectedMonthEnd > budget * 0.9 ? "close" : "under"
                  : null;
                const statusColor = budgetStatus === "over" ? theme.red : budgetStatus === "close" ? theme.orange : theme.green;
                const statusLabel = budgetStatus === "over" ? "Over budget" : budgetStatus === "close" ? "On track (tight)" : "Under budget";
                const trendIcon = trend === "up" ? "arrow-up" : trend === "down" ? "arrow-down" : "minus";
                const trendColor = trend === "up" ? theme.red : trend === "down" ? theme.green : theme.textMuted;

                return (
                  <FadeIn style={s.section}>
                    <Text style={[s.sectionTitle, { color: theme.text }]}>Forecast</Text>
                    <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.surfaceBorder, padding: 16 }]}>
                      <View style={s.forecastRow}>
                        <View style={[s.insightIcon, { backgroundColor: theme.accent + "18" }]}>
                          <MaterialCommunityIcons name="crystal-ball" size={18} color={theme.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: "600" }}>Projected month-end</Text>
                          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800", marginTop: 2 }}>{fmt(projectedMonthEnd)}</Text>
                        </View>
                        {budgetStatus && (
                          <View style={[s.forecastBadge, { backgroundColor: statusColor + "18" }]}>
                            <Text style={{ color: statusColor, fontSize: 11, fontWeight: "700" }}>{statusLabel}</Text>
                          </View>
                        )}
                      </View>
                      <View style={[s.forecastDivider, { backgroundColor: theme.divider }]} />
                      <View style={s.forecastStats}>
                        <View style={{ flex: 1, alignItems: "center" }}>
                          <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: "600" }}>Avg / day</Text>
                          <Text style={{ color: theme.text, fontSize: 14, fontWeight: "700", marginTop: 4 }}>{fmt(avgDaily)}</Text>
                        </View>
                        <View style={{ width: 1, height: 28, backgroundColor: theme.divider }} />
                        <View style={{ flex: 1, alignItems: "center" }}>
                          <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: "600" }}>Days left</Text>
                          <Text style={{ color: theme.text, fontSize: 14, fontWeight: "700", marginTop: 4 }}>{daysLeft}</Text>
                        </View>
                        {lastMonthTotal > 0 && (
                          <>
                            <View style={{ width: 1, height: 28, backgroundColor: theme.divider }} />
                            <View style={{ flex: 1, alignItems: "center" }}>
                              <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: "600" }}>vs last month</Text>
                              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, gap: 3 }}>
                                <MaterialCommunityIcons name={trendIcon} size={14} color={trendColor} />
                                <Text style={{ color: trendColor, fontSize: 14, fontWeight: "700" }}>{trendPct}%</Text>
                              </View>
                            </View>
                          </>
                        )}
                      </View>
                    </View>
                  </FadeIn>
                );
              })()}

              {/* Budget + Streak */}
              {budget > 0 && (
                <View>
                  <BudgetSection budget={budget} expense={expense} theme={theme} fmt={fmt} />
                  {(() => {
                    const streak = getBudgetStreak();
                    return streak > 0 && (
                      <View style={[s.streakBadge, { marginHorizontal: 16, marginTop: 8 }]}>
                        <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.surfaceBorder, flexDirection: "row", alignItems: "center", padding: 14, gap: 12 }]}>
                          <View style={[s.insightIcon, { backgroundColor: "#FBBF24" + "18" }]}>
                            <MaterialCommunityIcons name="fire" size={20} color="#FBBF24" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: theme.text, fontWeight: "700", fontSize: 14 }}>{streak} day streak</Text>
                            <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 2 }}>Under daily budget</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })()}
                </View>
              )}

              {/* Savings Goals */}
              <FadeIn delay={120} style={s.section}>
                <View style={s.sectionHeader}>
                  <Text style={[s.sectionTitle, { color: theme.text, marginBottom: 0 }]}>Savings Goals</Text>
                  <TouchableOpacity onPress={() => { setEditingGoal(null); setGoalName(""); setGoalTarget(""); setGoalSaved(""); setShowGoalModal(true); }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <MaterialCommunityIcons name="plus-circle-outline" size={16} color={theme.accent} />
                      <Text style={{ color: theme.accent, fontWeight: "600", fontSize: 13 }}>Add Goal</Text>
                    </View>
                  </TouchableOpacity>
                </View>
                {goals.length > 0 ? (
                  <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.surfaceBorder }]}>
                    {goals.map((goal, i) => {
                      const pct = Math.min(Math.round((goal.saved / goal.target) * 100), 100);
                      const barColor = pct >= 100 ? theme.green : pct >= 50 ? theme.accent : theme.orange;
                      return (
                        <Pressable
                          key={goal.id}
                          onPress={() => handleTapGoal(goal)}
                          onLongPress={() => handleDeleteGoal(goal)}
                          style={[s.goalRow, i < goals.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.divider }]}
                        >
                          <View style={[s.goalIcon, { backgroundColor: barColor + "18" }]}>
                            <MaterialCommunityIcons name={pct >= 100 ? "check-circle" : "flag-variant"} size={18} color={barColor} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                              <Text style={{ color: theme.text, fontWeight: "600", fontSize: 14 }} numberOfLines={1}>{goal.name}</Text>
                              <Text style={{ color: theme.textMuted, fontSize: 12, fontWeight: "600" }}>{pct}%</Text>
                            </View>
                            <View style={[s.goalBarBg, { backgroundColor: theme.surface, marginTop: 8 }]}>
                              <View style={[s.goalBarFill, { width: `${pct}%`, backgroundColor: barColor }]} />
                            </View>
                            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                              <Text style={{ color: theme.textMuted, fontSize: 11 }}>{fmt(goal.saved)} saved</Text>
                              <Text style={{ color: theme.textMuted, fontSize: 11 }}>{fmt(goal.target)}</Text>
                            </View>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.surfaceBorder, alignItems: "center", paddingVertical: 30 }]}>
                    <MaterialCommunityIcons name="piggy-bank-outline" size={36} color={theme.textDim} />
                    <Text style={{ color: theme.textMuted, marginTop: 10, fontWeight: "600", fontSize: 13 }}>No savings goals yet</Text>
                    <TouchableOpacity onPress={() => { setEditingGoal(null); setGoalName(""); setGoalTarget(""); setGoalSaved(""); setShowGoalModal(true); }}
                      style={[s.emptyBtn, { backgroundColor: theme.accent + "12" }]}>
                      <Text style={{ color: theme.accent, fontWeight: "600", fontSize: 13 }}>Create one</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </FadeIn>

              {/* Recurring Transactions */}
              {(() => {
                const recurring = getRecurring();
                return recurring.length > 0 && (
                  <FadeIn delay={150} style={s.section}>
                    <Text style={[s.sectionTitle, { color: theme.text }]}>Recurring</Text>
                    <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.surfaceBorder }]}>
                      {recurring.map((r, i) => {
                        const cat = getCategoryById(r.category);
                        return (
                          <View key={i} style={[s.txRow, i < recurring.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.divider }]}>
                            <View style={[s.txIcon, { backgroundColor: cat.color + "12" }]}>
                              <MaterialCommunityIcons name={cat.icon} size={18} color={cat.color} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[s.txDesc, { color: theme.text }]} numberOfLines={1}>{r.description}</Text>
                              <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 2 }}>{r.count}x · {fmt(r.lastAmt)} each</Text>
                            </View>
                            <Text style={{ color: theme.red, fontWeight: "700", fontSize: 13 }}>- {fmt(r.total)}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </FadeIn>
                );
              })()}

              {/* Badges */}
              {(() => {
                const badges = getBadges();
                return badges.length > 0 && (
                  <FadeIn delay={160} style={s.section}>
                    <Text style={[s.sectionTitle, { color: theme.text }]}>Badges</Text>
                    <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.surfaceBorder, padding: 12 }]}>
                      <View style={s.badgesGrid}>
                        {badges.map((b, i) => (
                          <View key={i} style={[s.badgeItem, { backgroundColor: b.color + "10" }]}>
                            <View style={[s.badgeIcon, { backgroundColor: b.color + "20" }]}>
                              <MaterialCommunityIcons name={b.icon} size={22} color={b.color} />
                            </View>
                            <Text style={[s.badgeLabel, { color: theme.text }]} numberOfLines={1}>{b.label}</Text>
                            <Text style={[s.badgeDesc, { color: theme.textMuted }]} numberOfLines={2}>{b.desc}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  </FadeIn>
                );
              })()}

              {/* Cash Flow Calendar */}
              <FadeIn delay={200} style={s.section}>
                <Text style={[s.sectionTitle, { color: theme.text }]}>Cash Flow Calendar</Text>
                <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.surfaceBorder, padding: 14, alignItems: "center" }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", marginBottom: 8 }}>
                    <TouchableOpacity onPress={() => {
                      if (heatmapMonth === 0) { setHeatmapMonth(11); setHeatmapYear(heatmapYear - 1); }
                      else setHeatmapMonth(heatmapMonth - 1);
                    }} activeOpacity={0.6} style={{ padding: 6 }}>
                      <MaterialCommunityIcons name="chevron-left" size={22} color={theme.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setHeatmapMonth(new Date().getMonth()); setHeatmapYear(new Date().getFullYear()); }} activeOpacity={0.7}>
                      <Text style={{ color: theme.text, fontSize: 14, fontWeight: "700" }}>
                        {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][heatmapMonth]} {heatmapYear}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => {
                      if (heatmapMonth === 11) { setHeatmapMonth(0); setHeatmapYear(heatmapYear + 1); }
                      else setHeatmapMonth(heatmapMonth + 1);
                    }} activeOpacity={0.6} style={{ padding: 6 }}>
                      <MaterialCommunityIcons name="chevron-right" size={22} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <CalendarHeatmap
                    data={(() => {
                      const map = {};
                      allTxns.forEach((t) => {
                        const d = new Date(t.date).toISOString().split("T")[0];
                        if (!map[d]) map[d] = { date: d, income: 0, expense: 0 };
                        if (t.type === "income") map[d].income += Number(t.amount);
                        else map[d].expense += Number(t.amount);
                      });
                      return Object.values(map);
                    })()}
                    month={heatmapMonth}
                    year={heatmapYear}
                    theme={theme}
                    size={Math.min(screenW, 420) - 72}
                    currencyFormatter={fmt}
                  />
                </View>
              </FadeIn>
            </>
          )}

          {/* Goal Modal */}
          <Modal visible={showGoalModal} transparent animationType="fade" onRequestClose={() => setShowGoalModal(false)}>
            <Pressable style={s.modalOverlay} onPress={() => setShowGoalModal(false)}>
              <Pressable style={[s.modalContent, { backgroundColor: theme.card, borderColor: theme.surfaceBorder }]} onPress={e => e.stopPropagation()}>
                <Text style={{ color: theme.text, fontSize: 18, fontWeight: "700", marginBottom: 16 }}>
                  {editingGoal ? "Update Saved Amount" : "New Savings Goal"}
                </Text>
                {!editingGoal && (
                  <TextInput
                    label="Goal name"
                    value={goalName}
                    onChangeText={setGoalName}
                    mode="outlined"
                    style={s.modalInput}
                    outlineColor={theme.surfaceBorder}
                    activeOutlineColor={theme.accent}
                    textColor={theme.text}
                    theme={{ colors: { onSurfaceVariant: theme.textMuted } }}
                  />
                )}
                {!editingGoal && (
                  <TextInput
                    label="Target amount"
                    value={goalTarget}
                    onChangeText={setGoalTarget}
                    mode="outlined"
                    keyboardType="numeric"
                    style={s.modalInput}
                    outlineColor={theme.surfaceBorder}
                    activeOutlineColor={theme.accent}
                    textColor={theme.text}
                    theme={{ colors: { onSurfaceVariant: theme.textMuted } }}
                  />
                )}
                <TextInput
                  label={editingGoal ? "Saved amount" : "Already saved (optional)"}
                  value={goalSaved}
                  onChangeText={setGoalSaved}
                  mode="outlined"
                  keyboardType="numeric"
                  style={s.modalInput}
                  outlineColor={theme.surfaceBorder}
                  activeOutlineColor={theme.accent}
                  textColor={theme.text}
                  theme={{ colors: { onSurfaceVariant: theme.textMuted } }}
                />
                <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                  <TouchableOpacity onPress={() => setShowGoalModal(false)}
                    style={[s.modalBtn, { backgroundColor: theme.surface, flex: 1 }]}>
                    <Text style={{ color: theme.textMuted, fontWeight: "600", textAlign: "center" }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleAddGoal}
                    style={[s.modalBtn, { backgroundColor: theme.accent, flex: 1 }]}>
                    <Text style={{ color: "#fff", fontWeight: "600", textAlign: "center" }}>{editingGoal ? "Update" : "Save"}</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Pressable>
          </Modal>

          {/* Recent Transactions */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={[s.sectionTitle, { color: theme.text, marginBottom: 0 }]}>Transactions</Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/transactions")}>
                <Text style={{ color: theme.accent, fontWeight: "600", fontSize: 13 }}>See all</Text>
              </TouchableOpacity>
            </View>
            {txns.length > 0 ? (
              <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.surfaceBorder }]}>
                {txns.slice(0, 6).map((t, i) => (
                  <TxItem key={t.id} t={t} isLast={i === Math.min(txns.length, 6) - 1} />
                ))}
              </View>
            ) : (
              <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.surfaceBorder, alignItems: "center", paddingVertical: 40 }]}>
                <MaterialCommunityIcons name="wallet-outline" size={40} color={theme.textDim} />
                <Text style={{ color: theme.textMuted, marginTop: 12, fontWeight: "600", fontSize: 14 }}>No transactions yet</Text>
                <TouchableOpacity onPress={() => router.push("/(tabs)/add")}
                  style={[s.emptyBtn, { backgroundColor: theme.accent + "12" }]}>
                  <Text style={{ color: theme.accent, fontWeight: "600", fontSize: 13 }}>Add your first</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },

  /* Cards — unified */
  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },

  /* Balance */
  balanceWrap: { paddingHorizontal: 16, marginTop: 16 },
  balanceHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { fontSize: 11, fontWeight: "600" },
  periodRow: { flexDirection: "row", gap: 4 },
  periodBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  periodText: { fontSize: 11, fontWeight: "700" },
  balanceAmt: { fontSize: 30, fontWeight: "800", marginVertical: 10, letterSpacing: -0.5 },
  balanceStats: { flexDirection: "row", alignItems: "center", paddingTop: 16, marginTop: 8, borderTopWidth: 1 },
  statAmt: { fontSize: 15, fontWeight: "700", marginTop: 3 },
  statDivider: { width: 1, height: 32, marginHorizontal: 20 },

  /* Quick Actions */
  actionsRow: { flexDirection: "row", justifyContent: "space-around", paddingHorizontal: 16, marginTop: 24, marginBottom: 4 },
  actionItem: { alignItems: "center", gap: 8 },
  actionIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  actionLabel: { fontSize: 11, fontWeight: "600" },

  /* Sections */
  section: { marginTop: 24, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },

  /* Budget */
  barBg: { height: 6, borderRadius: 3, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3 },
  barHint: { fontSize: 12, marginTop: 8, textAlign: "center" },

  /* Insights */
  insightRow: { flexDirection: "row", alignItems: "center", paddingVertical: 13, paddingHorizontal: 16, gap: 12 },
  insightIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  insightText: { flex: 1, fontSize: 13, fontWeight: "600", lineHeight: 18 },

  /* Forecast */
  forecastRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  forecastBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  forecastDivider: { height: 1, marginVertical: 14 },
  forecastStats: { flexDirection: "row", alignItems: "center" },

  /* Streak */
  streakBadge: {},

  /* More Insights Toggle */
  moreToggle: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginTop: 24, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1 },

  /* Transactions */
  txRow: { flexDirection: "row", alignItems: "center", paddingVertical: 13, paddingHorizontal: 16, gap: 12 },
  txIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center", overflow: "hidden" },
  txLogo: { width: 24, height: 24, borderRadius: 4 },
  txDesc: { fontSize: 14, fontWeight: "600" },
  txAmt: { fontSize: 14, fontWeight: "700" },
  emptyBtn: { marginTop: 14, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },


  /* Badges */
  badgesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badgeItem: { width: 80, borderRadius: 14, padding: 10, alignItems: "center" },
  badgeIcon: { width: 38, height: 38, borderRadius: 12, justifyContent: "center", alignItems: "center", marginBottom: 6 },
  badgeLabel: { fontSize: 11, fontWeight: "700", textAlign: "center" },
  badgeDesc: { fontSize: 9, textAlign: "center", marginTop: 2, lineHeight: 12 },

  /* Savings Goals */
  goalRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, gap: 12 },
  goalIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  goalBarBg: { height: 5, borderRadius: 3, overflow: "hidden" },
  goalBarFill: { height: 5, borderRadius: 3 },

  /* Goal Modal */
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 24 },
  modalContent: { width: "100%", maxWidth: 380, borderRadius: 14, borderWidth: 1, padding: 20 },
  modalInput: { marginBottom: 12, backgroundColor: "transparent" },
  modalBtn: { paddingVertical: 12, borderRadius: 10 },
});
