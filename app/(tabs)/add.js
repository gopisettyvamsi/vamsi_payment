import { useState, useEffect, useRef, useMemo } from "react";
import { View, ScrollView, StyleSheet, TouchableOpacity, Animated, Modal, Pressable, TextInput, Platform } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { CATEGORIES } from "../../lib/categories";
import { showMessage } from "../../lib/alert";
import { useTheme } from "../../lib/ThemeContext";
import { useCurrency } from "../../lib/CurrencyContext";
import { getItem, setItem, KEYS } from "../../lib/storage";
import { autoCategorizeTx } from "../../lib/helpers";
import { pickReceiptImage, parseReceiptText } from "../../lib/receiptOCR";
import { queueTransaction, isOnline, syncQueue } from "../../lib/offlineQueue";

/* ───── Calendar Picker ───── */
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function CalendarPicker({ visible, onClose, onSelect, selected, theme }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [mode, setMode] = useState("days");

  useEffect(() => {
    if (visible && selected) {
      const d = new Date(selected);
      if (!isNaN(d)) { setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); }
      setMode("days");
    }
  }, [visible, selected]);

  const days = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const startDay = first.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [viewYear, viewMonth]);

  const selectedDay = (() => {
    if (!selected) return -1;
    const d = new Date(selected);
    if (d.getFullYear() === viewYear && d.getMonth() === viewMonth) return d.getDate();
    return -1;
  })();

  const todayDay = today.getFullYear() === viewYear && today.getMonth() === viewMonth ? today.getDate() : -1;

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const pick = (day) => {
    const m = String(viewMonth + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    onSelect(`${viewYear}-${m}-${d}`);
    onClose();
  };

  const yearStart = today.getFullYear() - 50;
  const yearEnd = today.getFullYear() + 5;
  const years = Array.from({ length: yearEnd - yearStart + 1 }, (_, i) => yearStart + i);

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={cs.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[cs.sheet, { backgroundColor: theme.card }]}>
          <View style={cs.header}>
            <Pressable onPress={() => { if (mode === "days") prevMonth(); }} style={cs.navBtn}>
              <MaterialCommunityIcons name="chevron-left" size={22}
                color={mode === "days" ? theme.textSecondary : "transparent"} />
            </Pressable>
            <Pressable onPress={() => {
              if (mode === "days") setMode("months");
              else if (mode === "months") setMode("years");
              else setMode("days");
            }} style={cs.headerCenter}>
              <Text style={[cs.headerLabel, { color: theme.text }]}>
                {mode === "years" ? "Select Year" :
                  mode === "months" ? String(viewYear) :
                    `${MONTH_NAMES[viewMonth]} ${viewYear}`}
              </Text>
              <MaterialCommunityIcons name="chevron-down" size={14} color={theme.textMuted} style={{ marginLeft: 4 }} />
            </Pressable>
            <Pressable onPress={() => { if (mode === "days") nextMonth(); }} style={cs.navBtn}>
              <MaterialCommunityIcons name="chevron-right" size={22}
                color={mode === "days" ? theme.textSecondary : "transparent"} />
            </Pressable>
          </View>

          {mode === "years" && (
            <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
              <View style={cs.pickerGrid}>
                {years.map(y => (
                  <Pressable key={y} onPress={() => { setViewYear(y); setMode("months"); }}
                    style={[cs.pickerItem, y === viewYear && { backgroundColor: theme.accent }]}>
                    <Text style={[cs.pickerText, { color: theme.textSecondary },
                      y === viewYear && { color: "#fff", fontWeight: "700" },
                      y === today.getFullYear() && y !== viewYear && { color: theme.accent },
                    ]}>{y}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          )}

          {mode === "months" && (
            <View style={cs.pickerGrid}>
              {MONTH_SHORT.map((m, i) => (
                <Pressable key={m} onPress={() => { setViewMonth(i); setMode("days"); }}
                  style={[cs.pickerItem, i === viewMonth && { backgroundColor: theme.accent }]}>
                  <Text style={[cs.pickerText, { color: theme.textSecondary },
                    i === viewMonth && { color: "#fff", fontWeight: "700" },
                    i === today.getMonth() && viewYear === today.getFullYear() && i !== viewMonth && { color: theme.accent },
                  ]}>{m}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {mode === "days" && (
            <>
              <View style={cs.row}>
                {DAY_LABELS.map(l => (
                  <View key={l} style={cs.cell}>
                    <Text style={[cs.dayLabel, { color: theme.textMuted }]}>{l}</Text>
                  </View>
                ))}
              </View>
              <View style={cs.grid}>
                {days.map((d, i) => (
                  <View key={i} style={cs.cell}>
                    {d ? (
                      <Pressable onPress={() => pick(d)}
                        style={[cs.dayBtn,
                          d === selectedDay && { backgroundColor: theme.accent },
                          d === todayDay && d !== selectedDay && { borderWidth: 1, borderColor: theme.accent },
                        ]}>
                        <Text style={[cs.dayText, { color: theme.textSecondary },
                          d === selectedDay && { color: "#fff", fontWeight: "700" },
                          d === todayDay && d !== selectedDay && { color: theme.accent },
                        ]}>{d}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const cs = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  sheet: { width: 320, borderRadius: 14, padding: 20, zIndex: 10 },
  navBtn: { padding: 6, borderRadius: 8 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  headerCenter: { flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  headerLabel: { fontSize: 15, fontWeight: "700" },
  row: { flexDirection: "row" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "14.28%", alignItems: "center", paddingVertical: 4 },
  dayLabel: { fontSize: 12, fontWeight: "600" },
  dayBtn: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  dayText: { fontSize: 13 },
  pickerGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6, paddingVertical: 8 },
  pickerItem: { width: 70, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  pickerText: { fontSize: 13, fontWeight: "600" },
});

/* ───── Main Screen ───── */
export default function AddTransaction() {
  const { theme } = useTheme();
  const { currency } = useCurrency();
  const symbol = currency === "USD" ? "$" : currency === "EUR" ? "\u20AC" : "\u20B9";
  const { editId } = useLocalSearchParams();
  const router = useRouter();
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("other");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [showCal, setShowCal] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [tags, setTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState(new Set());
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [offlineMode, setOfflineMode] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  // Check online status on mount
  useEffect(() => {
    isOnline().then(online => setOfflineMode(!online));
  }, []);

  useEffect(() => {
    (async () => {
      const stored = await getItem(KEYS.CUSTOM_TAGS, []);
      setTags(stored);
    })();
  }, []);

  // Auto-categorize when description changes
  const handleDescChange = (val) => {
    setDescription(val);
    if (val.length > 2 && !editId) {
      const suggested = autoCategorizeTx(val);
      if (suggested !== "other") setCategory(suggested);
    }
  };

  // Receipt scan handler — web uses file input, mobile uses expo-image-picker
  const fileInputRef = useRef(null);

  const handleWebReceiptFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    const reader = new FileReader();
    reader.onload = () => {
      // Parse the text content for receipt data
      // For images, we show a preview message; for text files we try to parse
      if (file.type.startsWith("text/")) {
        const parsed = parseReceiptText(reader.result);
        if (parsed.amount) setAmount(String(parsed.amount));
        if (parsed.merchant) {
          setDescription(parsed.merchant);
          handleDescChange(parsed.merchant);
        }
        if (parsed.date) setDate(parsed.date);
        if (parsed.category) setCategory(parsed.category);
        showMessage("Receipt Parsed", `Found: ${parsed.amount ? `Amount: ${parsed.amount}` : ""}${parsed.merchant ? `, Merchant: ${parsed.merchant}` : ""}`);
      } else {
        showMessage("Receipt Uploaded", "Image selected. Paste the receipt text below or enter details manually.");
      }
      setScanning(false);
    };
    reader.onerror = () => {
      showMessage("Error", "Failed to read receipt file");
      setScanning(false);
    };
    if (file.type.startsWith("text/")) reader.readAsText(file);
    else reader.readAsDataURL(file);
    // Reset so same file can be selected again
    e.target.value = "";
  };

  const handleScanReceipt = async () => {
    if (Platform.OS === "web") {
      fileInputRef.current?.click();
      return;
    }
    setScanning(true);
    try {
      const { uri, cancelled } = await pickReceiptImage();
      if (cancelled || !uri) { setScanning(false); return; }
      showMessage("Receipt Selected", "Image selected. Please enter the amount and description manually for now.");
    } catch (e) {
      showMessage("Error", "Failed to scan receipt");
    }
    setScanning(false);
  };

  // Voice input using Web Speech API (Chrome, Edge, Safari)
  const handleVoiceInput = () => {
    if (Platform.OS !== "web") {
      showMessage("Info", "Voice input is available on web browsers.");
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showMessage("Not Supported", "Voice input is not supported in this browser. Try Chrome or Edge.");
      return;
    }

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.toLowerCase().trim();
      setListening(false);

      // Try to parse spoken input like "spent 500 on zomato" or "200 rupees uber"
      const amountMatch = transcript.match(/(\d+(?:\.\d+)?)/);
      const words = transcript.replace(/(\d+(?:\.\d+)?)/g, "").replace(/rupees?|dollars?|rs\.?|inr/gi, "").trim();

      if (amountMatch) {
        setAmount(amountMatch[1]);
      }
      if (words.length > 1) {
        // Clean up common filler words
        const cleaned = words.replace(/^(spent|paid|for|on|at|to)\s+/i, "").replace(/\s+(spent|paid|for|on|at|to)$/i, "").trim();
        if (cleaned) {
          setDescription(cleaned);
          handleDescChange(cleaned);
        }
      }
      if (!amountMatch && !words) {
        setDescription(transcript);
        handleDescChange(transcript);
      }

      showMessage("Voice Input", `Heard: "${transcript}"${amountMatch ? ` — Amount: ${amountMatch[1]}` : ""}`);
    };

    recognition.onerror = (event) => {
      setListening(false);
      if (event.error === "not-allowed") {
        showMessage("Permission Denied", "Please allow microphone access to use voice input.");
      } else if (event.error !== "aborted") {
        showMessage("Voice Error", `Could not recognize speech: ${event.error}`);
      }
    };

    recognition.onend = () => setListening(false);

    setListening(true);
    recognition.start();
  };

  useEffect(() => { if (editId) load(); }, [editId]);

  const load = async () => {
    const { data } = await supabase.from("transactions").select("*").eq("id", editId).single();
    if (data) { setType(data.type); setAmount(String(data.amount)); setDescription(data.description || ""); setCategory(data.category); setDate(new Date(data.date).toISOString().split("T")[0]); }
  };

  const save = async () => {
    if (!amount || isNaN(parseFloat(amount))) { showMessage("Error", "Enter a valid amount"); return; }
    if (parseFloat(amount) > 99999999) { showMessage("Error", "Amount is too large (max 99,999,999)"); return; }
    if (parseFloat(amount) <= 0) { showMessage("Error", "Amount must be greater than 0"); return; }
    setLoading(true);
    let finalDesc = description;
    if (selectedTags.size > 0) {
      const tagStr = [...selectedTags].map(t => `#${t}`).join(" ");
      finalDesc = finalDesc ? `${finalDesc} ${tagStr}` : tagStr;
    }
    const tx = { type, amount: parseFloat(amount), description: finalDesc, category, date: new Date(date).toISOString(), source: "manual" };

    // Offline mode: queue transaction locally
    const online = await isOnline();
    if (!online && !editId) {
      await queueTransaction(tx);
      setLoading(false);
      setOfflineMode(true);
      showMessage("Queued Offline", "Transaction saved locally. It will sync when you're back online.");
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      tx.user_id = user.id;
      const { error } = editId ? await supabase.from("transactions").update(tx).eq("id", editId) : await supabase.from("transactions").insert(tx);
      setLoading(false);
      // Try syncing any queued transactions
      if (!editId) {
        syncQueue(supabase, user.id).catch(() => {});
      }
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
          setSelectedTags(new Set());
        });
      }
    }
  };

  const incCats = CATEGORIES.filter(c => ["salary", "freelance", "investment", "other"].includes(c.id));
  const expCats = CATEGORIES.filter(c => !["salary", "freelance", "investment"].includes(c.id));
  const cats = type === "income" ? incCats : expCats;

  const displayDate = (() => {
    const d = new Date(date);
    if (isNaN(d)) return date;
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  })();

  const typeColor = type === "expense" ? theme.red : theme.green;

  return (
    <ScrollView style={[s.container, { backgroundColor: theme.bg }]} showsVerticalScrollIndicator={false}>

      {/* Type Toggle */}
      <View style={[s.typeRow, { backgroundColor: theme.card, borderColor: theme.surfaceBorder }]}>
        {["expense", "income"].map(t => {
          const active = type === t;
          const color = t === "expense" ? theme.red : theme.green;
          return (
            <TouchableOpacity key={t} onPress={() => setType(t)} style={s.typeHalf} activeOpacity={0.7}>
              <View style={[s.typeBtn, active && { backgroundColor: color + "18" }]}>
                <View style={[s.typeDot, { backgroundColor: active ? color : theme.textDim }]} />
                <Text style={[s.typeLabel, { color: active ? color : theme.textMuted }]}>
                  {t === "expense" ? "Expense" : "Income"}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Offline Banner */}
      {offlineMode && (
        <View style={[s.offlineBanner, { backgroundColor: theme.orange + "18", borderColor: theme.orange + "40" }]}>
          <MaterialCommunityIcons name="wifi-off" size={16} color={theme.orange} />
          <Text style={{ color: theme.orange, fontSize: 12, fontWeight: "600", flex: 1, marginLeft: 8 }}>
            Offline mode — transactions will sync when connected
          </Text>
        </View>
      )}

      {/* Scan Receipt & Voice Input */}
      <View style={s.quickActions}>
        <TouchableOpacity onPress={handleScanReceipt} disabled={scanning} activeOpacity={0.7}
          style={[s.quickActionBtn, { backgroundColor: theme.card, borderColor: theme.surfaceBorder, borderStyle: "dashed" }]}>
          <MaterialCommunityIcons name="camera-outline" size={18} color={theme.accent} />
          <Text style={[s.quickActionText, { color: theme.accent }]}>
            {scanning ? "Processing..." : "Scan Receipt"}
          </Text>
        </TouchableOpacity>
        {Platform.OS === "web" && (
          <TouchableOpacity onPress={handleVoiceInput} activeOpacity={0.7}
            style={[s.quickActionBtn, { backgroundColor: listening ? theme.red + "18" : theme.card, borderColor: listening ? theme.red + "40" : theme.surfaceBorder, borderStyle: listening ? "solid" : "dashed" }]}>
            <MaterialCommunityIcons name={listening ? "microphone-off" : "microphone-outline"} size={18} color={listening ? theme.red : theme.accent} />
            <Text style={[s.quickActionText, { color: listening ? theme.red : theme.accent }]}>
              {listening ? "Listening..." : "Voice Input"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      {/* Hidden file input for web receipt upload */}
      {Platform.OS === "web" && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,text/plain,.txt,.csv"
          onChange={handleWebReceiptFile}
          style={{ display: "none" }}
        />
      )}

      {/* Amount */}
      <View style={[s.fieldCard, { backgroundColor: theme.card, borderColor: theme.surfaceBorder, paddingVertical: 24, paddingHorizontal: 20 }]}>
        <Text style={[s.fieldLabel, { color: theme.textMuted }]}>AMOUNT</Text>
        <View style={s.amountRow}>
          <Text style={[s.amountSymbol, { color: typeColor }]}>{symbol}</Text>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            maxLength={10}
            onChange={(e) => {
              let val = e.target.value.replace(/[^0-9.]/g, "");
              const parts = val.split(".");
              if (parts.length > 2) val = parts[0] + "." + parts.slice(1).join("");
              val = val.slice(0, 10);
              if (val && !isNaN(parseFloat(val)) && parseFloat(val) > 99999999) return;
              setAmount(val);
            }}
            placeholder="0.00"
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              fontSize: 36, fontWeight: "800", color: theme.text, fontFamily: "inherit",
              caretColor: theme.accent,
            }}
          />
        </View>
      </View>

      {/* Description */}
      <View style={[s.fieldCard, { backgroundColor: theme.card, borderColor: theme.surfaceBorder }]}>
        <View style={s.fieldRow}>
          <MaterialCommunityIcons name="text-short" size={18} color={theme.textMuted} />
          <input
            type="text"
            value={description}
            onChange={(e) => handleDescChange(e.target.value)}
            placeholder="Description (optional)"
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              fontSize: 14, color: theme.text, fontFamily: "inherit", marginLeft: 12,
            }}
          />
        </View>
      </View>

      {/* Date */}
      <TouchableOpacity onPress={() => setShowCal(true)} activeOpacity={0.7}
        style={[s.fieldCard, { backgroundColor: theme.card, borderColor: theme.surfaceBorder }]}>
        <View style={s.fieldRow}>
          <MaterialCommunityIcons name="calendar-outline" size={18} color={theme.textMuted} />
          <Text style={[s.fieldText, { color: theme.text }]}>{displayDate}</Text>
          <MaterialCommunityIcons name="chevron-right" size={16} color={theme.textDim} />
        </View>
      </TouchableOpacity>

      {/* Category */}
      <Text style={[s.sectionLabel, { color: theme.textMuted }]}>CATEGORY</Text>
      <View style={s.catGrid}>
        {cats.map(cat => {
          const active = category === cat.id;
          return (
            <TouchableOpacity key={cat.id} onPress={() => setCategory(cat.id)} activeOpacity={0.7}
              style={[s.catChip, { backgroundColor: active ? cat.color + "14" : theme.surface },
                active && { borderColor: cat.color + "40" }]}>
              <View style={[s.catDot, { backgroundColor: cat.color }]} />
              <Text style={[s.catText, { color: active ? cat.color : theme.textSecondary }]}>{cat.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Tags */}
      <Text style={[s.sectionLabel, { color: theme.textMuted }]}>TAGS</Text>
      <View style={s.catGrid}>
        {tags.map(tag => {
          const active = selectedTags.has(tag);
          return (
            <TouchableOpacity key={tag} onPress={() => {
              setSelectedTags(prev => {
                const next = new Set(prev);
                if (next.has(tag)) next.delete(tag); else next.add(tag);
                return next;
              });
            }} activeOpacity={0.7}
              style={[s.tagChip, { backgroundColor: active ? theme.accent + "18" : theme.surface },
                active && { borderColor: theme.accent + "40" }]}>
              <MaterialCommunityIcons name="pound" size={12} color={active ? theme.accent : theme.textMuted} style={{ marginRight: 4 }} />
              <Text style={[s.tagText, { color: active ? theme.accent : theme.textSecondary }]}>{tag}</Text>
            </TouchableOpacity>
          );
        })}
        {showTagInput ? (
          <View style={[s.tagChip, { backgroundColor: theme.surface, borderColor: theme.accent + "40", borderWidth: 1.5 }]}>
            <TextInput
              value={newTag}
              onChangeText={setNewTag}
              placeholder="tag name"
              placeholderTextColor={theme.textDim}
              autoFocus
              onSubmitEditing={async () => {
                const trimmed = newTag.trim().toLowerCase().replace(/\s+/g, "-");
                if (trimmed && !tags.includes(trimmed)) {
                  const updated = [...tags, trimmed];
                  setTags(updated);
                  await setItem(KEYS.CUSTOM_TAGS, updated);
                }
                setNewTag("");
                setShowTagInput(false);
              }}
              onBlur={() => { setNewTag(""); setShowTagInput(false); }}
              style={{ fontSize: 12, fontWeight: "600", color: theme.text, minWidth: 60, padding: 0, margin: 0 }}
            />
          </View>
        ) : (
          <TouchableOpacity onPress={() => setShowTagInput(true)} activeOpacity={0.7}
            style={[s.tagChip, { backgroundColor: theme.surface, borderStyle: "dashed", borderColor: theme.textDim, borderWidth: 1.5 }]}>
            <MaterialCommunityIcons name="tag-plus" size={14} color={theme.textMuted} />
            <Text style={[s.tagText, { color: theme.textMuted, marginLeft: 4 }]}>Add</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Save Button */}
      <TouchableOpacity onPress={save} disabled={loading} activeOpacity={0.8} style={{ marginTop: 8 }}>
        <View style={[s.saveBtn, { backgroundColor: theme.accent }]}>
          <MaterialCommunityIcons name={editId ? "check" : "plus"} size={18} color="#fff" />
          <Text style={s.saveBtnText}>{loading ? "Saving..." : editId ? "Update Transaction" : "Add Transaction"}</Text>
        </View>
      </TouchableOpacity>

      <View style={{ height: 100 }} />

      <CalendarPicker visible={showCal} onClose={() => setShowCal(false)} onSelect={setDate} selected={date} theme={theme} />

      {showSuccess && (
        <Animated.View style={[s.successOverlay, { opacity: successOpacity }]}>
          <Animated.View style={[s.successCircle, { backgroundColor: theme.green, transform: [{ scale: successScale }] }]}>
            <MaterialCommunityIcons name="check" size={40} color="#fff" />
          </Animated.View>
          <Animated.Text style={[s.successText, { transform: [{ scale: successScale }] }]}>
            Transaction Added
          </Animated.Text>
        </Animated.View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: 16 },

  typeRow: { flexDirection: "row", borderRadius: 14, borderWidth: 1, marginBottom: 16, overflow: "hidden", padding: 4 },
  typeHalf: { flex: 1 },
  typeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 10 },
  typeDot: { width: 8, height: 8, borderRadius: 4 },
  typeLabel: { fontSize: 14, fontWeight: "700" },

  fieldCard: { borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1 },
  fieldLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 1, marginBottom: 8 },
  amountRow: { flexDirection: "row", alignItems: "center" },
  amountSymbol: { fontSize: 36, fontWeight: "800", marginRight: 4 },
  fieldRow: { flexDirection: "row", alignItems: "center" },
  fieldText: { flex: 1, fontSize: 14, fontWeight: "500", marginLeft: 12 },

  sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1.5, marginTop: 8, marginBottom: 10 },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  catChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, borderColor: "transparent" },
  catDot: { width: 7, height: 7, borderRadius: 3.5, marginRight: 8 },
  catText: { fontSize: 13, fontWeight: "600" },
  tagChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1.5, borderColor: "transparent" },
  tagText: { fontSize: 12, fontWeight: "600" },

  quickActions: { flexDirection: "row", gap: 10, marginBottom: 10 },
  quickActionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, padding: 14, borderWidth: 1 },
  quickActionText: { fontSize: 13, fontWeight: "600" },
  offlineBanner: { flexDirection: "row", alignItems: "center", borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 10 },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, borderRadius: 14 },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  successOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "center", alignItems: "center", zIndex: 100 },
  successCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: "center", alignItems: "center", marginBottom: 16 },
  successText: { color: "#fff", fontSize: 20, fontWeight: "700" },
});
