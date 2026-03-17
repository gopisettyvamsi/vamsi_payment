import { useState } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform, Image as RNImage } from "react-native";
import { Text, TextInput, Button, HelperText } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import { supabase } from "../../lib/supabase";
import { C } from "../../lib/theme";

const logo = require("../../assets/logo.png");

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setLoading(true); setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
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
    <LinearGradient colors={C.purpleDeep} style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={s.inner}>
          {/* Logo */}
          <View style={s.logoWrap}>
            <RNImage source={logo} style={s.logoImg} resizeMode="contain" />
            <Text style={s.brand}>Vamsify</Text>
            <Text style={s.tagline}>Smart money tracking</Text>
          </View>

          {/* Google Button */}
          <View style={s.googleBtn}>
            <Button mode="contained" onPress={handleGoogleLogin} loading={googleLoading}
              disabled={googleLoading} icon="google" buttonColor="#fff" textColor={C.textDark}
              contentStyle={{ paddingVertical: 6 }} labelStyle={{ fontWeight: "700", fontSize: 15 }}
              style={{ borderRadius: 12 }}>
              Continue with Google
            </Button>
          </View>

          <View style={s.orRow}>
            <View style={s.orLine} /><Text style={s.orText}>or sign in with email</Text><View style={s.orLine} />
          </View>

          {/* Email/Password */}
          <TextInput label="Email" value={email} onChangeText={setEmail} mode="flat"
            keyboardType="email-address" autoCapitalize="none" style={s.input}
            textColor="#fff" underlineColor={C.border} activeUnderlineColor={C.purpleLight}
            theme={{ colors: { onSurfaceVariant: C.textMuted } }}
            left={<TextInput.Icon icon="email" iconColor={C.textMuted} />}
          />
          <TextInput label="Password" value={password} onChangeText={setPassword} mode="flat"
            secureTextEntry style={s.input} textColor="#fff"
            underlineColor={C.border} activeUnderlineColor={C.purpleLight}
            theme={{ colors: { onSurfaceVariant: C.textMuted } }}
            left={<TextInput.Icon icon="lock" iconColor={C.textMuted} />}
          />

          {error ? <HelperText type="error" style={{ color: C.red }}>{error}</HelperText> : null}

          <Button mode="contained" onPress={handleLogin} loading={loading} disabled={loading}
            buttonColor={C.purple} textColor="#fff" style={s.loginBtn}
            contentStyle={{ paddingVertical: 8 }}
            labelStyle={{ fontWeight: "800", fontSize: 16, letterSpacing: 0.5 }}>
            Sign In
          </Button>

          <View style={s.linkRow}>
            <Text style={{ color: C.textMuted }}>New here? </Text>
            <Link href="/(auth)/signup"><Text style={{ color: C.purpleLight, fontWeight: "700" }}>Create Account</Text></Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  inner: { flex: 1, justifyContent: "center", paddingHorizontal: 28 },
  logoWrap: { alignItems: "center", marginBottom: 48 },
  logoImg: { width: 100, height: 100, borderRadius: 50, marginBottom: 16 },
  brand: { fontSize: 32, fontWeight: "900", color: "#fff", letterSpacing: 2 },
  tagline: { fontSize: 14, color: C.textMuted, marginTop: 4 },
  googleBtn: { marginBottom: 4 },
  orRow: { flexDirection: "row", alignItems: "center", marginVertical: 20 },
  orLine: { flex: 1, height: 1, backgroundColor: C.border },
  orText: { color: C.textMuted, marginHorizontal: 14, fontSize: 13 },
  input: { backgroundColor: "rgba(255,255,255,0.05)", marginBottom: 8, borderRadius: 12 },
  loginBtn: { marginTop: 16, borderRadius: 12 },
  linkRow: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
});
