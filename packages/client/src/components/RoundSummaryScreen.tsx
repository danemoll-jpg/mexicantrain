import { useState } from 'react';
import { PublicGameState, tileId } from '@mexicantrain/engine';
import { Domino } from './Domino';

interface RoundSummaryScreenProps {
  state: PublicGameState;
  onReady: () => void;
}

/** Shown between rounds — what everyone was left holding and how many pips it cost them this
 * round, plus their new running total. Play is paused here: it only continues once every
 * human player (bots auto-ready instantly) has clicked through, whether the match is local,
 * online, or on its very last round heading into the match-over screen. */
export function RoundSummaryScreen({ state, onReady }: RoundSummaryScreenProps) {
  const summary = state.roundSummary;
  const [justClicked, setJustClicked] = useState(false);
  if (!summary) return null;

  const me = state.viewerSeatIndex >= 0 ? state.players[state.viewerSeatIndex] : undefined;
  const iAmHuman = !!me && !me.isBot;
  const iAmReady = justClicked || (!!me && state.readyPlayerIds.includes(me.id));
  const waitingOn = state.players.filter((p) => !p.isBot && !state.readyPlayerIds.includes(p.id) && p.id !== me?.id);

  const nameFor = (id: string) => state.players.find((p) => p.id === id)?.name ?? id;
  const wentOutName = summary.wentOutBy ? nameFor(summary.wentOutBy) : null;
  const lowestScore = Math.min(...summary.players.map((p) => p.roundScore));
  const sorted = [...summary.players].sort((a, b) => a.roundScore - b.roundScore);

  function handleReady() {
    setJustClicked(true);
    onReady();
  }

  return (
    <div className="game-over">
      <div className="game-over__card">
        <div className="game-over__emoji">🚂</div>
        <h2>Round {summary.roundNumber} complete</h2>
        <p>
          {wentOutName ? `${wentOutName} went out first — ` : 'Nobody could go out — '}
          double-{state.engineValue} is done.
          {summary.isFinalRound && ' That was the last round!'}
        </p>

        <div className="round-summary-list">
          {sorted.map((p) => (
            <div
              key={p.playerId}
              className={`round-summary-row ${p.roundScore === lowestScore ? 'round-summary-row--best' : ''}`}
            >
              <div className="round-summary-row__header">
                <span className="round-summary-row__name">{nameFor(p.playerId)}</span>
                <span className="round-summary-row__score">
                  +{p.roundScore} pts <span className="round-summary-row__total">· {p.total} total</span>
                </span>
              </div>
              <div className="round-summary-row__hand">
                {p.hand.length === 0 ? (
                  <span className="round-summary-row__empty">Empty hand — went out!</span>
                ) : (
                  p.hand.map((tile) => (
                    <Domino key={tileId(tile)} tile={tile} orientation="vertical" size="sm" isDouble={tile.a === tile.b} />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>

        {iAmHuman && !iAmReady && (
          <div className="game-over__actions">
            <button type="button" className="game-over__button" onClick={handleReady}>
              {summary.isFinalRound ? 'See final results 🏆' : 'Next round →'}
            </button>
          </div>
        )}
        {(!iAmHuman || iAmReady) && (
          <p className="round-summary__waiting">
            {waitingOn.length > 0 ? `Waiting on ${waitingOn.map((p) => p.name).join(', ')}…` : 'Starting…'}
          </p>
        )}
      </div>
    </div>
  );
}
