import React from "react";
import { View } from "react-native";
import { Text } from "react-native-paper";
import Svg, { Circle, G } from "react-native-svg";

/**
 * Donut chart using react-native-svg.
 *
 * Props:
 *   data:     { label, value, color }[]
 *   size:     number (diameter, default 160)
 *   stroke:   number (ring thickness, default 24)
 *   theme:    theme object
 *   centerLabel: string (text in center)
 *   centerValue: string (value in center)
 */
export default function DonutChart({ data = [], size = 160, stroke = 24, theme, centerLabel, centerValue }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  let accumulated = 0;
  const segments = data.map((d) => {
    const pct = d.value / total;
    const offset = circumference * (1 - accumulated) + circumference * 0.25;
    accumulated += pct;
    return { ...d, pct, dashArray: `${circumference * pct} ${circumference * (1 - pct)}`, dashOffset: offset };
  });

  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ position: "relative", width: size, height: size }}>
        <Svg width={size} height={size}>
          {/* Background ring */}
          <Circle cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke={theme?.surface || "rgba(255,255,255,0.06)"} strokeWidth={stroke} />
          <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
            {segments.map((seg, i) => (
              <Circle key={i} cx={size / 2} cy={size / 2} r={radius} fill="none"
                stroke={seg.color} strokeWidth={stroke}
                strokeDasharray={seg.dashArray} strokeDashoffset={seg.dashOffset}
                strokeLinecap="round" />
            ))}
          </G>
        </Svg>
        {/* Center text */}
        {(centerLabel || centerValue) && (
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center" }}>
            {centerValue && <Text style={{ color: theme?.text || "#fff", fontSize: 18, fontWeight: "800" }}>{centerValue}</Text>}
            {centerLabel && <Text style={{ color: theme?.textMuted || "#888", fontSize: 10, fontWeight: "600", marginTop: 2 }}>{centerLabel}</Text>}
          </View>
        )}
      </View>
      {/* Legend */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12, marginTop: 14 }}>
        {segments.map((seg, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: seg.color }} />
            <Text style={{ color: theme?.textMuted || "#888", fontSize: 11, fontWeight: "600" }}>
              {seg.label} {Math.round(seg.pct * 100)}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
