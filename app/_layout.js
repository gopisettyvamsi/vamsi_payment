import { useEffect, useState } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { PaperProvider, MD3DarkTheme } from "react-native-paper";
import { StatusBar } from "react-native";
import { supabase } from "../lib/supabase";
import { COLORS } from "../lib/theme";

const theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: COLORS.primary,
    secondary: COLORS.secondary,
    background: COLORS.bg,
    surface: COLORS.bgCard,
    surfaceVariant: COLORS.bgCardLight,
    onSurface: COLORS.textPrimary,
    onSurfaceVariant: COLORS.textSecondary,
    outline: COLORS.border,
    elevation: {
      level0: "transparent",
      level1: COLORS.bgCard,
      level2: COLORS.bgCardLight,
      level3: COLORS.bgCardLight,
      level4: COLORS.bgCardLight,
      level5: COLORS.bgCardLight,
    },
  },
  roundness: 16,
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
    if (!session && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (session && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [session, segments, loading]);

  if (loading) return null;

  return (
    <PaperProvider theme={theme}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <Slot />
    </PaperProvider>
  );
}
