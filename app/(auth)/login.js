import { useState } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { Text, TextInput, Button, HelperText } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import { supabase } from "../../lib/supabase";
import { COLORS, SHADOWS, RADIUS } from "../../lib/theme";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError("");
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: Platform.OS === "web"
          ? window.location.origin
          : "payment-tracker://auth/callback",
        scopes: "https://www.googleapis.com/auth/gmail.readonly",
      },
    });
    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    } else if (data?.url) {
      if (Platform.OS === "web") {
        window.location.href = data.url;
      } else {
        const { Linking } = require("react-native");
        Linking.openURL(data.url);
      }
    }
  };

  return (
    <LinearGradient colors={["#0A0E21", "#1A1040", "#0A0E21"]} style={styles.gradient}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <View style={styles.inner}>
          {/* Logo & Title */}
          <View style={styles.logoContainer}>
            <LinearGradient
              colors={COLORS.gradientPrimary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoGradient}
            >
              <Text style={styles.logoIcon}>$</Text>
            </LinearGradient>
            <Text style={styles.title}>Payment Tracker</Text>
            <Text style={styles.subtitle}>Track your money, effortlessly</Text>
          </View>

          {/* Glass Card */}
          <View style={styles.card}>
            {/* Google Login Button */}
            <LinearGradient
              colors={["rgba(255,255,255,0.15)", "rgba(255,255,255,0.05)"]}
              style={styles.googleBtnGradient}
            >
              <Button
                mode="text"
                onPress={handleGoogleLogin}
                loading={googleLoading}
                disabled={googleLoading}
                icon="google"
                textColor="#fff"
                contentStyle={styles.buttonContent}
                labelStyle={styles.googleLabel}
              >
                Continue with Google
              </Button>
            </LinearGradient>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.divider} />
            </View>

            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
              textColor="#fff"
              outlineColor={COLORS.border}
              activeOutlineColor={COLORS.primary}
              theme={{ colors: { onSurfaceVariant: COLORS.textMuted } }}
            />
            <TextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              mode="outlined"
              secureTextEntry
              style={styles.input}
              textColor="#fff"
              outlineColor={COLORS.border}
              activeOutlineColor={COLORS.primary}
              theme={{ colors: { onSurfaceVariant: COLORS.textMuted } }}
            />

            {error ? <HelperText type="error" style={{ color: COLORS.danger }}>{error}</HelperText> : null}

            <LinearGradient
              colors={COLORS.gradientPrimary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.loginBtnGradient}
            >
              <Button
                mode="text"
                onPress={handleLogin}
                loading={loading}
                disabled={loading}
                textColor="#fff"
                contentStyle={styles.buttonContent}
                labelStyle={styles.loginLabel}
              >
                Login
              </Button>
            </LinearGradient>

            <View style={styles.linkRow}>
              <Text style={styles.linkText}>Don't have an account? </Text>
              <Link href="/(auth)/signup">
                <Text style={styles.link}>Sign Up</Text>
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
  logoContainer: { alignItems: "center", marginBottom: 40 },
  logoGradient: {
    width: 80,
    height: 80,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    ...SHADOWS.glow,
  },
  logoIcon: { fontSize: 36, fontWeight: "bold", color: "#fff" },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textMuted,
    marginTop: 6,
  },
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  googleBtnGradient: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  googleLabel: { fontSize: 16, fontWeight: "700" },
  buttonContent: { paddingVertical: 8 },
  dividerRow: { flexDirection: "row", alignItems: "center", marginVertical: 20 },
  divider: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { marginHorizontal: 16, color: COLORS.textMuted, fontSize: 13 },
  input: {
    marginBottom: 14,
    backgroundColor: COLORS.bgInput,
    borderRadius: RADIUS.md,
  },
  loginBtnGradient: {
    borderRadius: RADIUS.md,
    marginTop: 8,
    overflow: "hidden",
    ...SHADOWS.glow,
  },
  loginLabel: { fontSize: 16, fontWeight: "800", letterSpacing: 1 },
  linkRow: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
  linkText: { color: COLORS.textMuted, fontSize: 14 },
  link: { color: COLORS.primaryLight, fontWeight: "bold", fontSize: 14 },
});
