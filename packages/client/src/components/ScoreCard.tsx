import { PublicPlayerView, ROUNDS_PER_MATCH } from '@mexicantrain/engine';

interface ScoreCardProps {
  players: PublicPlayerView[];
  currentRound: number;
  onClose: () => void;
}

/** The 13-round running scorecard, one row per player, one column per round (double-12 down
 * to double-0), plus a running total. Available any time via a button in GameView, not just
 * at match end. */
export function ScoreCard({ players, currentRound, onClose }: ScoreCardProps) {
  const rounds = Array.from({ length: ROUNDS_PER_MATCH }, (_, i) => i + 1);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2>📋 Scorecard</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="scorecard-table-wrap">
          <table className="scorecard-table">
            <thead>
              <tr>
                <th>Player</th>
                {rounds.map((r) => (
                  <th key={r} className={r === currentRound ? 'scorecard-table__current' : ''}>
                    {r}
                  </th>
                ))}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  {rounds.map((r) => (
                    <td key={r} className={r === currentRound ? 'scorecard-table__current' : ''}>
                      {p.roundScores[r - 1] ?? '–'}
                    </td>
                  ))}
                  <td className="scorecard-table__total">{p.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
