import { useState } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { Text, TextInput, Button, HelperText } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import { supabase } from "../../lib/supabase";
import { C } from "../../lib/theme";

export default function Signup() {
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
      <LinearGradient colors={C.purpleDeep} style={{ flex: 1 }}>
        <View style={[s.inner, { alignItems: "center" }]}>
          <View style={s.successCircle}><Text style={{ fontSize: 40 }}>✓</Text></View>
          <Text style={s.successTitle}>Check your email!</Text>
          <Text style={s.successSub}>We sent a confirmation link to {email}</Text>
          <Link href="/(auth)/login"><Text style={{ color: C.purpleLight, fontWeight: "700", fontSize: 16 }}>Back to Login</Text></Link>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={C.purpleDeep} style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={s.inner}>
          <Text style={s.title}>Create Account</Text>
          <Text style={s.subtitle}>Start tracking your finances</Text>

          <TextInput label="Email" value={email} onChangeText={setEmail} mode="flat"
            keyboardType="email-address" autoCapitalize="none" style={s.input} textColor="#fff"
            underlineColor={C.border} activeUnderlineColor={C.purpleLight}
            theme={{ colors: { onSurfaceVariant: C.textMuted } }}
            left={<TextInput.Icon icon="email" iconColor={C.textMuted} />} />
          <TextInput label="Password" value={password} onChangeText={setPassword} mode="flat"
            secureTextEntry style={s.input} textColor="#fff"
            underlineColor={C.border} activeUnderlineColor={C.purpleLight}
            theme={{ colors: { onSurfaceVariant: C.textMuted } }}
            left={<TextInput.Icon icon="lock" iconColor={C.textMuted} />} />
          <TextInput label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword}
            mode="flat" secureTextEntry style={s.input} textColor="#fff"
            underlineColor={C.border} activeUnderlineColor={C.purpleLight}
            theme={{ colors: { onSurfaceVariant: C.textMuted } }}
            left={<TextInput.Icon icon="lock-check" iconColor={C.textMuted} />} />

          {error ? <HelperText type="error" style={{ color: C.red }}>{error}</HelperText> : null}

          <Button mode="contained" onPress={handleSignup} loading={loading} disabled={loading}
            buttonColor={C.purple} textColor="#fff" style={s.btn} contentStyle={{ paddingVertical: 8 }}
            labelStyle={{ fontWeight: "800", fontSize: 16, letterSpacing: 0.5 }}>
            Create Account
          </Button>

          <View style={s.linkRow}>
            <Text style={{ color: C.textMuted }}>Already have an account? </Text>
            <Link href="/(auth)/login"><Text style={{ color: C.purpleLight, fontWeight: "700" }}>Sign In</Text></Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  inner: { flex: 1, justifyContent: "center", paddingHorizontal: 28 },
  title: { fontSize: 30, fontWeight: "900", color: "#fff", marginBottom: 4 },
  subtitle: { fontSize: 14, color: C.textMuted, marginBottom: 36 },
  input: { backgroundColor: "rgba(255,255,255,0.05)", marginBottom: 8, borderRadius: 12 },
  btn: { marginTop: 16, borderRadius: 12 },
  linkRow: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
  successCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.green, justifyContent: "center", alignItems: "center", marginBottom: 24 },
  successTitle: { fontSize: 24, fontWeight: "900", color: "#fff", marginBottom: 8 },
  successSub: { color: C.textMuted, textAlign: "center", marginBottom: 32, fontSize: 15, lineHeight: 22 },
});
