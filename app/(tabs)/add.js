import { useState, useEffect } from "react";
import { View, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { Text, TextInput, Button, SegmentedButtons } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { CATEGORIES } from "../../lib/categories";
import { showAlert, showMessage } from "../../lib/alert";
import { COLORS, SHADOWS, RADIUS } from "../../lib/theme";

export default function AddTransaction() {
  const { editId } = useLocalSearchParams();
  const router = useRouter();
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("other");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (editId) loadTransaction(); }, [editId]);

  const loadTransaction = async () => {
    const { data } = await supabase.from("transactions").select("*").eq("id", editId).single();
    if (data) {
      setType(data.type); setAmount(String(data.amount));
      setDescription(data.description || ""); setCategory(data.category);
      setDate(new Date(data.date).toISOString().split("T")[0]);
    }
  };

  const handleSave = async () => {
    if (!amount || isNaN(parseFloat(amount))) { showMessage("Error", "Please enter a valid amount"); return; }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); showMessage("Error", "Please login first"); return; }
    const transaction = { user_id: user.id, type, amount: parseFloat(amount), description, category, date: new Date(date).toISOString(), source: "manual" };
    let error;
    if (editId) ({ error } = await supabase.from("transactions").update(transaction).eq("id", editId));
    else ({ error } = await supabase.from("transactions").insert(transaction));
    setLoading(false);
    if (error) showMessage("Error", error.message);
    else showMessage("Success", editId ? "Transaction updated!" : "Transaction added!", () => {
      setAmount(""); setDescription(""); setCategory("other"); setDate(new Date().toISOString().split("T")[0]);
      if (editId) router.back();
    });
  };

  const incomeCategories = CATEGORIES.filter(c => ["salary", "freelance", "investment", "other"].includes(c.id));
  const expenseCategories = CATEGORIES.filter(c => !["salary", "freelance", "investment"].includes(c.id));
  const displayCategories = type === "income" ? incomeCategories : expenseCategories;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>{editId ? "Edit Transaction" : "New Transaction"}</Text>

      {/* Type Toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity onPress={() => setType("expense")} style={{ flex: 1 }} activeOpacity={0.7}>
          {type === "expense" ? (
            <LinearGradient colors={COLORS.gradientRed} style={styles.toggleBtn}>
              <Text style={styles.toggleTextActive}>Expense</Text>
            </LinearGradient>
          ) : (
            <View style={[styles.toggleBtn, styles.toggleInactive]}>
              <Text style={styles.toggleText}>Expense</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setType("income")} style={{ flex: 1 }} activeOpacity={0.7}>
          {type === "income" ? (
            <LinearGradient colors={COLORS.gradientGreen} style={styles.toggleBtn}>
              <Text style={styles.toggleTextActive}>Income</Text>
            </LinearGradient>
          ) : (
            <View style={[styles.toggleBtn, styles.toggleInactive]}>
              <Text style={styles.toggleText}>Income</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Amount */}
      <View style={styles.amountCard}>
        <Text style={styles.amountLabel}>Amount</Text>
        <View style={styles.amountRow}>
          <Text style={styles.currencySymbol}>₹</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            mode="flat"
            keyboardType="numeric"
            style={styles.amountInput}
            textColor="#fff"
            underlineColor="transparent"
            activeUnderlineColor={COLORS.primary}
            placeholder="0"
            placeholderTextColor={COLORS.textMuted}
          />
        </View>
      </View>

      {/* Description */}
      <TextInput
        label="Description"
        value={description}
        onChangeText={setDescription}
        mode="outlined"
        style={styles.input}
        textColor="#fff"
        outlineColor={COLORS.border}
        activeOutlineColor={COLORS.primary}
        theme={{ colors: { onSurfaceVariant: COLORS.textMuted } }}
      />

      {/* Date */}
      <TextInput
        label="Date (YYYY-MM-DD)"
        value={date}
        onChangeText={setDate}
        mode="outlined"
        style={styles.input}
        textColor="#fff"
        outlineColor={COLORS.border}
        activeOutlineColor={COLORS.primary}
        theme={{ colors: { onSurfaceVariant: COLORS.textMuted } }}
      />

      {/* Category */}
      <Text style={styles.sectionTitle}>Category</Text>
      <View style={styles.categoryGrid}>
        {displayCategories.map(cat => (
          <TouchableOpacity key={cat.id} onPress={() => setCategory(cat.id)} activeOpacity={0.7}>
            <View style={[styles.catChip, category === cat.id && { backgroundColor: cat.color + "30", borderColor: cat.color }]}>
              <Text style={[styles.catText, category === cat.id && { color: cat.color, fontWeight: "800" }]}>
                {cat.label}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Save Button */}
      <LinearGradient
        colors={type === "expense" ? COLORS.gradientRed : COLORS.gradientGreen}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={styles.saveBtnGradient}
      >
        <Button mode="text" onPress={handleSave} loading={loading} disabled={loading}
          textColor="#fff" contentStyle={{ paddingVertical: 8 }}
          labelStyle={{ fontSize: 16, fontWeight: "800", letterSpacing: 0.5 }}
        >
          {editId ? "Update Transaction" : "Add Transaction"}
        </Button>
      </LinearGradient>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 20 },
  title: { color: "#fff", fontSize: 24, fontWeight: "900", marginBottom: 20, letterSpacing: 0.3 },
  toggleRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  toggleBtn: { paddingVertical: 14, borderRadius: RADIUS.md, alignItems: "center" },
  toggleInactive: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border },
  toggleText: { color: COLORS.textMuted, fontWeight: "600", fontSize: 15 },
  toggleTextActive: { color: "#fff", fontWeight: "800", fontSize: 15 },
  amountCard: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, padding: 20,
    marginBottom: 16, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.soft,
  },
  amountLabel: { color: COLORS.textMuted, fontSize: 13, fontWeight: "600", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 },
  amountRow: { flexDirection: "row", alignItems: "center" },
  currencySymbol: { color: COLORS.primary, fontSize: 32, fontWeight: "900", marginRight: 8 },
  amountInput: { flex: 1, backgroundColor: "transparent", fontSize: 32, fontWeight: "900" },
  input: { marginBottom: 14, backgroundColor: COLORS.bgInput, borderRadius: RADIUS.md },
  sectionTitle: { color: "#fff", fontSize: 16, fontWeight: "800", marginBottom: 12, marginTop: 4, letterSpacing: 0.3 },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
  catChip: {
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: RADIUS.md,
  },
  catText: { color: COLORS.textSecondary, fontWeight: "600", fontSize: 13 },
  saveBtnGradient: { borderRadius: RADIUS.md, overflow: "hidden", ...SHADOWS.glow },
});
