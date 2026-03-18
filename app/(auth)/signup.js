import { useState } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { Text, TextInput, Button, HelperText } from "react-native-paper";
import { Link } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useTheme } from "../../lib/ThemeContext";

export default function Signup() {
  const { theme } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSignup = async () => {
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true); setError("");
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setError(error.message); else setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <View style={[s.container, { backgroundColor: theme.bg }]}>
        <View style={[s.inner, { alignItems: "center" }]}>
          <View style={[s.successCircle, { backgroundColor: theme.green }]}>
            <Text style={{ fontSize: 36, color: "#fff", fontWeight: "700" }}>OK</Text>
          </View>
          <Text style={[s.successTitle, { color: theme.text }]}>Check your email!</Text>
          <Text style={{ color: theme.textMuted, textAlign: "center", marginBottom: 32, fontSize: 15, lineHeight: 22 }}>
            We sent a confirmation link to {email}
          </Text>
          <Link href="/(auth)/login"><Text style={{ color: theme.accent, fontWeight: "700", fontSize: 16 }}>Back to Login</Text></Link>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={s.inner}>
          <Text style={[s.title, { color: theme.text }]}>Create Account</Text>
          <Text style={{ color: theme.textMuted, fontSize: 14, marginBottom: 36, marginTop: 4 }}>Start tracking your finances</Text>

          <TextInput label="Email" value={email} onChangeText={setEmail} mode="flat"
            keyboardType="email-address" autoCapitalize="none"
            style={[s.input, { backgroundColor: theme.surface }]} textColor={theme.text}
            underlineColor={theme.border} activeUnderlineColor={theme.accent}
            theme={{ colors: { onSurfaceVariant: theme.textMuted } }}
            left={<TextInput.Icon icon="email" iconColor={theme.textMuted} />} />
          <TextInput label="Password" value={password} onChangeText={setPassword} mode="flat"
            secureTextEntry style={[s.input, { backgroundColor: theme.surface }]} textColor={theme.text}
            underlineColor={theme.border} activeUnderlineColor={theme.accent}
            theme={{ colors: { onSurfaceVariant: theme.textMuted } }}
            left={<TextInput.Icon icon="lock" iconColor={theme.textMuted} />} />
          <TextInput label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword}
            mode="flat" secureTextEntry style={[s.input, { backgroundColor: theme.surface }]} textColor={theme.text}
            underlineColor={theme.border} activeUnderlineColor={theme.accent}
            theme={{ colors: { onSurfaceVariant: theme.textMuted } }}
            left={<TextInput.Icon icon="lock-check" iconColor={theme.textMuted} />} />

          {error ? <HelperText type="error" style={{ color: theme.red }}>{error}</HelperText> : null}

          <Button mode="contained" onPress={handleSignup} loading={loading} disabled={loading}
            buttonColor={theme.accent} textColor="#fff" style={s.btn} contentStyle={{ paddingVertical: 8 }}
            labelStyle={{ fontWeight: "700", fontSize: 16 }}>
            Create Account
          </Button>

          <View style={s.linkRow}>
            <Text style={{ color: theme.textMuted }}>Already have an account? </Text>
            <Link href="/(auth)/login"><Text style={{ color: theme.accent, fontWeight: "700" }}>Sign In</Text></Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, justifyContent: "center", paddingHorizontal: 28 },
  title: { fontSize: 28, fontWeight: "800" },
  input: { marginBottom: 8, borderRadius: 12 },
  btn: { marginTop: 16, borderRadius: 12 },
  linkRow: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
  successCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: "center", alignItems: "center", marginBottom: 24 },
  successTitle: { fontSize: 24, fontWeight: "800", marginBottom: 8 },
});
