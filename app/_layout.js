import { useEffect, useState } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { PaperProvider, MD3LightTheme } from "react-native-paper";
import { supabase } from "../lib/supabase";

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: "#6C63FF",
    secondary: "#4ECDC4",
    background: "#F8F9FA",
    surface: "#FFFFFF",
  },
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
      // Not logged in and not on auth screen → redirect to login
      router.replace("/(auth)/login");
    } else if (session && inAuthGroup) {
      // Logged in but on auth screen → redirect to dashboard
      router.replace("/(tabs)");
    }
  }, [session, segments, loading]);

  if (loading) return null;

  return (
    <PaperProvider theme={theme}>
      <Slot />
    </PaperProvider>
  );
}
