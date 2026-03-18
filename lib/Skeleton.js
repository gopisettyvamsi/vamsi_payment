import { useEffect, useRef } from "react";
import { View, Animated, StyleSheet } from "react-native";

export default function Skeleton({ width = "100%", height = 20, borderRadius = 8, style }) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1000, useNativeDriver: false }),
        Animated.timing(shimmer, { toValue: 0, duration: 1000, useNativeDriver: false }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const bg = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,255,255,0.04)", "rgba(255,255,255,0.08)"],
  });

  return <Animated.View style={[{ width, height, borderRadius, backgroundColor: bg }, style]} />;
}

export function SkeletonCard() {
  return (
    <View style={sk.card}>
      <View style={sk.row}>
        <Skeleton width={42} height={42} borderRadius={21} />
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width="60%" height={14} />
          <Skeleton width="35%" height={10} />
        </View>
        <Skeleton width={70} height={16} />
      </View>
    </View>
  );
}

export function SkeletonBalance() {
  return (
    <View style={sk.balance}>
      <Skeleton width={100} height={11} />
      <Skeleton width={180} height={32} borderRadius={8} style={{ marginVertical: 10 }} />
      <View style={{ flexDirection: "row", gap: 32, marginTop: 8 }}>
        <View style={{ gap: 6 }}>
          <Skeleton width={50} height={11} />
          <Skeleton width={80} height={15} />
        </View>
        <View style={{ gap: 6 }}>
          <Skeleton width={50} height={11} />
          <Skeleton width={80} height={15} />
        </View>
      </View>
    </View>
  );
}

const sk = StyleSheet.create({
  card: { backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 12, marginBottom: 8, padding: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  balance: { backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 20, padding: 24, marginHorizontal: 20, marginTop: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
});
