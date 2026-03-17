import { useState, useEffect } from "react";
import { View, ScrollView, StyleSheet, TouchableOpacity, Image, Platform } from "react-native";
import { Text, Switch, TextInput } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { showAlert } from "../../lib/alert";
import { C } from "../../lib/theme";
import { getItem, setItem, KEYS } from "../../lib/storage";

export default function Settings() {
  const [user, setUser] = useState(null);
  const [currency, setCurrency] = useState("INR");
  const [budget, setBudget] = useState("");
  const [notif, setNotif] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      const savedCurr = await getItem(KEYS.CURRENCY, "INR");
      setCurrency(savedCurr);
      const savedBudget = await getItem(KEYS.BUDGET, "");
      setBudget(savedBudget ? String(savedBudget) : "");
    })();
  }, []);

  const updateCurrency = (c) => { setCurrency(c); setItem(KEYS.CURRENCY, c); };
  const updateBudget = (val) => {
    setBudget(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) setItem(KEYS.BUDGET, num);
    else if (val === "") setItem(KEYS.BUDGET, "");
  };

  const logout = () => showAlert("Logout", "Are you sure?", [
    { text: "Cancel" },
    { text: "Logout", style: "destructive", onPress: () => supabase.auth.signOut() },
  ]);

  const deleteAcc = () => showAlert("Delete Account", "This will permanently delete everything!", [
    { text: "Cancel" },
    { text: "Delete", style: "destructive", onPress: async () => {
      if (!user) return;
      await supabase.from("transactions").delete().eq("user_id", user.id);
      await supabase.auth.signOut();
    }},
  ]);

  const exportCSV = async () => {
    if (!user) return;
    const { data } = await supabase.from("transactions").select("*").eq("user_id", user.id).order("date", { ascending: false });
    if (!data?.length) { showAlert("No Data", "No transactions to export"); return; }
    const headers = "date,amount,type,category,description,source\n";
    const rows = data.map(t =>
      `${new Date(t.date).toISOString().split("T")[0]},${t.amount},${t.type},${t.category},"${(t.description || "").replace(/"/g, '""')}",${t.source}`
    ).join("\n");
    const csv = headers + rows;
    if (Platform.OS === "web") {
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "vamsify-transactions.csv";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showAlert("Exported", `${data.length} transactions downloaded as CSV.`);
    } else {
      showAlert("Export Ready", `${data.length} transactions ready.\nCSV download is available on web.`);
    }
  };

  const Item = ({ icon, color, title, sub, right, onPress, danger }) => (
    <TouchableOpacity onPress={onPress} disabled={!onPress} activeOpacity={onPress ? 0.6 : 1} style={s.item}>
      <View style={[s.itemIcon, { backgroundColor: (color || C.purple) + "18" }]}>
        <MaterialCommunityIcons name={icon} size={20} color={color || C.purple} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.itemTitle, danger && { color: C.red }]}>{title}</Text>
        {sub ? <Text style={s.itemSub}>{sub}</Text> : null}
      </View>
      {right || (onPress ? <MaterialCommunityIcons name="chevron-right" size={20} color="#ddd" /> : null)}
    </TouchableOpacity>
  );

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      {/* Profile */}
      <LinearGradient colors={["#5F259F", "#7B3FBF"]} style={s.profile}>
        {user?.user_metadata?.avatar_url || user?.user_metadata?.picture ? (
          <Image source={{ uri: user.user_metadata.avatar_url || user.user_metadata.picture }} style={s.avatarImg} />
        ) : (
          <View style={s.avatar}>
            <Text style={s.avatarText}>{user?.user_metadata?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "?"}</Text>
          </View>
        )}
        <Text style={s.fullName}>{user?.user_metadata?.full_name || ""}</Text>
        <Text style={s.email}>{user?.email || "Loading..."}</Text>
        <Text style={s.since}>Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "..."}</Text>
      </LinearGradient>

      {/* Preferences */}
      <Text style={s.sectionLabel}>PREFERENCES</Text>
      <View style={s.card}>
        <Item icon="currency-inr" color={C.orange} title="Currency" sub={currency}
          right={
            <View style={{ flexDirection: "row", gap: 6 }}>
              {["INR", "USD", "EUR"].map(c => (
                <TouchableOpacity key={c} onPress={() => updateCurrency(c)}
                  style={[s.currChip, currency === c && { backgroundColor: C.purple }]}>
                  <Text style={[s.currText, currency === c && { color: "#fff" }]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
          } />
        <View style={s.divider} />
        <Item icon="bell-outline" color={C.blue} title="Notifications"
          right={<Switch value={notif} onValueChange={setNotif} color={C.purple} />} />
        <View style={s.divider} />
        <View style={s.item}>
          <View style={[s.itemIcon, { backgroundColor: C.green + "18" }]}>
            <MaterialCommunityIcons name="target" size={20} color={C.green} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.itemTitle}>Monthly Budget</Text>
            <Text style={s.itemSub}>Set spending limit</Text>
          </View>
          <View style={s.budgetInputWrap}>
            <Text style={s.budgetSymbol}>₹</Text>
            <TextInput value={budget} onChangeText={updateBudget} keyboardType="numeric"
              placeholder="0" placeholderTextColor="#ccc" style={s.budgetInput} />
          </View>
        </View>
      </View>

      {/* Data */}
      <Text style={s.sectionLabel}>DATA</Text>
      <View style={s.card}>
        <Item icon="download" color={C.teal} title="Export CSV" sub="Download all transactions" onPress={exportCSV} />
      </View>

      {/* About */}
      <Text style={s.sectionLabel}>ABOUT</Text>
      <View style={s.card}>
        <Item icon="information-outline" color={C.blue} title="Version" sub="1.0.0" />
        <View style={s.divider} />
        <Item icon="code-tags" color={C.purple} title="Built with" sub="React Native + Expo + Supabase" />
      </View>

      {/* Actions */}
      <View style={{ marginTop: 24 }}>
        <TouchableOpacity onPress={logout} activeOpacity={0.7} style={s.actionBtn}>
          <MaterialCommunityIcons name="logout" size={20} color={C.orange} />
          <Text style={[s.actionText, { color: C.orange }]}>Logout</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={deleteAcc} activeOpacity={0.7} style={[s.actionBtn, { marginTop: 8, borderColor: C.red + "30" }]}>
          <MaterialCommunityIcons name="delete-outline" size={20} color={C.red} />
          <Text style={[s.actionText, { color: C.red }]}>Delete Account</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 80 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  profile: { padding: 32, alignItems: "center", borderBottomLeftRadius: 28, borderBottomRightRadius: 28, shadowColor: C.purple, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 10 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center", marginBottom: 14, borderWidth: 3, borderColor: "rgba(255,255,255,0.3)" },
  avatarImg: { width: 72, height: 72, borderRadius: 36, marginBottom: 14, borderWidth: 3, borderColor: "rgba(255,255,255,0.3)" },
  avatarText: { color: "#fff", fontSize: 28, fontWeight: "900" },
  fullName: { color: "#fff", fontSize: 20, fontWeight: "900", marginBottom: 2 },
  email: { color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: "600" },
  since: { color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 4 },
  sectionLabel: { color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: "800", letterSpacing: 2, marginTop: 24, marginBottom: 8, marginLeft: 20 },
  card: { backgroundColor: C.card, marginHorizontal: 16, borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  item: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  itemIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  itemTitle: { color: C.textDark, fontSize: 14, fontWeight: "600" },
  itemSub: { color: "#999", fontSize: 12, marginTop: 1 },
  divider: { height: 1, backgroundColor: "#F0F0F5", marginLeft: 64 },
  currChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, backgroundColor: "#F5F5F5" },
  currText: { fontSize: 11, fontWeight: "700", color: "#999" },
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginHorizontal: 16, paddingVertical: 16, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: C.orange + "30" },
  actionText: { fontWeight: "800", fontSize: 15 },
  budgetInputWrap: { flexDirection: "row", alignItems: "center", backgroundColor: "#F5F5F5", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  budgetSymbol: { color: C.purple, fontWeight: "800", fontSize: 16, marginRight: 2 },
  budgetInput: { fontSize: 16, fontWeight: "700", color: C.textDark, width: 80, textAlign: "right", padding: 0, backgroundColor: "transparent" },
});
