import { useState } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform, Image as RNImage, TouchableOpacity } from "react-native";
import { Text, TextInput, Button, HelperText } from "react-native-paper";
import { Link } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useTheme } from "../../lib/ThemeContext";
import { showAlert } from "../../lib/alert";

const logo = require("../../assets/logo.png");

export default function Login() {
  const { theme } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setLoading(true); setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError("Enter your email address first, then tap Forgot Password.");
      return;
    }
    setResetLoading(true); setError("");
    const redirectUrl = Platform.OS === "web" ? `${window.location.origin}/reset-password` : "payment-tracker://reset-password";
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirectUrl });
    setResetLoading(false);
    if (error) setError(error.message);
    else showAlert("Check Your Email", `We've sent a password reset link to ${email.trim()}. Check your inbox (and spam folder).`);
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true); setError("");
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: Platform.OS === "web" ? window.location.origin : "payment-tracker://auth/callback",
        scopes: "https://www.googleapis.com/auth/gmail.readonly",
      },
    });
    if (error) { setError(error.message); setGoogleLoading(false); }
    else if (data?.url) {
      if (Platform.OS === "web") window.location.href = data.url;
      else { const { Linking } = require("react-native"); Linking.openURL(data.url); }
    }
  };

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={s.inner}>
          <View style={s.logoWrap}>
            <RNImage source={logo} style={s.logoImg} resizeMode="contain" />
            <Text style={[s.brand, { color: theme.text }]}>Vamsify</Text>
            <Text style={{ color: theme.textMuted, fontSize: 14, fontWeight: "500", marginTop: 4 }}>Smart money tracking</Text>
          </View>

          <Button mode="contained" onPress={handleGoogleLogin} loading={googleLoading}
            disabled={googleLoading} icon="google" buttonColor={theme.accent} textColor="#fff"
            contentStyle={{ paddingVertical: 6 }} labelStyle={{ fontWeight: "700", fontSize: 15 }}
            style={{ borderRadius: 12 }}>
            Continue with Google
          </Button>

          <View style={s.orRow}>
            <View style={[s.orLine, { backgroundColor: theme.border }]} />
            <Text style={{ color: theme.textMuted, marginHorizontal: 14, fontSize: 13 }}>or sign in with email</Text>
            <View style={[s.orLine, { backgroundColor: theme.border }]} />
          </View>

          <TextInput label="Email" value={email} onChangeText={setEmail} mode="flat"
            keyboardType="email-address" autoCapitalize="none"
            style={[s.input, { backgroundColor: theme.surface }]}
            textColor={theme.text} underlineColor={theme.border} activeUnderlineColor={theme.accent}
            theme={{ colors: { onSurfaceVariant: theme.textMuted } }}
            left={<TextInput.Icon icon="email" iconColor={theme.textMuted} />}
          />
          <TextInput label="Password" value={password} onChangeText={setPassword} mode="flat"
            secureTextEntry style={[s.input, { backgroundColor: theme.surface }]} textColor={theme.text}
            underlineColor={theme.border} activeUnderlineColor={theme.accent}
            theme={{ colors: { onSurfaceVariant: theme.textMuted } }}
            left={<TextInput.Icon icon="lock" iconColor={theme.textMuted} />}
          />

          <TouchableOpacity onPress={handleForgotPassword} disabled={resetLoading} activeOpacity={0.6} style={s.forgotRow}>
            <Text style={{ color: theme.accent, fontSize: 13, fontWeight: "600" }}>
              {resetLoading ? "Sending reset link..." : "Forgot Password?"}
            </Text>
          </TouchableOpacity>

          {error ? <HelperText type="error" style={{ color: theme.red }}>{error}</HelperText> : null}

          <Button mode="contained" onPress={handleLogin} loading={loading} disabled={loading}
            buttonColor={theme.accent} textColor="#fff" style={s.loginBtn}
            contentStyle={{ paddingVertical: 8 }}
            labelStyle={{ fontWeight: "700", fontSize: 16 }}>
            Sign In
          </Button>

          <View style={s.linkRow}>
            <Text style={{ color: theme.textMuted }}>New here? </Text>
            <Link href="/(auth)/signup"><Text style={{ color: theme.accent, fontWeight: "700" }}>Create Account</Text></Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, justifyContent: "center", paddingHorizontal: 28 },
  logoWrap: { alignItems: "center", marginBottom: 48 },
  logoImg: { width: 88, height: 88, borderRadius: 44, marginBottom: 16 },
  brand: { fontSize: 30, fontWeight: "800", letterSpacing: 1 },
  orRow: { flexDirection: "row", alignItems: "center", marginVertical: 20 },
  orLine: { flex: 1, height: 1 },
  input: { marginBottom: 8, borderRadius: 12 },
  forgotRow: { alignSelf: "flex-end", marginTop: 2, marginBottom: 4, paddingVertical: 4 },
  loginBtn: { marginTop: 16, borderRadius: 12 },
  linkRow: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
});
