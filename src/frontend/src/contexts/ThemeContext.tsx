import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";

export type AppTheme =
  | "light"
  | "dark"
  | "raining"
  | "cloudy"
  | "mountain"
  | "seawave"
  | "waterfalls"
  | "sunny";

interface ThemeContextType {
  theme: AppTheme;
  setTheme: (t: AppTheme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  setTheme: () => {},
});

const ATMOSPHERIC = [
  "raining",
  "cloudy",
  "mountain",
  "seawave",
  "waterfalls",
  "sunny",
];

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    const saved = localStorage.getItem("wavechat_theme") as AppTheme | null;
    // Migrate old dark mode pref
    if (!saved) {
      const wasDark = localStorage.getItem("wavechat_darkmode");
      return wasDark === "true" ? "dark" : "light";
    }
    return saved;
  });

  const setTheme = (t: AppTheme) => {
    setThemeState(t);
    localStorage.setItem("wavechat_theme", t);
    // Also sync legacy key so other components that read wavechat_darkmode still work
    localStorage.setItem("wavechat_darkmode", t === "dark" ? "true" : "false");
    const html = document.documentElement;
    html.classList.remove("dark", ...ATMOSPHERIC.map((a) => `theme-${a}`));
    if (t === "dark") html.classList.add("dark");
    else if (ATMOSPHERIC.includes(t)) html.classList.add(`theme-${t}`);
  };

  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove("dark", ...ATMOSPHERIC.map((a) => `theme-${a}`));
    if (theme === "dark") html.classList.add("dark");
    else if (ATMOSPHERIC.includes(theme)) html.classList.add(`theme-${theme}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
