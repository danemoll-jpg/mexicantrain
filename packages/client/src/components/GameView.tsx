import { ReactNode, useState } from 'react';
import { MoveHint, PlayerAction, PublicGameState, Tile, tileId } from '@mexicantrain/engine';
import { CommentaryFeed } from './CommentaryFeed';
import { HandTray } from './HandTray';
import { HintPanel } from './HintPanel';
import { HowToPlay } from './HowToPlay';
import { LeaderboardPanel } from './LeaderboardPanel';
import { MatchOverScreen } from './MatchOverScreen';
import { RoundSummaryScreen } from './RoundSummaryScreen';
import { ScoreCard } from './ScoreCard';
import { SoundToggle } from './SoundToggle';
import { TrainBoard } from './TrainBoard';
import { CommentaryEntry } from '../hooks/useOnlineRoom';
import { canDraw, canPass, hasAnyLegalPlay, isMyTurn, playableTrainIds } from '../lib/legality';
import { seatAvatar } from '../lib/players';

interface GameViewProps {
  publicState: PublicGameState;
  /** Human players' chosen avatars, keyed by player id — bots resolve their avatar from
   * `personality` instead, via seatAvatar(). */
  playerIcons: Record<string, string>;
  commentary: CommentaryEntry[];
  hint: MoveHint | null;
  error: string | null;
  connected: boolean;
  muted: boolean;
  toggleMuted: () => void;
  sendAction: (action: PlayerAction) => void;
  requestHint: () => void;
  clearHint: () => void;
  dismissCommentary: (id: string) => void;
  newMatch: () => void;
  /** Player id → 1-based all-time rank, for whichever human players' final totals just landed
   * on the shared top-10 leaderboard — see MatchOverScreen's "New Record" badge. */
  newRecordRanks: Record<string, number>;
  headerExtra?: ReactNode;
}

/** The actual table screen — shared by local (vs-bots) and online (Firestore room) play,
 * since both hooks expose the same PublicGameState-shaped view of the match. */
export function GameView({
  publicState,
  playerIcons,
  commentary,
  hint,
  error,
  connected,
  muted,
  toggleMuted,
  sendAction,
  requestHint,
  clearHint,
  dismissCommentary,
  newMatch,
  newRecordRanks,
  headerExtra,
}: GameViewProps) {
  const [showScorecard, setShowScorecard] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);

  const me = publicState.players[publicState.viewerSeatIndex];
  const myTurn = isMyTurn(publicState);
  const acting = publicState.players[publicState.actingSeat];
  const selectedTile: Tile | undefined = me?.hand?.find((t) => tileId(t) === selectedTileId);

  function avatarFor(playerId: string): string {
    const p = publicState.players.find((pl) => pl.id === playerId);
    if (!p) return '🚉';
    return seatAvatar({ type: p.isBot ? 'bot' : 'human', personality: p.personality, icon: playerIcons[p.id] });
  }

  function handleSelectTile(id: string) {
    const tile = me?.hand?.find((t) => tileId(t) === id);
    if (!tile) return;
    const destinations = playableTrainIds(publicState, tile);
    if (destinations.length === 1) {
      // Only one legal place for it — just play it, no need to make the player tap twice.
      sendAction({ type: 'playTile', tileId: id, trainId: destinations[0] });
      setSelectedTileId(null);
    } else {
      setSelectedTileId((prev) => (prev === id ? null : id));
    }
  }

  function handlePlayToTrain(trainId: string) {
    if (!selectedTileId) return;
    sendAction({ type: 'playTile', tileId: selectedTileId, trainId });
    setSelectedTileId(null);
  }

  function statusText(): string {
    if (!myTurn) return acting ? `Waiting on ${acting.name}…` : '';
    if (publicState.openDouble) {
      return `Open double! Play a ${publicState.openDouble.value} to close it out — that's the only legal move right now.`;
    }
    if (hasAnyLegalPlay(publicState)) return 'Tap a tile to play it.';
    if (canDraw(publicState)) return "Nothing to play — draw from the boneyard.";
    if (canPass(publicState)) return "Still nothing to play — pass, and your train goes public.";
    return '';
  }

  return (
    <div className="app">
      <SoundToggle muted={muted} onToggle={toggleMuted} />
      {headerExtra}
      {!connected && <div className="error-banner">Disconnected — try refreshing.</div>}
      {error && <div className="error-banner">{error}</div>}

      <div className="hole-banner">
        <span>
          Round {publicState.roundNumber} of 13 · double-{publicState.engineValue}
          {publicState.rules.allTrainsPublic && <span className="hole-banner__jokers" title="Every train is public — the standard private-train rule is off"> · 🚉 All public</span>}
        </span>
        <span className="hole-banner__buttons">
          <button type="button" onClick={() => setShowScorecard(true)}>
            📋 Scorecard
          </button>
          <button type="button" onClick={() => setShowLeaderboard(true)}>
            🏆 Leaderboard
          </button>
          <button type="button" onClick={() => setShowHowToPlay(true)}>
            ❓ How to Play
          </button>
        </span>
      </div>

      <div className="players-strip">
        {publicState.players.map((p) => (
          <div
            key={p.id}
            className={`player-chip ${p.id === acting?.id ? 'player-chip--active' : ''} ${p.id === me?.id ? 'player-chip--me' : ''}`}
          >
            <span className="player-chip__avatar">{avatarFor(p.id)}</span>
            <span className="player-chip__name">
              {p.name}
              {p.id === me?.id && ' (you)'}
            </span>
            <span className="player-chip__count" title="Tiles left in hand">
              {p.handCount}
            </span>
            <span className="player-chip__total" title="Running total after completed rounds">
              {p.total}
            </span>
          </div>
        ))}
        <div className="player-chip player-chip--boneyard" title="Tiles left in the boneyard">
          🦴 {publicState.boneyardCount}
        </div>
      </div>

      <TrainBoard state={publicState} selectedTile={selectedTile ?? null} onPlayToTrain={handlePlayToTrain} avatarFor={avatarFor} />

      <div className="status-bar">
        <span className="status-bar__prompt">{statusText()}</span>
      </div>

      <div className="action-bar">
        <button type="button" disabled={!canDraw(publicState)} onClick={() => sendAction({ type: 'drawTile' })}>
          Draw
        </button>
        <button type="button" disabled={!canPass(publicState)} onClick={() => sendAction({ type: 'passTurn' })}>
          Pass
        </button>
        <HintPanel hint={hint} canRequest={myTurn} onRequest={requestHint} onDismiss={clearHint} />
      </div>

      {me?.hand && <HandTray hand={me.hand} state={publicState} selectedTileId={selectedTileId} onSelect={handleSelectTile} />}

      <CommentaryFeed entries={commentary} onDismiss={dismissCommentary} />

      {showScorecard && (
        <ScoreCard players={publicState.players} currentRound={publicState.roundNumber} onClose={() => setShowScorecard(false)} />
      )}
      {showLeaderboard && <LeaderboardPanel onClose={() => setShowLeaderboard(false)} />}
      {showHowToPlay && (
        <HowToPlay onClose={() => setShowHowToPlay(false)} allTrainsPublicInThisMatch={publicState.rules.allTrainsPublic} />
      )}
      {publicState.phase === 'roundOver' && publicState.roundSummary && (
        <RoundSummaryScreen
          key={publicState.roundSummary.roundNumber}
          state={publicState}
          onReady={() => sendAction({ type: 'readyForNextRound' })}
        />
      )}
      {publicState.phase === 'matchOver' && (
        <MatchOverScreen state={publicState} onPlayAgain={newMatch} newRecordRanks={newRecordRanks} />
      )}
    </div>
  );
}
