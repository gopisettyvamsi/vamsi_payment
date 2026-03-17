import { Tabs } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Platform } from "react-native";
import { C } from "../../lib/theme";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: C.purple,
        tabBarInactiveTintColor: "rgba(255,255,255,0.35)",
        tabBarStyle: {
          backgroundColor: C.tabBg,
          borderTopWidth: 0.5,
          borderTopColor: C.border,
          paddingBottom: Platform.OS === "ios" ? 24 : 8,
          paddingTop: 8,
          height: Platform.OS === "ios" ? 88 : 64,
          elevation: 0,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700", marginTop: 2 },
        headerStyle: { backgroundColor: C.bg, elevation: 0, shadowOpacity: 0, borderBottomWidth: 0.5, borderBottomColor: C.border },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "800", fontSize: 18 },
      }}
    >
      <Tabs.Screen name="index" options={{
        title: "Home",
        tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="home" size={size} color={color} />,
      }} />
      <Tabs.Screen name="transactions" options={{
        title: "History",
        tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="history" size={size} color={color} />,
      }} />
      <Tabs.Screen name="add" options={{
        title: "Add",
        tabBarIcon: ({ color }) => (
          <MaterialCommunityIcons name="plus-circle" size={32} color={C.purple} />
        ),
      }} />
      <Tabs.Screen name="import" options={{
        title: "Import",
        tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="download" size={size} color={color} />,
      }} />
      <Tabs.Screen name="settings" options={{
        title: "Profile",
        tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="account-circle" size={size} color={color} />,
      }} />
    </Tabs>
  );
}
