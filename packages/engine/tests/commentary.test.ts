import { describe, expect, it } from 'vitest';
import { createMatch } from '../src/gameEngine.js';
import { PERSONALITIES } from '../src/commentary/personalities.js';
import { TemplateCommentaryProvider } from '../src/commentary/templateProvider.js';
import { BotPersonalityId } from '../src/types.js';

const PERSONALITY_IDS = Object.keys(PERSONALITIES) as BotPersonalityId[];

describe('bot personalities', () => {
  it.each(PERSONALITY_IDS)('%s has at least one line for every commentary key', (id) => {
    const { lines } = PERSONALITIES[id];
    for (const [key, pool] of Object.entries(lines)) {
      expect(pool.length, `${id}.${key}`).toBeGreaterThan(0);
    }
  });

  it('seats one human against every bot personality (a full four-player table)', () => {
    const state = createMatch({
      playerConfigs: [
        { id: 'human', name: 'Dan', isBot: false },
        ...PERSONALITY_IDS.map((p, i) => ({ id: `bot${i}`, name: PERSONALITIES[p].displayName, isBot: true, personality: p })),
      ],
    });
    expect(state.players).toHaveLength(4);

    const provider = new TemplateCommentaryProvider();
    const spoke = new Set<BotPersonalityId>();
    for (let i = 0; i < 200; i++) {
      for (const line of provider.onEvent(state.log[state.log.length - 2], state) as Array<{ personality: BotPersonalityId; text: string }>) {
        expect(line.text.length).toBeGreaterThan(0);
        expect(line.text).not.toMatch(/\{\w+\}/); // no unfilled {placeholders}
        spoke.add(line.personality);
      }
    }
    // Over many draws every bot at the table gets a turn at the mic.
    expect([...spoke].sort()).toEqual([...PERSONALITY_IDS].sort());
  });
});
