#!/usr/bin/env node
// Generates the game's sound effects with ElevenLabs' text-to-sound-effects API and writes
// them to packages/client/public/sfx/, plus a manifest.json the client reads to know what's
// there (see packages/client/src/lib/audio.ts). Run once, review by ear, commit the results —
// the game never calls ElevenLabs at play time, so the API key stays out of the browser bundle.
//
//   ELEVENLABS_API_KEY=xi-... npm run sfx                      # only cues that don't exist yet
//   ELEVENLABS_API_KEY=xi-... npm run sfx -- play doubleDown   # regenerate exactly these cues
//
// Every run of a prompt yields a different take, so re-run a cue if you don't like how it
// came out. A plain run NEVER overwrites a recording that already exists — approved takes are
// only replaced when you name the cue, and the replaced file is first copied to .sfx-backup/
// (git-ignored) so a mistaken regeneration can be undone. Cues with `variants > 1` get that
// many separate takes; the client picks one at random per play.
//
// Requires Node 18+ (global fetch). Sound-effect generations spend ElevenLabs credits.
import { access, copyFile, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(REPO_ROOT, 'packages', 'client', 'public', 'sfx');
const BACKUP_DIR = join(REPO_ROOT, '.sfx-backup', new Date().toISOString().replace(/[:.]/g, '-'));
const ENDPOINT = 'https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128';

// Keys are the client's SoundName values (packages/client/src/lib/audio.ts).
const CUES = {
  deal: {
    text: 'A single friendly vintage steam locomotive whistle toot, short, warm, no background noise',
    duration: 1.8,
  },
  // draw: an approved single take — re-running it replaces that recording with a new random one.
  draw: {
    text: 'A single domino tile sliding across a wooden table and stopping, soft, close-up',
    duration: 0.8,
  },
  // play is the most-heard sound and a bad roll can come back near-silent (two did), so when
  // regenerating it, set `variants: 3` temporarily, audition the takes, and keep a good one.
  play: {
    text: 'A wooden domino tile knocked down hard onto a wooden table, loud clear percussive clack, close microphone, dry',
    duration: 0.8,
  },
  doubleDown: {
    text: 'Two heavy dominoes slammed onto a wooden table in quick succession, emphatic, followed by a short dramatic hit',
    duration: 1.2,
  },
  wentOut: {
    // Plays when someone empties their hand — the train pulling into the terminus. (A bells-
    // plus-clatter version was tried first and came back as one bell, a dead gap, then a crash.)
    text: 'A vintage steam locomotive braking to a stop at a station: squealing brakes, a long hiss of releasing steam, one last low chug, then quiet',
    duration: 2.5,
  },
  trainOpened: {
    text: 'A single railroad crossing bell clang, metallic, attention-getting, short',
    duration: 1.2,
  },
  roundScored: {
    text: 'A satisfying score-tally jingle: a rising run of four marimba and glockenspiel notes landing on a warm sustained chime with a soft sparkle, pleasant and rewarding',
    duration: 2.5,
  },
  matchOverWin: {
    text: 'A short triumphant brass fanfare with a burst of applause and cheering, joyful',
    duration: 3.5,
  },
  matchOverLose: {
    text: 'Comedic sad trombone, wah wah wah waaah, descending, cartoonish',
    duration: 2.6,
  },
  matchOverDraw: {
    text: 'Two-note playful woodwind shrug, neutral, lighthearted, short',
    duration: 1.8,
  },
};

const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) {
  console.error(
    'Set ELEVENLABS_API_KEY in your environment first, e.g.\n' +
      '  PowerShell:  $env:ELEVENLABS_API_KEY = "xi-..."; npm run sfx\n' +
      '  bash/zsh:    ELEVENLABS_API_KEY=xi-... npm run sfx',
  );
  process.exit(1);
}

const requested = process.argv.slice(2);
const unknown = requested.filter((name) => !(name in CUES));
if (unknown.length > 0) {
  console.error(`Unknown cue(s): ${unknown.join(', ')}\nKnown cues: ${Object.keys(CUES).join(', ')}`);
  process.exit(1);
}

async function generate(cue, take) {
  const { text, duration } = CUES[cue];
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      duration_seconds: duration,
      prompt_influence: 0.5,
      model_id: 'eleven_text_to_sound_v2',
    }),
  });
  if (!res.ok) {
    throw new Error(`${cue} take ${take}: HTTP ${res.status} ${await res.text()}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

await mkdir(OUT_DIR, { recursive: true });

// Start from the existing manifest so regenerating a couple of cues doesn't drop the rest.
let manifest = {};
try {
  manifest = JSON.parse(await readFile(join(OUT_DIR, 'manifest.json'), 'utf8'));
} catch {
  // First run — nothing to preserve.
}

function filesFor(cue) {
  const variants = CUES[cue].variants ?? 1;
  return Array.from({ length: variants }, (_, i) => (variants > 1 ? `${cue}-${i + 1}.mp3` : `${cue}.mp3`));
}

async function exists(file) {
  try {
    await access(join(OUT_DIR, file));
    return true;
  } catch {
    return false;
  }
}

// Naming cues is an explicit "replace these"; with no names, only fill in what's missing.
const explicit = requested.length > 0;
const toGenerate = [];
for (const cue of explicit ? requested : Object.keys(CUES)) {
  const present = (await Promise.all(filesFor(cue).map(exists))).every(Boolean);
  if (present && !explicit) console.log(`- ${cue}: already exists, skipping (name it to regenerate)`);
  else toGenerate.push(cue);
}

let failed = 0;
for (const cue of toGenerate) {
  const variants = CUES[cue].variants ?? 1;
  const files = [];
  for (let take = 1; take <= variants; take++) {
    const file = filesFor(cue)[take - 1];
    try {
      // Generate first, back up the old take only once a replacement is in hand, so a failed
      // API call leaves the existing recording untouched.
      const audio = await generate(cue, take);
      if (await exists(file)) {
        await mkdir(BACKUP_DIR, { recursive: true });
        await copyFile(join(OUT_DIR, file), join(BACKUP_DIR, file));
      }
      await writeFile(join(OUT_DIR, file), audio);
      files.push(file);
      console.log(`✓ ${file}`);
    } catch (err) {
      failed++;
      console.error(`✗ ${err.message}`);
    }
  }
  if (files.length > 0) {
    // A cue's file list can change shape (e.g. one take -> three). Move any file it used to
    // list that's no longer referenced into the backup, so it isn't left in the shipped folder.
    for (const old of manifest[cue] ?? []) {
      if (files.includes(old) || !(await exists(old))) continue;
      await mkdir(BACKUP_DIR, { recursive: true });
      await copyFile(join(OUT_DIR, old), join(BACKUP_DIR, old));
      await unlink(join(OUT_DIR, old));
    }
    manifest[cue] = files;
  }
}

await writeFile(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`\nWrote manifest for ${Object.keys(manifest).length} cue(s) to ${OUT_DIR}`);
if (failed > 0) {
  console.error(`${failed} generation(s) failed — re-run to retry (\`npm run sfx -- <cue>\` for just the failed ones).`);
  process.exit(1);
}
