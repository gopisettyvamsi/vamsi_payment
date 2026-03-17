import { View, Platform, useWindowDimensions } from "react-native";
import { C } from "./theme";

// On web desktop, constrain to phone width centered on screen
export default function ResponsiveContainer({ children, style }) {
  const { width } = useWindowDimensions();
  const isWideScreen = Platform.OS === "web" && width > 500;

  if (!isWideScreen) return <View style={[{ flex: 1 }, style]}>{children}</View>;

  return (
    <View style={{ flex: 1, backgroundColor: "#080014", alignItems: "center" }}>
      <View style={{
        flex: 1,
        width: 420,
        maxWidth: 420,
        backgroundColor: C.bg,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: "rgba(255,255,255,0.06)",
        shadowColor: C.purple,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.15,
        shadowRadius: 40,
        overflow: "hidden",
        ...style,
      }}>
        {children}
      </View>
    </View>
  );
}
