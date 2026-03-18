import { View, Platform, useWindowDimensions } from "react-native";
import { useTheme } from "./ThemeContext";

export default function ResponsiveContainer({ children, style }) {
  const { width } = useWindowDimensions();
  const { theme } = useTheme();
  const isWideScreen = Platform.OS === "web" && width > 500;

  if (!isWideScreen) return <View style={[{ flex: 1 }, style]}>{children}</View>;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bgOuter, alignItems: "center" }}>
      <View style={{
        flex: 1,
        width: 420,
        maxWidth: 420,
        backgroundColor: theme.bg,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: theme.border,
        overflow: "hidden",
        ...style,
      }}>
        {children}
      </View>
    </View>
  );
}
