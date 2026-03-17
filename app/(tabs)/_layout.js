import { Tabs } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View, Platform } from "react-native";
import { COLORS } from "../../lib/theme";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.tabInactive,
        tabBarStyle: {
          backgroundColor: COLORS.tabBg,
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
          paddingBottom: Platform.OS === "ios" ? 20 : 8,
          paddingTop: 8,
          height: Platform.OS === "ios" ? 85 : 68,
          ...(Platform.OS === "web" ? {} : {
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
          }),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          letterSpacing: 0.3,
        },
        headerStyle: {
          backgroundColor: COLORS.bgSurface,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTintColor: "#fff",
        headerTitleStyle: {
          fontWeight: "800",
          fontSize: 20,
          letterSpacing: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? { backgroundColor: COLORS.primary + "20", borderRadius: 12, padding: 4 } : { padding: 4 }}>
              <MaterialCommunityIcons name="view-dashboard" size={24} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: "Transactions",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? { backgroundColor: COLORS.primary + "20", borderRadius: 12, padding: 4 } : { padding: 4 }}>
              <MaterialCommunityIcons name="swap-horizontal" size={24} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: "Add",
          tabBarIcon: ({ color, focused }) => (
            <View style={{
              backgroundColor: focused ? COLORS.primary : COLORS.primary + "40",
              borderRadius: 16,
              padding: 8,
              marginTop: -4,
            }}>
              <MaterialCommunityIcons name="plus" size={24} color="#fff" />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="import"
        options={{
          title: "Import",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? { backgroundColor: COLORS.primary + "20", borderRadius: 12, padding: 4 } : { padding: 4 }}>
              <MaterialCommunityIcons name="file-import" size={24} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? { backgroundColor: COLORS.primary + "20", borderRadius: 12, padding: 4 } : { padding: 4 }}>
              <MaterialCommunityIcons name="cog" size={24} color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
