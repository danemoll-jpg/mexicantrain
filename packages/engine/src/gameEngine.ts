import { findTileInHand, getLegalActions, isActionLegal, MEXICAN_TRAIN_ID, nextSeat } from './rules.js';
import { scoreHand } from './scoring.js';
import { freshShuffledSet, shuffle } from './tiles.js';
import {
  DEFAULT_RULES,
  EngineConfig,
  GameState,
  HAND_SIZE_BY_PLAYER_COUNT,
  isDouble,
  LegalActions,
  otherEnd,
  PIP_MAX,
  PlayerAction,
  PlayerState,
  ROUNDS_PER_MATCH,
  RoundSummary,
  Tile,
  tileId,
  Train,
} from './types.js';

/** Deals a fresh round in place: shuffles a brand-new 91-tile set, hands everyone their
 * round's hand, then finds who starts — whoever's already holding this round's double plays
 * it as the hub; if nobody was dealt it, players draw one at a time (starting at
 * `searchStartSeat`, rotating) until someone turns it up. That player becomes `actingSeat`
 * and a normal turn begins for them immediately (see the README's "simplifications" section:
 * real Mexican Train also obligates the hub-placer to try to satisfy it as a double — this
 * engine treats their very next play as satisfying that in spirit without a hard requirement,
 * which plays out the same in the common case where they simply extend their own train). */
function dealRound(state: GameState, roundNumber: number, engineValue: number, searchStartSeat: number, rng: () => number): void {
  const bag = freshShuffledSet(rng);
  const handSize = HAND_SIZE_BY_PLAYER_COUNT[state.players.length] ?? 13;

  for (const p of state.players) {
    p.hand = [];
    for (let i = 0; i < handSize; i++) p.hand.push(bag.pop()!);
  }
  let boneyard = bag;

  const isEngineDouble = (t: Tile) => t.a === engineValue && t.b === engineValue;

  let hubSeat = state.players.findIndex((p) => p.hand.some(isEngineDouble));
  let drawsNeeded = 0;
  if (hubSeat === -1) {
    // Nobody was dealt this round's double — turn boneyard tiles face up one at a time
    // (starting at searchStartSeat, rotating whose "turn" it is to reveal one) until it
    // appears. Every OTHER tile turned up along the way goes right back into the boneyard
    // (reshuffled) once the search ends — it was never actually dealt to anyone, just
    // temporarily set aside, so this can't inflate a player's hand size.
    const setAside: Tile[] = [];
    let seat = searchStartSeat;
    while (hubSeat === -1) {
      if (boneyard.length === 0) {
        // Unreachable in practice — the engine double is guaranteed to be either already
        // dealt or still in the boneyard, one of the 91 tiles has to be it. Defensive only.
        throw new Error('Boneyard exhausted while searching for the round-starting double.');
      }
      const drawn = boneyard.pop()!;
      drawsNeeded++;
      if (isEngineDouble(drawn)) {
        hubSeat = seat;
      } else {
        setAside.push(drawn);
        seat = nextSeat(state.players.length, seat);
      }
    }
    boneyard = shuffle([...boneyard, ...setAside], rng);
  }

  const hubPlayer = state.players[hubSeat];
  // A no-op filter in the search branch (the hub tile was never added to any hand there),
  // and removes it from wherever it was originally dealt in the "already had it" branch.
  hubPlayer.hand = hubPlayer.hand.filter((t) => !isEngineDouble(t));

  const trains: Record<string, Train> = {
    [MEXICAN_TRAIN_ID]: { id: MEXICAN_TRAIN_ID, ownerId: null, tiles: [], openEnd: engineValue, isPublic: true },
  };
  for (const p of state.players) {
    trains[p.id] = { id: p.id, ownerId: p.id, tiles: [], openEnd: engineValue, isPublic: state.rules.allTrainsPublic };
  }

  state.boneyard = boneyard;
  state.trains = trains;
  state.trainOrder = [MEXICAN_TRAIN_ID, ...state.players.map((p) => p.id)];
  state.engineValue = engineValue;
  state.roundNumber = roundNumber;
  state.startingSeat = searchStartSeat;
  state.actingSeat = hubSeat;
  state.drawnThisSegment = false;
  state.playedAnythingThisTurn = false;
  state.openDouble = null;
  state.consecutivePasses = 0;
  state.phase = 'playing';
  state.log.push({ type: 'roundStarted', roundNumber, engineValue, startingSeat: hubSeat });
  state.log.push({ type: 'hubPlaced', by: hubPlayer.id, engineValue, drawsNeeded });
}

export function createMatch(config: EngineConfig): GameState {
  const rng = config.rng ?? Math.random;

  const players: PlayerState[] = config.playerConfigs.map((pc) => ({
    id: pc.id,
    name: pc.name,
    isBot: pc.isBot,
    personality: pc.personality,
    hand: [],
    roundScores: [],
  }));

  const state: GameState = {
    players,
    rules: config.rules ?? DEFAULT_RULES,
    boneyard: [],
    trains: {},
    trainOrder: [],
    actingSeat: 0,
    drawnThisSegment: false,
    playedAnythingThisTurn: false,
    openDouble: null,
    consecutivePasses: 0,
    phase: 'playing',
    roundNumber: 0,
    engineValue: PIP_MAX,
    startingSeat: 0,
    log: [],
    matchWinnerIds: null,
    roundSummary: null,
    readyPlayerIds: [],
  };

  state.log.push({ type: 'matchStarted', playerOrder: players.map((p) => p.id) });
  dealRound(state, 1, PIP_MAX, 0, rng);
  return state;
}

export function getCurrentLegalActions(state: GameState): LegalActions | null {
  if (state.phase === 'matchOver' || state.phase === 'roundOver') return null;
  return { seatIndex: state.actingSeat, actions: getLegalActions(state, state.actingSeat) };
}

/** Scores the just-finished round and parks the match in 'roundOver' with a snapshot for the
 * summary screen — nothing is dealt and the match is never marked over from here directly.
 * Bot seats are auto-readied immediately (they never make anyone wait); if that alone clears
 * every human (an all-bot table, or no humans left), the round-over pause collapses instantly
 * via `maybeAdvanceFromRoundOver` and this behaves just like the old immediate-advance code. */
function resolveRound(state: GameState, rng: () => number, wentOutBy: string | null): void {
  const scores: Array<{ playerId: string; score: number; total: number }> = [];
  const summaryPlayers: RoundSummary['players'] = [];
  for (const p of state.players) {
    const score = scoreHand(p.hand);
    p.roundScores.push(score);
    const total = p.roundScores.reduce((a, b) => a + b, 0);
    scores.push({ playerId: p.id, score, total });
    summaryPlayers.push({ playerId: p.id, hand: [...p.hand], roundScore: score, total });
  }
  state.log.push({ type: 'roundScored', roundNumber: state.roundNumber, wentOutBy, scores });

  state.phase = 'roundOver';
  state.roundSummary = {
    roundNumber: state.roundNumber,
    wentOutBy,
    isFinalRound: state.roundNumber >= ROUNDS_PER_MATCH,
    players: summaryPlayers,
  };
  state.readyPlayerIds = state.players.filter((p) => p.isBot).map((p) => p.id);
  maybeAdvanceFromRoundOver(state, rng);
}

/** Once every human player has readied up (or there were none to begin with), either deals
 * the next round or, if this was the last one, ends the match. A no-op while any human is
 * still on the round-over summary screen. */
function maybeAdvanceFromRoundOver(state: GameState, rng: () => number): void {
  if (state.phase !== 'roundOver') return;
  const allHumansReady = state.players.filter((p) => !p.isBot).every((p) => state.readyPlayerIds.includes(p.id));
  if (!allHumansReady) return;

  const summary = state.roundSummary!;
  state.roundSummary = null;
  state.readyPlayerIds = [];

  if (summary.isFinalRound) {
    const totals = state.players.map((p) => ({ id: p.id, total: p.roundScores.reduce((a, b) => a + b, 0) }));
    const lowest = Math.min(...totals.map((t) => t.total));
    const winnerIds = totals.filter((t) => t.total === lowest).map((t) => t.id);
    state.matchWinnerIds = winnerIds;
    state.phase = 'matchOver';
    state.log.push({ type: 'matchOver', winnerIds, isDraw: winnerIds.length > 1 });
    return;
  }

  const nextEngineValue = PIP_MAX - summary.roundNumber; // roundNumber is 1-based & about to +1
  dealRound(state, summary.roundNumber + 1, nextEngineValue, nextSeat(state.players.length, state.startingSeat), rng);
}

function endTurn(state: GameState): void {
  state.actingSeat = nextSeat(state.players.length, state.actingSeat);
  state.drawnThisSegment = false;
  state.playedAnythingThisTurn = false;
}

export function applyAction(
  state: GameState,
  seatIndex: number,
  action: PlayerAction,
  rng: () => number = Math.random,
): GameState {
  if (!isActionLegal(state, seatIndex, action)) {
    throw new Error(`Illegal action ${JSON.stringify(action)} for seat ${seatIndex} in phase ${state.phase}`);
  }
  const next: GameState = structuredClone(state);
  const player = next.players[seatIndex];

  switch (action.type) {
    case 'playTile': {
      const tile = findTileInHand(player.hand, action.tileId)!;
      const train = next.trains[action.trainId];
      const openEndBefore = train.openEnd;

      player.hand = player.hand.filter((t) => tileId(t) !== action.tileId);
      train.tiles.push(tile);
      const newOpenEnd = otherEnd(tile, openEndBefore);
      train.openEnd = newOpenEnd;
      const wasDouble = isDouble(tile);

      let trainClosedOwn = false;
      if (train.ownerId === player.id && train.isPublic) {
        train.isPublic = false;
        trainClosedOwn = true;
      }

      next.playedAnythingThisTurn = true;
      next.consecutivePasses = 0;
      const wentOut = player.hand.length === 0;
      next.log.push({ type: 'tilePlayed', by: player.id, trainId: train.id, tile, isDouble: wasDouble, wentOut, trainClosedOwn });

      if (wentOut) {
        next.openDouble = null;
        resolveRound(next, rng, player.id);
        break;
      }

      if (wasDouble) {
        // Whether this closes out an inherited open double or opens a brand-new one, the
        // acting player (same seat either way) must now try to satisfy THIS double before
        // their turn can end — fresh sub-turn segment, one more draw allowed.
        next.openDouble = { trainId: train.id, value: newOpenEnd };
        next.drawnThisSegment = false;
        next.log.push({ type: 'doubleOpened', trainId: train.id, value: newOpenEnd });
      } else {
        next.openDouble = null;
        endTurn(next);
      }
      break;
    }

    case 'drawTile': {
      const tile = next.boneyard.pop()!;
      player.hand.push(tile);
      next.drawnThisSegment = true;
      next.log.push({ type: 'drew', by: player.id });
      break;
    }

    case 'passTurn': {
      next.log.push({ type: 'passed', by: player.id });
      const myTrain = next.trains[player.id];
      if (!next.playedAnythingThisTurn && !myTrain.isPublic) {
        myTrain.isPublic = true;
        next.log.push({ type: 'trainOpened', trainId: myTrain.id });
      }
      next.consecutivePasses += 1;

      if (next.boneyard.length === 0 && next.consecutivePasses >= next.players.length) {
        resolveRound(next, rng, null);
        break;
      }
      endTurn(next);
      break;
    }

    case 'readyForNextRound': {
      next.readyPlayerIds = [...next.readyPlayerIds, player.id];
      next.log.push({ type: 'playerReady', by: player.id });
      maybeAdvanceFromRoundOver(next, rng);
      break;
    }
  }

  return next;
}
