import { BotPersonalityId, GameEvent, GameState, PlayerState } from '../types.js';
import { CommentaryKey, PERSONALITIES, Personality } from './personalities.js';
import { CommentaryLine, CommentaryProvider } from './types.js';

type BotPlayer = PlayerState & { personality: BotPersonalityId };

type BaseKey = 'roundStart' | 'greatPlay' | 'wentOut' | 'roundWon' | 'matchWin' | 'matchDraw';

interface BaseEvent {
  key: BaseKey;
  actorId?: string;
}

function baseEventFor(event: GameEvent): BaseEvent | null {
  switch (event.type) {
    case 'roundStarted':
      return { key: 'roundStart' };
    case 'tilePlayed':
      // Going out is the bigger moment — if the last tile played also happens to be a
      // double, that's still just "they went out," not "great play AND went out."
      if (event.wentOut) return { key: 'wentOut', actorId: event.by };
      return event.isDouble ? { key: 'greatPlay', actorId: event.by } : null;
    case 'roundScored': {
      // Only call out a clear winner of the round — a tie for lowest pips is skipped rather
      // than arbitrarily picking one of the tied players to congratulate.
      const lowest = Math.min(...event.scores.map((s) => s.score));
      const winners = event.scores.filter((s) => s.score === lowest);
      if (winners.length !== 1) return null;
      return { key: 'roundWon', actorId: winners[0].playerId };
    }
    case 'matchOver':
      return event.isDraw ? { key: 'matchDraw' } : { key: 'matchWin', actorId: event.winnerIds[0] };
    default:
      return null;
  }
}

function resolveKey(base: BaseEvent, speakerId: string): CommentaryKey {
  if (base.key === 'roundStart' || base.key === 'matchDraw') return base.key;
  const isSelf = base.actorId === speakerId;
  return `${base.key}${isSelf ? 'Self' : 'Other'}` as CommentaryKey;
}

/** Picks which line pool to draw from: a personalized one if the player being addressed is
 * someone the speaker has a special relationship with (their spouse, their kid, their
 * granddaughter — see Personality.namedOverrides), otherwise their normal reaction lines. */
function resolveLinePool(personality: Personality, key: CommentaryKey, addresseeName: string | undefined): string[] | undefined {
  if (addresseeName) {
    const override = personality.namedOverrides?.[addresseeName.trim().toLowerCase()]?.[key];
    if (override && override.length > 0) return override;
  }
  return personality.lines[key];
}

function fillTemplate(template: string, event: GameEvent, state: GameState): string {
  const nameOf = (id: string) => state.players.find((p) => p.id === id)?.name ?? id;
  let text = template;
  if (event.type === 'roundStarted') {
    text = text.replaceAll('{round}', String(event.roundNumber)).replaceAll('{engine}', String(event.engineValue));
  } else if (event.type === 'tilePlayed') {
    text = text.replaceAll('{player}', nameOf(event.by));
  } else if (event.type === 'roundScored') {
    const lowest = Math.min(...event.scores.map((s) => s.score));
    const winner = event.scores.find((s) => s.score === lowest);
    if (winner) text = text.replaceAll('{player}', nameOf(winner.playerId));
  } else if (event.type === 'matchOver' && event.winnerIds[0]) {
    text = text.replaceAll('{player}', nameOf(event.winnerIds[0]));
  }
  return text;
}

/** Picks who speaks. Carol gets first refusal on reacting to someone ELSE's great play — that
 * needling "ooh, look at YOU" reaction is her defining trait — but if SHE'S the one who made
 * the play, she steps back so her husband sometimes gets the moment instead (Ed bragging
 * about his wife is sweeter than Carol congratulating herself every time). Otherwise Carol
 * talks about twice as often as the quieter Ed, matching their personalities. */
function pickSpeaker(bots: BotPlayer[], baseKey: BaseKey, actorId: string | undefined): BotPlayer {
  if (baseKey === 'greatPlay') {
    const carol = bots.find((b) => b.personality === 'carol');
    if (carol && carol.id !== actorId) return carol;
  }
  const weighted: BotPlayer[] = [];
  for (const b of bots) {
    for (let i = 0; i < (b.personality === 'carol' ? 2 : 1); i++) weighted.push(b);
  }
  return weighted[Math.floor(Math.random() * weighted.length)];
}

/**
 * Default commentary source: randomized templated one-liners, keyed off engine events. No
 * network calls, no API key required. Implements {@link CommentaryProvider}, so a future
 * Claude-powered provider can be swapped in without touching game logic.
 */
export class TemplateCommentaryProvider implements CommentaryProvider {
  private lastLineByPersonality = new Map<string, string>();

  onEvent(event: GameEvent, state: GameState): CommentaryLine[] {
    const base = baseEventFor(event);
    if (!base) return [];

    const bots = state.players.filter(
      (p): p is PlayerState & { personality: NonNullable<PlayerState['personality']> } => p.isBot && !!p.personality,
    );
    if (bots.length === 0) return [];
    const speaker = pickSpeaker(bots, base.key, base.actorId);

    const key = resolveKey(base, speaker.id);
    const isSelf = base.actorId === speaker.id;
    const addresseeName = !isSelf && base.actorId ? state.players.find((p) => p.id === base.actorId)?.name : undefined;
    const pool = resolveLinePool(PERSONALITIES[speaker.personality], key, addresseeName);
    if (!pool || pool.length === 0) return [];

    const last = this.lastLineByPersonality.get(speaker.personality);
    const candidates = pool.length > 1 ? pool.filter((l) => l !== last) : pool;
    const template = candidates[Math.floor(Math.random() * candidates.length)];
    this.lastLineByPersonality.set(speaker.personality, template);

    return [{ speakerId: speaker.id, personality: speaker.personality, text: fillTemplate(template, event, state) }];
  }
}
