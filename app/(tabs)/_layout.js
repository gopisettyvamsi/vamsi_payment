import { useState, useEffect, useCallback } from "react";
import { Tabs } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Platform, View } from "react-native";
import { useTheme } from "../../lib/ThemeContext";
import { getItem, KEYS } from "../../lib/storage";
import BiometricLock from "../../lib/BiometricLock";

export default function TabLayout() {
  const { theme } = useTheme();
  const [locked, setLocked] = useState(false);
  const [checkingLock, setCheckingLock] = useState(true);

  useEffect(() => {
    (async () => {
      if (Platform.OS === "web") {
        setCheckingLock(false);
        return;
      }
      const enabled = await getItem(KEYS.BIOMETRIC_LOCK, false);
      if (enabled) {
        setLocked(true);
      }
      setCheckingLock(false);
    })();
  }, []);

  const handleUnlock = useCallback(() => {
    setLocked(false);
  }, []);

  if (checkingLock) {
    return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: theme.accent,
          tabBarInactiveTintColor: theme.textDim,
          tabBarStyle: {
            backgroundColor: theme.tabBg,
            borderTopWidth: 1,
            borderTopColor: theme.divider,
            paddingBottom: Platform.OS === "ios" ? 24 : 8,
            paddingTop: 8,
            height: Platform.OS === "ios" ? 84 : 60,
            elevation: 0,
          },
          tabBarLabelStyle: { fontSize: 10, fontWeight: "600", marginTop: 2 },
          headerStyle: {
            backgroundColor: theme.bg,
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 1,
            borderBottomColor: theme.divider,
          },
          headerTintColor: theme.text,
          headerTitleStyle: { fontWeight: "700", fontSize: 17 },
        }}
      >
        <Tabs.Screen name="index" options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="home-outline" size={22} color={color} />,
        }} />
        <Tabs.Screen name="transactions" options={{
          title: "History",
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="clock-outline" size={22} color={color} />,
        }} />
        <Tabs.Screen name="add" options={{
          title: "Add",
          tabBarIcon: ({ focused }) => (
            <View style={{
              width: 44, height: 44, borderRadius: 14, marginTop: -12,
              backgroundColor: theme.accent,
              justifyContent: "center", alignItems: "center",
            }}>
              <MaterialCommunityIcons name="plus" size={24} color="#fff" />
            </View>
          ),
        }} />
        <Tabs.Screen name="import" options={{
          title: "Import",
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="download-outline" size={22} color={color} />,
        }} />
        <Tabs.Screen name="settings" options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="account-outline" size={22} color={color} />,
        }} />
      </Tabs>
      {locked && <BiometricLock onUnlock={handleUnlock} />}
    </View>
  );
}
