import { useState, useEffect } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform, Image as RNImage } from "react-native";
import { Text, TextInput, Button, HelperText } from "react-native-paper";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { useTheme } from "../lib/ThemeContext";
import { showAlert } from "../lib/alert";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const logo = require("../assets/logo.png");

export default function ResetPassword() {
  const { theme } = useTheme();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState(null);
  const [resendEmail, setResendEmail] = useState("");
  const [resending, setResending] = useState(false);

  useEffect(() => {
    // Check URL for error params (expired/invalid link)
    if (Platform.OS === "web") {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash || window.location.search);
      const errCode = params.get("error_code") || params.get("error");
      const errDesc = params.get("error_description");
      if (errCode) {
        setLinkError({
          code: errCode,
          message: errDesc ? decodeURIComponent(errDesc.replace(/\+/g, " ")) : "The reset link is invalid.",
        });
        return;
      }
    }

    // Listen for PASSWORD_RECOVERY event from Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async () => {
    if (!password.trim()) { setError("Please enter a new password."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords don't match."); return; }

    setLoading(true); setError("");
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      showAlert("Password Updated", "Your password has been reset successfully. You can now sign in with your new password.");
      router.replace("/(auth)/login");
    }
  };

  const handleResend = async () => {
    if (!resendEmail.trim()) { setError("Please enter your email address."); return; }
    setResending(true); setError("");
    const redirectUrl = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(resendEmail.trim(), { redirectTo: redirectUrl });
    setResending(false);
    if (error) setError(error.message);
    else showAlert("Link Sent", `A new password reset link has been sent to ${resendEmail.trim()}.`);
  };

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={s.inner}>
          <View style={s.logoWrap}>
            <RNImage source={logo} style={s.logoImg} resizeMode="contain" />
          </View>

          {/* Link expired or invalid */}
          {linkError ? (
            <View style={s.centerCard}>
              <View style={[s.errorIcon, { backgroundColor: theme.redBg || "#fef2f2" }]}>
                <MaterialCommunityIcons name="link-off" size={32} color={theme.red} />
              </View>
              <Text style={[s.brand, { color: theme.text }]}>Link Expired</Text>
              <Text style={{ color: theme.textMuted, fontSize: 14, textAlign: "center", marginTop: 8, lineHeight: 21 }}>
                {linkError.message}{"\n"}Please request a new password reset link.
              </Text>

              <TextInput label="Your email address" value={resendEmail} onChangeText={setResendEmail} mode="flat"
                keyboardType="email-address" autoCapitalize="none"
                style={[s.input, { backgroundColor: theme.surface, marginTop: 24, width: "100%" }]} textColor={theme.text}
                underlineColor={theme.border} activeUnderlineColor={theme.accent}
                theme={{ colors: { onSurfaceVariant: theme.textMuted } }}
                left={<TextInput.Icon icon="email" iconColor={theme.textMuted} />}
              />

              {error ? <HelperText type="error" style={{ color: theme.red }}>{error}</HelperText> : null}

              <Button mode="contained" onPress={handleResend} loading={resending} disabled={resending}
                buttonColor={theme.accent} textColor="#fff" style={[s.resetBtn, { width: "100%" }]}
                contentStyle={{ paddingVertical: 8 }}
                labelStyle={{ fontWeight: "700", fontSize: 15 }}>
                Send New Reset Link
              </Button>

              <Button mode="text" onPress={() => router.replace("/(auth)/login")} textColor={theme.textMuted} style={{ marginTop: 12 }}>
                Back to Login
              </Button>
            </View>

          /* Waiting for token verification */
          ) : !ready ? (
            <View style={s.centerCard}>
              <Text style={[s.brand, { color: theme.text }]}>Reset Password</Text>
              <Text style={{ color: theme.textMuted, textAlign: "center", fontSize: 14, lineHeight: 22, marginTop: 8 }}>
                Verifying your reset link...{"\n\n"}If this takes too long, go back and request a new link.
              </Text>
              <Button mode="text" onPress={() => router.replace("/(auth)/login")} textColor={theme.accent} style={{ marginTop: 16 }}>
                Back to Login
              </Button>
            </View>

          /* Ready to reset */
          ) : (
            <>
              <Text style={[s.brand, { color: theme.text, textAlign: "center" }]}>Set New Password</Text>
              <Text style={{ color: theme.textMuted, fontSize: 14, textAlign: "center", marginTop: 4, marginBottom: 24 }}>
                Enter your new password below
              </Text>

              <TextInput label="New Password" value={password} onChangeText={setPassword} mode="flat"
                secureTextEntry style={[s.input, { backgroundColor: theme.surface }]} textColor={theme.text}
                underlineColor={theme.border} activeUnderlineColor={theme.accent}
                theme={{ colors: { onSurfaceVariant: theme.textMuted } }}
                left={<TextInput.Icon icon="lock" iconColor={theme.textMuted} />}
              />
              <TextInput label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} mode="flat"
                secureTextEntry style={[s.input, { backgroundColor: theme.surface }]} textColor={theme.text}
                underlineColor={theme.border} activeUnderlineColor={theme.accent}
                theme={{ colors: { onSurfaceVariant: theme.textMuted } }}
                left={<TextInput.Icon icon="lock-check" iconColor={theme.textMuted} />}
              />

              {error ? <HelperText type="error" style={{ color: theme.red }}>{error}</HelperText> : null}

              <Button mode="contained" onPress={handleReset} loading={loading} disabled={loading}
                buttonColor={theme.accent} textColor="#fff" style={s.resetBtn}
                contentStyle={{ paddingVertical: 8 }}
                labelStyle={{ fontWeight: "700", fontSize: 16 }}>
                Update Password
              </Button>

              <Button mode="text" onPress={() => router.replace("/(auth)/login")} textColor={theme.textMuted} style={{ marginTop: 12 }}>
                Back to Login
              </Button>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, justifyContent: "center", paddingHorizontal: 28 },
  logoWrap: { alignItems: "center", marginBottom: 24 },
  logoImg: { width: 72, height: 72, borderRadius: 36 },
  brand: { fontSize: 24, fontWeight: "800", letterSpacing: -0.3 },
  centerCard: { alignItems: "center", paddingVertical: 10 },
  errorIcon: { width: 64, height: 64, borderRadius: 32, justifyContent: "center", alignItems: "center", marginBottom: 16 },
  input: { marginBottom: 8, borderRadius: 12 },
  resetBtn: { marginTop: 16, borderRadius: 12 },
});
