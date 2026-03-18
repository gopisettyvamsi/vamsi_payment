import React, { useMemo, useState } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Text } from "react-native-paper";
import Svg, { Rect, Text as SvgText, G } from "react-native-svg";

/**
 * Cash Flow Calendar Heatmap
 *
 * Shows a monthly calendar grid where each day is colored based on transactions.
 *   Green shades = net positive (income > expense)
 *   Red shades   = net negative (expense > income)
 *   Gray         = no transactions
 *
 * Props:
 *   data:   { date: "YYYY-MM-DD", income: number, expense: number }[]
 *   month:  number (0-11)
 *   year:   number
 *   theme:  theme object
 *   size:   width of the component (default 300)
 *   currencyFormatter: function to format amounts (optional)
 */

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function getGreenShade(intensity) {
  // Ensure minimum visible opacity of 0.35, max 1.0
  const alpha = 0.35 + intensity * 0.65;
  return `rgba(74, 222, 128, ${alpha.toFixed(2)})`;
}

function getRedShade(intensity) {
  const alpha = 0.35 + intensity * 0.65;
  return `rgba(248, 113, 113, ${alpha.toFixed(2)})`;
}

export default function CalendarHeatmap({ data = [], month, year, theme, size = 300, currencyFormatter }) {
  const [selectedDay, setSelectedDay] = useState(null);

  const { grid, lookup } = useMemo(() => {
    // Build a lookup map: "YYYY-MM-DD" -> { income, expense }
    const lookup = {};
    data.forEach((d) => {
      lookup[d.date] = { income: d.income || 0, expense: d.expense || 0 };
    });

    // Find max absolute net for scaling intensity (only for this month)
    const firstDay = new Date(year, month, 1);
    const startDow = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let maxAbs = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const entry = lookup[dateStr];
      if (entry) {
        const net = Math.abs(entry.income - entry.expense);
        if (net > maxAbs) maxAbs = net;
      }
    }

    // Build calendar grid
    const cells = [];
    const totalSlots = startDow + daysInMonth;
    const rows = Math.ceil(totalSlots / 7);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < 7; col++) {
        const idx = row * 7 + col;
        const dayNum = idx - startDow + 1;
        if (dayNum < 1 || dayNum > daysInMonth) {
          cells.push({ row, col, day: null });
          continue;
        }
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
        const entry = lookup[dateStr];
        let color;
        let hasData = false;
        if (!entry || (entry.income === 0 && entry.expense === 0)) {
          color = theme?.surface || "rgba(255,255,255,0.05)";
        } else {
          hasData = true;
          const net = entry.income - entry.expense;
          // Use minimum intensity of 0.3 so cells are always visible
          const rawIntensity = maxAbs > 0 ? Math.abs(net) / maxAbs : 1;
          const intensity = Math.max(0.3, rawIntensity);
          color = net >= 0 ? getGreenShade(intensity) : getRedShade(intensity);
        }
        cells.push({ row, col, day: dayNum, color, dateStr, hasData });
      }
    }

    return { grid: { cells, rows }, lookup };
  }, [data, month, year, theme]);

  const cols = 7;
  const padding = 4;
  const headerH = 20;
  const cellGap = 3;
  const cellSize = Math.floor((size - padding * 2 - cellGap * (cols - 1)) / cols);
  const totalW = padding * 2 + cellSize * cols + cellGap * (cols - 1);
  const svgH = headerH + padding + (cellSize + cellGap) * grid.rows + 30;

  const textColor = theme?.textMuted || "rgba(255,255,255,0.4)";
  const dayNumColor = theme?.textSecondary || "rgba(255,255,255,0.7)";

  const fmt = currencyFormatter || ((v) => v.toFixed(2));

  // Get selected day info
  const selectedInfo = selectedDay ? lookup[selectedDay] : null;

  return (
    <View style={{ alignItems: "center" }}>
      {/* Tooltip for selected day */}
      {selectedDay && selectedInfo && (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setSelectedDay(null)}
          style={[styles.tooltip, { backgroundColor: theme?.card || "#1e1e2e", borderColor: theme?.surfaceBorder || "rgba(255,255,255,0.1)" }]}
        >
          <Text style={[styles.tooltipDate, { color: theme?.text || "#fff" }]}>
            {new Date(selectedDay + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          </Text>
          {selectedInfo.income > 0 && (
            <Text style={[styles.tooltipLine, { color: "#4ADE80" }]}>
              {"\u25B2"} Received: {fmt(selectedInfo.income)}
            </Text>
          )}
          {selectedInfo.expense > 0 && (
            <Text style={[styles.tooltipLine, { color: "#F87171" }]}>
              {"\u25BC"} Spent: {fmt(selectedInfo.expense)}
            </Text>
          )}
          {selectedInfo.income > 0 && selectedInfo.expense > 0 && (
            <Text style={[styles.tooltipLine, { color: theme?.textSecondary || "rgba(255,255,255,0.7)" }]}>
              Net: {fmt(selectedInfo.income - selectedInfo.expense)}
            </Text>
          )}
        </TouchableOpacity>
      )}

      <View style={{ position: "relative", width: totalW, height: svgH }}>
        <Svg width={totalW} height={svgH}>
          {/* Day-of-week headers */}
          {DAY_LABELS.map((label, i) => (
            <SvgText
              key={`hdr-${i}`}
              x={padding + i * (cellSize + cellGap) + cellSize / 2}
              y={14}
              fontSize={10}
              fontWeight="600"
              fill={textColor}
              textAnchor="middle"
            >
              {label}
            </SvgText>
          ))}

          {/* Calendar cells */}
          {grid.cells.map((cell, i) => {
            if (cell.day === null) return null;
            const x = padding + cell.col * (cellSize + cellGap);
            const y = headerH + padding + cell.row * (cellSize + cellGap);
            const isSelected = cell.dateStr === selectedDay;
            return (
              <G key={`cell-${i}`}>
                <Rect
                  x={x}
                  y={y}
                  width={cellSize}
                  height={cellSize}
                  rx={4}
                  ry={4}
                  fill={cell.color}
                  stroke={isSelected ? (theme?.primary || "#7C3AED") : "transparent"}
                  strokeWidth={isSelected ? 2 : 0}
                />
                <SvgText
                  x={x + cellSize / 2}
                  y={y + cellSize / 2 + 4}
                  fontSize={cellSize > 30 ? 10 : 8}
                  fontWeight="600"
                  fill={isSelected ? "#fff" : dayNumColor}
                  textAnchor="middle"
                >
                  {cell.day}
                </SvgText>
              </G>
            );
          })}

          {/* Legend */}
          {(() => {
            const legendY = headerH + padding + grid.rows * (cellSize + cellGap) + 8;
            const legendCellSize = 10;
            const legendGap = 6;
            const legendW = legendCellSize * 2 + legendGap * 2 + 120;
            const startX = (totalW - legendW) / 2;
            return (
              <G>
                <Rect x={startX} y={legendY} width={legendCellSize} height={legendCellSize} rx={2} fill="rgba(74, 222, 128, 0.8)" />
                <SvgText x={startX + legendCellSize + 4} y={legendY + 9} fontSize={9} fontWeight="600" fill={textColor}>
                  Income day
                </SvgText>
                <Rect x={startX + 70} y={legendY} width={legendCellSize} height={legendCellSize} rx={2} fill="rgba(248, 113, 113, 0.8)" />
                <SvgText x={startX + 70 + legendCellSize + 4} y={legendY + 9} fontSize={9} fontWeight="600" fill={textColor}>
                  Expense day
                </SvgText>
              </G>
            );
          })()}
        </Svg>

        {/* Invisible touch targets overlaid on SVG cells */}
        {grid.cells.map((cell, i) => {
          if (cell.day === null || !cell.hasData) return null;
          const x = padding + cell.col * (cellSize + cellGap);
          const y = headerH + padding + cell.row * (cellSize + cellGap);
          return (
            <TouchableOpacity
              key={`touch-${i}`}
              style={{ position: "absolute", left: x, top: y, width: cellSize, height: cellSize }}
              activeOpacity={0.7}
              onPress={() => setSelectedDay(cell.dateStr === selectedDay ? null : cell.dateStr)}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tooltip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
    minWidth: 160,
    alignItems: "center",
  },
  tooltipDate: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 4,
  },
  tooltipLine: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
});
