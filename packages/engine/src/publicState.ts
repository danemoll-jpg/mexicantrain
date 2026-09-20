import { BotPersonalityId, GamePhase, GameState, MatchRules, RoundSummary, Tile, Train } from './types.js';

/** A player as any viewer is allowed to see them — `hand` (the actual tiles) is only
 * populated for the viewer's own seat; everyone else just exposes `handCount`, the way an
 * opponent's tiles are only visible as a row of face-down dominoes on a real table. */
export interface PublicPlayerView {
  id: string;
  name: string;
  isBot: boolean;
  personality?: BotPersonalityId;
  hand?: Tile[];
  handCount: number;
  roundScores: number[];
  total: number;
}

export interface PublicGameState {
  players: PublicPlayerView[];
  rules: MatchRules;
  /** The board itself has no hidden information — every placed tile is visible to everyone,
   * same as a real table — so trains are exposed in full, unlike hands. */
  trains: Record<string, Train>;
  trainOrder: string[];
  boneyardCount: number;
  actingSeat: number;
  drawnThisSegment: boolean;
  openDouble: { trainId: string; value: number } | null;
  phase: GamePhase;
  roundNumber: number;
  engineValue: number;
  matchWinnerIds: string[] | null;
  /** Populated only while `phase === 'roundOver'` — see RoundSummary. Safe to expose in full
   * (including every player's final hand) since the round it describes has already ended. */
  roundSummary: RoundSummary | null;
  /** Human player ids who've already readied up for the next round, during 'roundOver'. */
  readyPlayerIds: string[];
  /** Which seat this view was built for. -1 if the viewer isn't seated (spectator). */
  viewerSeatIndex: number;
}

/** Builds the view of `state` that `viewerId` is allowed to see. */
export function redactState(state: GameState, viewerId: string): PublicGameState {
  const viewerSeatIndex = state.players.findIndex((p) => p.id === viewerId);

  return {
    players: state.players.map((p, i) => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      personality: p.personality,
      hand: i === viewerSeatIndex ? p.hand : undefined,
      handCount: p.hand.length,
      roundScores: p.roundScores,
      total: p.roundScores.reduce((a, b) => a + b, 0),
    })),
    rules: state.rules,
    trains: state.trains,
    trainOrder: state.trainOrder,
    boneyardCount: state.boneyard.length,
    actingSeat: state.actingSeat,
    drawnThisSegment: state.drawnThisSegment,
    openDouble: state.openDouble,
    phase: state.phase,
    roundNumber: state.roundNumber,
    engineValue: state.engineValue,
    matchWinnerIds: state.matchWinnerIds,
    roundSummary: state.roundSummary,
    readyPlayerIds: state.readyPlayerIds,
    viewerSeatIndex,
  };
}
