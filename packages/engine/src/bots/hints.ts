import { findTileInHand, MEXICAN_TRAIN_ID } from '../rules.js';
import { GameState, PlayerAction } from '../types.js';
import { chooseBestAction, ReasonTag } from './strategy.js';

export interface MoveHint {
  action: PlayerAction;
  headline: string;
  rationale: string;
}

function trainLabel(state: GameState, trainId: string, seatIndex: number): string {
  if (trainId === MEXICAN_TRAIN_ID) return 'the Mexican Train';
  if (trainId === state.players[seatIndex].id) return 'your train';
  const owner = state.players.find((p) => p.id === trainId);
  return owner ? `${owner.name}'s train` : 'that train';
}

function describeAction(action: PlayerAction, state: GameState, seatIndex: number): string {
  switch (action.type) {
    case 'playTile': {
      const tile = findTileInHand(state.players[seatIndex].hand, action.tileId);
      const label = tile ? `${tile.a}-${tile.b}` : action.tileId;
      return `Play the ${label} onto ${trainLabel(state, action.trainId, seatIndex)}`;
    }
    case 'drawTile':
      return 'Draw a tile from the boneyard';
    case 'passTurn':
      return "Pass — you can't play";
  }
}

const RATIONALE: Record<ReasonTag, string> = {
  onlyOption: "It's your only legal move right now.",
  forcedDraw: "You've got nothing playable — draw and see what you get.",
  forcedPass: "Still nothing playable after drawing — pass, and your train goes public until you can play on it again.",
  satisfyOpenDouble: "There's an open double on the board — until someone fills it, that's the only kind of move anyone can make. Close it out.",
  shedHeavyOwnTrain: "It's one of your heavier tiles, and it keeps your own train moving — a safe, private play.",
  shedHeavyMexicanTrain: "It's one of your heavier tiles — dumping it on the Mexican Train sheds the weight without opening up anything of yours.",
  shedHeavyOpponentTrain: "It's one of your heavier tiles, and that train's open to play on right now — get rid of it while you can.",
};

/** Suggests the best move for `seatIndex` using the same heuristic the bots use, in plain
 * English — this is the "What should I play?" button's whole implementation, so a hint can
 * never suggest something illegal and a bot can never cheat by seeing more than this. */
export function getHint(state: GameState, seatIndex: number): MoveHint | null {
  const best = chooseBestAction(state, seatIndex);
  if (!best) return null;
  return {
    action: best.action,
    headline: describeAction(best.action, state, seatIndex),
    rationale: RATIONALE[best.reason],
  };
}
