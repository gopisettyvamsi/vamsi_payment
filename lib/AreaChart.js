import React from "react";
import { View } from "react-native";
import { Text } from "react-native-paper";
import Svg, { Path, Defs, LinearGradient as SvgGrad, Stop, Line, Text as SvgText } from "react-native-svg";

/**
 * Dual gradient area chart (income + expense).
 *
 * Props:
 *   labels:   string[]          – x-axis labels (e.g. month names)
 *   series:   { data: number[], color: string, label: string }[]
 *   width:    number
 *   height:   number            – chart area height (default 180)
 *   theme:    object            – theme colors
 */
export default function AreaChart({ labels = [], series = [], width = 300, height = 180, theme }) {
  const PAD_LEFT = 44;
  const PAD_RIGHT = 12;
  const PAD_TOP = 12;
  const PAD_BOTTOM = 28;
  const chartW = width - PAD_LEFT - PAD_RIGHT;
  const chartH = height - PAD_TOP - PAD_BOTTOM;

  // Find max across all series
  const allValues = series.flatMap(s => s.data);
  const rawMax = Math.max(...allValues, 1);
  // Round up to a nice number
  const niceMax = (() => {
    if (rawMax <= 10) return 10;
    const mag = Math.pow(10, Math.floor(Math.log10(rawMax)));
    const norm = rawMax / mag;
    if (norm <= 1.5) return 1.5 * mag;
    if (norm <= 2) return 2 * mag;
    if (norm <= 3) return 3 * mag;
    if (norm <= 5) return 5 * mag;
    return 10 * mag;
  })();

  const n = labels.length;
  if (n === 0) return null;

  // X positions
  const xs = labels.map((_, i) => PAD_LEFT + (i / Math.max(n - 1, 1)) * chartW);
  // Y position for a value
  const yOf = (v) => PAD_TOP + chartH - (v / niceMax) * chartH;

  // Smooth cubic bezier path through points
  const smoothPath = (points) => {
    if (points.length < 2) return "";
    let d = `M ${points[0][0]},${points[0][1]}`;
    for (let i = 0; i < points.length - 1; i++) {
      const [x0, y0] = points[i];
      const [x1, y1] = points[i + 1];
      const cpx = (x1 - x0) * 0.4;
      d += ` C ${x0 + cpx},${y0} ${x1 - cpx},${y1} ${x1},${y1}`;
    }
    return d;
  };

  // Build area path (line + close to bottom)
  const areaPath = (data) => {
    const points = data.map((v, i) => [xs[i], yOf(v)]);
    const line = smoothPath(points);
    const bottom = PAD_TOP + chartH;
    return `${line} L ${points[points.length - 1][0]},${bottom} L ${points[0][0]},${bottom} Z`;
  };

  // Y-axis grid lines (4 lines)
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    y: PAD_TOP + chartH * (1 - f),
    label: formatK(niceMax * f),
  }));

  return (
    <View>
      <Svg width={width} height={height}>
        <Defs>
          {series.map((s, idx) => (
            <SvgGrad key={idx} id={`grad-${idx}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={s.color} stopOpacity="0.4" />
              <Stop offset="100%" stopColor={s.color} stopOpacity="0.02" />
            </SvgGrad>
          ))}
        </Defs>

        {/* Grid lines */}
        {gridLines.map((g, i) => (
          <React.Fragment key={i}>
            <Line x1={PAD_LEFT} y1={g.y} x2={width - PAD_RIGHT} y2={g.y}
              stroke={theme?.divider || "rgba(255,255,255,0.06)"} strokeWidth="1" strokeDasharray="4,4" />
            <SvgText x={PAD_LEFT - 8} y={g.y + 4} textAnchor="end"
              fill={theme?.textMuted || "rgba(255,255,255,0.4)"} fontSize="10" fontWeight="500">
              {g.label}
            </SvgText>
          </React.Fragment>
        ))}

        {/* X labels — skip empty ones */}
        {labels.map((lbl, i) => lbl ? (
          <SvgText key={i} x={xs[i]} y={height - 4} textAnchor="middle"
            fill={theme?.textMuted || "rgba(255,255,255,0.4)"} fontSize="10" fontWeight="500">
            {lbl}
          </SvgText>
        ) : null)}

        {/* Area fills (render expense first so income overlaps on top) */}
        {[...series].reverse().map((s, idx) => (
          <Path key={`area-${idx}`} d={areaPath(s.data)} fill={`url(#grad-${series.length - 1 - idx})`} />
        ))}

        {/* Stroke lines */}
        {series.map((s, idx) => {
          const points = s.data.map((v, i) => [xs[i], yOf(v)]);
          return <Path key={`line-${idx}`} d={smoothPath(points)} fill="none" stroke={s.color} strokeWidth="2.5" />;
        })}

        {/* Dots on latest point */}
        {series.map((s, idx) => {
          const lastIdx = s.data.length - 1;
          if (lastIdx < 0) return null;
          return (
            <React.Fragment key={`dot-${idx}`}>
              <circle cx={xs[lastIdx]} cy={yOf(s.data[lastIdx])} r="4" fill={s.color} />
              <circle cx={xs[lastIdx]} cy={yOf(s.data[lastIdx])} r="7" fill={s.color} fillOpacity="0.2" />
            </React.Fragment>
          );
        })}
      </Svg>

      {/* Legend */}
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 24, marginTop: 8 }}>
        {series.map((s, idx) => (
          <View key={idx} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color }} />
            <Text style={{ color: theme?.textMuted || "#888", fontSize: 11, fontWeight: "600" }}>{s.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function formatK(v) {
  if (v >= 100000) return `${(v / 100000).toFixed(v % 100000 === 0 ? 0 : 1)}L`;
  if (v >= 1000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}K`;
  return String(Math.round(v));
}
