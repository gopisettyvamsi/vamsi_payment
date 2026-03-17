import { useState } from "react";
import { View, ScrollView, StyleSheet, Platform, TouchableOpacity } from "react-native";
/* global fetch */
import { Text, Button, ProgressBar } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import Papa from "papaparse";
import { supabase } from "../../lib/supabase";
import { parseCSVRow, parseEmailTransaction } from "../../lib/helpers";
import { showAlert, showMessage } from "../../lib/alert";
import { COLORS, SHADOWS, RADIUS } from "../../lib/theme";

export default function Import() {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);

  const handleCSVImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/comma-separated-values", "application/vnd.ms-excel"],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      setImporting(true); setProgress(0); setResults(null);
      const file = result.assets[0];
      const content = await FileSystem.readAsStringAsync(file.uri);
      const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });
      if (parsed.errors.length > 0) showAlert("CSV Error", `Found ${parsed.errors.length} errors in the file`);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      let imported = 0, failed = 0;
      const rows = parsed.data;
      for (let i = 0; i < rows.length; i++) {
        try {
          const tx = parseCSVRow(rows[i]);
          if (tx.amount > 0) { await supabase.from("transactions").insert({ ...tx, user_id: user.id, date: new Date(tx.date).toISOString() }); imported++; }
          else failed++;
        } catch { failed++; }
        setProgress((i + 1) / rows.length);
      }
      setResults({ imported, failed, total: rows.length }); setImporting(false);
    } catch { showAlert("Error", "Failed to import CSV file"); setImporting(false); }
  };

  const handleGmailImport = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.provider_token) {
        showAlert("Google Login Required", "Please log out and log back in with Google to grant Gmail access.", [{ text: "OK" }]);
        return;
      }
      await fetchGmailTransactions(session.provider_token);
    } catch { showAlert("Error", "Failed to connect to Gmail"); }
  };

  const fetchGmailTransactions = async (accessToken) => {
    try {
      setImporting(true); setProgress(0);
      const searchQuery = "subject:(transaction OR debit OR credit OR payment) newer_than:30d";
      const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(searchQuery)}&maxResults=50`, { headers: { Authorization: `Bearer ${accessToken}` } });
      const data = await response.json();
      if (!data.messages) { showAlert("No Emails", "No transaction emails found in the last 30 days"); setImporting(false); return; }
      const { data: { user } } = await supabase.auth.getUser();
      let imported = 0, failed = 0;
      for (let i = 0; i < data.messages.length; i++) {
        try {
          const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${data.messages[i].id}`, { headers: { Authorization: `Bearer ${accessToken}` } });
          const msg = await msgRes.json();
          const subject = msg.payload.headers.find(h => h.name === "Subject")?.value || "";
          const body = msg.snippet || "";
          const tx = parseEmailTransaction(subject, body);
          if (tx && tx.amount > 0 && tx.type) { await supabase.from("transactions").insert({ ...tx, user_id: user.id }); imported++; }
          else failed++;
        } catch { failed++; }
        setProgress((i + 1) / data.messages.length);
      }
      setResults({ imported, failed, total: data.messages.length }); setImporting(false);
    } catch { showAlert("Error", "Failed to fetch Gmail messages"); setImporting(false); }
  };

  const handleSMSImport = async () => {
    if (Platform.OS !== "android") { showAlert("Android Only", "SMS import is only available on Android devices"); return; }
    showAlert("SMS Import", "SMS import requires a custom development build.\n\n1. Run: npx expo prebuild\n2. Install react-native-get-sms-android\n3. Build custom APK", [{ text: "OK" }]);
  };

  const ImportCard = ({ icon, iconColor, gradientColors, title, desc, btnText, onPress }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <LinearGradient colors={gradientColors} style={styles.iconBg}>
          <MaterialCommunityIcons name={icon} size={24} color="#fff" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardDesc}>{desc}</Text>
        </View>
      </View>
      <TouchableOpacity onPress={onPress} disabled={importing} activeOpacity={0.7}>
        <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cardBtn}>
          <MaterialCommunityIcons name={icon} size={18} color="#fff" />
          <Text style={styles.cardBtnText}>{btnText}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Import Transactions</Text>
      <Text style={styles.subtitle}>Bring in your transactions from various sources</Text>

      <ImportCard icon="file-delimited" gradientColors={COLORS.gradientPurple}
        title="CSV / Excel Import" desc="Upload bank statement CSV files"
        btnText="Upload CSV File" onPress={handleCSVImport} />

      <ImportCard icon="gmail" gradientColors={["#EA4335", "#FF6B6B"]}
        title="Gmail Email Import" desc="Auto-detect transactions from bank emails"
        btnText="Connect Gmail" onPress={handleGmailImport} />

      <ImportCard icon="message-text" gradientColors={COLORS.gradientTeal}
        title="SMS Import (Android)" desc="Auto-detect transactions from bank SMS"
        btnText="Import from SMS" onPress={handleSMSImport} />

      {importing && (
        <View style={styles.progressCard}>
          <Text style={styles.progressTitle}>Importing...</Text>
          <ProgressBar progress={progress} color={COLORS.primary} style={styles.progressBar} />
          <Text style={styles.progressText}>{Math.round(progress * 100)}% complete</Text>
        </View>
      )}

      {results && (
        <LinearGradient colors={COLORS.gradientGreen} style={styles.resultsCard}>
          <Text style={styles.resultsTitle}>Import Complete!</Text>
          <View style={styles.resultsRow}>
            <View style={styles.resultItem}>
              <Text style={styles.resultNum}>{results.total}</Text>
              <Text style={styles.resultLabel}>Total</Text>
            </View>
            <View style={styles.resultItem}>
              <Text style={[styles.resultNum, { color: "#fff" }]}>{results.imported}</Text>
              <Text style={styles.resultLabel}>Imported</Text>
            </View>
            <View style={styles.resultItem}>
              <Text style={[styles.resultNum, { color: "rgba(255,255,255,0.6)" }]}>{results.failed}</Text>
              <Text style={styles.resultLabel}>Skipped</Text>
            </View>
          </View>
        </LinearGradient>
      )}

      {/* CSV Format Guide */}
      <View style={styles.guideCard}>
        <Text style={styles.guideTitle}>CSV Format Guide</Text>
        <View style={styles.codeBlock}>
          <Text style={styles.codeText}>
            date,amount,type,category,description{"\n"}
            2024-01-15,500,expense,food,Lunch{"\n"}
            2024-01-16,50000,income,salary,January{"\n"}
            2024-01-17,1200,expense,transport,Uber
          </Text>
        </View>
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 20 },
  title: { color: "#fff", fontSize: 24, fontWeight: "900", letterSpacing: 0.3 },
  subtitle: { color: COLORS.textMuted, fontSize: 14, marginBottom: 24, marginTop: 4 },
  card: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, padding: 20,
    marginBottom: 16, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.soft,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 },
  iconBg: { width: 48, height: 48, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  cardTitle: { color: "#fff", fontSize: 16, fontWeight: "800" },
  cardDesc: { color: COLORS.textMuted, fontSize: 13, marginTop: 2 },
  cardBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 14, borderRadius: RADIUS.md,
  },
  cardBtnText: { color: "#fff", fontWeight: "800", fontSize: 14, letterSpacing: 0.3 },
  progressCard: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, padding: 20,
    marginBottom: 16, borderWidth: 1, borderColor: COLORS.border,
  },
  progressTitle: { color: "#fff", fontWeight: "800", fontSize: 16, marginBottom: 12 },
  progressBar: { height: 8, borderRadius: 4, backgroundColor: COLORS.bgInput },
  progressText: { color: COLORS.textMuted, marginTop: 8, fontSize: 13 },
  resultsCard: { borderRadius: RADIUS.lg, padding: 24, marginBottom: 16 },
  resultsTitle: { color: "#fff", fontWeight: "900", fontSize: 18, marginBottom: 16, textAlign: "center" },
  resultsRow: { flexDirection: "row", justifyContent: "space-around" },
  resultItem: { alignItems: "center" },
  resultNum: { color: "#fff", fontSize: 28, fontWeight: "900" },
  resultLabel: { color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 4, fontWeight: "600" },
  guideCard: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, padding: 20,
    borderWidth: 1, borderColor: COLORS.border,
  },
  guideTitle: { color: "#fff", fontWeight: "800", fontSize: 16, marginBottom: 12 },
  codeBlock: {
    backgroundColor: COLORS.bgInput, padding: 16, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  codeText: { color: COLORS.textSecondary, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 12, lineHeight: 20 },
});
