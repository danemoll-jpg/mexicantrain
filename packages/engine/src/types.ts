// Core types for the Mexican Train engine. Kept framework-free so this package can be used
// identically by local play, online play, the bots, and the hint generator.
//
// Standard double-12 Mexican Train: 91 tiles (every pip pair 0-0 through 12-12). Each round
// is "hosted" by a double, starting at double-12 and counting down to double-0 (13 rounds).
// Whoever holds that round's double plays it as the central hub; every player then grows
// their own private train off the hub, plus everyone shares one public "Mexican Train".
// Lowest total pips left in hand across all 13 rounds wins — same shape as Golf's "lowest
// score over 9 holes," just with dominoes instead of cards.

export const PIP_MAX = 12;

export interface Tile {
  a: number;
  b: number;
}

export function tileId(tile: Tile): string {
  const [lo, hi] = tile.a <= tile.b ? [tile.a, tile.b] : [tile.b, tile.a];
  return `${lo}-${hi}`;
}

export function tilesEqual(x: Tile, y: Tile): boolean {
  return (x.a === y.a && x.b === y.b) || (x.a === y.b && x.b === y.a);
}

export function isDouble(tile: Tile): boolean {
  return tile.a === tile.b;
}

export function pipTotal(tile: Tile): number {
  return tile.a + tile.b;
}

/** The pip value on `tile` that ISN'T `openEnd` — i.e. what the train's new open end becomes
 * after this tile is played. For a double, both halves equal `openEnd`, so this just returns
 * that same value (the train's open end doesn't change; see `isDouble`/open-double handling
 * in rules.ts for why a double still needs special treatment despite that). */
export function otherEnd(tile: Tile, openEnd: number): number {
  return tile.a === openEnd ? tile.b : tile.a;
}

export function tileMatches(tile: Tile, openEnd: number): boolean {
  return tile.a === openEnd || tile.b === openEnd;
}

export type BotPersonalityId = 'ed' | 'carol';

/** One branch of the board: either a player's own train (ownerId set) or the single shared
 * Mexican train (ownerId null). `tiles` is the ordered chain as played, starting from the
 * hub. `openEnd` is the pip value the next tile played here must match. `isPublic` is the
 * "marker/topper" state — the Mexican train is always public; a player's own train starts
 * private and only opens if its owner fails to play at all on their turn (closes again the
 * next time the owner plays on it). */
export interface Train {
  id: string;
  ownerId: string | null;
  tiles: Tile[];
  openEnd: number;
  isPublic: boolean;
}

export interface PlayerState {
  id: string;
  name: string;
  isBot: boolean;
  personality?: BotPersonalityId;
  hand: Tile[];
  /** One entry appended per completed round (index 0 = round 1, the 12s). */
  roundScores: number[];
}

export type GamePhase = 'playing' | 'matchOver';

/** Structured events emitted by the engine as it plays — the seam commentary/sound cues
 * hook into. */
export type GameEvent =
  | { type: 'matchStarted'; playerOrder: string[] }
  | { type: 'roundStarted'; roundNumber: number; engineValue: number; startingSeat: number }
  | { type: 'hubPlaced'; by: string; engineValue: number; drawsNeeded: number }
  | { type: 'drew'; by: string }
  | {
      type: 'tilePlayed';
      by: string;
      trainId: string;
      tile: Tile;
      isDouble: boolean;
      wentOut: boolean;
      trainClosedOwn: boolean;
    }
  | { type: 'doubleOpened'; trainId: string; value: number }
  | { type: 'trainOpened'; trainId: string }
  | { type: 'passed'; by: string }
  | {
      type: 'roundScored';
      roundNumber: number;
      wentOutBy: string | null;
      scores: Array<{ playerId: string; score: number; total: number }>;
    }
  | { type: 'matchOver'; winnerIds: string[]; isDraw: boolean };

/** Optional house rules, fixed for the whole match (chosen at setup, before round 1 is
 * dealt) — not secret, so it's fine to expose in PublicGameState too. */
export interface MatchRules {
  /** A common casual/kids variant: every train (not just the Mexican train) is public from
   * the very start, so anyone can play on anyone's train at any time — no private trains, no
   * marker rule. Off by default (standard rules: your own train starts private). */
  allTrainsPublic: boolean;
}

export const DEFAULT_RULES: MatchRules = { allTrainsPublic: false };

/** The full double-12 engine sequence for a match: round 1 is hosted by double-12, round 13
 * by double-0. */
export const ROUNDS_PER_MATCH = PIP_MAX + 1;

export interface GameState {
  players: PlayerState[];
  rules: MatchRules;
  /** Draw pile (the "boneyard"); draw from the end (pop). */
  boneyard: Tile[];
  trains: Record<string, Train>;
  /** Fixed per match: 'mexican', plus one entry per player id, in player order. Kept
   * separately from `Object.keys(trains)` so render/iteration order is stable. */
  trainOrder: string[];
  actingSeat: number;
  /** Whether the acting player has already drawn once during their current turn segment
   * (a normal turn, or a double-satisfy attempt — each gets exactly one draw). */
  drawnThisSegment: boolean;
  /** Whether the acting player has successfully played any tile yet this turn — determines
   * whether failing out at the end marks their own train public (only if they truly played
   * nothing this turn). */
  playedAnythingThisTurn: boolean;
  /** An unsatisfied double sitting at the end of a train — until it's filled, the acting
   * player's only legal moves are ones that satisfy it (from anyone, on anyone's turn). */
  openDouble: { trainId: string; value: number } | null;
  /** Turns in a row where nobody could play anything (and the boneyard was empty) — hitting
   * the player count means the round is blocked and gets scored as-is. */
  consecutivePasses: number;
  phase: GamePhase;
  roundNumber: number;
  /** This round's hub/engine double value (round 1 = 12, counting down to round 13 = 0). The
   * hub tile itself isn't stored anywhere else — it's a fixed fixture for the round, not part
   * of any train's tile chain — so this is the one place its value lives. */
  engineValue: number;
  /** Seat that anchors this round's hub-search draw order; rotates round to round the same
   * way Golf rotates who starts a hole. NOT necessarily who actually places the hub (that's
   * whoever holds or draws the round's double) — see `log` for a `hubPlaced` event naming
   * the actual starter. */
  startingSeat: number;
  log: GameEvent[];
  /** Set once phase is 'matchOver' — lowest total wins; more than one id means a tie. */
  matchWinnerIds: string[] | null;
}

export interface EngineConfig {
  playerConfigs: Array<{ id: string; name: string; isBot: boolean; personality?: BotPersonalityId }>;
  /** Optional house rules for the whole match — defaults to DEFAULT_RULES if omitted. */
  rules?: MatchRules;
  /** Optional seeded RNG for deterministic tests. */
  rng?: () => number;
}

export type PlayTileAction = { type: 'playTile'; tileId: string; trainId: string };
export type DrawTileAction = { type: 'drawTile' };
export type PassTurnAction = { type: 'passTurn' };

export type PlayerAction = PlayTileAction | DrawTileAction | PassTurnAction;

export interface LegalActions {
  seatIndex: number;
  actions: PlayerAction[];
}

/** Per-player-count hand size at deal time — the standard double-12 Mexican Train table. */
export const HAND_SIZE_BY_PLAYER_COUNT: Record<number, number> = {
  2: 15,
  3: 13,
  4: 13,
};
