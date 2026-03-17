import { useState } from "react";
import { View, ScrollView, StyleSheet, Platform, TouchableOpacity } from "react-native";
/* global fetch */
import { Text, ProgressBar } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import Papa from "papaparse";
import { supabase } from "../../lib/supabase";
import { parseCSVRow, parseEmailTransaction } from "../../lib/helpers";
import { showAlert } from "../../lib/alert";
import { C } from "../../lib/theme";

export default function Import() {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);

  const handleCSV = async () => {
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: ["text/csv", "text/comma-separated-values", "application/vnd.ms-excel"], copyToCacheDirectory: true });
      if (r.canceled) return;
      setImporting(true); setProgress(0); setResults(null);
      const content = await FileSystem.readAsStringAsync(r.assets[0].uri);
      const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      let imp = 0, fail = 0;
      for (let i = 0; i < parsed.data.length; i++) {
        try { const tx = parseCSVRow(parsed.data[i]); if (tx.amount > 0) { await supabase.from("transactions").insert({ ...tx, user_id: user.id, date: new Date(tx.date).toISOString() }); imp++; } else fail++; }
        catch { fail++; }
        setProgress((i + 1) / parsed.data.length);
      }
      setResults({ imported: imp, failed: fail, total: parsed.data.length }); setImporting(false);
    } catch { showAlert("Error", "Failed to import CSV"); setImporting(false); }
  };

  const handleGmail = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.provider_token) { showAlert("Google Login Required", "Log out and log back in with Google to grant Gmail access."); return; }
      setImporting(true); setProgress(0); setResults(null);
      const q = "subject:(transaction OR debit OR credit OR payment) newer_than:30d";
      const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=50`, { headers: { Authorization: `Bearer ${session.provider_token}` } });
      const data = await res.json();
      if (!data.messages) { showAlert("No Emails", "No transaction emails found"); setImporting(false); return; }
      const { data: { user } } = await supabase.auth.getUser();
      let imp = 0, fail = 0;
      for (let i = 0; i < data.messages.length; i++) {
        try {
          const mr = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${data.messages[i].id}`, { headers: { Authorization: `Bearer ${session.provider_token}` } });
          const msg = await mr.json();
          const subj = msg.payload.headers.find(h => h.name === "Subject")?.value || "";
          const tx = parseEmailTransaction(subj, msg.snippet || "");
          if (tx?.amount > 0 && tx?.type) { await supabase.from("transactions").insert({ ...tx, user_id: user.id }); imp++; } else fail++;
        } catch { fail++; }
        setProgress((i + 1) / data.messages.length);
      }
      setResults({ imported: imp, failed: fail, total: data.messages.length }); setImporting(false);
    } catch { showAlert("Error", "Failed to fetch Gmail"); setImporting(false); }
  };

  const handleSMS = () => {
    if (Platform.OS !== "android") { showAlert("Android Only", "SMS import only works on Android"); return; }
    showAlert("Coming Soon", "SMS import requires a custom build. Use CSV or Gmail for now.");
  };

  const Card = ({ icon, color, title, desc, btnText, onPress }) => (
    <TouchableOpacity onPress={onPress} disabled={importing} activeOpacity={0.7} style={s.card}>
      <View style={s.cardRow}>
        <View style={[s.iconBox, { backgroundColor: color + "18" }]}>
          <MaterialCommunityIcons name={icon} size={28} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle}>{title}</Text>
          <Text style={s.cardDesc}>{desc}</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={24} color="#ddd" />
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      <Text style={s.title}>Import</Text>
      <Text style={s.subtitle}>Bring in transactions from external sources</Text>

      <Card icon="file-delimited-outline" color={C.purple} title="CSV File" desc="Upload bank statement" onPress={handleCSV} />
      <Card icon="gmail" color="#EA4335" title="Gmail" desc="Auto-detect bank emails" onPress={handleGmail} />
      <Card icon="message-text-outline" color={C.teal} title="SMS (Android)" desc="Read bank SMS alerts" onPress={handleSMS} />

      {importing && (
        <View style={s.progressCard}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
            <Text style={{ color: C.textDark, fontWeight: "700" }}>Importing...</Text>
            <Text style={{ color: C.purple, fontWeight: "800" }}>{Math.round(progress * 100)}%</Text>
          </View>
          <ProgressBar progress={progress} color={C.purple} style={{ height: 6, borderRadius: 3, backgroundColor: "#F0F0F5" }} />
        </View>
      )}

      {results && (
        <View style={s.resultCard}>
          <MaterialCommunityIcons name="check-circle" size={40} color={C.green} style={{ alignSelf: "center", marginBottom: 12 }} />
          <Text style={s.resultTitle}>Import Complete!</Text>
          <View style={s.resultRow}>
            <View style={s.resultItem}><Text style={s.resultNum}>{results.total}</Text><Text style={s.resultLabel}>Total</Text></View>
            <View style={s.resultItem}><Text style={[s.resultNum, { color: C.green }]}>{results.imported}</Text><Text style={s.resultLabel}>Success</Text></View>
            <View style={s.resultItem}><Text style={[s.resultNum, { color: C.red }]}>{results.failed}</Text><Text style={s.resultLabel}>Failed</Text></View>
          </View>
        </View>
      )}

      {/* CSV Guide */}
      <View style={s.guideCard}>
        <Text style={{ color: C.textDark, fontWeight: "700", marginBottom: 10, fontSize: 14 }}>CSV Format</Text>
        <View style={s.codeBlock}>
          <Text style={s.code}>date,amount,type,category,description{"\n"}2024-01-15,500,expense,food,Lunch{"\n"}2024-01-16,50000,income,salary,Jan</Text>
        </View>
      </View>

      <View style={{ height: 80 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, padding: 16 },
  title: { color: "#fff", fontSize: 24, fontWeight: "900" },
  subtitle: { color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 20, marginTop: 4 },
  card: { backgroundColor: C.card, borderRadius: 16, marginBottom: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  cardRow: { flexDirection: "row", alignItems: "center", padding: 18, gap: 14 },
  iconBox: { width: 52, height: 52, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  cardTitle: { color: C.textDark, fontSize: 15, fontWeight: "700" },
  cardDesc: { color: "#999", fontSize: 12, marginTop: 2 },
  progressCard: { backgroundColor: C.card, borderRadius: 16, padding: 20, marginTop: 10, marginBottom: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  resultCard: { backgroundColor: C.card, borderRadius: 16, padding: 24, marginTop: 10, marginBottom: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  resultTitle: { color: C.textDark, fontWeight: "800", fontSize: 18, textAlign: "center", marginBottom: 16 },
  resultRow: { flexDirection: "row", justifyContent: "space-around" },
  resultItem: { alignItems: "center" },
  resultNum: { fontSize: 28, fontWeight: "900", color: C.textDark },
  resultLabel: { color: "#999", fontSize: 11, fontWeight: "600", marginTop: 2 },
  guideCard: { backgroundColor: C.card, borderRadius: 16, padding: 18, marginTop: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  codeBlock: { backgroundColor: "#F8F8FA", borderRadius: 12, padding: 14 },
  code: { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 11, color: "#666", lineHeight: 18 },
});
