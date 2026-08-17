import { describe, expect, it } from 'vitest';
import { buildTileSet, isDouble, tileId } from '../src/index.js';

describe('buildTileSet', () => {
  it('builds all 91 unique tiles of a double-12 set', () => {
    const tiles = buildTileSet();
    expect(tiles).toHaveLength(91);
    const ids = new Set(tiles.map(tileId));
    expect(ids.size).toBe(91);
  });

  it('includes exactly the 13 doubles, 0-0 through 12-12', () => {
    const doubles = buildTileSet().filter(isDouble);
    expect(doubles).toHaveLength(13);
    const values = doubles.map((t) => t.a).sort((a, b) => a - b);
    expect(values).toEqual(Array.from({ length: 13 }, (_, i) => i));
  });
});
