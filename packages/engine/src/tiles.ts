import { PIP_MAX, Tile } from './types.js';

/** Builds a standard double-12 domino set, unshuffled: every unordered pair (a, b) with
 * 0 <= a <= b <= 12, including all 13 doubles. 91 tiles total. */
export function buildTileSet(): Tile[] {
  const tiles: Tile[] = [];
  for (let a = 0; a <= PIP_MAX; a++) {
    for (let b = a; b <= PIP_MAX; b++) {
      tiles.push({ a, b });
    }
  }
  return tiles;
}

/** Fisher-Yates shuffle. Accepts a custom RNG (0-1 range) so tests can be deterministic. */
export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Builds a fresh shuffled boneyard (draw from the end via pop()). */
export function freshShuffledSet(rng: () => number = Math.random): Tile[] {
  return shuffle(buildTileSet(), rng);
}
