import { useState, useEffect, useCallback, useRef } from "react";
import { View, SectionList, StyleSheet, TouchableOpacity, Animated, Platform, Image } from "react-native";
import { Text, Searchbar, IconButton, Menu } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";
import { useRouter, useFocusEffect } from "expo-router";
import { supabase } from "../../lib/supabase";
import { formatDate } from "../../lib/helpers";
import { getCategoryById } from "../../lib/categories";
import { showAlert } from "../../lib/alert";
import { useTheme } from "../../lib/ThemeContext";
import { useCurrency, fmtCurrency } from "../../lib/CurrencyContext";
import { detectBrand, getBrandLogoUrl } from "../../lib/brands";
import { getMerchantLogoUrl } from "../../lib/merchantLogos";

const getDateLabel = (dateStr) => {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const txDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (today - txDate) / 86400000;
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return "This Week";
  if (diff < 30) return "This Month";
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
};

const groupByDate = (txns) => {
  const groups = {};
  txns.forEach(t => {
    const label = getDateLabel(t.date);
    if (!groups[label]) groups[label] = [];
    groups[label].push(t);
  });
  return Object.entries(groups).map(([title, data]) => ({ title, data }));
};

const DATE_RANGES = [
  { key: "all", label: "All Time" },
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "90d", label: "3 Months" },
  { key: "year", label: "This Year" },
];

const getDateFrom = (rangeKey) => {
  const now = new Date();
  // Use start of day (midnight) for clean date boundaries
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
  if (rangeKey === "7d") { const d = new Date(now); d.setDate(d.getDate() - 7); return startOfDay(d); }
  if (rangeKey === "30d") { const d = new Date(now); d.setDate(d.getDate() - 30); return startOfDay(d); }
  if (rangeKey === "90d") { const d = new Date(now); d.setDate(d.getDate() - 90); return startOfDay(d); }
  if (rangeKey === "year") return new Date(now.getFullYear(), 0, 1).toISOString();
  return null;
};

export default function Transactions() {
  const { theme } = useTheme();
  const [txns, setTxns] = useState([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [dateRange, setDateRange] = useState("all");
  const [menuVisible, setMenuVisible] = useState(null);
  const { currency } = useCurrency();
  const fmt = (amt) => fmtCurrency(amt, currency);
  const router = useRouter();

  const fetch_ = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    let q = supabase.from("transactions").select("*").eq("user_id", user.id).order("date", { ascending: false });
    if (filterType !== "all") q = q.eq("type", filterType);
    if (search) q = q.ilike("description", `%${search}%`);
    const dateFrom = getDateFrom(dateRange);
    if (dateFrom) q = q.gte("date", dateFrom);
    const { data } = await q.limit(500);
    setTxns(data || []);
  }, [search, filterType, dateRange]);

  useEffect(() => { fetch_(); }, [fetch_]);
  useFocusEffect(useCallback(() => { fetch_(); }, [fetch_]));

  const del = async (id) => {
    showAlert("Delete", "Delete this transaction?", [
      { text: "Cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await supabase.from("transactions").delete().eq("id", id); fetch_(); } },
    ]);
  };

  const sections = groupByDate(txns);

  const renderRightActions = (progress, dragX, item) => {
    const translateX = dragX.interpolate({ inputRange: [-160, 0], outputRange: [0, 160] });
    return (
      <Animated.View style={[s.swipeActions, { transform: [{ translateX }] }]}>
        <TouchableOpacity onPress={() => router.push({ pathname: "/(tabs)/add", params: { editId: item.id } })}
          style={[s.swipeBtn, { backgroundColor: theme.blue }]}>
          <MaterialCommunityIcons name="pencil-outline" size={20} color="#fff" />
          <Text style={s.swipeBtnText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => del(item.id)} style={[s.swipeBtn, { backgroundColor: theme.red }]}>
          <MaterialCommunityIcons name="trash-can-outline" size={20} color="#fff" />
          <Text style={s.swipeBtnText}>Delete</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderItem = ({ item, index, section }) => {
    const cat = getCategoryById(item.category);
    const brand = detectBrand(item.description);
    const logoUrl = brand ? getBrandLogoUrl(brand.domain) : getMerchantLogoUrl(item.description);
    const iconColor = brand?.color || cat.color;
    const initial = brand?.name?.[0] || (item.description || cat.label)[0]?.toUpperCase() || "?";
    const isLast = index === section.data.length - 1;

    const card = (
      <View style={[s.txRow, !isLast && { borderBottomWidth: 1, borderBottomColor: theme.divider }]}>
        <View style={[s.txIcon, { backgroundColor: iconColor + "12" }]}>
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={{ width: 24, height: 24, borderRadius: 4 }} resizeMode="contain" />
          ) : (
            <Text style={{ color: iconColor, fontWeight: "700", fontSize: 15 }}>{initial}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.txDesc, { color: theme.text }]} numberOfLines={1}>{brand?.name || item.description || cat.label}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
            <Text style={{ color: theme.textMuted, fontSize: 11 }}>{formatDate(item.date)}</Text>
            <View style={[s.srcChip, { backgroundColor: theme.surface }]}>
              <Text style={{ color: theme.textMuted, fontSize: 9, fontWeight: "700", textTransform: "uppercase" }}>{item.source}</Text>
            </View>
          </View>
        </View>
        <Text style={[s.txAmt, { color: item.type === "income" ? theme.green : theme.red }]}>
          {item.type === "income" ? "+" : "-"} {fmt(item.amount)}
        </Text>
        <Menu visible={menuVisible === item.id} onDismiss={() => setMenuVisible(null)}
          contentStyle={{ backgroundColor: theme.card }}
          anchor={<IconButton icon="dots-vertical" size={16} iconColor={theme.textDim} onPress={() => setMenuVisible(item.id)} style={{ margin: 0 }} />}>
          <Menu.Item onPress={() => { setMenuVisible(null); router.push({ pathname: "/(tabs)/add", params: { editId: item.id } }); }} title="Edit" leadingIcon="pencil-outline" />
          <Menu.Item onPress={() => { setMenuVisible(null); del(item.id); }} title="Delete" leadingIcon="trash-can-outline" titleStyle={{ color: theme.red }} />
        </Menu>
      </View>
    );

    if (Platform.OS === "web") return card;
    return (
      <Swipeable renderRightActions={(progress, dragX) => renderRightActions(progress, dragX, item)}
        overshootRight={false} friction={2}>
        {card}
      </Swipeable>
    );
  };

  const renderSectionHeader = ({ section: { title } }) => (
    <View style={s.sectionHeader}>
      <Text style={[s.sectionLabel, { color: theme.textMuted }]}>{title}</Text>
    </View>
  );

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      {/* Search */}
      <Searchbar placeholder="Search transactions..." value={search} onChangeText={setSearch}
        style={[s.search, { backgroundColor: theme.card, borderColor: theme.surfaceBorder }]}
        inputStyle={{ color: theme.text, fontSize: 14 }}
        iconColor={theme.textMuted} placeholderTextColor={theme.textDim} />

      {/* Type Filter */}
      <View style={s.filterRow}>
        {[["all", "All"], ["income", "Income"], ["expense", "Expense"]].map(([k, v]) => (
          <TouchableOpacity key={k} onPress={() => setFilterType(k)} activeOpacity={0.7}
            style={[s.filterChip, { backgroundColor: theme.surface },
              filterType === k && { backgroundColor: theme.accent }]}>
            <Text style={[s.filterText, { color: theme.textMuted },
              filterType === k && { color: "#fff" }]}>{v}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Date Range Filter */}
      <View style={s.dateFilterRow}>
        {DATE_RANGES.map(({ key, label }) => (
          <TouchableOpacity key={key} onPress={() => setDateRange(key)} activeOpacity={0.7}
            style={[s.dateChip, { borderColor: theme.surfaceBorder },
              dateRange === key && { backgroundColor: theme.accent, borderColor: theme.accent }]}>
            <Text style={[s.dateChipText, { color: theme.textMuted },
              dateRange === key && { color: "#fff" }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Result count */}
      <Text style={[s.resultCount, { color: theme.textMuted }]}>{txns.length} transaction{txns.length !== 1 ? "s" : ""}</Text>

      {/* List */}
      <SectionList
        sections={sections}
        extraData={[filterType, dateRange, search]}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingVertical: 60 }}>
            <MaterialCommunityIcons name="magnify" size={40} color={theme.textDim} />
            <Text style={{ color: theme.textMuted, marginTop: 12, fontWeight: "600", fontSize: 14 }}>No transactions found</Text>
          </View>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  search: { borderRadius: 14, elevation: 0, marginBottom: 12, height: 46, borderWidth: 1 },
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8 },
  filterText: { fontWeight: "700", fontSize: 12 },
  dateFilterRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  dateChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  dateChipText: { fontWeight: "600", fontSize: 11 },
  resultCount: { fontSize: 11, fontWeight: "600", marginBottom: 8 },
  sectionHeader: { paddingVertical: 8, paddingHorizontal: 4 },
  sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  txRow: { flexDirection: "row", alignItems: "center", paddingVertical: 13, paddingHorizontal: 4, gap: 12 },
  txIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  txDesc: { fontSize: 14, fontWeight: "600" },
  txAmt: { fontSize: 14, fontWeight: "700" },
  srcChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  swipeActions: { flexDirection: "row", alignItems: "center", borderRadius: 12, overflow: "hidden" },
  swipeBtn: { width: 72, height: "100%", justifyContent: "center", alignItems: "center" },
  swipeBtnText: { color: "#fff", fontSize: 10, fontWeight: "700", marginTop: 3 },
});
