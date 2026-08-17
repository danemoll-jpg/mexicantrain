// A single shared top-10 leaderboard across every device/room — one Firestore document
// (leaderboard/global) so every client's realtime listener sees the same list. Same pattern
// as Golf's src/network/globalLeaderboard.ts: LOWEST total wins, so the board is sorted
// ascending. Humans only — see useLocalGame.ts/useOnlineRoom.ts, which filter out bot seats
// before ever calling addScoresToGlobalLeaderboard, so the board reflects real players, not
// however well the heuristic bot strategy happens to play.
import { doc, onSnapshot, runTransaction } from 'firebase/firestore';
import { db } from './firebase';

const LEADERBOARD_REF = doc(db, 'leaderboard', 'global');
const MAX_ENTRIES = 10;

export interface LeaderboardEntry {
  name: string;
  score: number;
  date: string;
  isAi: boolean;
}

/** Calls callback(entries) immediately with whatever's cached/known, then again on every
 * change. Returns an unsubscribe function. */
export function subscribeToGlobalLeaderboard(callback: (entries: LeaderboardEntry[]) => void): () => void {
  return onSnapshot(LEADERBOARD_REF, (snap) => {
    callback(snap.exists() ? (snap.data().entries as LeaderboardEntry[]) || [] : []);
  });
}

/** results: one finished match's final totals for every player, saved together (ranking
 * everyone against the SAME merged list, not one at a time, so whoever gets processed first
 * doesn't end up with an incorrectly-good rank). Returns an array of ranks (1-based, or null
 * if that score didn't make the top 10) in the same order as `results`. */
export async function addScoresToGlobalLeaderboard(
  results: Array<{ name: string; score: number; isAi: boolean }>,
): Promise<Array<number | null>> {
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(LEADERBOARD_REF);
    const existing: (LeaderboardEntry & { _id?: string })[] = snap.exists() ? snap.data().entries || [] : [];
    const date = new Date().toISOString().slice(0, 10);
    const tagged = results.map((r, i) => ({
      ...r,
      date,
      _id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
    }));
    const combined = [...existing, ...tagged];
    combined.sort((a, b) => a.score - b.score); // lowest score first — pips left in hand
    const trimmed = combined.slice(0, MAX_ENTRIES);
    tx.set(LEADERBOARD_REF, { entries: trimmed });
    return tagged.map((t) => {
      const madeTheCut = trimmed.some((e) => e._id === t._id);
      return madeTheCut ? combined.filter((e) => e.score < t.score).length + 1 : null;
    });
  });
}
