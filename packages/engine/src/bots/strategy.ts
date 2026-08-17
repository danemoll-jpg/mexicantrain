import { MEXICAN_TRAIN_ID, findTileInHand, getLegalActions } from '../rules.js';
import { GameState, otherEnd, PlayerAction, pipTotal, tileId, tileMatches } from '../types.js';

/**
 * Heuristic move scorer shared by the bots and the human hint generator, so a hint always
 * matches what a competent bot would actually do — and a bot never has access to information
 * or moves the rules engine wouldn't allow (in particular: it never "knows" what's in an
 * opponent's hand or the boneyard, only its own hand and the fully-visible board).
 */
export interface ScoredAction {
  action: PlayerAction;
  score: number;
  reason: ReasonTag;
}

/** Machine-readable reason tags — hints.ts turns these into plain-English rationale. */
export type ReasonTag =
  | 'onlyOption'
  | 'forcedDraw'
  | 'forcedPass'
  | 'satisfyOpenDouble'
  | 'shedHeavyOwnTrain'
  | 'shedHeavyMexicanTrain'
  | 'shedHeavyOpponentTrain';

function reasonFor(state: GameState, trainId: string, playerId: string): ReasonTag {
  if (state.openDouble) return 'satisfyOpenDouble';
  const train = state.trains[trainId];
  if (train.ownerId === playerId) return 'shedHeavyOwnTrain';
  if (train.id === MEXICAN_TRAIN_ID) return 'shedHeavyMexicanTrain';
  return 'shedHeavyOpponentTrain';
}

/** Scores every legal action for `seatIndex` and returns them best-first. This is the one
 * "brain" behind both the human hint button and every bot's play — difficulty (see
 * chooseBotAction below) only changes how reliably a bot acts on this ranking, never the
 * ranking itself, so a hint is always the strongest advice regardless of who's playing.
 *
 * The heuristic: shed your heaviest tiles first (they're dead weight if the round ends before
 * you play them), mildly prefer your own train over the Mexican train or an opponent's open
 * train (keeps your options private), and mildly prefer a play that leaves your new open end
 * matching another tile still in your hand (keeps you flexible next turn). */
export function scoreActions(state: GameState, seatIndex: number): ScoredAction[] {
  const actions = getLegalActions(state, seatIndex);
  const player = state.players[seatIndex];

  if (actions.length === 1 && actions[0].type !== 'playTile') {
    const a = actions[0];
    return [{ action: a, score: 0, reason: a.type === 'drawTile' ? 'forcedDraw' : 'forcedPass' }];
  }

  const scored: ScoredAction[] = actions.map((action) => {
    if (action.type !== 'playTile') {
      return { action, score: 0, reason: action.type === 'drawTile' ? 'forcedDraw' : 'forcedPass' };
    }
    if (actions.length === 1) {
      return { action, score: 0, reason: 'onlyOption' };
    }

    const tile = findTileInHand(player.hand, action.tileId)!;
    const train = state.trains[action.trainId];
    const pips = pipTotal(tile);
    const newOpenEnd = otherEnd(tile, train.openEnd);
    const remainingHand = player.hand.filter((t) => tileId(t) !== action.tileId);
    const flexMatches = remainingHand.filter((t) => tileMatches(t, newOpenEnd)).length;

    let score = pips + flexMatches * 8;
    if (!state.openDouble && train.ownerId === player.id) score += 15;

    return { action, score, reason: reasonFor(state, action.trainId, player.id) };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

/** Always the single best-ranked move — this is what the "What should I play?" hint uses, so
 * a hint is never sandbagged and never wrong about what the strongest play actually is. */
export function chooseBestAction(state: GameState, seatIndex: number): ScoredAction | null {
  const scored = scoreActions(state, seatIndex);
  return scored[0] ?? null;
}

export type BotDifficulty = 'easy' | 'normal' | 'hard';

/**
 * Picks a bot's actual move for a given difficulty, drawing from the exact same ranking a
 * hint would use — difficulty only changes how consistently the bot acts on it:
 *  - 'hard' always takes the top-ranked option — a genuinely sharp opponent.
 *  - 'normal' usually takes the best option but sometimes settles for the next-best or an
 *    outright weaker one — competent, beatable.
 *  - 'easy' takes the best option less than half the time — forgiving, good for a newer or
 *    younger player.
 */
export function chooseBotAction(
  state: GameState,
  seatIndex: number,
  difficulty: BotDifficulty = 'normal',
  rng: () => number = Math.random,
): ScoredAction | null {
  const scored = scoreActions(state, seatIndex);
  if (scored.length === 0) return null;
  if (difficulty === 'hard' || scored.length === 1) return scored[0];

  const roll = rng();
  if (difficulty === 'normal') {
    if (roll < 0.72) return scored[0];
    if (roll < 0.92 && scored.length > 1) return scored[1];
    return scored[Math.floor(rng() * scored.length)];
  }

  // easy
  if (roll < 0.35) return scored[0];
  if (roll < 0.65) return scored[Math.floor(rng() * Math.min(3, scored.length))];
  return scored[Math.floor(rng() * scored.length)];
}
