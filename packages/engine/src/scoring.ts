import { pipTotal, Tile } from './types.js';

/** A round's score for one player: total pips left in hand (0 if they went out — same
 * "lowest is best" shape as Golf's layout scoring). Assumes `hand` is whatever's left at the
 * moment the round ends, win or blocked. */
export function scoreHand(hand: Tile[]): number {
  return hand.reduce((sum, t) => sum + pipTotal(t), 0);
}
