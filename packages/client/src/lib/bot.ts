// Runs one bot decision using the shared heuristic strategy. Used identically by local
// (vs-bots) games and, in online rooms, by the host's browser stepping a bot seat.
import { applyAction, BotDifficulty, chooseBotAction, GameEvent, GameState } from '@mexicantrain/engine';

export interface BotStepResult {
  state: GameState;
  newEvents: GameEvent[];
}

export function isBotTurn(state: GameState): boolean {
  // 'roundOver' isn't turn-based — nobody "acts" there, humans just ready up in any order —
  // so `actingSeat` (a leftover from whoever played last) doesn't mean anything and must not
  // be read as "it's this bot's turn."
  return state.phase === 'playing' && state.players[state.actingSeat]?.isBot === true;
}

/** Applies exactly one bot decision using the shared heuristic strategy at the given
 * difficulty (defaults to 'normal' if unspecified). A single call may only draw (leaving the
 * same bot still acting to decide what to play next) — the caller loops via isBotTurn until
 * it's a human's turn again. */
export function stepBot(state: GameState, difficulty: BotDifficulty = 'normal'): BotStepResult {
  const seatIndex = state.actingSeat;
  const decision = chooseBotAction(state, seatIndex, difficulty);
  if (!decision) throw new Error(`Bot at seat ${seatIndex} has no legal action available`);
  const prevLogLength = state.log.length;
  const next = applyAction(state, seatIndex, decision.action);
  return { state: next, newEvents: next.log.slice(prevLogLength) };
}
