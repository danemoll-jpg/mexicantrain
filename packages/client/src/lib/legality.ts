// Lightweight client-side "can I do this right now?" checks, used only for
// highlighting/disabling controls in the UI. The engine is still the sole source of truth —
// applyAction re-validates every action via @mexicantrain/engine's rules — so nothing here
// needs to be exhaustively airtight, just a good-faith mirror of the real rules.
import { PublicGameState, Tile, tileMatches } from '@mexicantrain/engine';

export function isMyTurn(state: PublicGameState): boolean {
  return state.actingSeat === state.viewerSeatIndex;
}

export function canDraw(state: PublicGameState): boolean {
  return isMyTurn(state) && !hasAnyLegalPlay(state) && !state.drawnThisSegment && state.boneyardCount > 0;
}

export function canPass(state: PublicGameState): boolean {
  return isMyTurn(state) && !hasAnyLegalPlay(state) && (state.drawnThisSegment || state.boneyardCount === 0);
}

/** Who can play on a train, from the viewer's seat:
 * - `open`: anyone (the Mexican Train, an opened player train, or every train under the
 *   all-trains-public house rule)
 * - `yours`: the viewer's own private train — only they can play on it
 * - `locked`: someone else's private train — the viewer can't play on it */
export type TrainAccess = 'open' | 'yours' | 'locked';

export function trainAccess(state: PublicGameState, trainId: string): TrainAccess {
  const train = state.trains[trainId];
  // Same rule as playableTrainIds/the engine: under all-trains-public the per-train isPublic
  // flag is irrelevant (the engine even flips it back to false when an owner plays on their
  // own train), so reading the flag alone would show a lock on a train that's actually open.
  if (trainId === 'mexican' || train.isPublic || state.rules.allTrainsPublic) return 'open';
  const me = state.players[state.viewerSeatIndex];
  return me && train.ownerId === me.id ? 'yours' : 'locked';
}

/** Which of the board's trains `tile` could legally be played on right now, respecting the
 * open-double restriction and private/public train visibility — a good-faith mirror only
 * (see module docstring); the server-side engine is what actually enforces this. */
export function playableTrainIds(state: PublicGameState, tile: Tile): string[] {
  if (!isMyTurn(state)) return [];
  const me = state.players[state.viewerSeatIndex];

  if (state.openDouble) {
    return tileMatches(tile, state.openDouble.value) ? [state.openDouble.trainId] : [];
  }

  return state.trainOrder.filter((id) => {
    const train = state.trains[id];
    const playable = id === 'mexican' || train.ownerId === me.id || train.isPublic || state.rules.allTrainsPublic;
    return playable && tileMatches(tile, train.openEnd);
  });
}

export function hasAnyLegalPlay(state: PublicGameState): boolean {
  if (!isMyTurn(state)) return false;
  const me = state.players[state.viewerSeatIndex];
  return (me.hand ?? []).some((t) => playableTrainIds(state, t).length > 0);
}
