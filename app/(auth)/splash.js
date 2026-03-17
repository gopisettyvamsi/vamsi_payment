import { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C } from "../../lib/theme";

const logo = require("../../assets/logo.png");

export default function Splash({ onFinish }) {
  const scale = useRef(new Animated.Value(0.3)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
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
    <LinearGradient colors={C.purpleDeep} style={s.container}>
      <Animated.View style={[s.logoWrap, { transform: [{ scale }], opacity }]}>
        <Image source={logo} style={s.logoImg} resizeMode="contain" />
      </Animated.View>
      <Animated.Text style={[s.brand, { opacity: textOpacity }]}>Vamsify</Animated.Text>
      <Animated.Text style={[s.tagline, { opacity: textOpacity }]}>Smart money tracking</Animated.Text>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  logoWrap: { marginBottom: 20 },
  logoImg: { width: 120, height: 120, borderRadius: 60 },
  brand: { fontSize: 34, fontWeight: "900", color: "#fff", letterSpacing: 2 },
  tagline: { fontSize: 14, color: "rgba(255,255,255,0.5)", marginTop: 6 },
});
