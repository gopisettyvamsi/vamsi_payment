import { useState, useEffect, useCallback } from "react";
import { View, ScrollView, StyleSheet, Dimensions, RefreshControl } from "react-native";
import { Text, Card, Surface } from "react-native-paper";
import { LineChart, PieChart } from "react-native-chart-kit";
import { supabase } from "../../lib/supabase";
import { formatCurrency, getMonthName } from "../../lib/helpers";
import { getCategoryById, CATEGORIES } from "../../lib/categories";

const screenWidth = Dimensions.get("window").width;

export default function Dashboard() {
  const [transactions, setTransactions] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState("month"); // month, week, year

  const fetchTransactions = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const now = new Date();
    let startDate;
    if (period === "week") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === "month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      startDate = new Date(now.getFullYear(), 0, 1);
    }

    const { data } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", startDate.toISOString())
      .order("date", { ascending: false });

    setTransactions(data || []);
  }, [period]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTransactions();
    setRefreshing(false);
  };

  const totalIncome = transactions.filter(t => t.type === "income").reduce((sum, t) => sum + Number(t.amount), 0);
  const totalExpense = transactions.filter(t => t.type === "expense").reduce((sum, t) => sum + Number(t.amount), 0);
  const balance = totalIncome - totalExpense;

  // Monthly trend data (last 6 months)
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
        {
          data: months.map(m => {
            return transactions
              .filter(t => {
                const td = new Date(t.date);
                return td.getMonth() === m.m && td.getFullYear() === m.year && t.type === "expense";
              })
              .reduce((sum, t) => sum + Number(t.amount), 0) || 0;
          }),
          color: () => "#FF6B6B",
        },
        {
          data: months.map(m => {
            return transactions
              .filter(t => {
                const td = new Date(t.date);
                return td.getMonth() === m.m && td.getFullYear() === m.year && t.type === "income";
              })
              .reduce((sum, t) => sum + Number(t.amount), 0) || 0;
          }),
          color: () => "#4ECDC4",
        },
      ],
    };
  };

  // Category breakdown for pie chart
  const getCategoryData = () => {
    const categoryTotals = {};
    transactions
      .filter(t => t.type === "expense")
      .forEach(t => {
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + Number(t.amount);
      });

    return Object.entries(categoryTotals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([catId, amount]) => {
        const cat = getCategoryById(catId);
        return {
          name: cat.label,
          amount,
          color: cat.color,
          legendFontColor: "#333",
          legendFontSize: 12,
        };
      });
  };

  const monthlyData = getMonthlyData();
  const categoryData = getCategoryData();

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Period Selector */}
      <View style={styles.periodRow}>
        {["week", "month", "year"].map(p => (
          <Surface
            key={p}
            style={[styles.periodChip, period === p && styles.periodActive]}
            onTouchEnd={() => setPeriod(p)}
          >
            <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </Text>
          </Surface>
        ))}
      </View>

      {/* Summary Cards */}
      <View style={styles.cardRow}>
        <Card style={[styles.summaryCard, { backgroundColor: "#E8F5E9" }]}>
          <Card.Content>
            <Text variant="labelMedium" style={{ color: "#2E7D32" }}>Income</Text>
            <Text variant="titleLarge" style={{ color: "#2E7D32", fontWeight: "bold" }}>
              {formatCurrency(totalIncome)}
            </Text>
          </Card.Content>
        </Card>
        <Card style={[styles.summaryCard, { backgroundColor: "#FFEBEE" }]}>
          <Card.Content>
            <Text variant="labelMedium" style={{ color: "#C62828" }}>Expense</Text>
            <Text variant="titleLarge" style={{ color: "#C62828", fontWeight: "bold" }}>
              {formatCurrency(totalExpense)}
            </Text>
          </Card.Content>
        </Card>
      </View>

      <Card style={[styles.balanceCard, { backgroundColor: balance >= 0 ? "#E3F2FD" : "#FFF3E0" }]}>
        <Card.Content style={{ alignItems: "center" }}>
          <Text variant="labelLarge">Balance</Text>
          <Text variant="headlineMedium" style={{ fontWeight: "bold", color: balance >= 0 ? "#1565C0" : "#E65100" }}>
            {formatCurrency(balance)}
          </Text>
        </Card.Content>
      </Card>

      {/* Monthly Trend Chart */}
      {transactions.length > 0 && (
        <Card style={styles.chartCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.chartTitle}>Monthly Trend</Text>
            <LineChart
              data={monthlyData}
              width={screenWidth - 64}
              height={200}
              chartConfig={{
                backgroundColor: "#fff",
                backgroundGradientFrom: "#fff",
                backgroundGradientTo: "#fff",
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(108, 99, 255, ${opacity})`,
                labelColor: () => "#666",
                propsForDots: { r: "4" },
              }}
              bezier
              style={{ borderRadius: 8 }}
            />
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#FF6B6B" }]} />
                <Text variant="bodySmall">Expense</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#4ECDC4" }]} />
                <Text variant="bodySmall">Income</Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Category Pie Chart */}
      {categoryData.length > 0 && (
        <Card style={styles.chartCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.chartTitle}>Expense by Category</Text>
            <PieChart
              data={categoryData}
              width={screenWidth - 64}
              height={200}
              chartConfig={{
                color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              }}
              accessor="amount"
              backgroundColor="transparent"
              paddingLeft="15"
            />
          </Card.Content>
        </Card>
      )}

      {/* Recent Transactions */}
      <Card style={styles.chartCard}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.chartTitle}>Recent Transactions</Text>
          {transactions.slice(0, 5).map(t => {
            const cat = getCategoryById(t.category);
            return (
              <View key={t.id} style={styles.txRow}>
                <View style={[styles.txIcon, { backgroundColor: cat.color + "20" }]}>
                  <Text style={{ fontSize: 16 }}>{t.type === "income" ? "+" : "-"}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyMedium">{t.description || cat.label}</Text>
                  <Text variant="bodySmall" style={{ color: "#999" }}>
                    {new Date(t.date).toLocaleDateString()}
                  </Text>
                </View>
                <Text
                  variant="bodyLarge"
                  style={{ color: t.type === "income" ? "#2E7D32" : "#C62828", fontWeight: "bold" }}
                >
                  {t.type === "income" ? "+" : "-"}{formatCurrency(t.amount)}
                </Text>
              </View>
            );
          })}
          {transactions.length === 0 && (
            <Text variant="bodyMedium" style={{ textAlign: "center", padding: 20, color: "#999" }}>
              No transactions yet. Add your first one!
            </Text>
          )}
        </Card.Content>
      </Card>

      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA", padding: 16 },
  periodRow: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 16 },
  periodChip: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, backgroundColor: "#fff", elevation: 1 },
  periodActive: { backgroundColor: "#6C63FF" },
  periodText: { color: "#666" },
  periodTextActive: { color: "#fff", fontWeight: "bold" },
  cardRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  summaryCard: { flex: 1, borderRadius: 12, elevation: 2 },
  balanceCard: { borderRadius: 12, elevation: 2, marginBottom: 16 },
  chartCard: { borderRadius: 12, elevation: 2, marginBottom: 16, backgroundColor: "#fff" },
  chartTitle: { fontWeight: "bold", marginBottom: 12 },
  legendRow: { flexDirection: "row", justifyContent: "center", gap: 20, marginTop: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  txRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f0f0f0", gap: 12 },
  txIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
});
