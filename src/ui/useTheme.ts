import { useEffect, useState } from "react";
import { store } from "../storage/local";

// "system" follows the computer's own light or dark setting. public/theme.js applies the choice on load.
export type Theme = "system" | "light" | "dark";
const KEY = "mdt.ui.theme";

function read(): Theme {
  const t = store.get(KEY);
  return t === "light" || t === "dark" ? t : "system";
}

function apply(t: Theme) {
  if (t === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
}

export function useTheme() {
  const [theme, setTheme] = useState(read);
  // A change made in another tab applies here too.
  useEffect(() => {
    const changed = (e: StorageEvent) => {
      if (e.key !== KEY && e.key !== null) return;
      const t = read();
      apply(t);
      setTheme(t);
    };
    addEventListener("storage", changed);
    return () => removeEventListener("storage", changed);
  }, []);
  function choose(t: Theme) {
    if (t === "system") store.del(KEY);
    else store.set(KEY, t);
    apply(t);
    setTheme(t);
  }
  return { theme, choose };
}

export type ThemeApi = ReturnType<typeof useTheme>;
