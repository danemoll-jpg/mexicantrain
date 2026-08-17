interface Section {
  heading: string;
  body?: string;
  items?: Array<[string, string]>;
}

const SECTIONS: Section[] = [
  {
    heading: 'Objective',
    body: 'Score as few pips as possible over 13 rounds — one round per double, counting down from double-12 to double-0. Lowest total wins.',
  },
  {
    heading: 'Setup',
    body: "Everyone gets a hand of tiles (13-15, depending on table size). Whoever holds this round's double lays it in the center as the hub — if nobody has it, tiles get turned face-up from the boneyard until it shows up, and whoever turns it up starts.",
  },
  {
    heading: 'Trains',
    body: "Every player gets their own train growing off the hub, plus everyone shares one public Mexican Train. Your own train starts private — only you can play on it. It goes public (anyone can play on it) the moment you can't play at all on your turn, and it closes back up private again the next time you play on it yourself.",
  },
  {
    heading: 'Your Turn',
    body: "Play a tile if you can: onto your own train, onto the Mexican Train, or onto anyone else's train that's currently public. If you can't play anything, draw one tile from the boneyard. If that doesn't help either, you pass — and your own train goes public.",
  },
  {
    heading: 'Doubles',
    body: "A double (like 7-7) needs a follow-up: the moment one gets played, EVERYONE'S only legal move — no matter whose turn it is — becomes filling that double with a matching tile, until someone does. It stays a live bottleneck at the table until it's covered.",
  },
  {
    heading: 'Going out',
    body: "The instant a player plays their very last tile, the round ends immediately — no extra turns for anyone else. Everyone left holding tiles counts up the pips in hand; the player who went out scores zero for the round.",
  },
  {
    heading: 'Blocked round',
    body: "If a full lap goes by with nobody able to play anything and the boneyard is empty, the round ends right there — same scoring as normal, just nobody gets the zero.",
  },
  {
    heading: 'Scoring a tile',
    items: [
      ['Any tile', 'Pips on both halves added together (e.g. 5-9 = 14 points)'],
      ['Double-0 (blank)', '0 points — the cheapest tile in the set'],
      ['Double-12', '24 points — the heaviest tile in the set'],
    ],
  },
  {
    heading: 'Winning',
    body: 'After 13 rounds, whoever has the lowest running total wins the match. Check the 📋 Scorecard button any time to see where everyone stands.',
  },
];

const ALL_TRAINS_PUBLIC_SECTION: Section = {
  heading: 'Optional: All Trains Public',
  body: "A casual house-rule variant — every train, including everyone's personal ones, is public from the start. No private trains, no marker rule to track. A friendlier, faster-moving game.",
};

interface HowToPlayProps {
  onClose: () => void;
  /** Whether "all trains public" is active in the current match, if there is one — undefined
   * (e.g. the pre-game screens) just shows the rule as background info without an ON/OFF
   * badge. */
  allTrainsPublicInThisMatch?: boolean;
}

export function HowToPlay({ onClose, allTrainsPublicInThisMatch }: HowToPlayProps) {
  const sections =
    allTrainsPublicInThisMatch === undefined
      ? [...SECTIONS, ALL_TRAINS_PUBLIC_SECTION]
      : [
          ...SECTIONS,
          {
            ...ALL_TRAINS_PUBLIC_SECTION,
            body: `${ALL_TRAINS_PUBLIC_SECTION.body} This match: ${allTrainsPublicInThisMatch ? 'ON 🚉' : 'OFF'}.`,
          },
        ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2>❓ How to Play</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="how-to-play__body">
          {sections.map((section) => (
            <div key={section.heading} className="how-to-play__section">
              <h3>{section.heading}</h3>
              {section.items ? (
                <ul>
                  {section.items.map(([name, desc]) => (
                    <li key={name}>
                      <strong>{name}</strong> — {desc}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{section.body}</p>
              )}
            </div>
          ))}
        </div>
        <p className="how-to-play__footer">
          Stuck mid-turn? Close this and tap <strong>🤔 What should I play?</strong> for a live suggestion.
        </p>
      </div>
    </div>
  );
}
