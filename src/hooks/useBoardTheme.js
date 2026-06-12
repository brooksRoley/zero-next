import { useState, useEffect, useCallback } from 'react';
import { DEFAULT_BOARD_PREFS, sanitizeBoardPrefs } from 'src/lib/pente/boardThemes';

const STORAGE_KEY = 'pente_board_prefs_v1';

/**
 * Per-player board customization preferences (skin, stone style, motion mode).
 * Cosmetic-only, so localStorage is the source of truth — each player styles
 * their own view of the board, even in online games.
 */
export default function useBoardTheme() {
  const [prefs, setPrefs] = useState(DEFAULT_BOARD_PREFS);

  // Hydrate after mount (SSR-safe; avoids hydration mismatch on the board attrs)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setPrefs(sanitizeBoardPrefs(JSON.parse(raw)));
    } catch { /* private mode or corrupt JSON — keep defaults */ }
  }, []);

  const updatePrefs = useCallback((patch) => {
    setPrefs(prev => {
      const next = sanitizeBoardPrefs({ ...prev, ...patch });
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch { /* persistence is best-effort */ }
      return next;
    });
  }, []);

  return { prefs, updatePrefs };
}
