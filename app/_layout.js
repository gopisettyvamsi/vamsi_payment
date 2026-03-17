import { useEffect, useState } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { PaperProvider, MD3DarkTheme } from "react-native-paper";
import { StatusBar } from "react-native";
import { supabase } from "../lib/supabase";
import { C } from "../lib/theme";

const theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: C.purple,
    secondary: C.green,
    background: C.bg,
    surface: C.bgLight,
    onSurface: "#fff",
    onSurfaceVariant: C.textLight,
    outline: C.border,
  },
  roundness: 12,
};

export default function RootLayout() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (!session && !inAuthGroup) router.replace("/(auth)/login");
    else if (session && inAuthGroup) router.replace("/(tabs)");
  }, [session, segments, loading]);

  if (loading) return null;

  return (
    <PaperProvider theme={theme}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <Slot />
    </PaperProvider>
  );
}
