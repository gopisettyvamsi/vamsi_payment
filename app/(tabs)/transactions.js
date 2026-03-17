import { useState, useEffect, useCallback } from "react";
import { View, FlatList, StyleSheet, TouchableOpacity } from "react-native";
import { Text, Searchbar, IconButton, Menu } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { formatCurrency, formatDate } from "../../lib/helpers";
import { getCategoryById } from "../../lib/categories";
import { showAlert } from "../../lib/alert";
import { COLORS, SHADOWS, RADIUS } from "../../lib/theme";

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [menuVisible, setMenuVisible] = useState(null);
  const router = useRouter();

  const fetchTransactions = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    let query = supabase.from("transactions").select("*").eq("user_id", user.id).order("date", { ascending: false });
    if (filterType !== "all") query = query.eq("type", filterType);
    if (search) query = query.ilike("description", `%${search}%`);
    const { data } = await query.limit(100);
    setTransactions(data || []);
  }, [search, filterType]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const deleteTransaction = async (id) => {
    showAlert("Delete", "Are you sure you want to delete this transaction?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await supabase.from("transactions").delete().eq("id", id); fetchTransactions(); } },
    ]);
  };

  const renderTransaction = ({ item }) => {
    const cat = getCategoryById(item.category);
    return (
      <View style={styles.txCard}>
        <View style={styles.txRow}>
          <LinearGradient
            colors={item.type === "income" ? COLORS.gradientGreen : COLORS.gradientRed}
            style={styles.txIcon}
          >
            <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 16 }}>
              {item.type === "income" ? "+" : "-"}
            </Text>
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={styles.txDesc}>{item.description || cat.label}</Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
              <Text style={styles.txDate}>{formatDate(item.date)}</Text>
              <View style={styles.sourceChip}>
                <Text style={styles.sourceText}>{item.source}</Text>
              </View>
            </View>
          </View>
          <Text style={[styles.txAmount, { color: item.type === "income" ? COLORS.success : COLORS.danger }]}>
            {item.type === "income" ? "+" : "-"}{formatCurrency(item.amount)}
          </Text>
          <Menu
            visible={menuVisible === item.id}
            onDismiss={() => setMenuVisible(null)}
            contentStyle={{ backgroundColor: COLORS.bgSurface }}
            anchor={<IconButton icon="dots-vertical" size={20} iconColor={COLORS.textMuted} onPress={() => setMenuVisible(item.id)} />}
          >
            <Menu.Item onPress={() => { setMenuVisible(null); router.push({ pathname: "/(tabs)/add", params: { editId: item.id } }); }} title="Edit" leadingIcon="pencil" titleStyle={{ color: "#fff" }} />
            <Menu.Item onPress={() => { setMenuVisible(null); deleteTransaction(item.id); }} title="Delete" leadingIcon="delete" titleStyle={{ color: COLORS.danger }} />
          </Menu>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Search transactions..."
        value={search}
        onChangeText={setSearch}
        style={styles.search}
        inputStyle={{ color: "#fff" }}
        iconColor={COLORS.textMuted}
        placeholderTextColor={COLORS.textMuted}
      />

      <View style={styles.filterRow}>
        {["all", "income", "expense"].map(type => (
          <TouchableOpacity key={type} onPress={() => setFilterType(type)} activeOpacity={0.7}>
            {filterType === type ? (
              <LinearGradient colors={COLORS.gradientPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.chip}>
                <Text style={styles.chipTextActive}>{type.charAt(0).toUpperCase() + type.slice(1)}</Text>
              </LinearGradient>
            ) : (
              <View style={[styles.chip, styles.chipInactive]}>
                <Text style={styles.chipText}>{type.charAt(0).toUpperCase() + type.slice(1)}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={transactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>No transactions found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 16 },
  search: {
    marginBottom: 14, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border, elevation: 0,
  },
  filterRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  chip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: RADIUS.full },
  chipInactive: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border },
  chipText: { color: COLORS.textMuted, fontWeight: "600", fontSize: 13 },
  chipTextActive: { color: "#fff", fontWeight: "800", fontSize: 13 },
  txCard: {
    marginBottom: 10, borderRadius: RADIUS.lg, backgroundColor: COLORS.bgCard,
    borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.soft,
  },
  txRow: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  txIcon: { width: 42, height: 42, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  txDesc: { color: "#fff", fontSize: 15, fontWeight: "600" },
  txDate: { color: COLORS.textMuted, fontSize: 12 },
  sourceChip: { backgroundColor: COLORS.bgInput, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  sourceText: { color: COLORS.textMuted, fontSize: 10, fontWeight: "600", textTransform: "uppercase" },
  txAmount: { fontSize: 16, fontWeight: "800" },
  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: COLORS.textSecondary, fontSize: 16, fontWeight: "600" },
});
