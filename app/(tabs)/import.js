import { useState, useRef, useEffect } from "react";
import { View, ScrollView, StyleSheet, Platform, TouchableOpacity, Animated, Modal, Pressable, TextInput } from "react-native";
/* global fetch */
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import Papa from "papaparse";
import { supabase } from "../../lib/supabase";
import { parseCSVRow, parseEmailTransaction, autoCategorizeTx } from "../../lib/helpers";
import { showAlert } from "../../lib/alert";
import { useTheme } from "../../lib/ThemeContext";
import { getItem, KEYS } from "../../lib/storage";

const TEST_USER_EMAIL = "gopisettyvamsi.159@gmail.com";

const TEST_EMAILS = [
  { subject: "Payment of Rs. 325.70 to Zomato APL was successful", body: "Your payment of Rs. 325.70 to Zomato APL has been debited from your account. Transaction ID: ZMT20260318. Merchant: Zomato." },
  { subject: "Transaction Alert: Rs 1,249 debited - Amazon Pay", body: "Rs 1,249.00 has been debited from your account for your Amazon purchase. Order ID: 402-7293847. Payment Method: UPI." },
  { subject: "Uber Trip Receipt - Payment of Rs. 187 debited", body: "Your Uber trip has ended. Trip fare: Rs. 187.00. Payment: Debited from linked account. Pickup: Madhapur. Drop: HITEC City." },
  { subject: "Swiggy Order Confirmed - Rs 456 payment successful", body: "Your Swiggy order has been placed! Amount Paid: Rs 456.00. Restaurant: Paradise Biryani. Payment: Debited via UPI." },
  { subject: "Netflix Subscription - Rs 649 debited from your account", body: "Your Netflix monthly subscription of Rs 649.00 has been charged. Plan: Standard. Payment Method: Credit Card ending 4521." },
  { subject: "Airtel Broadband Bill Payment - Rs 999 debited", body: "Your Airtel broadband bill of Rs 999 has been paid successfully. Plan: 100 Mbps Unlimited. Billing Month: March 2026." },
  { subject: "Zepto Quick Delivery - Rs 28 payment debited", body: "Your Zepto order of Rs 28.00 has been delivered. Items: Milk 500ml x 1. Payment: Rs 28 debited via UPI." },
  { subject: "Flipkart Purchase - Rs 3,499 debited for Electronics", body: "Thank you for your purchase on Flipkart! Product: boAt Airdopes 141. Amount: Rs 3,499.00. Payment: Debited from account." },
  { subject: "Apollo Pharmacy - Rs 850 payment debited", body: "Apollo Pharmacy - Payment Receipt. Amount Paid: Rs 850.00. Store: Apollo Pharmacy, Gachibowli. Items: Prescription medicines." },
  { subject: "BESCOM Electricity Bill - Rs 2,340 debited", body: "Electricity Bill Payment Successful. Amount: Rs 2,340.00. Consumer No: 123456789. Billing Period: Feb 2026. Units: 245." },
  { subject: "Salary Credit - Rs 45,000 credited to your account", body: "Rs 45,000.00 has been credited to your account. Description: Salary for March 2026. From: TechCorp Solutions Pvt Ltd." },
  { subject: "Refund of Rs 1,249 credited - Amazon Order Cancelled", body: "Rs 1,249.00 has been credited to your account as a refund. Reason: Order cancelled by customer." },
  { subject: "UPI Payment Received - Rs 2,500 credited to your account", body: "You have received Rs 2,500.00 via UPI. From: Rahul Sharma. Remarks: Freelance payment." },
  { subject: "Cashback of Rs 50 credited - Paytm Wallet", body: "Rs 50.00 cashback has been credited to your Paytm wallet. Offer: 10% cashback on first Swiggy order." },
  { subject: "Groww - Dividend of Rs 1,200 credited to your account", body: "Dividend of Rs 1,200.00 has been credited to your bank account. Fund: HDFC Mid-Cap Opportunities Fund." },
];

export default function Import() {
  const { theme } = useTheme();
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const [activeSource, setActiveSource] = useState(null);
  const [showGmailRange, setShowGmailRange] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testProgress, setTestProgress] = useState(0);
  const [isDevUser, setIsDevUser] = useState(false);
  const [testMode, setTestMode] = useState("self"); // "self" or "targeted"
  const [targetEmail, setTargetEmail] = useState("");
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsDevUser(user?.email === TEST_USER_EMAIL);
    });
  }, []);

  const GMAIL_RANGES = [
    { key: "7d", label: "Last 7 days", query: "newer_than:7d", icon: "calendar-today" },
    { key: "30d", label: "Last 30 days", query: "newer_than:30d", icon: "calendar-week" },
    { key: "90d", label: "Last 3 months", query: "newer_than:90d", icon: "calendar-month" },
    { key: "180d", label: "Last 6 months", query: "newer_than:180d", icon: "calendar-range" },
    { key: "365d", label: "Last 1 year", query: "newer_than:365d", icon: "calendar-star" },
  ];

  const animateProgress = (to) => {
    setProgress(to);
    Animated.timing(progressAnim, { toValue: to, duration: 150, useNativeDriver: false }).start();
  };

  const readFileContent = async (asset) => {
    if (Platform.OS === "web") {
      // On web, fetch the blob URI and read as text
      const res = await fetch(asset.uri);
      return await res.text();
    }
    return await FileSystem.readAsStringAsync(asset.uri);
  };

  const handleCSV = async () => {
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: ["text/csv", "text/comma-separated-values", "application/vnd.ms-excel", ".csv"], copyToCacheDirectory: true });
      if (r.canceled) return;
      setImporting(true); setActiveSource("csv"); animateProgress(0); setResults(null);
      const content = await readFileContent(r.assets[0]);
      const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });
      if (!parsed.data?.length) { showAlert("Empty File", "No rows found in CSV"); setImporting(false); setActiveSource(null); return; }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setImporting(false); setActiveSource(null); return; }
      let imp = 0, fail = 0;
      for (let i = 0; i < parsed.data.length; i++) {
        try {
          const tx = parseCSVRow(parsed.data[i]);
          if (tx.amount > 0) {
            await supabase.from("transactions").insert({ ...tx, user_id: user.id, date: new Date(tx.date).toISOString() });
            imp++;
          } else fail++;
        } catch { fail++; }
        animateProgress((i + 1) / parsed.data.length);
      }
      setResults({ imported: imp, failed: fail, total: parsed.data.length }); setImporting(false); setActiveSource(null);
    } catch (err) {
      console.error("CSV import error:", err);
      showAlert("Error", "Failed to import CSV. Make sure the file format is correct.");
      setImporting(false); setActiveSource(null);
    }
  };

  const handleGmailTap = () => {
    setShowGmailRange(true);
  };

  const handleGmail = async (rangeQuery) => {
    setShowGmailRange(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      let token = session?.provider_token;
      // Fallback to stored token if session doesn't have it (after page refresh)
      if (!token) token = await getItem(KEYS.GOOGLE_TOKEN, null);
      if (!token) { showAlert("Google Login Required", "Log out and log back in with Google to grant Gmail access."); return; }
      setImporting(true); setActiveSource("gmail"); animateProgress(0); setResults(null);
      const q = `subject:(transaction OR debit OR credit OR payment) ${rangeQuery}`;
      const authHeader = { Authorization: `Bearer ${token}` };

      // Fetch all message IDs with pagination
      let allMessages = [];
      let pageToken = null;
      do {
        const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=100${pageToken ? `&pageToken=${pageToken}` : ""}`;
        const res = await fetch(url, { headers: authHeader });
        if (res.status === 401) {
          showAlert("Token Expired", "Your Google session has expired. Please log out and log back in with Google.");
          setImporting(false); setActiveSource(null); return;
        }
        const page = await res.json();
        if (page.messages) allMessages = allMessages.concat(page.messages);
        pageToken = page.nextPageToken || null;
      } while (pageToken);

      if (!allMessages.length) { showAlert("No Emails", "No transaction emails found in the selected range"); setImporting(false); setActiveSource(null); return; }
      const { data: { user } } = await supabase.auth.getUser();
      let imp = 0, fail = 0, skipped = 0;
      for (let i = 0; i < allMessages.length; i++) {
        try {
          const mr = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${allMessages[i].id}`, { headers: authHeader });
          const msg = await mr.json();
          const subj = msg.payload.headers.find(h => h.name === "Subject")?.value || "";
          const emailDate = msg.payload.headers.find(h => h.name === "Date")?.value || "";
          const tx = parseEmailTransaction(subj, msg.snippet || "", emailDate);
          if (tx?.amount > 0 && tx?.type) {
            // Check for duplicate: same amount, description, date, and source
            const txDate = new Date(tx.date);
            const dayStart = new Date(txDate.getFullYear(), txDate.getMonth(), txDate.getDate()).toISOString();
            const dayEnd = new Date(txDate.getFullYear(), txDate.getMonth(), txDate.getDate() + 1).toISOString();
            const { data: existing } = await supabase.from("transactions").select("id")
              .eq("user_id", user.id).eq("amount", tx.amount).eq("description", tx.description)
              .gte("date", dayStart).lt("date", dayEnd).limit(1);
            if (existing?.length) { skipped++; }
            else { await supabase.from("transactions").insert({ ...tx, user_id: user.id }); imp++; }
          } else fail++;
        } catch { fail++; }
        animateProgress((i + 1) / allMessages.length);
      }
      setResults({ imported: imp, failed: fail, skipped, total: allMessages.length }); setImporting(false); setActiveSource(null);
    } catch { showAlert("Error", "Failed to fetch Gmail"); setImporting(false); setActiveSource(null); }
  };

  const handleSMS = () => {
    if (Platform.OS !== "android") { showAlert("Android Only", "SMS import only works on Android"); return; }
    showAlert("Coming Soon", "SMS import requires a custom build. Use CSV or Gmail for now.");
  };

  // Send test emails using Gmail API (self or targeted)
  const handleSendTestEmails = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.email !== TEST_USER_EMAIL) {
      showAlert("Not Available", "Test emails are only available for the developer account.");
      return;
    }
    const recipient = testMode === "targeted" ? targetEmail.trim() : user.email;
    if (!recipient) {
      showAlert("Enter Email", "Please enter a target email address.");
      return;
    }
    if (testMode === "targeted" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      showAlert("Invalid Email", "Please enter a valid email address.");
      return;
    }
    let token = session?.provider_token;
    if (!token) token = await getItem(KEYS.GOOGLE_TOKEN, null);
    if (!token) {
      showAlert("Google Login Required", "Log out and log back in with Google to grant Gmail access.");
      return;
    }
    setSendingTest(true);
    setTestProgress(0);
    let sent = 0, failed = 0;
    for (let i = 0; i < TEST_EMAILS.length; i++) {
      try {
        const email = TEST_EMAILS[i];
        const raw = [
          `From: ${user.email}`,
          `To: ${recipient}`,
          `Subject: ${email.subject}`,
          `Date: ${new Date(Date.now() - i * 86400000).toUTCString()}`,
          `Content-Type: text/plain; charset=UTF-8`,
          ``,
          email.body,
        ].join("\r\n");
        const encoded = btoa(unescape(encodeURIComponent(raw)))
          .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ raw: encoded }),
        });
        if (res.ok) sent++;
        else failed++;
      } catch { failed++; }
      setTestProgress(Math.round(((i + 1) / TEST_EMAILS.length) * 100));
    }
    setSendingTest(false);
    setTestProgress(0);
    showAlert("Test Emails Sent", `${sent} emails sent to ${recipient}, ${failed} failed.${testMode === "self" ? '\n\nNow use "Gmail" import above to pull them in!' : ""}`);
  };

  const handlePDF = async () => {
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", ".pdf"], copyToCacheDirectory: true });
      if (r.canceled) return;
      setImporting(true); setActiveSource("pdf"); animateProgress(0); setResults(null);

      if (Platform.OS !== "web") {
        showAlert("Web Only", "PDF import currently works on web only. Use CSV for mobile.");
        setImporting(false); setActiveSource(null); return;
      }

      // On web, try to read PDF as text
      const res = await fetch(r.assets[0].uri);
      const text = await res.text();

      // Try to extract transactions using common bank statement patterns
      const lines = text.split(/\n/);
      const amountRegex = /(?:Rs\.?|₹|INR)\s*([\d,]+\.?\d*)/gi;
      const dateRegex = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/g;

      const found = [];
      for (const line of lines) {
        const amtMatch = line.match(amountRegex);
        const dateMatch = line.match(dateRegex);
        if (amtMatch && amtMatch.length > 0) {
          const amtStr = amtMatch[0].replace(/[^\d.]/g, "").replace(/,/g, "");
          const amount = parseFloat(amtStr);
          if (amount > 0 && amount < 100000000) {
            const isCredit = /credit|cr|deposit|received|refund/i.test(line);
            const type = isCredit ? "income" : "expense";
            let date = new Date().toISOString();
            if (dateMatch) {
              const parsed = new Date(dateMatch[0]);
              if (!isNaN(parsed)) date = parsed.toISOString();
            }
            found.push({ amount, type, date, description: line.trim().slice(0, 100), category: autoCategorizeTx(line), source: "pdf" });
          }
        }
      }

      if (!found.length) { showAlert("No Data", "Could not extract transactions from this PDF. Try CSV format instead."); setImporting(false); setActiveSource(null); return; }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setImporting(false); setActiveSource(null); return; }
      let imp = 0, fail = 0;
      for (let i = 0; i < found.length; i++) {
        try {
          await supabase.from("transactions").insert({ ...found[i], user_id: user.id });
          imp++;
        } catch { fail++; }
        animateProgress((i + 1) / found.length);
      }
      setResults({ imported: imp, failed: fail, skipped: 0, total: found.length }); setImporting(false); setActiveSource(null);
    } catch (err) {
      console.error("PDF import error:", err);
      showAlert("Error", "Failed to import PDF.");
      setImporting(false); setActiveSource(null);
    }
  };

  const downloadTemplate = () => {
    const template = `date,amount,type,category,description
2024-01-15,500,expense,food,Lunch at restaurant
2024-01-16,50000,income,salary,January salary
2024-01-17,200,expense,transport,Uber ride
2024-01-18,1500,expense,shopping,Amazon order
2024-01-19,3000,expense,bills,Electricity bill
2024-01-20,800,expense,entertainment,Movie tickets
2024-01-21,10000,income,freelance,Design project`;
    if (Platform.OS === "web") {
      const blob = new Blob([template], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "vamsify-import-template.csv";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      showAlert("Web Only", "Template download is available on web.");
    }
  };

  const sources = [
    { key: "csv", icon: "file-upload-outline", title: "CSV File", desc: "Upload a bank statement or spreadsheet", onPress: handleCSV },
    { key: "gmail", icon: "email-outline", title: "Gmail", desc: "Auto-detect transactions from bank emails", onPress: handleGmailTap },
    { key: "sms", icon: "message-text-outline", title: "SMS (Android)", desc: "Read transaction alerts from bank SMS", onPress: handleSMS },
    { key: "pdf", icon: "file-document-outline", title: "Bank Statement (PDF)", desc: "Upload PDF bank statement", onPress: handlePDF },
  ];

  return (
    <ScrollView style={[s.container, { backgroundColor: theme.bg }]} showsVerticalScrollIndicator={false}>

      {/* Header */}
      <View style={s.header}>
        <Text style={[s.title, { color: theme.text }]}>Import</Text>
        <Text style={[s.subtitle, { color: theme.textMuted }]}>Bring in transactions from external sources</Text>
      </View>

      {/* Source Cards */}
      <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.surfaceBorder }]}>
        {sources.map((src, i) => {
          const isActive = activeSource === src.key;
          return (
            <View key={src.key}>
              {i > 0 && <View style={[s.sep, { backgroundColor: theme.divider }]} />}
              <TouchableOpacity onPress={src.onPress} disabled={importing} activeOpacity={0.6} style={s.sourceRow}>
                <View style={[s.sourceIcon, { backgroundColor: theme.surface }]}>
                  <MaterialCommunityIcons name={src.icon} size={20} color={theme.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.sourceTitle, { color: theme.text }]}>{src.title}</Text>
                  <Text style={[s.sourceDesc, { color: theme.textMuted }]}>{src.desc}</Text>
                </View>
                {isActive ? (
                  <Text style={[s.percent, { color: theme.accent }]}>{Math.round(progress * 100)}%</Text>
                ) : (
                  <MaterialCommunityIcons name="chevron-right" size={18} color={theme.textDim} />
                )}
              </TouchableOpacity>

              {/* Progress bar inline */}
              {isActive && (
                <View style={[s.progressTrack, { backgroundColor: theme.surface }]}>
                  <Animated.View style={[s.progressFill, {
                    backgroundColor: theme.accent,
                    width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
                  }]} />
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* Results */}
      {results && (
        <View style={[s.resultsCard, { backgroundColor: theme.card, borderColor: theme.surfaceBorder }]}>
          <View style={s.resultsHeader}>
            <View style={[s.checkIcon, { backgroundColor: theme.greenBg }]}>
              <MaterialCommunityIcons name="check" size={18} color={theme.green} />
            </View>
            <Text style={[s.resultsTitle, { color: theme.text }]}>Import complete</Text>
          </View>

          <View style={s.statsRow}>
            {[
              { label: "Total", value: results.total, color: theme.text },
              { label: "Imported", value: results.imported, color: theme.green },
              { label: "Skipped", value: results.skipped || 0, color: results.skipped > 0 ? theme.accent : theme.textMuted },
              { label: "Failed", value: results.failed, color: results.failed > 0 ? theme.red : theme.textMuted },
            ].map(stat => (
              <View key={stat.label} style={[s.statBox, { backgroundColor: theme.surface }]}>
                <Text style={[s.statNum, { color: stat.color }]}>{stat.value}</Text>
                <Text style={[s.statLabel, { color: theme.textMuted }]}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* CSV Format Guide + Template */}
      <View style={[s.guideCard, { backgroundColor: theme.card, borderColor: theme.surfaceBorder }]}>
        <View style={s.guideHeader}>
          <MaterialCommunityIcons name="information-outline" size={16} color={theme.textMuted} />
          <Text style={[s.guideTitle, { color: theme.textSecondary }]}>Expected CSV format</Text>
        </View>
        <View style={[s.codeBlock, { backgroundColor: theme.bg }]}>
          <Text style={[s.codeLine, { color: theme.accent }]}>date,amount,type,category,description</Text>
          <Text style={[s.codeLine, { color: theme.textMuted }]}>2024-01-15,500,expense,food,Lunch</Text>
          <Text style={[s.codeLine, { color: theme.textMuted }]}>2024-01-16,50000,income,salary,Jan</Text>
        </View>
        <TouchableOpacity onPress={downloadTemplate} activeOpacity={0.7}
          style={[s.templateBtn, { backgroundColor: theme.accent + "12" }]}>
          <MaterialCommunityIcons name="file-download-outline" size={16} color={theme.accent} />
          <Text style={[s.templateText, { color: theme.accent }]}>Download CSV Template</Text>
        </TouchableOpacity>
      </View>

      {/* Send Test Emails (Dev Only) */}
      {isDevUser && <View style={[s.testCard, { backgroundColor: theme.card, borderColor: theme.accent + "30" }]}>
        <View style={s.testHeader}>
          <View style={[s.testIcon, { backgroundColor: theme.accent + "14" }]}>
            <MaterialCommunityIcons name="email-fast-outline" size={18} color={theme.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.testTitle, { color: theme.text }]}>Send Test Emails</Text>
            <Text style={[s.testDesc, { color: theme.textMuted }]}>
              Send 15 dummy payment emails (Zomato, Amazon, Uber, etc.) for testing
            </Text>
          </View>
        </View>

        {/* Self / Targeted Toggle */}
        <View style={[s.modeToggle, { backgroundColor: theme.surface }]}>
          <TouchableOpacity
            onPress={() => setTestMode("self")}
            activeOpacity={0.7}
            style={[s.modeBtn, testMode === "self" && { backgroundColor: theme.accent }]}
          >
            <MaterialCommunityIcons name="account" size={14} color={testMode === "self" ? "#fff" : theme.textMuted} />
            <Text style={[s.modeBtnText, { color: testMode === "self" ? "#fff" : theme.textMuted }]}>Self</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTestMode("targeted")}
            activeOpacity={0.7}
            style={[s.modeBtn, testMode === "targeted" && { backgroundColor: theme.accent }]}
          >
            <MaterialCommunityIcons name="email-outline" size={14} color={testMode === "targeted" ? "#fff" : theme.textMuted} />
            <Text style={[s.modeBtnText, { color: testMode === "targeted" ? "#fff" : theme.textMuted }]}>Targeted</Text>
          </TouchableOpacity>
        </View>

        {/* Target Email Input (shown only for targeted mode) */}
        {testMode === "targeted" && (
          <TextInput
            value={targetEmail}
            onChangeText={setTargetEmail}
            placeholder="Enter recipient email address"
            placeholderTextColor={theme.textDim}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={[s.emailInput, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.divider }]}
          />
        )}

        <TouchableOpacity onPress={handleSendTestEmails} disabled={sendingTest} activeOpacity={0.7}
          style={[s.testBtn, { backgroundColor: theme.accent }]}>
          <MaterialCommunityIcons name={sendingTest ? "loading" : "send"} size={16} color="#fff" />
          <Text style={s.testBtnText}>
            {sendingTest ? `Sending... ${testProgress}%` : `Send 15 Test Emails${testMode === "targeted" && targetEmail.trim() ? ` to ${targetEmail.trim()}` : ""}`}
          </Text>
        </TouchableOpacity>
      </View>}

      <View style={{ height: 100 }} />

      {/* Gmail Range Picker Modal */}
      <Modal visible={showGmailRange} transparent animationType="fade" onRequestClose={() => setShowGmailRange(false)}>
        <Pressable style={s.modalOverlay} onPress={() => setShowGmailRange(false)}>
          <Pressable style={[s.modalContent, { backgroundColor: theme.card, borderColor: theme.surfaceBorder }]}>
            <Text style={[s.modalTitle, { color: theme.text }]}>Import Range</Text>
            <Text style={[s.modalSubtitle, { color: theme.textMuted }]}>How far back should we scan your Gmail?</Text>
            {GMAIL_RANGES.map((range, i) => (
              <TouchableOpacity
                key={range.key}
                activeOpacity={0.6}
                onPress={() => handleGmail(range.query)}
                style={[s.rangeRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.divider }]}
              >
                <View style={[s.rangeIcon, { backgroundColor: theme.surface }]}>
                  <MaterialCommunityIcons name={range.icon} size={18} color={theme.textSecondary} />
                </View>
                <Text style={[s.rangeLabel, { color: theme.text }]}>{range.label}</Text>
                <MaterialCommunityIcons name="chevron-right" size={16} color={theme.textDim} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setShowGmailRange(false)} activeOpacity={0.7}
              style={[s.cancelBtn, { backgroundColor: theme.surface }]}>
              <Text style={[s.cancelText, { color: theme.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },

  header: { padding: 20, paddingBottom: 16 },
  title: { fontSize: 24, fontWeight: "800", letterSpacing: -0.3 },
  subtitle: { fontSize: 13, marginTop: 4 },

  card: { marginHorizontal: 16, borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  sep: { height: 1, marginLeft: 62 },
  sourceRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  sourceIcon: { width: 38, height: 38, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  sourceTitle: { fontSize: 14, fontWeight: "600" },
  sourceDesc: { fontSize: 12, marginTop: 2 },
  percent: { fontSize: 13, fontWeight: "700" },

  progressTrack: { height: 2, marginHorizontal: 16, marginBottom: 10, borderRadius: 1 },
  progressFill: { height: 2, borderRadius: 1 },

  resultsCard: { marginHorizontal: 16, borderRadius: 14, padding: 20, marginTop: 16, borderWidth: 1 },
  resultsHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  checkIcon: { width: 30, height: 30, borderRadius: 15, justifyContent: "center", alignItems: "center" },
  resultsTitle: { fontSize: 15, fontWeight: "700" },
  statsRow: { flexDirection: "row", gap: 8 },
  statBox: { flex: 1, alignItems: "center", paddingVertical: 14, borderRadius: 10 },
  statNum: { fontSize: 20, fontWeight: "800" },
  statLabel: { fontSize: 11, fontWeight: "600", marginTop: 3, letterSpacing: 0.3 },

  guideCard: { marginHorizontal: 16, borderRadius: 14, padding: 16, marginTop: 16, borderWidth: 1 },
  guideHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  guideTitle: { fontSize: 13, fontWeight: "600" },
  codeBlock: { borderRadius: 10, padding: 12, gap: 2 },
  codeLine: { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 11, lineHeight: 18 },
  templateBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12, paddingVertical: 11, borderRadius: 10 },
  templateText: { fontSize: 13, fontWeight: "700" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 24 },
  modalContent: { width: "100%", maxWidth: 360, borderRadius: 14, borderWidth: 1, padding: 20, paddingBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: "800", letterSpacing: -0.2 },
  modalSubtitle: { fontSize: 13, marginTop: 4, marginBottom: 16 },
  rangeRow: { flexDirection: "row", alignItems: "center", paddingVertical: 13, gap: 12 },
  rangeIcon: { width: 34, height: 34, borderRadius: 9, justifyContent: "center", alignItems: "center" },
  rangeLabel: { flex: 1, fontSize: 14, fontWeight: "600" },
  cancelBtn: { marginTop: 12, paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  cancelText: { fontSize: 14, fontWeight: "600" },

  testCard: { marginHorizontal: 16, borderRadius: 14, padding: 16, marginTop: 16, borderWidth: 1, borderStyle: "dashed" },
  testHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  testIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  testTitle: { fontSize: 14, fontWeight: "700" },
  testDesc: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  modeToggle: { flexDirection: "row", borderRadius: 10, padding: 3, marginBottom: 10 },
  modeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: 8 },
  modeBtnText: { fontSize: 13, fontWeight: "700" },
  emailInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, marginBottom: 10 },
  testBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 10 },
  testBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});
