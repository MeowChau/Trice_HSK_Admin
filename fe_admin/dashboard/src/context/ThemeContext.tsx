"use client";

import type React from "react";
import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";

type Theme = "light" | "dark";

type ThemeContextType = {
  theme: Theme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const themeChanged = "tricehsk:theme-changed";
function readTheme(): Theme {
  return localStorage.getItem("theme") === "dark" ? "dark" : "light";
}
function subscribeTheme(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(themeChanged, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(themeChanged, listener);
  };
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const theme = useSyncExternalStore(
    subscribeTheme,
    readTheme,
    () => "light" as Theme,
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggleTheme = () => {
    localStorage.setItem("theme", theme === "light" ? "dark" : "light");
    window.dispatchEvent(new Event(themeChanged));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
