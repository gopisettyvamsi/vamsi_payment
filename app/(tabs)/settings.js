import { useState, useEffect } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { Text, Card, Button, List, Switch, Divider, TextInput } from "react-native-paper";
import { supabase } from "../../lib/supabase";
import { showAlert, showMessage } from "../../lib/alert";

export default function Settings() {
  const [user, setUser] = useState(null);
  const [currency, setCurrency] = useState("INR");
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  const handleLogout = async () => {
    showAlert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await supabase.auth.signOut();
        },
      },
    ]);
  };

  const handleDeleteAccount = async () => {
    showAlert(
      "Delete Account",
      "This will permanently delete your account and all transactions. This cannot be undone!",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!user) return;
            // Delete all user transactions first
            await supabase.from("transactions").delete().eq("user_id", user.id);
            await supabase.auth.signOut();
            showAlert("Deleted", "Your account data has been removed.");
          },
        },
      ]
    );
  };

  const handleExportData = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false });

    if (!data || data.length === 0) {
      showAlert("No Data", "No transactions to export");
      return;
    }

    // Create CSV
    const headers = "date,amount,type,category,description,source\n";
    const rows = data.map(t =>
      `${new Date(t.date).toISOString().split("T")[0]},${t.amount},${t.type},${t.category},"${t.description || ""}",${t.source}`
    ).join("\n");

    const csv = headers + rows;

    showAlert(
      "Export Ready",
      `${data.length} transactions ready to export.\n\nOn mobile, this would save to your device.\nOn web, this would download as a file.`,
      [{ text: "OK" }]
    );
  };

  return (
    <ScrollView style={styles.container}>
      {/* Account */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>Account</Text>
          <List.Item
            title="Email"
            description={user?.email || "Loading..."}
            left={(props) => <List.Icon {...props} icon="email" />}
          />
          <List.Item
            title="Member since"
            description={user?.created_at ? new Date(user.created_at).toLocaleDateString() : "..."}
            left={(props) => <List.Icon {...props} icon="calendar" />}
          />
        </Card.Content>
      </Card>

      {/* Preferences */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>Preferences</Text>
          <List.Item
            title="Currency"
            description={currency}
            left={(props) => <List.Icon {...props} icon="currency-inr" />}
            right={() => (
              <View style={{ flexDirection: "row", gap: 4 }}>
                {["INR", "USD", "EUR"].map(c => (
                  <Button
                    key={c}
                    mode={currency === c ? "contained" : "outlined"}
                    compact
                    onPress={() => setCurrency(c)}
                    style={{ borderRadius: 4 }}
                  >
                    {c}
                  </Button>
                ))}
              </View>
            )}
          />
          <Divider />
          <List.Item
            title="Notifications"
            left={(props) => <List.Icon {...props} icon="bell" />}
            right={() => (
              <Switch value={notifications} onValueChange={setNotifications} color="#6C63FF" />
            )}
          />
        </Card.Content>
      </Card>

      {/* Data */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>Data</Text>
          <Button
            mode="outlined"
            onPress={handleExportData}
            icon="download"
            style={styles.btn}
          >
            Export Transactions (CSV)
          </Button>
        </Card.Content>
      </Card>

      {/* About */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>About</Text>
          <List.Item title="Version" description="1.0.0" left={(props) => <List.Icon {...props} icon="information" />} />
          <List.Item title="Built with" description="React Native + Expo + Supabase" left={(props) => <List.Icon {...props} icon="code-tags" />} />
        </Card.Content>
      </Card>

      {/* Actions */}
      <Button
        mode="outlined"
        onPress={handleLogout}
        icon="logout"
        textColor="#E65100"
        style={[styles.btn, { borderColor: "#E65100", marginHorizontal: 0 }]}
      >
        Logout
      </Button>

      <Button
        mode="outlined"
        onPress={handleDeleteAccount}
        icon="delete-forever"
        textColor="#C62828"
        style={[styles.btn, { borderColor: "#C62828", marginHorizontal: 0, marginTop: 8 }]}
      >
        Delete Account
      </Button>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA", padding: 16 },
  card: { borderRadius: 12, marginBottom: 16, backgroundColor: "#fff", elevation: 2 },
  sectionTitle: { fontWeight: "bold", marginBottom: 8 },
  btn: { borderRadius: 8, marginTop: 8 },
});
