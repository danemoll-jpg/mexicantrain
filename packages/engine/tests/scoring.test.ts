import { describe, expect, it } from 'vitest';
import { scoreHand } from '../src/index.js';

describe('scoreHand', () => {
  it('sums the pips of every tile in hand', () => {
    expect(scoreHand([{ a: 3, b: 5 }, { a: 0, b: 0 }, { a: 12, b: 12 }])).toBe(8 + 0 + 24);
  });

  it('scores an empty hand (went out) as zero', () => {
    expect(scoreHand([])).toBe(0);
  });
});
