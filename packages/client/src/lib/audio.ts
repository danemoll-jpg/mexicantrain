// Sound effects, played through the Web Audio API.
//
// Preferred source: pre-generated recordings in public/sfx/ (made once with `npm run sfx`,
// which asks ElevenLabs' sound-effects API — see scripts/generate-sfx.mjs — and committed, so
// nothing is fetched from ElevenLabs at play time and no API key ever reaches the browser).
// public/sfx/manifest.json lists what was generated; a cue can have several variants, and one
// is picked at random each time so repeated tile clacks don't sound machine-gunned.
//
// Fallback: a couple of oscillator envelopes per cue (the original synthesized sounds), used
// for any cue that has no recording — including before `npm run sfx` has ever been run, or if
// the files fail to load — so the game always makes some noise and never depends on the network.
import { SfxCue } from '@mexicantrain/engine';

export type SoundName = Exclude<SfxCue, 'matchOver'> | 'matchOverWin' | 'matchOverLose' | 'matchOverDraw';

const MUTE_KEY = 'mexicantrain-muted';

let ctx: AudioContext | null = null;

function getContext(): AudioContext {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
  }
  return ctx;
}

const SAMPLE_VOLUME = 0.85;
const samples = new Map<SoundName, AudioBuffer[]>();
let samplesRequested = false;

/** Fetches + decodes whatever public/sfx/manifest.json lists. Best-effort throughout: any
 * failure (no manifest, a 404 that the SPA fallback turns into index.html, a corrupt file)
 * just leaves that cue on its synthesized fallback. */
function loadSamples(): void {
  if (samplesRequested) return;
  samplesRequested = true;
  void (async () => {
    try {
      const base = `${import.meta.env.BASE_URL}sfx/`;
      const res = await fetch(`${base}manifest.json`);
      if (!res.ok) return;
      const manifest = (await res.json()) as Partial<Record<SoundName, string[]>>;
      const c = getContext();
      await Promise.all(
        Object.entries(manifest).map(async ([name, files]) => {
          const decoded = await Promise.all(
            (files ?? []).map(async (file) => {
              try {
                const r = await fetch(`${base}${file}`);
                return r.ok ? await c.decodeAudioData(await r.arrayBuffer()) : null;
              } catch {
                return null;
              }
            }),
          );
          const usable = decoded.filter((b): b is AudioBuffer => b !== null);
          if (usable.length > 0) samples.set(name as SoundName, usable);
        }),
      );
    } catch {
      // No recordings available — synthesized fallback it is.
    }
  })();
}

/** Call from inside a real user-gesture handler (e.g. a button click) — browsers block audio otherwise. */
export function unlockAudio(): void {
  const c = getContext();
  if (c.state === 'suspended') void c.resume();
  loadSamples();
}

function playSample(name: SoundName): boolean {
  const variants = samples.get(name);
  if (!variants) return false;
  const c = getContext();
  const source = c.createBufferSource();
  const gain = c.createGain();
  source.buffer = variants[Math.floor(Math.random() * variants.length)];
  gain.gain.value = SAMPLE_VOLUME;
  source.connect(gain).connect(c.destination);
  source.start();
  return true;
}

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // localStorage unavailable (private browsing etc.) — just won't persist, no big deal.
  }
}

function tone(freq: number, startOffset: number, duration: number, type: OscillatorType = 'sine', peakGain = 0.18): void {
  const c = getContext();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = c.currentTime + startOffset;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(peakGain, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.03);
}

function sweep(freqStart: number, freqEnd: number, startOffset: number, duration: number, type: OscillatorType = 'sawtooth', peakGain = 0.16): void {
  const c = getContext();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  const t0 = c.currentTime + startOffset;
  osc.frequency.setValueAtTime(freqStart, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t0 + duration);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(peakGain, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.03);
}

/** A short, dry "clack" — two quick square-wave ticks, like a tile hitting the table. */
function clack(startOffset: number, peakGain = 0.14): void {
  tone(180, startOffset, 0.035, 'square', peakGain);
  tone(120, startOffset + 0.02, 0.05, 'square', peakGain * 0.8);
}

const PLAYERS: Record<SoundName, () => void> = {
  deal: () => {
    // A little train-whistle-ish rising sweep to open a new round.
    sweep(260, 520, 0, 0.24, 'triangle', 0.14);
    sweep(520, 760, 0.08, 0.18, 'triangle', 0.11);
  },
  draw: () => tone(500, 0, 0.05, 'square', 0.09),
  play: () => clack(0),
  doubleDown: () => {
    clack(0, 0.16);
    clack(0.09, 0.14);
    tone(660, 0.16, 0.1, 'triangle', 0.12);
  },
  wentOut: () => {
    tone(660, 0, 0.09, 'triangle', 0.14);
    tone(880, 0.09, 0.13, 'triangle', 0.14);
  },
  trainOpened: () => tone(300, 0, 0.08, 'sawtooth', 0.09),
  roundScored: () => {
    tone(587, 0, 0.1, 'sine', 0.13);
    tone(740, 0.1, 0.16, 'sine', 0.13);
  },
  matchOverWin: () => {
    tone(523, 0, 0.14, 'triangle', 0.17);
    tone(659, 0.14, 0.14, 'triangle', 0.17);
    tone(784, 0.28, 0.14, 'triangle', 0.17);
    tone(1046, 0.42, 0.32, 'triangle', 0.2);
  },
  matchOverLose: () => {
    // The classic "sad trombone" — a descending pitch-bent sweep, twice for emphasis.
    sweep(300, 110, 0, 0.5, 'sawtooth', 0.19);
    sweep(300, 90, 0.48, 0.5, 'sawtooth', 0.17);
  },
  matchOverDraw: () => {
    tone(440, 0, 0.15, 'sine', 0.14);
    tone(392, 0.15, 0.22, 'sine', 0.14);
  },
};

export function playSound(name: SoundName): void {
  if (isMuted()) return;
  try {
    // Kicks off the (one-time) sample load too, for a player who somehow reaches a game
    // without having clicked a start button in this page load — harmless if already started.
    loadSamples();
    if (!playSample(name)) PLAYERS[name]();
  } catch {
    // Audio can fail for all sorts of environment reasons — never let it break gameplay.
  }
}
