import { useState, useEffect, useCallback } from "react";
import { View, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "./ThemeContext";

let LocalAuthentication = null;
if (Platform.OS !== "web") {
  LocalAuthentication = require("expo-local-authentication");
}

export default function BiometricLock({ onUnlock }) {
  const { theme } = useTheme();
  const [failed, setFailed] = useState(false);
  const [checking, setChecking] = useState(true);

  const authenticate = useCallback(async () => {
    setFailed(false);
    setChecking(true);

    try {
      if (!LocalAuthentication) {
        onUnlock();
        return;
      }

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) {
        onUnlock();
        return;
      }

      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!isEnrolled) {
        onUnlock();
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock Vamsify",
        fallbackLabel: "Use passcode",
        cancelLabel: "Cancel",
        disableDeviceFallback: false,
      });

      if (result.success) {
        onUnlock();
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setChecking(false);
    }
  }, [onUnlock]);

  useEffect(() => {
    authenticate();
  }, [authenticate]);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={styles.content}>
        <View style={[styles.iconCircle, { backgroundColor: theme.accent + "20" }]}>
          <MaterialCommunityIcons
            name={failed ? "lock-alert-outline" : "lock-outline"}
            size={48}
            color={theme.accent}
          />
        </View>

        <Text style={[styles.appName, { color: theme.text }]}>Vamsify</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          {checking
            ? "Verifying identity..."
            : failed
            ? "Authentication failed"
            : "Locked"}
        </Text>

        <TouchableOpacity
          onPress={authenticate}
          activeOpacity={0.7}
          style={[styles.unlockBtn, { backgroundColor: theme.accent }]}
        >
          <MaterialCommunityIcons
            name={failed ? "refresh" : "fingerprint"}
            size={20}
            color="#fff"
          />
          <Text style={styles.unlockText}>
            {failed ? "Try Again" : "Tap to unlock"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
    paddingHorizontal: 40,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  appName: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 40,
  },
  unlockBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
  },
  unlockText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
