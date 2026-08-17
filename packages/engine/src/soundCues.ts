import { GameEvent } from './types.js';

/**
 * Semantic sound cue names, derived from raw engine events so the client doesn't need to
 * infer "what just happened" from state diffs. Independent of commentary (which is gated on
 * a bot existing to "speak") — sound cues fire for every player, every time.
 */
export type SfxCue = 'deal' | 'draw' | 'play' | 'doubleDown' | 'wentOut' | 'trainOpened' | 'roundScored' | 'matchOver';

const CUE_BY_EVENT: Partial<Record<GameEvent['type'], SfxCue>> = {
  roundStarted: 'deal',
  drew: 'draw',
  trainOpened: 'trainOpened',
  roundScored: 'roundScored',
  matchOver: 'matchOver',
};

/** Maps a batch of raw engine events to the sound cues the client should play, in order.
 * `tilePlayed` needs its own event-shape-aware branch (doubles and going-out get a bigger
 * cue than an ordinary play), so it isn't in the flat lookup table above. */
export function deriveSoundCues(events: GameEvent[]): SfxCue[] {
  const cues: SfxCue[] = [];
  for (const event of events) {
    if (event.type === 'tilePlayed') {
      cues.push(event.wentOut ? 'wentOut' : event.isDouble ? 'doubleDown' : 'play');
      continue;
    }
    const cue = CUE_BY_EVENT[event.type];
    if (cue) cues.push(cue);
  }
  return cues;
}
