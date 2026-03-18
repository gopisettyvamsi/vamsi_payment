import { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Image } from "react-native";
import { useTheme } from "../../lib/ThemeContext";

const logo = require("../../assets/logo.png");

export default function Splash({ onFinish }) {
  const { theme } = useTheme();
  const scale = useRef(new Animated.Value(0.3)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      Animated.timing(textOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(800),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(textOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
    ]).start(() => onFinish && onFinish());
  }, []);

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <Animated.View style={{ transform: [{ scale }], opacity }}>
        <Image source={logo} style={s.logoImg} resizeMode="contain" />
      </Animated.View>
      <Animated.Text style={[s.brand, { color: theme.text }]}>Vamsify</Animated.Text>
      <Animated.Text style={[s.tagline, { color: theme.textMuted }]}>Smart money tracking</Animated.Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  logoImg: { width: 100, height: 100, borderRadius: 50 },
  brand: { fontSize: 32, fontWeight: "800", letterSpacing: 1, marginTop: 20 },
  tagline: { fontSize: 14, fontWeight: "500", marginTop: 6 },
});
