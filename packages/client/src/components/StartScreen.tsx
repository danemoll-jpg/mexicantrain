import { useState } from 'react';
import { BotDifficulty, MatchRules } from '@mexicantrain/engine';
import { unlockAudio } from '../lib/audio';
import { DEFAULT_DIFFICULTY, DIFFICULTY_DESCRIPTIONS, DIFFICULTY_LABELS, DIFFICULTY_OPTIONS } from '../lib/difficulty';
import { DEFAULT_PLAYER_ICON } from '../lib/icons';
import { IconPicker } from './IconPicker';

interface StartScreenProps {
  connected: boolean;
  onStart: (humanName: string, totalPlayers: number, icon: string, rules: MatchRules, difficulty: BotDifficulty) => void;
  onBack: () => void;
}

export function StartScreen({ connected, onStart, onBack }: StartScreenProps) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(DEFAULT_PLAYER_ICON);
  const [totalPlayers, setTotalPlayers] = useState(3);
  const [allTrainsPublic, setAllTrainsPublic] = useState(false);
  const [difficulty, setDifficulty] = useState<BotDifficulty>(DEFAULT_DIFFICULTY);

  function handleStart() {
    // Browsers require a real user gesture before audio can play — this click is it.
    unlockAudio();
    onStart(name, totalPlayers, icon, { allTrainsPublic }, difficulty);
  }

  return (
    <div className="start-screen">
      <div className="start-screen__card">
        <button type="button" className="back-link" onClick={onBack}>
          ‹ Back
        </button>
        <h1>🚂 Mexican Train</h1>
        <p className="start-screen__subtitle">
          13 rounds, double-12 down to double-0. Build your own train off the hub, dump your heaviest tiles first —
          lowest total pips wins.
        </p>

        <label className="start-screen__label">
          What should Ed &amp; Carol call you?
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Dan"
            maxLength={20}
          />
        </label>

        <label className="start-screen__label">
          Your avatar
          <IconPicker value={icon} onChange={setIcon} />
        </label>

        <label className="start-screen__label">
          Table size
          <div className="start-screen__options">
            <button type="button" className={totalPlayers === 2 ? 'active' : ''} onClick={() => setTotalPlayers(2)}>
              You vs. 1
            </button>
            <button type="button" className={totalPlayers === 3 ? 'active' : ''} onClick={() => setTotalPlayers(3)}>
              You vs. 2
            </button>
          </div>
        </label>

        <label className="start-screen__label">
          Bot difficulty
          <div className="start-screen__options">
            {DIFFICULTY_OPTIONS.map((d) => (
              <button key={d} type="button" className={difficulty === d ? 'active' : ''} onClick={() => setDifficulty(d)}>
                {DIFFICULTY_LABELS[d]}
              </button>
            ))}
          </div>
          <span className="start-screen__hint">{DIFFICULTY_DESCRIPTIONS[difficulty]}</span>
        </label>

        <label className="start-screen__checkbox">
          <input type="checkbox" checked={allTrainsPublic} onChange={(e) => setAllTrainsPublic(e.target.checked)} />
          🚉 All trains public (a casual house-rule variant — anyone can play on anyone's train, always)
        </label>

        <button type="button" className="start-screen__submit" disabled={!connected} onClick={handleStart}>
          {connected ? 'Lay the hub 🚂' : 'Connecting…'}
        </button>

        <details className="start-screen__rules">
          <summary>I don't really know how to play — quick rules?</summary>
          <ul>
            <li>Whoever holds this round's double (starting at double-12) lays it in the center as the hub.</li>
            <li>Everyone grows their own train off the hub — you can also play on the shared Mexican Train anytime.</li>
            <li>On your turn, play a matching tile if you have one. Can't play? Draw one from the boneyard.</li>
            <li>Still can't play after drawing? Your train goes public — anyone can play on it until you close it again.</li>
            <li>Play a double and you must immediately try to cover it — until it's covered, EVERYONE'S only legal move is filling that double.</li>
            <li>First to empty their hand ends the round immediately — everyone else scores the pips still in hand.</li>
            <li>13 rounds (double-12 down to double-0). Lowest total pips wins.</li>
            <li>Optional: turn on "all trains public" below for a friendlier, no-privacy variant.</li>
            <li>Pick a bot difficulty below — Easy is forgiving, Hard never wastes a play.</li>
          </ul>
          <p>Stuck mid-turn? Hit the "What should I play?" button any time.</p>
        </details>
      </div>
    </div>
  );
}
