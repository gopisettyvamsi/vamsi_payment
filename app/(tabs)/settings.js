import { useState, useEffect } from "react";
import { View, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { Text, Switch } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { showAlert, showMessage } from "../../lib/alert";
import { COLORS, SHADOWS, RADIUS } from "../../lib/theme";

export default function Settings() {
  const [user, setUser] = useState(null);
  const [currency, setCurrency] = useState("INR");
  const [notifications, setNotifications] = useState(true);

  useEffect(() => { loadUser(); }, []);

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  const handleLogout = async () => {
    showAlert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: async () => { await supabase.auth.signOut(); } },
    ]);
  };

  const handleDeleteAccount = async () => {
    showAlert("Delete Account", "This will permanently delete your account and all transactions. This cannot be undone!", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        if (!user) return;
        await supabase.from("transactions").delete().eq("user_id", user.id);
        await supabase.auth.signOut();
        showAlert("Deleted", "Your account data has been removed.");
      }},
    ]);
  };

  const handleExportData = async () => {
    if (!user) return;
    const { data } = await supabase.from("transactions").select("*").eq("user_id", user.id).order("date", { ascending: false });
    if (!data || data.length === 0) { showAlert("No Data", "No transactions to export"); return; }
    const headers = "date,amount,type,category,description,source\n";
    const rows = data.map(t => `${new Date(t.date).toISOString().split("T")[0]},${t.amount},${t.type},${t.category},"${t.description || ""}",${t.source}`).join("\n");
    const csv = headers + rows;
    showAlert("Export Ready", `${data.length} transactions ready to export.`, [{ text: "OK" }]);
  };

  const SettingsItem = ({ icon, iconColor, title, desc, right, onPress }) => (
    <TouchableOpacity onPress={onPress} disabled={!onPress} activeOpacity={onPress ? 0.7 : 1} style={styles.settingsItem}>
      <View style={[styles.settingsIcon, { backgroundColor: (iconColor || COLORS.primary) + "20" }]}>
        <MaterialCommunityIcons name={icon} size={22} color={iconColor || COLORS.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemTitle}>{title}</Text>
        {desc ? <Text style={styles.itemDesc}>{desc}</Text> : null}
      </View>
      {right || null}
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Profile Card */}
      <LinearGradient colors={COLORS.gradientPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.email ? user.email[0].toUpperCase() : "?"}
          </Text>
        </View>
        <Text style={styles.profileEmail}>{user?.email || "Loading..."}</Text>
        <Text style={styles.profileSince}>
          Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "..."}
        </Text>
      </LinearGradient>

      {/* Preferences */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.card}>
          <SettingsItem icon="currency-inr" iconColor={COLORS.warning} title="Currency" desc={currency}
            right={
              <View style={styles.currencyRow}>
                {["INR", "USD", "EUR"].map(c => (
                  <TouchableOpacity key={c} onPress={() => setCurrency(c)} activeOpacity={0.7}>
                    {currency === c ? (
                      <LinearGradient colors={COLORS.gradientPrimary} style={styles.currencyChip}>
                        <Text style={styles.currencyTextActive}>{c}</Text>
                      </LinearGradient>
                    ) : (
                      <View style={[styles.currencyChip, styles.currencyInactive]}>
                        <Text style={styles.currencyText}>{c}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            }
          />
          <View style={styles.divider} />
          <SettingsItem icon="bell" iconColor={COLORS.info} title="Notifications"
            right={<Switch value={notifications} onValueChange={setNotifications} color={COLORS.primary} />}
          />
        </View>
      </View>

      {/* Data */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data</Text>
        <View style={styles.card}>
          <SettingsItem icon="download" iconColor={COLORS.teal} title="Export Transactions" desc="Download as CSV file" onPress={handleExportData} />
        </View>
      </View>

      {/* About */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.card}>
          <SettingsItem icon="information" iconColor={COLORS.info} title="Version" desc="1.0.0" />
          <View style={styles.divider} />
          <SettingsItem icon="code-tags" iconColor={COLORS.secondary} title="Built with" desc="React Native + Expo + Supabase" />
        </View>
      </View>

      {/* Actions */}
      <View style={styles.section}>
        <TouchableOpacity onPress={handleLogout} activeOpacity={0.7}>
          <View style={styles.logoutBtn}>
            <MaterialCommunityIcons name="logout" size={20} color={COLORS.warning} />
            <Text style={styles.logoutText}>Logout</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleDeleteAccount} activeOpacity={0.7} style={{ marginTop: 10 }}>
          <View style={styles.deleteBtn}>
            <MaterialCommunityIcons name="delete-forever" size={20} color={COLORS.danger} />
            <Text style={styles.deleteText}>Delete Account</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 20 },
  profileCard: {
    borderRadius: RADIUS.lg, padding: 28, alignItems: "center", marginBottom: 24, ...SHADOWS.glow,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center", alignItems: "center", marginBottom: 14,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.3)",
  },
  avatarText: { color: "#fff", fontSize: 28, fontWeight: "900" },
  profileEmail: { color: "#fff", fontSize: 18, fontWeight: "700" },
  profileSince: { color: "rgba(255,255,255,0.6)", fontSize: 13, marginTop: 4 },
  section: { marginBottom: 20 },
  sectionTitle: { color: COLORS.textMuted, fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, marginLeft: 4 },
  card: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border, overflow: "hidden",
  },
  settingsItem: { flexDirection: "row", alignItems: "center", padding: 16, gap: 14 },
  settingsIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  itemTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  itemDesc: { color: COLORS.textMuted, fontSize: 13, marginTop: 2 },
  divider: { height: 1, backgroundColor: COLORS.border, marginHorizontal: 16 },
  currencyRow: { flexDirection: "row", gap: 6 },
  currencyChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: RADIUS.sm },
  currencyInactive: { backgroundColor: COLORS.bgInput, borderWidth: 1, borderColor: COLORS.border },
  currencyText: { color: COLORS.textMuted, fontWeight: "600", fontSize: 12 },
  currencyTextActive: { color: "#fff", fontWeight: "800", fontSize: 12 },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, paddingVertical: 16,
    borderWidth: 1, borderColor: COLORS.warning + "40",
  },
  logoutText: { color: COLORS.warning, fontWeight: "800", fontSize: 15 },
  deleteBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, paddingVertical: 16,
    borderWidth: 1, borderColor: COLORS.danger + "40",
  },
  deleteText: { color: COLORS.danger, fontWeight: "800", fontSize: 15 },
});
