import { useState, useEffect } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { Text, TextInput, Button, SegmentedButtons, Chip } from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { CATEGORIES } from "../../lib/categories";
import { showAlert, showMessage } from "../../lib/alert";

export default function AddTransaction() {
  const { editId } = useLocalSearchParams();
  const router = useRouter();
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("other");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editId) loadTransaction();
  }, [editId]);

  const loadTransaction = async () => {
    const { data } = await supabase.from("transactions").select("*").eq("id", editId).single();
    if (data) {
      setType(data.type);
      setAmount(String(data.amount));
      setDescription(data.description || "");
      setCategory(data.category);
      setDate(new Date(data.date).toISOString().split("T")[0]);
    }
  };

  const handleSave = async () => {
    if (!amount || isNaN(parseFloat(amount))) {
      showMessage("Error", "Please enter a valid amount");
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      showMessage("Error", "Please login first");
      return;
    }

    const transaction = {
      user_id: user.id,
      type,
      amount: parseFloat(amount),
      description,
      category,
      date: new Date(date).toISOString(),
      source: "manual",
    };

    let error;
    if (editId) {
      ({ error } = await supabase.from("transactions").update(transaction).eq("id", editId));
    } else {
      ({ error } = await supabase.from("transactions").insert(transaction));
    }

    setLoading(false);

    if (error) {
      showMessage("Error", error.message);
    } else {
      showMessage("Success", editId ? "Transaction updated!" : "Transaction added!", () => {
        setAmount("");
        setDescription("");
        setCategory("other");
        setDate(new Date().toISOString().split("T")[0]);
        if (editId) router.back();
      });
    }
  };

  const incomeCategories = CATEGORIES.filter(c => ["salary", "freelance", "investment", "other"].includes(c.id));
  const expenseCategories = CATEGORIES.filter(c => !["salary", "freelance", "investment"].includes(c.id));
  const displayCategories = type === "income" ? incomeCategories : expenseCategories;

  return (
    <ScrollView style={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>
        {editId ? "Edit Transaction" : "Add Transaction"}
      </Text>

      {/* Income / Expense Toggle */}
      <SegmentedButtons
        value={type}
        onValueChange={setType}
        buttons={[
          { value: "expense", label: "Expense", icon: "arrow-up" },
          { value: "income", label: "Income", icon: "arrow-down" },
        ]}
        style={styles.segment}
      />

      {/* Amount */}
      <TextInput
        label="Amount"
        value={amount}
        onChangeText={setAmount}
        mode="outlined"
        keyboardType="numeric"
        left={<TextInput.Affix text="₹" />}
        style={styles.input}
      />

      {/* Description */}
      <TextInput
        label="Description"
        value={description}
        onChangeText={setDescription}
        mode="outlined"
        style={styles.input}
      />

      {/* Date */}
      <TextInput
        label="Date (YYYY-MM-DD)"
        value={date}
        onChangeText={setDate}
        mode="outlined"
        style={styles.input}
      />

      {/* Category */}
      <Text variant="titleMedium" style={styles.sectionTitle}>Category</Text>
      <View style={styles.categoryGrid}>
        {displayCategories.map(cat => (
          <Chip
            key={cat.id}
            selected={category === cat.id}
            onPress={() => setCategory(cat.id)}
            style={[
              styles.catChip,
              category === cat.id && { backgroundColor: cat.color + "30", borderColor: cat.color },
            ]}
            textStyle={category === cat.id ? { fontWeight: "bold" } : {}}
          >
            {cat.label}
          </Chip>
        ))}
      </View>

      {/* Save Button */}
      <Button
        mode="contained"
        onPress={handleSave}
        loading={loading}
        disabled={loading}
        style={styles.saveBtn}
        contentStyle={{ paddingVertical: 6 }}
      >
        {editId ? "Update Transaction" : "Add Transaction"}
      </Button>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA", padding: 16 },
  title: { fontWeight: "bold", marginBottom: 16 },
  segment: { marginBottom: 16 },
  input: { marginBottom: 12, backgroundColor: "#fff" },
  sectionTitle: { fontWeight: "bold", marginBottom: 8, marginTop: 4 },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  catChip: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e0e0e0" },
  saveBtn: { borderRadius: 8, backgroundColor: "#6C63FF" },
});
