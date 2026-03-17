import { useState, useEffect, useCallback } from "react";
import { View, ScrollView, StyleSheet, Dimensions, RefreshControl, TouchableOpacity } from "react-native";
import { Text } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { LineChart, PieChart } from "react-native-chart-kit";
import { supabase } from "../../lib/supabase";
import { formatCurrency, getMonthName } from "../../lib/helpers";
import { getCategoryById } from "../../lib/categories";
import { COLORS, SHADOWS, RADIUS } from "../../lib/theme";

const screenWidth = Dimensions.get("window").width;

export default function Dashboard() {
  const [transactions, setTransactions] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState("month");

  const fetchTransactions = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const now = new Date();
    let startDate;
    if (period === "week") startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    else if (period === "month") startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    else startDate = new Date(now.getFullYear(), 0, 1);
    const { data } = await supabase.from("transactions").select("*")
      .eq("user_id", user.id).gte("date", startDate.toISOString())
      .order("date", { ascending: false });
    setTransactions(data || []);
  }, [period]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const onRefresh = async () => { setRefreshing(true); await fetchTransactions(); setRefreshing(false); };

  const totalIncome = transactions.filter(t => t.type === "income").reduce((sum, t) => sum + Number(t.amount), 0);
  const totalExpense = transactions.filter(t => t.type === "expense").reduce((sum, t) => sum + Number(t.amount), 0);
  const balance = totalIncome - totalExpense;

  const getMonthlyData = () => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ month: getMonthName(d.getMonth()), year: d.getFullYear(), m: d.getMonth() });
    }
    return {
      labels: months.map(m => m.month),
      datasets: [
        { data: months.map(m => transactions.filter(t => { const td = new Date(t.date); return td.getMonth() === m.m && td.getFullYear() === m.year && t.type === "expense"; }).reduce((sum, t) => sum + Number(t.amount), 0) || 0), color: () => "#EF4444" },
        { data: months.map(m => transactions.filter(t => { const td = new Date(t.date); return td.getMonth() === m.m && td.getFullYear() === m.year && t.type === "income"; }).reduce((sum, t) => sum + Number(t.amount), 0) || 0), color: () => "#10B981" },
      ],
    };
  };

  const getCategoryData = () => {
    const categoryTotals = {};
    transactions.filter(t => t.type === "expense").forEach(t => {
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + Number(t.amount);
    });
    return Object.entries(categoryTotals).sort(([, a], [, b]) => b - a).slice(0, 5).map(([catId, amount]) => {
      const cat = getCategoryById(catId);
      return { name: cat.label, amount, color: cat.color, legendFontColor: COLORS.textSecondary, legendFontSize: 12 };
    });
  };

  const monthlyData = getMonthlyData();
  const categoryData = getCategoryData();

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
      showsVerticalScrollIndicator={false}
    >
      {/* Period Selector */}
      <View style={styles.periodRow}>
        {["week", "month", "year"].map(p => (
          <TouchableOpacity key={p} onPress={() => setPeriod(p)} activeOpacity={0.7}>
            {period === p ? (
              <LinearGradient colors={COLORS.gradientPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.periodChip}>
                <Text style={styles.periodTextActive}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
              </LinearGradient>
            ) : (
              <View style={[styles.periodChip, styles.periodInactive]}>
                <Text style={styles.periodText}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Balance Card */}
      <LinearGradient
        colors={balance >= 0 ? ["#6C63FF", "#A855F7"] : ["#EF4444", "#F97316"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.balanceCard}
      >
        <Text style={styles.balanceLabel}>Total Balance</Text>
        <Text style={styles.balanceAmount}>{formatCurrency(balance)}</Text>
        <View style={styles.balanceRow}>
          <View style={styles.balanceItem}>
            <View style={styles.balanceIconBg}>
              <Text style={{ fontSize: 14 }}>↑</Text>
            </View>
            <View>
              <Text style={styles.balanceItemLabel}>Income</Text>
              <Text style={styles.balanceItemAmount}>{formatCurrency(totalIncome)}</Text>
            </View>
          </View>
          <View style={styles.balanceDivider} />
          <View style={styles.balanceItem}>
            <View style={[styles.balanceIconBg, { backgroundColor: "rgba(239,68,68,0.3)" }]}>
              <Text style={{ fontSize: 14 }}>↓</Text>
            </View>
            <View>
              <Text style={styles.balanceItemLabel}>Expense</Text>
              <Text style={styles.balanceItemAmount}>{formatCurrency(totalExpense)}</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Monthly Trend Chart */}
      {transactions.length > 0 && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Monthly Trend</Text>
          <LineChart
            data={monthlyData}
            width={screenWidth - 72}
            height={200}
            chartConfig={{
              backgroundColor: "transparent",
              backgroundGradientFrom: COLORS.bgCard,
              backgroundGradientTo: COLORS.bgCard,
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(108, 99, 255, ${opacity})`,
              labelColor: () => COLORS.textMuted,
              propsForDots: { r: "5", strokeWidth: "2", stroke: COLORS.primary },
              propsForBackgroundLines: { strokeDasharray: "", stroke: COLORS.border },
              fillShadowGradient: COLORS.primary,
              fillShadowGradientOpacity: 0.1,
            }}
            bezier
            style={{ borderRadius: 16 }}
          />
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#EF4444" }]} />
              <Text style={styles.legendText}>Expense</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#10B981" }]} />
              <Text style={styles.legendText}>Income</Text>
            </View>
          </View>
        </View>
      )}

      {/* Category Pie Chart */}
      {categoryData.length > 0 && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Expense by Category</Text>
          <PieChart
            data={categoryData}
            width={screenWidth - 72}
            height={200}
            chartConfig={{ color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})` }}
            accessor="amount"
            backgroundColor="transparent"
            paddingLeft="15"
          />
        </View>
      )}

      {/* Recent Transactions */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Recent Transactions</Text>
        {transactions.slice(0, 5).map(t => {
          const cat = getCategoryById(t.category);
          return (
            <View key={t.id} style={styles.txRow}>
              <LinearGradient
                colors={t.type === "income" ? COLORS.gradientGreen : COLORS.gradientRed}
                style={styles.txIcon}
              >
                <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 16 }}>
                  {t.type === "income" ? "+" : "-"}
                </Text>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={styles.txDesc}>{t.description || cat.label}</Text>
                <Text style={styles.txDate}>{new Date(t.date).toLocaleDateString()}</Text>
              </View>
              <Text style={[styles.txAmount, { color: t.type === "income" ? COLORS.success : COLORS.danger }]}>
                {t.type === "income" ? "+" : "-"}{formatCurrency(t.amount)}
              </Text>
            </View>
          );
        })}
        {transactions.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💰</Text>
            <Text style={styles.emptyText}>No transactions yet</Text>
            <Text style={styles.emptySubtext}>Add your first one!</Text>
          </View>
        )}
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 20 },
  periodRow: { flexDirection: "row", justifyContent: "center", gap: 10, marginBottom: 20 },
  periodChip: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: RADIUS.full },
  periodInactive: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border },
  periodText: { color: COLORS.textMuted, fontWeight: "600", fontSize: 14 },
  periodTextActive: { color: "#fff", fontWeight: "800", fontSize: 14 },
  balanceCard: {
    borderRadius: RADIUS.lg, padding: 24, marginBottom: 20, ...SHADOWS.glow,
  },
  balanceLabel: { color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1 },
  balanceAmount: { color: "#fff", fontSize: 36, fontWeight: "900", marginVertical: 8 },
  balanceRow: { flexDirection: "row", alignItems: "center", marginTop: 12 },
  balanceItem: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  balanceDivider: { width: 1, height: 40, backgroundColor: "rgba(255,255,255,0.2)" },
  balanceIconBg: { width: 36, height: 36, borderRadius: 12, backgroundColor: "rgba(16,185,129,0.3)", justifyContent: "center", alignItems: "center" },
  balanceItemLabel: { color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: "500" },
  balanceItemAmount: { color: "#fff", fontSize: 16, fontWeight: "700" },
  chartCard: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, padding: 20,
    marginBottom: 16, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.soft,
  },
  chartTitle: { color: "#fff", fontSize: 18, fontWeight: "800", marginBottom: 16, letterSpacing: 0.3 },
  legendRow: { flexDirection: "row", justifyContent: "center", gap: 24, marginTop: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: COLORS.textSecondary, fontSize: 13 },
  txRow: {
    flexDirection: "row", alignItems: "center", paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight, gap: 14,
  },
  txIcon: { width: 42, height: 42, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  txDesc: { color: "#fff", fontSize: 15, fontWeight: "600" },
  txDate: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  txAmount: { fontSize: 16, fontWeight: "800" },
  emptyState: { alignItems: "center", paddingVertical: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: COLORS.textSecondary, fontSize: 16, fontWeight: "600" },
  emptySubtext: { color: COLORS.textMuted, fontSize: 13, marginTop: 4 },
});
