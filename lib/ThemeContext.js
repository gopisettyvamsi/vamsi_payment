import { createContext, useContext, useState, useEffect } from "react";
import { getItem, setItem, KEYS } from "./storage";
import { dark, light } from "./theme";

const ThemeContext = createContext({ theme: dark, isDark: true, toggleTheme: () => {} });

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    getItem(KEYS.THEME, "dark").then((t) => setIsDark(t === "dark"));
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    setItem(KEYS.THEME, next ? "dark" : "light");
  };

  const theme = isDark ? dark : light;

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
