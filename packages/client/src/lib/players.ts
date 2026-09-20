// Shared seat/personality bookkeeping used by both local (vs-bots) and online (Firestore
// room) game setup, so the two don't drift.
import { BotPersonalityId, EngineConfig, PERSONALITIES } from '@mexicantrain/engine';
import { DEFAULT_PLAYER_ICON } from './icons';

export const BOT_PERSONALITIES: BotPersonalityId[] = ['ed', 'carol', 'gus'];
export const BOT_DISPLAY_NAMES: Record<BotPersonalityId, string> = { ed: 'Ed', carol: 'Carol', gus: 'Gus' };

/** Capped at 4 seats total — matches Golf's and Durak's table cap. Three bot personalities
 * exist today (Ed, Carol, Gus), enough to fill every seat but the human's; nextBotPersonality
 * below returns null if more bots than personalities are ever requested. */
export const MAX_SEATS = 4;

export interface SeatConfig {
  id: string;
  name: string;
  isBot: boolean;
  personality?: BotPersonalityId;
}

export function buildPlayerConfigs(seats: SeatConfig[]): EngineConfig['playerConfigs'] {
  return seats.map((s) => ({
    id: s.id,
    name: s.name.trim() || 'Player',
    isBot: s.isBot,
    personality: s.personality,
  }));
}

/** Picks the first bot personality not already sitting at the table, or null if every
 * available personality is taken. */
export function nextBotPersonality(used: Array<BotPersonalityId | undefined>): BotPersonalityId | null {
  return BOT_PERSONALITIES.find((p) => !used.includes(p)) ?? null;
}

/** Single source of truth for "what avatar does this seat show" — used by both the lobby and
 * the in-game player badges. Bots always show their personality's fixed avatar; humans show
 * whatever they picked (see lib/icons.ts), falling back to the default if unset (e.g. an
 * unclaimed open seat). */
export function seatAvatar(seat: { type: 'human' | 'bot'; personality?: BotPersonalityId; icon?: string }): string {
  if (seat.type === 'bot') return seat.personality ? PERSONALITIES[seat.personality].avatar : '🤖';
  return seat.icon || DEFAULT_PLAYER_ICON;
}
