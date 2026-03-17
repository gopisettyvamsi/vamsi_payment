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
    outputRange: ["rgba(255,255,255,0.04)", "rgba(255,255,255,0.1)"],
  });

  return <Animated.View style={[{ width, height, borderRadius, backgroundColor: bg }, style]} />;
}

export function SkeletonCard() {
  return (
    <View style={sk.card}>
      <View style={sk.row}>
        <Skeleton width={44} height={44} borderRadius={14} />
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
      <Skeleton width={100} height={12} />
      <Skeleton width={180} height={36} borderRadius={8} style={{ marginVertical: 10 }} />
      <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 8 }}>
        <View style={{ alignItems: "center", gap: 6 }}>
          <Skeleton width={32} height={32} borderRadius={10} />
          <Skeleton width={70} height={14} />
        </View>
        <View style={{ alignItems: "center", gap: 6 }}>
          <Skeleton width={32} height={32} borderRadius={10} />
          <Skeleton width={70} height={14} />
        </View>
      </View>
    </View>
  );
}

const sk = StyleSheet.create({
  card: { backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 14, marginBottom: 8, padding: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  balance: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 20, padding: 24, marginHorizontal: 16, marginTop: 16 },
});
