import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyAction,
  BotDifficulty,
  BotPersonalityId,
  deriveSoundCues,
  DEFAULT_RULES,
  GameEvent,
  getHint,
  MoveHint,
  PlayerAction,
  PublicGameState,
  redactState,
  SfxCue,
  TemplateCommentaryProvider,
} from '@mexicantrain/engine';
import { isBotTurn, stepBot } from '../lib/bot';
import { commentaryForEvents } from '../lib/commentary';
import { DEFAULT_DIFFICULTY } from '../lib/difficulty';
import { isMuted, playSound, setMuted, SoundName } from '../lib/audio';
import { addScoresToGlobalLeaderboard } from '../network/globalLeaderboard';
import { getClientId } from '../network/clientId';
import { clearSavedRoomCode, getSavedRoomCode, saveRoomCode } from '../network/roomSession';
import {
  addBotSeat as addBotSeatRequest,
  addOpenSeat as addOpenSeatRequest,
  createRoom,
  joinRoom,
  removeSeat as removeSeatRequest,
  resetToLobby,
  RoomDoc,
  sendReadyForNextRound,
  setRoomDifficulty,
  setRoomRules,
  startMatch as startMatchRequest,
  subscribeToRoom,
  updateNewRecordRanks,
  writeGameState,
} from '../network/rooms';

export interface CommentaryEntry {
  id: string;
  speakerId: string;
  personality: BotPersonalityId;
  text: string;
}

// Deliberately shorter than local play's pause — a single "turn" online can involve several
// chained bot actions (draw, then play, sometimes a double-satisfy chain on top), each with
// its own Firestore round-trip on top of this delay, so it compounds fast.
const BOT_THINK_MIN_MS = 250;
const BOT_THINK_MAX_MS = 450;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveSoundName(cue: SfxCue, state: PublicGameState | null): SoundName {
  if (cue !== 'matchOver') return cue;
  if (!state || !state.matchWinnerIds || state.matchWinnerIds.length > 1) return 'matchOverDraw';
  const iWon = state.players[state.viewerSeatIndex]?.id === state.matchWinnerIds[0];
  return iWon ? 'matchOverWin' : 'matchOverLose';
}

export interface UseOnlineRoom {
  connected: boolean;
  room: RoomDoc | null;
  code: string | null;
  isHost: boolean;
  mySeatIndex: number;
  error: string | null;
  createAndJoin: (hostName: string, hostIcon: string) => Promise<void>;
  joinExisting: (code: string, name: string, icon: string) => Promise<void>;
  leaveRoom: () => void;
  addOpenSeat: () => void;
  addBotSeat: () => void;
  removeSeat: (index: number) => void;
  setAllTrainsPublicRule: (allTrainsPublic: boolean) => void;
  setBotDifficulty: (difficulty: BotDifficulty) => void;
  begin: () => void;
  publicState: PublicGameState | null;
  /** Human players' chosen avatars, keyed by player id — see GameView's playerIcons prop. */
  playerIcons: Record<string, string>;
  commentary: CommentaryEntry[];
  hint: MoveHint | null;
  muted: boolean;
  toggleMuted: () => void;
  sendAction: (action: PlayerAction) => void;
  requestHint: () => void;
  clearHint: () => void;
  dismissCommentary: (id: string) => void;
  newMatch: () => void;
  /** Player id → 1-based all-time rank, for whichever human players' final totals just landed
   * on the shared top-10 leaderboard. Empty until the host's leaderboard write resolves and
   * syncs into the room doc. */
  newRecordRanks: Record<string, number>;
}

/** Online (Firestore-synced) room: mirrors the shape of the local-play hook, but backed by a
 * shared `rooms/{code}` document instead of in-memory state. See src/network/rooms.ts for the
 * sync model — single writer per turn, host-driven bots, independently re-derived sound cues,
 * shared commentary. */
export function useOnlineRoom(): UseOnlineRoom {
  const myClientId = useMemo(() => getClientId(), []);
  // Starts from whatever room (if any) this browser was last connected to — see
  // network/roomSession.ts — so a refresh (or reopening the tab later) resumes the same match
  // instead of losing it.
  const [code, setCode] = useState<string | null>(() => getSavedRoomCode());
  const [room, setRoom] = useState<RoomDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<MoveHint | null>(null);
  const [dismissedSeqs, setDismissedSeqs] = useState<Set<number>>(new Set());
  const [muted, setMutedState] = useState(() => isMuted());

  const lastSeenLogLength = useRef(0);
  const botLoopRunning = useRef(false);
  const commentaryProvider = useRef(new TemplateCommentaryProvider());
  const submittedLeaderboard = useRef(false);

  useEffect(() => {
    if (!code) return undefined;
    const unsubscribe = subscribeToRoom(code, (next) => {
      setRoom(next);
      if (next) {
        setError(null);
      } else {
        // The room this browser remembered no longer exists (expired, deleted, or a stale/
        // mistyped code) — stop trying to resume it on the next reload.
        setError('That room no longer exists.');
        clearSavedRoomCode();
      }
    });
    return unsubscribe;
  }, [code]);

  const mySeatIndex = room?.seats.findIndex((s) => s.clientId === myClientId) ?? -1;
  const isHost = room?.hostClientId === myClientId;
  const gameState = room?.gameState ?? null;

  // Independently re-derive + play sound cues for any newly-arrived events. Deterministic
  // given the same event log, so every connected client computing this separately is fine.
  useEffect(() => {
    if (!gameState) {
      lastSeenLogLength.current = 0;
      return;
    }
    const newEvents = gameState.log.slice(lastSeenLogLength.current);
    lastSeenLogLength.current = gameState.log.length;
    if (newEvents.length === 0) return;
    const publicNow = mySeatIndex >= 0 ? redactState(gameState, room!.seats[mySeatIndex].id) : null;
    for (const cue of deriveSoundCues(newEvents)) playSound(resolveSoundName(cue, publicNow));
  }, [gameState, mySeatIndex, room]);

  // Host's browser drives every bot turn. A bot "turn" here can be several atomic engine
  // actions in a row — a draw before a play, or (unique to Mexican Train) a whole
  // open-double-satisfy chain stacking several draw/play pairs on top of each other. Those
  // in-between steps aren't something another client needs to see live — only the *result*
  // once the turn actually hands off to someone else is. So this batches every atomic step
  // that keeps the same seat acting into ONE Firestore write, flushing only when the acting
  // seat changes (a real turn boundary) or the match ends. A long double chain that used to
  // cost one network round trip per step now costs exactly one, however many steps it took —
  // that round-trip latency stacking up was the actual source of the extra online lag.
  useEffect(() => {
    if (!isHost || !code || !room || !gameState) return;
    if (!isBotTurn(gameState)) return;
    if (botLoopRunning.current) return;
    botLoopRunning.current = true;

    const roomCode = code; // local const alias — TS won't carry the `!code` narrowing above into the nested `flush` function below
    let current = gameState;
    let currentRoom = room;
    const difficulty = room.botDifficulty ?? DEFAULT_DIFFICULTY;
    (async () => {
      let batchStartSeat = current.actingSeat;
      let batchEvents: GameEvent[] = [];

      async function flush() {
        if (batchEvents.length === 0) return;
        const lines = await commentaryForEvents(commentaryProvider.current, batchEvents, current);
        const written = await writeGameState(roomCode, currentRoom, current, lines);
        // Keep our local copy in step with what we just wrote (rather than waiting for the
        // snapshot round-trip) so the next batch doesn't clobber it.
        currentRoom = { ...currentRoom, ...written };
        batchEvents = [];
      }

      while (isBotTurn(current)) {
        await delay(BOT_THINK_MIN_MS + Math.random() * (BOT_THINK_MAX_MS - BOT_THINK_MIN_MS));
        const { state: next, newEvents } = stepBot(current, difficulty);
        current = next;
        batchEvents.push(...newEvents);

        if (current.actingSeat !== batchStartSeat || current.phase === 'matchOver') {
          await flush();
          batchStartSeat = current.actingSeat;
        }
      }
      await flush(); // whatever's left in the batch when a human's turn arrives
    })().finally(() => {
      botLoopRunning.current = false;
    });
  }, [isHost, code, room, gameState]);

  // Host submits final totals to the shared leaderboard exactly once per finished match —
  // every connected client sees the same matchOver moment via its own subscription, so
  // without this host-only gate, a match's scores would get added once PER connected device
  // instead of once total.
  useEffect(() => {
    if (!isHost || !code || !gameState || gameState.phase !== 'matchOver' || submittedLeaderboard.current) return;
    submittedLeaderboard.current = true;
    // Bots don't compete for leaderboard spots — only human results get submitted, so the
    // board reflects real players, not however well the heuristic bot strategy happens to play.
    const humans = gameState.players.filter((p) => !p.isBot);
    if (humans.length === 0) return;
    const results = humans.map((p) => ({
      name: p.name,
      score: p.roundScores.reduce((a, b) => a + b, 0),
      isAi: false,
    }));
    addScoresToGlobalLeaderboard(results)
      .then((ranks) => {
        const next: Record<string, number> = {};
        ranks.forEach((rank, i) => {
          if (rank !== null) next[humans[i].id] = rank;
        });
        if (Object.keys(next).length > 0) return updateNewRecordRanks(code, next);
      })
      .catch(() => {
        // Leaderboard is a nice-to-have — a failed write shouldn't disrupt the game-over screen.
      });
  }, [isHost, code, gameState]);

  const createAndJoin = useCallback(async (hostName: string, hostIcon: string) => {
    setError(null);
    try {
      const newCode = await createRoom(hostName, hostIcon);
      saveRoomCode(newCode);
      setCode(newCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create a room.');
    }
  }, []);

  const joinExisting = useCallback(async (joinCode: string, name: string, icon: string) => {
    setError(null);
    try {
      const joined = await joinRoom(joinCode, name, icon);
      saveRoomCode(joined);
      setCode(joined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join that room.');
    }
  }, []);

  const leaveRoom = useCallback(() => {
    clearSavedRoomCode();
    setCode(null);
    setRoom(null);
    setError(null);
    setHint(null);
    setDismissedSeqs(new Set());
  }, []);

  const addOpenSeat = useCallback(() => {
    if (code) addOpenSeatRequest(code).catch((err) => setError(err instanceof Error ? err.message : 'Failed.'));
  }, [code]);

  const addBotSeat = useCallback(() => {
    if (code) addBotSeatRequest(code).catch((err) => setError(err instanceof Error ? err.message : 'Failed.'));
  }, [code]);

  const removeSeat = useCallback(
    (index: number) => {
      if (code) removeSeatRequest(code, index).catch((err) => setError(err instanceof Error ? err.message : 'Failed.'));
    },
    [code],
  );

  const setAllTrainsPublicRule = useCallback(
    (allTrainsPublic: boolean) => {
      if (code) setRoomRules(code, { allTrainsPublic }).catch((err) => setError(err instanceof Error ? err.message : 'Failed.'));
    },
    [code],
  );

  const setBotDifficulty = useCallback(
    (difficulty: BotDifficulty) => {
      if (code) setRoomDifficulty(code, difficulty).catch((err) => setError(err instanceof Error ? err.message : 'Failed.'));
    },
    [code],
  );

  const begin = useCallback(() => {
    if (code && room) {
      startMatchRequest(code, room.seats, room.rules ?? DEFAULT_RULES).catch((err) =>
        setError(err instanceof Error ? err.message : 'Failed.'),
      );
    }
  }, [code, room]);

  const publicState = gameState && mySeatIndex >= 0 ? redactState(gameState, room!.seats[mySeatIndex].id) : null;

  const sendAction = useCallback(
    (action: PlayerAction) => {
      if (!code || !room || !gameState || mySeatIndex < 0) return;

      // 'readyForNextRound' isn't turn-based, and — unlike every other action — more than one
      // player can legitimately send it during the same round-over pause, so it goes through a
      // Firestore transaction (see sendReadyForNextRound) instead of the optimistic
      // compute-locally-then-overwrite path every other action uses below.
      if (action.type === 'readyForNextRound') {
        setError(null);
        setHint(null);
        sendReadyForNextRound(code, room.seats[mySeatIndex].id, commentaryProvider.current).catch((err) => {
          setError(err instanceof Error ? err.message : 'That move was rejected.');
        });
        return;
      }

      if (gameState.actingSeat !== mySeatIndex) {
        setError("It's not your turn.");
        return;
      }
      setError(null);
      setHint(null);
      (async () => {
        try {
          const prevLogLength = gameState.log.length;
          const next = applyAction(gameState, mySeatIndex, action);
          const newEvents = next.log.slice(prevLogLength);
          const lines = await commentaryForEvents(commentaryProvider.current, newEvents, next);
          await writeGameState(code, room, next, lines);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'That move was rejected.');
        }
      })();
    },
    [code, room, gameState, mySeatIndex],
  );

  const requestHint = useCallback(() => {
    if (!gameState || mySeatIndex < 0) return;
    setHint(getHint(gameState, mySeatIndex));
  }, [gameState, mySeatIndex]);

  const clearHint = useCallback(() => setHint(null), []);

  const dismissCommentary = useCallback((id: string) => {
    const seq = Number(id);
    if (Number.isNaN(seq)) return;
    setDismissedSeqs((prev) => new Set(prev).add(seq));
  }, []);

  const newMatch = useCallback(() => {
    if (code) {
      resetToLobby(code).catch((err) => setError(err instanceof Error ? err.message : 'Failed.'));
      setHint(null);
      setDismissedSeqs(new Set());
      submittedLeaderboard.current = false;
    }
  }, [code]);

  const toggleMuted = useCallback(() => {
    setMutedState((prev) => {
      const next = !prev;
      setMuted(next);
      return next;
    });
  }, []);

  const commentary: CommentaryEntry[] = (room?.commentary ?? [])
    .filter((c) => !dismissedSeqs.has(c.seq))
    .map((c) => ({ id: String(c.seq), speakerId: c.speakerId, personality: c.personality, text: c.text }));

  const playerIcons: Record<string, string> = Object.fromEntries(
    (room?.seats ?? []).filter((s): s is typeof s & { icon: string } => !!s.icon).map((s) => [s.id, s.icon]),
  );

  return {
    connected: room !== null,
    room,
    code,
    isHost,
    mySeatIndex,
    error,
    createAndJoin,
    joinExisting,
    leaveRoom,
    addOpenSeat,
    addBotSeat,
    removeSeat,
    setAllTrainsPublicRule,
    setBotDifficulty,
    begin,
    publicState,
    playerIcons,
    commentary,
    hint,
    muted,
    toggleMuted,
    sendAction,
    requestHint,
    clearHint,
    dismissCommentary,
    newMatch,
    newRecordRanks: room?.newRecordRanks ?? {},
  };
}
