import { useState } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { Text, TextInput, Button, HelperText } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import { supabase } from "../../lib/supabase";
import { COLORS, SHADOWS, RADIUS } from "../../lib/theme";

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
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) { setError(error.message); } else { setSuccess(true); }
    setLoading(false);
  };

  if (success) {
    return (
      <LinearGradient colors={["#0A0E21", "#1A1040", "#0A0E21"]} style={styles.gradient}>
        <View style={[styles.container, styles.inner]}>
          <View style={styles.successCard}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successTitle}>Check your email!</Text>
            <Text style={styles.successText}>We sent a confirmation link to {email}</Text>
            <Link href="/(auth)/login">
              <Text style={styles.link}>Back to Login</Text>
            </Link>
          </View>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={["#0A0E21", "#1A1040", "#0A0E21"]} style={styles.gradient}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <View style={styles.inner}>
          <View style={styles.header}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Start tracking your finances</Text>
          </View>

          <View style={styles.card}>
            <TextInput
              label="Email" value={email} onChangeText={setEmail} mode="outlined"
              keyboardType="email-address" autoCapitalize="none" style={styles.input}
              textColor="#fff" outlineColor={COLORS.border} activeOutlineColor={COLORS.primary}
              theme={{ colors: { onSurfaceVariant: COLORS.textMuted } }}
            />
            <TextInput
              label="Password" value={password} onChangeText={setPassword} mode="outlined"
              secureTextEntry style={styles.input} textColor="#fff"
              outlineColor={COLORS.border} activeOutlineColor={COLORS.primary}
              theme={{ colors: { onSurfaceVariant: COLORS.textMuted } }}
            />
            <TextInput
              label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword}
              mode="outlined" secureTextEntry style={styles.input} textColor="#fff"
              outlineColor={COLORS.border} activeOutlineColor={COLORS.primary}
              theme={{ colors: { onSurfaceVariant: COLORS.textMuted } }}
            />

            {error ? <HelperText type="error" style={{ color: COLORS.danger }}>{error}</HelperText> : null}

            <LinearGradient
              colors={COLORS.gradientPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.btnGradient}
            >
              <Button mode="text" onPress={handleSignup} loading={loading} disabled={loading}
                textColor="#fff" contentStyle={{ paddingVertical: 8 }}
                labelStyle={{ fontSize: 16, fontWeight: "800", letterSpacing: 1 }}
              >
                Sign Up
              </Button>
            </LinearGradient>

            <View style={styles.linkRow}>
              <Text style={styles.linkText}>Already have an account? </Text>
              <Link href="/(auth)/login">
                <Text style={styles.link}>Login</Text>
              </Link>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1 },
  inner: { flex: 1, justifyContent: "center", padding: 24 },
  header: { alignItems: "center", marginBottom: 32 },
  title: { fontSize: 32, fontWeight: "900", color: "#fff", letterSpacing: 1 },
  subtitle: { fontSize: 16, color: COLORS.textMuted, marginTop: 6 },
  card: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, padding: 24,
    borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.card,
  },
  input: { marginBottom: 14, backgroundColor: COLORS.bgInput, borderRadius: RADIUS.md },
  btnGradient: { borderRadius: RADIUS.md, marginTop: 8, overflow: "hidden", ...SHADOWS.glow },
  linkRow: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
  linkText: { color: COLORS.textMuted, fontSize: 14 },
  link: { color: COLORS.primaryLight, fontWeight: "bold", fontSize: 14 },
  successCard: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, padding: 40,
    alignItems: "center", borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.card,
  },
  successIcon: { fontSize: 48, color: COLORS.success, marginBottom: 16 },
  successTitle: { fontSize: 24, fontWeight: "900", color: "#fff", marginBottom: 12 },
  successText: { color: COLORS.textSecondary, textAlign: "center", marginBottom: 24, fontSize: 15 },
});
