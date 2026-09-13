import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme?: () => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
  forcedTheme?: Theme;
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = false,
  forcedTheme,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (forcedTheme) return forcedTheme;
    if (switchable) {
      const stored = localStorage.getItem("theme");
      return (stored as Theme) || defaultTheme;
    }
    return defaultTheme;
  });

  useEffect(() => {
    const root = document.documentElement;
    const activeTheme = forcedTheme ?? theme;
    root.classList.toggle("dark", activeTheme === "dark");
    root.classList.toggle("light", activeTheme === "light");
    root.dataset.theme = activeTheme;
    root.style.colorScheme = activeTheme;

    if (switchable && !forcedTheme) {
      localStorage.setItem("theme", activeTheme);
    }
  }, [forcedTheme, switchable, theme]);

  const activeTheme = forcedTheme ?? theme;
  const toggleTheme = switchable && !forcedTheme
    ? () => {
        setTheme(prev => (prev === "light" ? "dark" : "light"));
      }
    : undefined;

  return (
    <ThemeContext.Provider
      value={{ theme: activeTheme, toggleTheme, switchable: Boolean(toggleTheme) }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
