import { useCallback, useEffect, useState } from "react";
import { STORAGE_KEY, THEME_CLASSES, getTheme, type ThemeId } from "@/lib/themes";

function applyTheme(id: ThemeId) {
  const root = document.documentElement;
  root.classList.remove(...THEME_CLASSES);
  const cls = getTheme(id).className;
  if (cls) root.classList.add(cls);
}

/**
 * Theme state persisted in localStorage. Premium themes are only kept while
 * the visitor is signed in; guests fall back to the default dark palette.
 */
export function useTheme(canUsePremium: boolean) {
  const [theme, setThemeState] = useState<ThemeId>("dark");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = getTheme(window.localStorage.getItem(STORAGE_KEY));
    setThemeState(stored.id);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const def = getTheme(theme);
    if (def.premium && !canUsePremium) {
      setThemeState("dark");
      return;
    }
    applyTheme(theme);
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme, hydrated, canUsePremium]);

  const setTheme = useCallback((id: ThemeId) => setThemeState(id), []);

  return { theme, setTheme, hydrated };
}
