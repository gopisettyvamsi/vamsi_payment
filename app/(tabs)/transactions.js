import { useState, useEffect, useCallback } from "react";
import { View, FlatList, StyleSheet, TouchableOpacity } from "react-native";
import { Text, Searchbar, IconButton, Menu } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { formatCurrency, formatDate } from "../../lib/helpers";
import { getCategoryById } from "../../lib/categories";
import { showAlert } from "../../lib/alert";
import { C } from "../../lib/theme";

export default function Transactions() {
  const [txns, setTxns] = useState([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [menuVisible, setMenuVisible] = useState(null);
  const router = useRouter();

  const fetch_ = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    let q = supabase.from("transactions").select("*").eq("user_id", user.id).order("date", { ascending: false });
    if (filterType !== "all") q = q.eq("type", filterType);
    if (search) q = q.ilike("description", `%${search}%`);
    const { data } = await q.limit(100);
    setTxns(data || []);
  }, [search, filterType]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const del = async (id) => {
    showAlert("Delete", "Delete this transaction?", [
      { text: "Cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await supabase.from("transactions").delete().eq("id", id); fetch_(); } },
    ]);
  };

  const renderItem = ({ item }) => {
    const cat = getCategoryById(item.category);
    return (
      <View style={s.txCard}>
        <View style={s.txRow}>
          <View style={[s.txIcon, { backgroundColor: cat.color + "18" }]}>
            <MaterialCommunityIcons name={cat.icon} size={22} color={cat.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.txDesc}>{item.description || cat.label}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
              <Text style={s.txDate}>{formatDate(item.date)}</Text>
              <View style={s.srcChip}><Text style={s.srcText}>{item.source}</Text></View>
            </View>
          </View>
          <Text style={[s.txAmt, { color: item.type === "income" ? C.green : C.textDark }]}>
            {item.type === "income" ? "+" : "-"} {formatCurrency(item.amount)}
          </Text>
          <Menu visible={menuVisible === item.id} onDismiss={() => setMenuVisible(null)}
            contentStyle={{ backgroundColor: C.card }}
            anchor={<IconButton icon="dots-vertical" size={18} iconColor="#999" onPress={() => setMenuVisible(item.id)} />}>
            <Menu.Item onPress={() => { setMenuVisible(null); router.push({ pathname: "/(tabs)/add", params: { editId: item.id } }); }} title="Edit" leadingIcon="pencil" />
            <Menu.Item onPress={() => { setMenuVisible(null); del(item.id); }} title="Delete" leadingIcon="delete" titleStyle={{ color: C.red }} />
          </Menu>
        </View>
      </View>
    );
  };

  return (
    <View style={s.container}>
      <Searchbar placeholder="Search..." value={search} onChangeText={setSearch}
        style={s.search} inputStyle={{ color: C.textDark, fontSize: 14 }}
        iconColor="#999" placeholderTextColor="#999" />

      <View style={s.filterRow}>
        {[["all", "All"], ["income", "Income"], ["expense", "Expense"]].map(([k, v]) => (
          <TouchableOpacity key={k} onPress={() => setFilterType(k)} activeOpacity={0.7}
            style={[s.filterChip, filterType === k && s.filterActive]}>
            <Text style={[s.filterText, filterType === k && s.filterActiveText]}>{v}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList data={txns} renderItem={renderItem} keyExtractor={i => i.id}
        contentContainerStyle={{ paddingBottom: 80 }} showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingVertical: 60 }}>
            <MaterialCommunityIcons name="magnify" size={48} color="rgba(255,255,255,0.2)" />
            <Text style={{ color: "rgba(255,255,255,0.4)", marginTop: 12, fontWeight: "600" }}>No transactions found</Text>
          </View>
        } />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, padding: 16 },
  search: { backgroundColor: C.card, borderRadius: 14, elevation: 2, marginBottom: 12, height: 48 },
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  filterChip: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: C.border },
  filterActive: { backgroundColor: C.purple, borderColor: C.purple },
  filterText: { color: "rgba(255,255,255,0.5)", fontWeight: "700", fontSize: 13 },
  filterActiveText: { color: "#fff" },
  txCard: { backgroundColor: C.card, borderRadius: 14, marginBottom: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  txRow: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  txIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  txDesc: { color: C.textDark, fontSize: 14, fontWeight: "600" },
  txDate: { color: "#999", fontSize: 11 },
  srcChip: { backgroundColor: "#F5F5F5", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  srcText: { color: "#999", fontSize: 9, fontWeight: "700", textTransform: "uppercase" },
  txAmt: { fontSize: 15, fontWeight: "800" },
});
