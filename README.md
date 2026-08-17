# Mexican Train 🚂

A web version of **Mexican Train** — the domino game where each round is hosted by a double
(starting at double-12, counting down to double-0), everyone grows their own train off the
shared hub, and the lowest pip total across all 13 rounds wins.

Includes:
- The classic **double-12 set** (91 tiles): whoever holds the round's double lays it as the
  hub; if nobody does, tiles get turned face-up from the boneyard until it shows up.
- Every player gets a **private train** off the hub, plus everyone shares one public
  **Mexican Train**. A train opens up to everyone the moment its owner can't play at all, and
  closes back to private the next time they play on it themselves.
- The **open-double rule**: play a double and someone has to cover it before anything else
  can happen at the table — a real bottleneck, same as it plays at a real table.
- **Online play**: create a room, share the 4-letter code, and play a real match against
  someone else from anywhere — synced live via Firestore, no server to run or keep alive.
- Two **heuristic AI bots** with distinct personalities: **Ed** (quiet, confident, the
  occasional dry joke) and **Carol** (loud, encouraging — until you make a great play, then
  she gets sassy about it). They're married to each other, and Ed's got a soft spot for a
  player named Dan while Carol's got one for a player named Juliana — sit down under either
  name and watch the commentary change.
- A **"What should I play?" hint button** — powered by the exact same logic the bots use, so
  it never suggests an illegal move.
- **Snarky commentary** that reacts to what's happening at the table — big doubles, someone
  going out, round winners, and the final result.
- A **shared top-10 leaderboard** (lowest 13-round pip total wins, humans only — bot scores
  never get submitted) — same Firestore-backed approach as Golf's/Durak's.
- A live **scorecard** (📋 button, any time) showing every round so far plus running totals.
- **Sound effects** — synthesized in the browser via the Web Audio API (no audio files to
  ship). Mute anytime with the 🔊 button, top-right.

## Quick start

```bash
npm install
npm run dev
```

That builds the shared game engine, then starts the Vite dev server for the client (no
separate backend process — the app is a pure static site). The terminal will print the URL —
Vite defaults to `http://localhost:5173`, but picks the next free port (5174, 5175, …) if
that one's taken.

Local (vs-bots) play works immediately with zero setup. Online play and the leaderboard need
a Firebase project's config filled into `packages/client/src/network/firebase.ts` first — see
"Deploying" below; until then, "Play online" will fail to create/join a room, and the
leaderboard button will just show "Loading…" forever.

### Tests

```bash
npm run test
```

Runs the engine's test suite: tile-set/scoring checks, the open-double legality restriction,
and simulated full matches (bots playing bots — 2/3/4-player tables, several seeds each) that
assert all 91 tiles are conserved at every single step and every match terminates with a
valid winner.

## How to play (short version)

- Whoever holds this round's double (round 1 = double-12) lays it in the center as the hub.
- Everyone grows their own train off the hub. You can also play on the shared Mexican Train
  any time.
- On your turn: play a tile if you have one that fits — onto your own train, the Mexican
  Train, or anyone else's train that's currently public. Can't play? Draw from the boneyard.
  Still can't play? Pass — and your own train goes public until you play on it again.
- Play a double and you (or, if you can't finish it, whoever gets there first) has to cover it
  before anything else can happen at the table.
- The instant a player empties their hand, the round ends immediately — everyone else counts
  the pips still in hand; the player who went out scores zero.
- 13 rounds (double-12 down to double-0). Lowest total pips wins.

Click **"What should I play?"** any time it's your turn if you want a suggested move and why.

## Project structure

```
packages/
  engine/   Pure game logic — rules, state machine, scoring, bot strategy, hints, and
            commentary. No UI or network dependencies; fully unit-tested (vitest).
  client/   React + Vite UI. No backend of its own:
            - Local (vs-bots) play runs the engine directly in the browser
              (src/hooks/useLocalGame.ts).
            - Online play syncs through a shared Firestore document
              (src/network/, src/hooks/useOnlineRoom.ts).
```

The engine is deliberately framework-free so the exact same "what moves are legal right now"
and "what's the best move" logic is shared by local play, online play, the bots, and the
human hint feature — a hint can never suggest something illegal, and a bot can never cheat by
seeing a tile nobody's played or drawn yet.

## How online play is synced

There's no custom backend — both players' browsers talk directly to a shared Firestore
document at `rooms/{code}` (same approach as the author's other two projects, Golf and Durak):

- **Single writer per turn**: whoever's turn it is computes their move locally with the same
  engine code as local play, then writes the resulting state to the room. Everyone else's
  live subscription picks it up.
- **Only the host's browser drives bot turns** — avoids two clients racing to step the same
  bot's move. A bot "turn" is often several atomic actions in a row (draw, play, and a whole
  open-double-satisfy chain on top), each its own Firestore write. This means the host needs
  to stay connected for bot turns to happen; a bot-free 2-human room has no such dependency
  mid-game.
- **Sound cues** are deterministic given the event log, so every client re-derives and plays
  them independently — no sync needed. **Commentary** is randomized (which bot speaks, which
  canned line), so it's computed once by whoever wrote the move and shared via the room doc,
  so both players see the same reaction.
- **The host submits final scores to the leaderboard** exactly once per finished match — a
  match's scores don't get added once per connected device.

### Hand privacy

Same shape of hidden information as Durak's hands, not Golf's face-down cards: your own hand
is fully known to you and hidden from everyone else, but the board itself (every train, every
placed tile) is visible to the whole table, same as a real game. The room document still
holds the *full* authoritative game state (every player's hand), because that's what every
browser needs to sync the match — the UI just never shows another seat's hand to anyone.
There's no Auth/Cloud-Functions-based redaction in place — same accepted tradeoff Durak/Golf
document for their own hidden information, not a competitive-integrity guarantee for a game
against strangers. See `firestore.rules` for the same caveat in the security-rules comments.

## Deploying

1. **Firebase**: create a project at [console.firebase.google.com](https://console.firebase.google.com),
   enable **Firestore** (Standard edition). In Project Settings → General → Your apps, add a
   Web app and copy its config object into `packages/client/src/network/firebase.ts` (it
   currently has `REPLACE_ME` placeholders). Then paste this repo's `firestore.rules` into
   Firestore → Rules → Publish.
2. **Build**: `npm run build` (root) builds the engine, then the client to
   `packages/client/dist`.
3. **Host the static build** anywhere that serves static files — Netlify, Vercel, GitHub
   Pages, Cloudflare Pages, etc. all work with zero server-side config since this is a plain
   static site. For Netlify specifically: "Import from Git", build command
   `npm install && npm run build`, publish directory `packages/client/dist`.

No environment variables are needed at build time — the Firebase web config isn't a secret
(access control is enforced by `firestore.rules`, not by hiding the config), so it just gets
committed directly in `firebase.ts` once you've filled it in.

## Extending this later

- **Claude-powered commentary**: bot lines currently come from `TemplateCommentaryProvider`
  (`packages/engine/src/commentary/templateProvider.ts`), which picks randomized canned lines
  — no API key, no network calls. It implements the `CommentaryProvider` interface
  (`packages/engine/src/commentary/types.ts`); a `ClaudeCommentaryProvider` implementing that
  same interface (calling the Claude API, e.g. Haiku, with the game event as context) can be
  swapped in wherever `new TemplateCommentaryProvider()` is currently constructed
  (`useLocalGame.ts`, `useOnlineRoom.ts`), with no changes to game logic.
  See [claude.com/platform/api](https://claude.com/platform/api) for API keys.
- **More bot personalities / bigger tables**: add entries to `PERSONALITIES` in
  `packages/engine/src/commentary/personalities.ts` and to `BOT_PERSONALITIES`/
  `BOT_DISPLAY_NAMES` in `packages/client/src/lib/players.ts`, then raise `MAX_SEATS` in that
  same file past 4 if you want more than 4 seats total.
- **Double-9 or double-6 variants** (faster games, fewer rounds): parameterize `PIP_MAX` in
  `types.ts` (currently fixed at 12) and the corresponding hand-size table
  (`HAND_SIZE_BY_PLAYER_COUNT`).
- **Real access control on rooms**: swap the "anyone with the code can read/write" Firestore
  rules for Firebase Auth + Cloud Functions doing the actual writes server-side, if this ever
  needs to be trustworthy for strangers rather than just a friend.

## A couple of simplifications versus some house rules

- Placing the round's starting double doesn't itself carry the "must immediately try to play
  again" obligation that some rule sheets describe — the hub-placer just begins their normal
  turn right after. In practice this plays out the same way almost all the time (they usually
  extend their own train anyway), it's just not a hard requirement here.
- Only one open double is tracked live on the board at a time — extremely rare edge cases
  around simultaneous unsatisfied doubles aren't modeled, since the "only legal move is
  satisfying it" rule already prevents a second one from appearing until the first is closed.

Neither affects who ends up winning a well-played match — just some minor edge-case flavor.
