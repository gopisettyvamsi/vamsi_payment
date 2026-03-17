import { useState, useEffect, useCallback } from "react";
import { View, ScrollView, StyleSheet, Dimensions, RefreshControl, TouchableOpacity } from "react-native";
import { Text } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LineChart, PieChart } from "react-native-chart-kit";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { formatCurrency, getMonthName } from "../../lib/helpers";
import { getCategoryById } from "../../lib/categories";
import { C } from "../../lib/theme";

const W = Dimensions.get("window").width;

export default function Dashboard() {
  const [txns, setTxns] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState("month");
  const router = useRouter();

  const fetch_ = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const now = new Date();
    let start;
    if (period === "week") start = new Date(now.getTime() - 7 * 86400000);
    else if (period === "month") start = new Date(now.getFullYear(), now.getMonth(), 1);
    else start = new Date(now.getFullYear(), 0, 1);
    const { data } = await supabase.from("transactions").select("*")
      .eq("user_id", user.id).gte("date", start.toISOString()).order("date", { ascending: false });
    setTxns(data || []);
  }, [period]);

  useEffect(() => { fetch_(); }, [fetch_]);
  const onRefresh = async () => { setRefreshing(true); await fetch_(); setRefreshing(false); };

  const income = txns.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expense = txns.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const balance = income - expense;

  const getMonthlyData = () => {
    const ms = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      ms.push({ label: getMonthName(d.getMonth()), y: d.getFullYear(), m: d.getMonth() });
    }
    return {
      labels: ms.map(m => m.label),
      datasets: [
        { data: ms.map(m => txns.filter(t => { const d = new Date(t.date); return d.getMonth() === m.m && d.getFullYear() === m.y && t.type === "expense"; }).reduce((s, t) => s + Number(t.amount), 0) || 0), color: () => C.red },
        { data: ms.map(m => txns.filter(t => { const d = new Date(t.date); return d.getMonth() === m.m && d.getFullYear() === m.y && t.type === "income"; }).reduce((s, t) => s + Number(t.amount), 0) || 0), color: () => C.green },
      ],
    };
  };

  const getCatData = () => {
    const tots = {};
    txns.filter(t => t.type === "expense").forEach(t => { tots[t.category] = (tots[t.category] || 0) + Number(t.amount); });
    return Object.entries(tots).sort(([,a],[,b]) => b - a).slice(0, 5).map(([id, amt]) => {
      const cat = getCategoryById(id);
      return { name: cat.label, amount: amt, color: cat.color, legendFontColor: "#999", legendFontSize: 11 };
    });
  };

  const QuickAction = ({ icon, label, color, onPress }) => (
    <TouchableOpacity onPress={onPress} style={s.qaItem} activeOpacity={0.7}>
      <View style={[s.qaIcon, { backgroundColor: color + "18" }]}>
        <MaterialCommunityIcons name={icon} size={26} color={color} />
      </View>
      <Text style={s.qaLabel}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.purple} />}>

      {/* Balance Card */}
      <LinearGradient colors={["#5F259F", "#7B3FBF", "#9B59D0"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.balanceCard}>
        <View style={s.balanceTop}>
          <Text style={s.balanceLabel}>Total Balance</Text>
          <View style={s.periodRow}>
            {["week", "month", "year"].map(p => (
              <TouchableOpacity key={p} onPress={() => setPeriod(p)}
                style={[s.periodBtn, period === p && s.periodActive]}>
                <Text style={[s.periodText, period === p && s.periodActiveText]}>
                  {p === "week" ? "7D" : p === "month" ? "1M" : "1Y"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <Text style={s.balanceAmt}>{formatCurrency(balance)}</Text>
        <View style={s.balanceBottom}>
          <View style={s.balanceStat}>
            <View style={s.statDot}><MaterialCommunityIcons name="arrow-down" size={14} color={C.green} /></View>
            <View>
              <Text style={s.statLabel}>Income</Text>
              <Text style={s.statAmt}>{formatCurrency(income)}</Text>
            </View>
          </View>
          <View style={{ width: 1, height: 36, backgroundColor: "rgba(255,255,255,0.15)" }} />
          <View style={s.balanceStat}>
            <View style={[s.statDot, { backgroundColor: "rgba(255,59,48,0.2)" }]}>
              <MaterialCommunityIcons name="arrow-up" size={14} color={C.red} />
            </View>
            <View>
              <Text style={s.statLabel}>Expense</Text>
              <Text style={s.statAmt}>{formatCurrency(expense)}</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Quick Actions */}
      <View style={s.qaCard}>
        <View style={s.qaRow}>
          <QuickAction icon="plus-circle-outline" label="Add" color={C.purple} onPress={() => router.push("/(tabs)/add")} />
          <QuickAction icon="swap-horizontal" label="History" color={C.blue} onPress={() => router.push("/(tabs)/transactions")} />
          <QuickAction icon="file-import-outline" label="Import" color={C.teal} onPress={() => router.push("/(tabs)/import")} />
          <QuickAction icon="download-outline" label="Export" color={C.orange} onPress={() => router.push("/(tabs)/settings")} />
        </View>
      </View>

      {/* Monthly Trend */}
      {txns.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Monthly Trend</Text>
          <View style={s.chartWrap}>
            <LineChart
              data={getMonthlyData()} width={W - 56} height={180}
              chartConfig={{
                backgroundColor: "transparent", backgroundGradientFrom: C.card, backgroundGradientTo: C.card,
                decimalPlaces: 0, color: () => C.purple, labelColor: () => "#999",
                propsForDots: { r: "4", strokeWidth: "2", stroke: C.purple },
                propsForBackgroundLines: { stroke: "#f0f0f0" },
              }}
              bezier style={{ borderRadius: 12 }}
            />
            <View style={s.legendRow}>
              <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: C.red }]} /><Text style={s.legendText}>Expense</Text></View>
              <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: C.green }]} /><Text style={s.legendText}>Income</Text></View>
            </View>
          </View>
        </View>
      )}

      {/* Category Breakdown */}
      {getCatData().length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Top Expenses</Text>
          <View style={s.chartWrap}>
            <PieChart data={getCatData()} width={W - 56} height={180}
              chartConfig={{ color: () => "#000" }} accessor="amount"
              backgroundColor="transparent" paddingLeft="15"
            />
          </View>
        </View>
      )}

      {/* Recent Transactions */}
      <View style={s.section}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={s.sectionTitle}>Recent</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/transactions")}>
            <Text style={{ color: C.purple, fontWeight: "700", fontSize: 13 }}>See All</Text>
          </TouchableOpacity>
        </View>
        <View style={s.txCard}>
          {txns.slice(0, 6).map((t, i) => {
            const cat = getCategoryById(t.category);
            return (
              <View key={t.id} style={[s.txRow, i < Math.min(txns.length, 6) - 1 && s.txBorder]}>
                <View style={[s.txIcon, { backgroundColor: cat.color + "18" }]}>
                  <MaterialCommunityIcons name={cat.icon} size={22} color={cat.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.txDesc}>{t.description || cat.label}</Text>
                  <Text style={s.txDate}>{new Date(t.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</Text>
                </View>
                <Text style={[s.txAmt, { color: t.type === "income" ? C.green : C.textDark }]}>
                  {t.type === "income" ? "+" : "-"} {formatCurrency(t.amount)}
                </Text>
              </View>
            );
          })}
          {txns.length === 0 && (
            <View style={{ alignItems: "center", paddingVertical: 40 }}>
              <MaterialCommunityIcons name="wallet-outline" size={48} color="#ddd" />
              <Text style={{ color: "#999", marginTop: 12, fontWeight: "600" }}>No transactions yet</Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/add")} style={s.emptyBtn}>
                <Text style={{ color: C.purple, fontWeight: "700" }}>+ Add your first</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      <View style={{ height: 80 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // Balance
  balanceCard: { marginHorizontal: 16, marginTop: 16, borderRadius: 20, padding: 24, shadowColor: C.purple, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 10 },
  balanceTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  balanceLabel: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1 },
  periodRow: { flexDirection: "row", gap: 4 },
  periodBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  periodActive: { backgroundColor: "rgba(255,255,255,0.2)" },
  periodText: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "700" },
  periodActiveText: { color: "#fff" },
  balanceAmt: { color: "#fff", fontSize: 38, fontWeight: "900", marginVertical: 12 },
  balanceBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-around", marginTop: 4 },
  balanceStat: { flexDirection: "row", alignItems: "center", gap: 10 },
  statDot: { width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(0,200,83,0.2)", justifyContent: "center", alignItems: "center" },
  statLabel: { color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "500" },
  statAmt: { color: "#fff", fontSize: 15, fontWeight: "800" },

  // Quick Actions
  qaCard: { backgroundColor: C.card, marginHorizontal: 16, marginTop: 16, borderRadius: 16, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  qaRow: { flexDirection: "row", justifyContent: "space-around" },
  qaItem: { alignItems: "center", width: 70 },
  qaIcon: { width: 52, height: 52, borderRadius: 16, justifyContent: "center", alignItems: "center", marginBottom: 6 },
  qaLabel: { fontSize: 11, fontWeight: "700", color: C.textDark },

  // Sections
  section: { marginTop: 24, paddingHorizontal: 16 },
  sectionTitle: { color: "#fff", fontSize: 17, fontWeight: "800", marginBottom: 12 },

  // Charts
  chartWrap: { backgroundColor: C.card, borderRadius: 16, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  legendRow: { flexDirection: "row", justifyContent: "center", gap: 20, marginTop: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: "#999", fontSize: 12 },

  // Transactions
  txCard: { backgroundColor: C.card, borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  txRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  txBorder: { borderBottomWidth: 1, borderBottomColor: "#F5F5F5" },
  txIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  txDesc: { color: C.textDark, fontSize: 14, fontWeight: "600" },
  txDate: { color: "#999", fontSize: 12, marginTop: 2 },
  txAmt: { fontSize: 15, fontWeight: "800" },
  emptyBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: C.purple + "10" },
});
