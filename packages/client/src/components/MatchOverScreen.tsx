import { useState } from 'react';
import { PublicGameState, ROUNDS_PER_MATCH } from '@mexicantrain/engine';
import { GAME_HUB_URL } from '../lib/hub';
import { LeaderboardPanel } from './LeaderboardPanel';

interface MatchOverScreenProps {
  state: PublicGameState;
  onPlayAgain: () => void;
  /** Player id → 1-based all-time rank, for whichever human players' final totals just landed
   * on the shared top-10 leaderboard. */
  newRecordRanks: Record<string, number>;
}

export function MatchOverScreen({ state, onPlayAgain, newRecordRanks }: MatchOverScreenProps) {
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const winnerIds = state.matchWinnerIds ?? [];
  const isDraw = winnerIds.length > 1;
  const iWon = winnerIds.includes(state.players[state.viewerSeatIndex]?.id ?? '');
  const winners = state.players.filter((p) => winnerIds.includes(p.id));
  const sorted = [...state.players].sort((a, b) => a.total - b.total);
  const rounds = Array.from({ length: ROUNDS_PER_MATCH }, (_, i) => i + 1);

  return (
    <div className="game-over">
      <div className="game-over__card">
        {isDraw ? (
          <>
            <div className="game-over__emoji">🤝</div>
            <h2>It's a tie — {winners.map((w) => w.name).join(' & ')}!</h2>
            <p>Thirteen rounds and nobody could shake the other loose.</p>
          </>
        ) : (
          <>
            <div className="game-over__emoji">🏆</div>
            <h2>{iWon ? 'You win!' : `${winners[0]?.name ?? 'Someone'} wins!`}</h2>
            <p>Lowest pip total after 13 rounds takes it.</p>
          </>
        )}

        <div className="scorecard-table-wrap">
          <table className="scorecard-table">
            <thead>
              <tr>
                <th>Player</th>
                {rounds.map((r) => (
                  <th key={r}>{r}</th>
                ))}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <tr key={p.id} className={winnerIds.includes(p.id) ? 'scorecard-table__winner' : ''}>
                  <td>
                    {p.name}
                    {newRecordRanks[p.id] && (
                      <span className="new-record-badge">🏅 New Record! #{newRecordRanks[p.id]} All-Time</span>
                    )}
                  </td>
                  {rounds.map((r) => (
                    <td key={r}>{p.roundScores[r - 1] ?? '–'}</td>
                  ))}
                  <td className="scorecard-table__total">{p.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="game-over__actions">
          <button type="button" className="game-over__button" onClick={onPlayAgain}>
            Play again
          </button>
          <button type="button" className="game-over__button game-over__button--secondary" onClick={() => setShowLeaderboard(true)}>
            🏆 Leaderboard
          </button>
          <a className="game-over__button game-over__button--secondary" href={GAME_HUB_URL}>
            🎮 Game Hub
          </a>
        </div>
      </div>
      {showLeaderboard && <LeaderboardPanel onClose={() => setShowLeaderboard(false)} />}
    </div>
  );
}
