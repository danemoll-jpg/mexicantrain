import { useCallback, useState } from 'react';

const CHATTER_KEY = 'mexicantrain-chatter-silenced';

function readSilenced(): boolean {
  try {
    return localStorage.getItem(CHATTER_KEY) === '1';
  } catch {
    return false;
  }
}

/** Whether the bots' commentary toasts are switched off. Persisted per browser, like the sound
 * mute — independent of it, so someone can keep the tile clacks and lose the wisecracks. */
export function useChatterSilenced(): [boolean, () => void] {
  const [silenced, setSilenced] = useState(readSilenced);

  const toggle = useCallback(() => {
    setSilenced((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(CHATTER_KEY, next ? '1' : '0');
      } catch {
        // localStorage unavailable (private browsing etc.) — just won't persist.
      }
      return next;
    });
  }, []);

  return [silenced, toggle];
}
