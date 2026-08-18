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
