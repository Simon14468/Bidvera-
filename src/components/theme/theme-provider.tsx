"use client";

import { useServerInsertedHTML } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "bidvera-theme";
const THEME_EVENT = "bidvera-theme-change";

/** FOUC-prevention — injected via useServerInsertedHTML (not rendered as a React <script>). */
const THEME_INIT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(STORAGE_KEY)});var light=t==="light";document.documentElement.classList.toggle("light",light);document.documentElement.dataset.theme=light?"light":"dark";}catch(e){document.documentElement.classList.remove("light");document.documentElement.dataset.theme="dark";}})();`;

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("light", theme === "light");
  root.dataset.theme = theme;
}

function subscribeTheme(onStoreChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(THEME_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(THEME_EVENT, onStoreChange);
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Inject theme script into the SSR HTML stream outside the React client tree
  // so React 19 does not warn about <script> inside components.
  useServerInsertedHTML(() => (
    <script
      id="bidvera-theme-init"
      dangerouslySetInnerHTML={{ __html: THEME_INIT }}
    />
  ));

  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "dark" as Theme);

  useLayoutEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    applyTheme(next);
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
