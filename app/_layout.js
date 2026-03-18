import { useEffect, useState } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { PaperProvider, MD3DarkTheme, MD3LightTheme } from "react-native-paper";
import { StatusBar } from "react-native";
import { supabase } from "../lib/supabase";
import { setItem, KEYS } from "../lib/storage";
import { ThemeProvider, useTheme } from "../lib/ThemeContext";
import ResponsiveContainer from "../lib/ResponsiveContainer";
import { CurrencyProvider } from "../lib/CurrencyContext";
import Splash from "./(auth)/splash";

function InnerLayout() {
  const { theme, isDark } = useTheme();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const segments = useSegments();
  const router = useRouter();

  const paperTheme = {
    ...(isDark ? MD3DarkTheme : MD3LightTheme),
    colors: {
      ...(isDark ? MD3DarkTheme : MD3LightTheme).colors,
      primary: theme.accent,
      secondary: theme.green,
      background: theme.bg,
      surface: theme.card,
      onSurface: theme.text,
      onSurfaceVariant: theme.textSecondary,
      outline: theme.border,
    },
    roundness: 12,
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      // Store Google provider token when available (only present right after OAuth login)
      if (session?.provider_token) {
        setItem(KEYS.GOOGLE_TOKEN, session.provider_token);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (loading || showSplash) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (!session && !inAuthGroup) router.replace("/(auth)/login");
    else if (session && inAuthGroup) router.replace("/(tabs)");
  }, [session, segments, loading, showSplash]);

  if (showSplash) {
    return (
      <ResponsiveContainer>
        <Splash onFinish={() => setShowSplash(false)} />
      </ResponsiveContainer>
    );
  }

  if (loading) return null;

  return (
    <PaperProvider theme={paperTheme}>
      <CurrencyProvider>
        <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
        <ResponsiveContainer>
          <Slot />
        </ResponsiveContainer>
      </CurrencyProvider>
    </PaperProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <InnerLayout />
    </ThemeProvider>
  );
}
