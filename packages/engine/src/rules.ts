import { GameState, PlayerAction, PlayTileAction, Tile, tileId, tileMatches, Train } from './types.js';

export function nextSeat(playerCount: number, from: number): number {
  return (from + 1) % playerCount;
}

export const MEXICAN_TRAIN_ID = 'mexican';

/** True if `playerId` is currently allowed to play a tile onto `train` — the Mexican train
 * is always fair game, a player's own train is always fair game to its owner, and anyone
 * else's train only if it's currently marked public (topper on it), or the whole match is
 * being played under the "all trains public" house rule. */
export function isTrainPlayableBy(train: Train, playerId: string, allTrainsPublic: boolean): boolean {
  if (train.id === MEXICAN_TRAIN_ID) return true;
  if (train.ownerId === playerId) return true;
  return allTrainsPublic || train.isPublic;
}

/** Every legal `playTile` action for `seatIndex` right now. When an open double is pending,
 * this is restricted to tiles that satisfy it (on that specific train), regardless of whose
 * turn it originally was — satisfying an open double is always allowed, for anyone. */
export function legalPlaysForSeat(state: GameState, seatIndex: number): PlayTileAction[] {
  const player = state.players[seatIndex];
  const actions: PlayTileAction[] = [];

  if (state.openDouble) {
    const train = state.trains[state.openDouble.trainId];
    for (const t of player.hand) {
      if (tileMatches(t, state.openDouble.value)) {
        actions.push({ type: 'playTile', tileId: tileId(t), trainId: train.id });
      }
    }
    return actions;
  }

  for (const trainId of state.trainOrder) {
    const train = state.trains[trainId];
    if (!isTrainPlayableBy(train, player.id, state.rules.allTrainsPublic)) continue;
    for (const t of player.hand) {
      if (tileMatches(t, train.openEnd)) {
        actions.push({ type: 'playTile', tileId: tileId(t), trainId });
      }
    }
  }
  return actions;
}

/** Computes the legal actions for whichever seat is currently allowed to act. Always
 * well-defined: a play if any exists, otherwise a single draw (once per turn segment, if the
 * boneyard isn't empty), otherwise a pass — there's never a dead end with zero legal moves. */
export function getLegalActions(state: GameState, seatIndex: number): PlayerAction[] {
  if (state.phase !== 'playing' || state.actingSeat !== seatIndex) return [];

  const plays = legalPlaysForSeat(state, seatIndex);
  if (plays.length > 0) return plays;

  if (!state.drawnThisSegment && state.boneyard.length > 0) {
    return [{ type: 'drawTile' }];
  }
  return [{ type: 'passTurn' }];
}

export function isActionLegal(state: GameState, seatIndex: number, action: PlayerAction): boolean {
  const legal = getLegalActions(state, seatIndex);
  return legal.some((a) => {
    if (a.type !== action.type) return false;
    if (a.type === 'playTile' && action.type === 'playTile') {
      return a.tileId === action.tileId && a.trainId === action.trainId;
    }
    return true;
  });
}

export function findTileInHand(hand: Tile[], id: string): Tile | undefined {
  return hand.find((t) => tileId(t) === id);
}
