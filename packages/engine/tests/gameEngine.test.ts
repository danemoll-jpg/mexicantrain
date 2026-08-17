import { describe, expect, it } from 'vitest';
import {
  applyAction,
  chooseBestAction,
  createMatch,
  EngineConfig,
  getCurrentLegalActions,
  GameState,
  ROUNDS_PER_MATCH,
} from '../src/index.js';

/** Deterministic seeded RNG (mulberry32) so simulated games are reproducible. */
function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 91 tiles always, minus none — the round's hub tile is never tracked in boneyard/hands/
 * trains (it's a fixed fixture once placed), so it's added back in as a constant +1 any time
 * a round is underway (which is always true once createMatch has run — dealRound places the
 * hub synchronously, it's never in transit). */
function totalTilesInPlay(state: GameState): number {
  const inHands = state.players.reduce((sum, p) => sum + p.hand.length, 0);
  const inTrains = state.trainOrder.reduce((sum, id) => sum + state.trains[id].tiles.length, 0);
  return state.boneyard.length + inHands + inTrains + 1;
}

function makeConfig(playerCount: number): EngineConfig['playerConfigs'] {
  return Array.from({ length: playerCount }, (_, i) => ({
    id: `p${i}`,
    name: `Player ${i}`,
    isBot: true,
  }));
}

/** Plays a full 13-round match with every seat driven by the shared bot heuristic, asserting
 * tile conservation after every single action. Bounded step count guards against an infinite
 * loop actually hanging the test suite if a future change breaks turn advancement. */
function playFullMatch(playerCount: number, seed: number, rules?: EngineConfig['rules']): GameState {
  const rng = seededRng(seed);
  let state = createMatch({ playerConfigs: makeConfig(playerCount), rules, rng });
  expect(totalTilesInPlay(state)).toBe(91);

  let steps = 0;
  const MAX_STEPS = 50000;
  while (state.phase !== 'matchOver') {
    const legal = getCurrentLegalActions(state);
    expect(legal).not.toBeNull();
    const decision = chooseBestAction(state, legal!.seatIndex);
    expect(decision).not.toBeNull();
    state = applyAction(state, legal!.seatIndex, decision!.action, rng);
    expect(totalTilesInPlay(state)).toBe(91);

    steps += 1;
    if (steps > MAX_STEPS) throw new Error(`Match did not terminate within ${MAX_STEPS} steps`);
  }
  return state;
}

describe('createMatch', () => {
  it('deals hands, places the double-12 hub, and starts round 1 in the playing phase', () => {
    const state = createMatch({ playerConfigs: makeConfig(3), rng: seededRng(1) });
    expect(state.roundNumber).toBe(1);
    expect(state.engineValue).toBe(12);
    expect(state.phase).toBe('playing');
    expect(totalTilesInPlay(state)).toBe(91);

    // The Mexican train plus one private train per player, every one open at the hub value.
    expect(state.trainOrder).toHaveLength(4);
    for (const id of state.trainOrder) {
      expect(state.trains[id].openEnd).toBe(12);
      expect(state.trains[id].tiles).toHaveLength(0);
    }
    expect(state.trains.mexican.isPublic).toBe(true);
    for (const p of state.players) {
      expect(state.trains[p.id].isPublic).toBe(false);
    }
  });

  it('deals 13 tiles per player at a 3-player table', () => {
    const state = createMatch({ playerConfigs: makeConfig(3), rng: seededRng(4) });
    for (const p of state.players) expect(p.hand.length).toBe(13);
  });

  it('deals 15 tiles per player at a 2-player table', () => {
    const state = createMatch({ playerConfigs: makeConfig(2), rng: seededRng(4) });
    for (const p of state.players) expect(p.hand.length).toBe(15);
  });
});

describe('full simulated matches', () => {
  for (const playerCount of [2, 3, 4]) {
    for (const seed of [1, 2, 3]) {
      it(`completes a ${playerCount}-player match (seed ${seed}) with conserved tiles and a decided winner`, () => {
        const state = playFullMatch(playerCount, seed);
        expect(state.phase).toBe('matchOver');
        expect(state.matchWinnerIds).not.toBeNull();
        expect(state.matchWinnerIds!.length).toBeGreaterThan(0);
        for (const p of state.players) {
          expect(p.roundScores).toHaveLength(ROUNDS_PER_MATCH);
        }

        const totals = state.players.map((p) => p.roundScores.reduce((a, b) => a + b, 0));
        const lowest = Math.min(...totals);
        for (const winnerId of state.matchWinnerIds!) {
          const player = state.players.find((p) => p.id === winnerId)!;
          expect(player.roundScores.reduce((a, b) => a + b, 0)).toBe(lowest);
        }
      });
    }
  }
});

describe('allTrainsPublic house rule', () => {
  it('marks every train public from round 1, including personal trains', () => {
    const state = createMatch({
      playerConfigs: makeConfig(3),
      rules: { allTrainsPublic: true },
      rng: seededRng(9),
    });
    for (const id of state.trainOrder) {
      expect(state.trains[id].isPublic).toBe(true);
    }
  });

  for (const seed of [1, 2, 3]) {
    it(`completes a 3-player match with allTrainsPublic enabled (seed ${seed})`, () => {
      const state = playFullMatch(3, seed, { allTrainsPublic: true });
      expect(state.phase).toBe('matchOver');
      expect(state.rules.allTrainsPublic).toBe(true);
    });
  }
});

describe('open double', () => {
  it('restricts legal actions to satisfying it once one is on the board', () => {
    // Drive a short simulated match until an open double actually appears, then assert the
    // legality restriction holds for whoever's up next.
    const rng = seededRng(11);
    let state = createMatch({ playerConfigs: makeConfig(4), rng });
    let steps = 0;
    while (!state.openDouble && state.phase !== 'matchOver' && steps < 5000) {
      const legal = getCurrentLegalActions(state)!;
      const decision = chooseBestAction(state, legal.seatIndex)!;
      state = applyAction(state, legal.seatIndex, decision.action, rng);
      steps += 1;
    }
    if (state.phase === 'matchOver') return; // unlucky seed, never opened one — fine, skip
    expect(state.openDouble).not.toBeNull();
    const legal = getCurrentLegalActions(state)!;
    for (const action of legal.actions) {
      if (action.type === 'playTile') {
        expect(action.trainId).toBe(state.openDouble!.trainId);
      }
    }
  });
});
