import { useState, useEffect, useCallback } from "react";
import { View, FlatList, StyleSheet } from "react-native";
import { Text, Searchbar, Chip, Card, IconButton, Menu, FAB } from "react-native-paper";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { formatCurrency, formatDate } from "../../lib/helpers";
import { getCategoryById, CATEGORIES } from "../../lib/categories";
import { showAlert } from "../../lib/alert";

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all"); // all, income, expense
  const [filterCategory, setFilterCategory] = useState("all");
  const [menuVisible, setMenuVisible] = useState(null);
  const router = useRouter();

  const fetchTransactions = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let query = supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false });

    if (filterType !== "all") query = query.eq("type", filterType);
    if (filterCategory !== "all") query = query.eq("category", filterCategory);
    if (search) query = query.ilike("description", `%${search}%`);

    const { data } = await query.limit(100);
    setTransactions(data || []);
  }, [search, filterType, filterCategory]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const deleteTransaction = async (id) => {
    showAlert("Delete", "Are you sure you want to delete this transaction?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await supabase.from("transactions").delete().eq("id", id);
          fetchTransactions();
        },
      },
    ]);
  };

  const renderTransaction = ({ item }) => {
    const cat = getCategoryById(item.category);
    return (
      <Card style={styles.txCard}>
        <View style={styles.txRow}>
          <View style={[styles.txIcon, { backgroundColor: cat.color + "20" }]}>
            <Text style={{ color: cat.color, fontWeight: "bold" }}>
              {item.type === "income" ? "+" : "-"}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="bodyLarge" style={{ fontWeight: "500" }}>
              {item.description || cat.label}
            </Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 2 }}>
              <Text variant="bodySmall" style={{ color: "#999" }}>{formatDate(item.date)}</Text>
              <Chip compact textStyle={{ fontSize: 10 }} style={styles.sourceChip}>
                {item.source}
              </Chip>
            </View>
          </View>
          <Text
            variant="titleMedium"
            style={{ color: item.type === "income" ? "#2E7D32" : "#C62828", fontWeight: "bold" }}
          >
            {item.type === "income" ? "+" : "-"}{formatCurrency(item.amount)}
          </Text>
          <Menu
            visible={menuVisible === item.id}
            onDismiss={() => setMenuVisible(null)}
            anchor={
              <IconButton icon="dots-vertical" size={20} onPress={() => setMenuVisible(item.id)} />
            }
          >
            <Menu.Item
              onPress={() => {
                setMenuVisible(null);
                router.push({ pathname: "/(tabs)/add", params: { editId: item.id } });
              }}
              title="Edit"
              leadingIcon="pencil"
            />
            <Menu.Item
              onPress={() => {
                setMenuVisible(null);
                deleteTransaction(item.id);
              }}
              title="Delete"
              leadingIcon="delete"
            />
          </Menu>
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Search transactions..."
        value={search}
        onChangeText={setSearch}
        style={styles.search}
      />

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {["all", "income", "expense"].map(type => (
          <Chip
            key={type}
            selected={filterType === type}
            onPress={() => setFilterType(type)}
            style={[styles.chip, filterType === type && styles.chipActive]}
            textStyle={filterType === type ? { color: "#fff" } : {}}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </Chip>
        ))}
      </View>

      <FlatList
        data={transactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 80 }}
        ListEmptyComponent={
          <Text style={styles.empty}>No transactions found</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA", padding: 16 },
  search: { marginBottom: 12, backgroundColor: "#fff", elevation: 1 },
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  chip: { backgroundColor: "#fff" },
  chipActive: { backgroundColor: "#6C63FF" },
  txCard: { marginBottom: 8, borderRadius: 10, backgroundColor: "#fff" },
  txRow: { flexDirection: "row", alignItems: "center", padding: 12, gap: 10 },
  txIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  sourceChip: { height: 20, backgroundColor: "#f0f0f0" },
  empty: { textAlign: "center", padding: 40, color: "#999" },
});
