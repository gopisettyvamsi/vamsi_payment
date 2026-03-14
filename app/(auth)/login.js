import { useState } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform, Linking } from "react-native";
import { Text, TextInput, Button, HelperText, Divider } from "react-native-paper";
import { Link } from "expo-router";
import { supabase } from "../../lib/supabase";

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
        Linking.openURL(data.url);
      }
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.inner}>
        <Text variant="displaySmall" style={styles.title}>Payment Tracker</Text>
        <Text variant="bodyLarge" style={styles.subtitle}>Track your money, effortlessly</Text>

        {/* Google Login Button */}
        <Button
          mode="outlined"
          onPress={handleGoogleLogin}
          loading={googleLoading}
          disabled={googleLoading}
          icon="google"
          style={styles.googleBtn}
          contentStyle={styles.buttonContent}
          textColor="#333"
        >
          Continue with Google
        </Button>

        <View style={styles.dividerRow}>
          <Divider style={styles.divider} />
          <Text variant="bodySmall" style={styles.dividerText}>OR</Text>
          <Divider style={styles.divider} />
        </View>

        <TextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          mode="outlined"
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
        />
        <TextInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          mode="outlined"
          secureTextEntry
          style={styles.input}
        />

        {error ? <HelperText type="error">{error}</HelperText> : null}

        <Button
          mode="contained"
          onPress={handleLogin}
          loading={loading}
          disabled={loading}
          style={styles.button}
          contentStyle={styles.buttonContent}
        >
          Login
        </Button>

        <View style={styles.linkRow}>
          <Text variant="bodyMedium">Don't have an account? </Text>
          <Link href="/(auth)/signup">
            <Text variant="bodyMedium" style={styles.link}>Sign Up</Text>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  inner: { flex: 1, justifyContent: "center", padding: 24 },
  title: { textAlign: "center", fontWeight: "bold", color: "#6C63FF", marginBottom: 8 },
  subtitle: { textAlign: "center", color: "#666", marginBottom: 32 },
  input: { marginBottom: 12 },
  button: { marginTop: 8, borderRadius: 8 },
  googleBtn: { borderRadius: 8, borderColor: "#ddd", backgroundColor: "#fff" },
  buttonContent: { paddingVertical: 6 },
  dividerRow: { flexDirection: "row", alignItems: "center", marginVertical: 20 },
  divider: { flex: 1, height: 1 },
  dividerText: { marginHorizontal: 12, color: "#999" },
  linkRow: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
  link: { color: "#6C63FF", fontWeight: "bold" },
});
