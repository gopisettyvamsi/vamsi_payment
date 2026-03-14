import { useState } from "react";
import { View, ScrollView, StyleSheet, Platform, Linking } from "react-native";
/* global fetch */
import { Text, Card, Button, List, ProgressBar, Chip, Divider } from "react-native-paper";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import Papa from "papaparse";
import { supabase } from "../../lib/supabase";
import { parseCSVRow, parseSMS, parseEmailTransaction } from "../../lib/helpers";
import { showAlert, showMessage } from "../../lib/alert";

export default function Import() {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);

  // ===== CSV IMPORT =====
  const handleCSVImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/comma-separated-values", "application/vnd.ms-excel"],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      setImporting(true);
      setProgress(0);
      setResults(null);

      const file = result.assets[0];
      const content = await FileSystem.readAsStringAsync(file.uri);

      const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });

      if (parsed.errors.length > 0) {
        showAlert("CSV Error", `Found ${parsed.errors.length} errors in the file`);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let imported = 0;
      let failed = 0;
      const rows = parsed.data;

      for (let i = 0; i < rows.length; i++) {
        try {
          const tx = parseCSVRow(rows[i]);
          if (tx.amount > 0) {
            await supabase.from("transactions").insert({
              ...tx,
              user_id: user.id,
              date: new Date(tx.date).toISOString(),
            });
            imported++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
        setProgress((i + 1) / rows.length);
      }

      setResults({ imported, failed, total: rows.length });
      setImporting(false);
    } catch (err) {
      showAlert("Error", "Failed to import CSV file");
      setImporting(false);
    }
  };

  // ===== GMAIL IMPORT =====
  const handleGmailImport = async () => {
    // Gmail API requires OAuth setup. This opens the setup guide.
    showAlert(
      "Gmail Import Setup",
      "To import transactions from Gmail:\n\n" +
      "1. Go to Google Cloud Console\n" +
      "2. Create a project & enable Gmail API\n" +
      "3. Create OAuth credentials\n" +
      "4. Add credentials to Settings\n\n" +
      "This is a one-time setup. Would you like to see the guide?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Open Guide",
          onPress: () => Linking.openURL("https://console.cloud.google.com/apis/library/gmail.googleapis.com"),
        },
      ]
    );
  };

  // Simulated email parsing (once Gmail OAuth is set up)
  const fetchGmailTransactions = async (accessToken) => {
    try {
      setImporting(true);
      setProgress(0);

      // Search for bank alert emails
      const searchQuery = "subject:(transaction OR debit OR credit OR payment) newer_than:30d";
      const response = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(searchQuery)}&maxResults=50`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const data = await response.json();

      if (!data.messages) {
        showAlert("No Emails", "No transaction emails found in the last 30 days");
        setImporting(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      let imported = 0;
      let failed = 0;

      for (let i = 0; i < data.messages.length; i++) {
        try {
          const msgRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${data.messages[i].id}`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          const msg = await msgRes.json();

          const subject = msg.payload.headers.find(h => h.name === "Subject")?.value || "";
          const body = msg.snippet || "";

          const tx = parseEmailTransaction(subject, body);
          if (tx && tx.amount > 0 && tx.type) {
            await supabase.from("transactions").insert({
              ...tx,
              user_id: user.id,
            });
            imported++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
        setProgress((i + 1) / data.messages.length);
      }

      setResults({ imported, failed, total: data.messages.length });
      setImporting(false);
    } catch (err) {
      showAlert("Error", "Failed to fetch Gmail messages");
      setImporting(false);
    }
  };

  // ===== SMS IMPORT (Android only) =====
  const handleSMSImport = async () => {
    if (Platform.OS !== "android") {
      showAlert("Android Only", "SMS import is only available on Android devices");
      return;
    }

    try {
      // Note: SMS reading requires a native module.
      // In production, you'd use react-native-get-sms-android
      // For Expo, this requires a development build (not Expo Go)
      showAlert(
        "SMS Import",
        "SMS import requires a custom development build.\n\n" +
        "Steps:\n" +
        "1. Run: npx expo prebuild\n" +
        "2. Install react-native-get-sms-android\n" +
        "3. Build custom APK\n\n" +
        "The app will then read bank SMS messages and auto-detect transactions.",
        [{ text: "OK" }]
      );
    } catch (err) {
      showAlert("Error", "Failed to read SMS messages");
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>Import Transactions</Text>

      {/* CSV Import */}
      <Card style={styles.card}>
        <Card.Content>
          <List.Item
            title="CSV / Excel Import"
            description="Upload bank statement CSV files"
            left={(props) => <List.Icon {...props} icon="file-delimited" color="#6C63FF" />}
          />
          <Text variant="bodySmall" style={styles.hint}>
            Supported columns: date, amount, type (income/expense), category, description
          </Text>
          <Button
            mode="contained"
            onPress={handleCSVImport}
            loading={importing}
            disabled={importing}
            icon="upload"
            style={styles.btn}
          >
            Upload CSV File
          </Button>
        </Card.Content>
      </Card>

      {/* Gmail Import */}
      <Card style={styles.card}>
        <Card.Content>
          <List.Item
            title="Gmail Email Import"
            description="Auto-detect transactions from bank emails"
            left={(props) => <List.Icon {...props} icon="gmail" color="#EA4335" />}
          />
          <Text variant="bodySmall" style={styles.hint}>
            Reads bank alert emails and extracts transaction details automatically
          </Text>
          <Button
            mode="contained"
            onPress={handleGmailImport}
            icon="email"
            style={[styles.btn, { backgroundColor: "#EA4335" }]}
          >
            Connect Gmail
          </Button>
        </Card.Content>
      </Card>

      {/* SMS Import */}
      <Card style={styles.card}>
        <Card.Content>
          <List.Item
            title="SMS Import (Android)"
            description="Auto-detect transactions from bank SMS"
            left={(props) => <List.Icon {...props} icon="message-text" color="#4ECDC4" />}
          />
          <Text variant="bodySmall" style={styles.hint}>
            Reads bank SMS messages like "Rs 500 debited from A/C XX1234"
          </Text>
          <Chip icon="android" style={{ alignSelf: "flex-start", marginBottom: 8 }}>
            Android Only
          </Chip>
          <Button
            mode="contained"
            onPress={handleSMSImport}
            icon="message-processing"
            style={[styles.btn, { backgroundColor: "#4ECDC4" }]}
          >
            Import from SMS
          </Button>
        </Card.Content>
      </Card>

      {/* Progress */}
      {importing && (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={{ marginBottom: 8 }}>Importing...</Text>
            <ProgressBar progress={progress} color="#6C63FF" style={{ height: 8, borderRadius: 4 }} />
            <Text variant="bodySmall" style={{ marginTop: 4 }}>
              {Math.round(progress * 100)}% complete
            </Text>
          </Card.Content>
        </Card>
      )}

      {/* Results */}
      {results && (
        <Card style={[styles.card, { backgroundColor: "#E8F5E9" }]}>
          <Card.Content>
            <Text variant="titleMedium" style={{ fontWeight: "bold", marginBottom: 8 }}>
              Import Complete!
            </Text>
            <Text variant="bodyMedium">Total rows: {results.total}</Text>
            <Text variant="bodyMedium" style={{ color: "#2E7D32" }}>
              Imported: {results.imported}
            </Text>
            <Text variant="bodyMedium" style={{ color: "#C62828" }}>
              Skipped/Failed: {results.failed}
            </Text>
          </Card.Content>
        </Card>
      )}

      {/* CSV Format Guide */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={{ fontWeight: "bold", marginBottom: 8 }}>
            CSV Format Guide
          </Text>
          <Text variant="bodySmall" style={styles.codeBlock}>
            date,amount,type,category,description{"\n"}
            2024-01-15,500,expense,food,Lunch at restaurant{"\n"}
            2024-01-16,50000,income,salary,January salary{"\n"}
            2024-01-17,1200,expense,transport,Uber ride
          </Text>
        </Card.Content>
      </Card>

      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA", padding: 16 },
  title: { fontWeight: "bold", marginBottom: 16 },
  card: { borderRadius: 12, marginBottom: 16, backgroundColor: "#fff", elevation: 2 },
  btn: { borderRadius: 8, marginTop: 8 },
  hint: { color: "#999", marginBottom: 8, paddingLeft: 16 },
  codeBlock: {
    backgroundColor: "#f5f5f5",
    padding: 12,
    borderRadius: 8,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    lineHeight: 20,
  },
});
