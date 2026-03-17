import { useState, useEffect, useRef } from "react";
import { View, ScrollView, StyleSheet, TouchableOpacity, Animated, Modal } from "react-native";
import { Text, TextInput, Button } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { CATEGORIES } from "../../lib/categories";
import { showMessage } from "../../lib/alert";
import { C } from "../../lib/theme";

export default function AddTransaction() {
  const { editId } = useLocalSearchParams();
  const router = useRouter();
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("other");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => { if (editId) load(); }, [editId]);

  const load = async () => {
    const { data } = await supabase.from("transactions").select("*").eq("id", editId).single();
    if (data) { setType(data.type); setAmount(String(data.amount)); setDescription(data.description || ""); setCategory(data.category); setDate(new Date(data.date).toISOString().split("T")[0]); }
  };

  const save = async () => {
    if (!amount || isNaN(parseFloat(amount))) { showMessage("Error", "Enter a valid amount"); return; }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const tx = { user_id: user.id, type, amount: parseFloat(amount), description, category, date: new Date(date).toISOString(), source: "manual" };
    const { error } = editId ? await supabase.from("transactions").update(tx).eq("id", editId) : await supabase.from("transactions").insert(tx);
    setLoading(false);
    if (error) showMessage("Error", error.message);
    else {
      if (editId) { showMessage("Success", "Updated!"); router.back(); return; }
      setShowSuccess(true);
      successScale.setValue(0); successOpacity.setValue(1);
      Animated.sequence([
        Animated.spring(successScale, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
        Animated.delay(1200),
        Animated.timing(successOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => {
        setShowSuccess(false);
        setAmount(""); setDescription(""); setCategory("other");
        setDate(new Date().toISOString().split("T")[0]);
      });
    }
  };

  const incCats = CATEGORIES.filter(c => ["salary", "freelance", "investment", "other"].includes(c.id));
  const expCats = CATEGORIES.filter(c => !["salary", "freelance", "investment"].includes(c.id));
  const cats = type === "income" ? incCats : expCats;

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      {/* Type Toggle */}
      <View style={s.toggleRow}>
        <TouchableOpacity onPress={() => setType("expense")} style={{ flex: 1 }} activeOpacity={0.7}>
          <View style={[s.toggleBtn, type === "expense" && { backgroundColor: C.red }]}>
            <MaterialCommunityIcons name="arrow-up-circle" size={20} color={type === "expense" ? "#fff" : "#999"} />
            <Text style={[s.toggleText, type === "expense" && s.toggleActive]}>Expense</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setType("income")} style={{ flex: 1 }} activeOpacity={0.7}>
          <View style={[s.toggleBtn, type === "income" && { backgroundColor: C.green }]}>
            <MaterialCommunityIcons name="arrow-down-circle" size={20} color={type === "income" ? "#fff" : "#999"} />
            <Text style={[s.toggleText, type === "income" && s.toggleActive]}>Income</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Amount Card */}
      <View style={s.amountCard}>
        <Text style={s.amountLabel}>AMOUNT</Text>
        <View style={s.amountRow}>
          <Text style={s.rupee}>₹</Text>
          <TextInput value={amount} onChangeText={setAmount} mode="flat" keyboardType="numeric"
            style={s.amountInput} textColor={C.textDark} underlineColor="transparent"
            activeUnderlineColor={C.purple} placeholder="0" placeholderTextColor="#ccc"
          />
        </View>
      </View>

      {/* Fields */}
      <View style={s.fieldCard}>
        <TextInput label="Description" value={description} onChangeText={setDescription}
          mode="flat" style={s.field} textColor={C.textDark}
          underlineColor="#eee" activeUnderlineColor={C.purple}
          left={<TextInput.Icon icon="text" iconColor="#999" />}
          theme={{ colors: { onSurfaceVariant: "#999" } }} />
        <View style={{ height: 1, backgroundColor: "#F0F0F0" }} />
        <TextInput label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate}
          mode="flat" style={s.field} textColor={C.textDark}
          underlineColor="#eee" activeUnderlineColor={C.purple}
          left={<TextInput.Icon icon="calendar" iconColor="#999" />}
          theme={{ colors: { onSurfaceVariant: "#999" } }} />
      </View>

      {/* Category */}
      <Text style={s.sectionTitle}>Category</Text>
      <View style={s.catGrid}>
        {cats.map(cat => (
          <TouchableOpacity key={cat.id} onPress={() => setCategory(cat.id)} activeOpacity={0.7}
            style={[s.catItem, category === cat.id && { backgroundColor: cat.color + "15", borderColor: cat.color }]}>
            <View style={[s.catIcon, { backgroundColor: cat.color + "18" }]}>
              <MaterialCommunityIcons name={cat.icon} size={22} color={cat.color} />
            </View>
            <Text style={[s.catLabel, category === cat.id && { color: cat.color, fontWeight: "800" }]}>{cat.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Save */}
      <TouchableOpacity onPress={save} disabled={loading} activeOpacity={0.8}>
        <View style={[s.saveBtn, { backgroundColor: type === "expense" ? C.red : C.green }]}>
          <MaterialCommunityIcons name={editId ? "check" : "plus"} size={22} color="#fff" />
          <Text style={s.saveBtnText}>{loading ? "Saving..." : editId ? "Update" : "Add Transaction"}</Text>
        </View>
      </TouchableOpacity>

      <View style={{ height: 80 }} />

      {/* Success Overlay */}
      {showSuccess && (
        <Animated.View style={[s.successOverlay, { opacity: successOpacity }]}>
          <Animated.View style={[s.successCircle, { transform: [{ scale: successScale }] }]}>
            <MaterialCommunityIcons name="check" size={48} color="#fff" />
          </Animated.View>
          <Animated.Text style={[s.successText, { transform: [{ scale: successScale }] }]}>
            Transaction Added!
          </Animated.Text>
        </Animated.View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, padding: 16 },
  toggleRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  toggleBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: C.border },
  toggleText: { color: "#999", fontWeight: "700", fontSize: 15 },
  toggleActive: { color: "#fff" },
  amountCard: { backgroundColor: C.card, borderRadius: 16, padding: 20, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  amountLabel: { color: "#999", fontSize: 11, fontWeight: "700", letterSpacing: 1.5, marginBottom: 8 },
  amountRow: { flexDirection: "row", alignItems: "center" },
  rupee: { color: C.purple, fontSize: 36, fontWeight: "900", marginRight: 4 },
  amountInput: { flex: 1, backgroundColor: "transparent", fontSize: 36, fontWeight: "900" },
  fieldCard: { backgroundColor: C.card, borderRadius: 16, overflow: "hidden", marginBottom: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  field: { backgroundColor: "transparent" },
  sectionTitle: { color: "#fff", fontSize: 15, fontWeight: "800", marginBottom: 12, letterSpacing: 0.3 },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
  catItem: { alignItems: "center", width: 78, paddingVertical: 12, borderRadius: 14, backgroundColor: C.card, borderWidth: 1.5, borderColor: "#F0F0F0" },
  catIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center", marginBottom: 6 },
  catLabel: { fontSize: 10, fontWeight: "600", color: C.textDark, textAlign: "center" },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16, borderRadius: 14 },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  successOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center", zIndex: 100 },
  successCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: "#00C853", justifyContent: "center", alignItems: "center", marginBottom: 20, shadowColor: "#00C853", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 12 },
  successText: { color: "#fff", fontSize: 22, fontWeight: "900" },
});
