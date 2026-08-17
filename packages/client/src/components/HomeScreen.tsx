interface HomeScreenProps {
  onSelectLocal: () => void;
  onSelectOnline: () => void;
}

export function HomeScreen({ onSelectLocal, onSelectOnline }: HomeScreenProps) {
  return (
    <div className="start-screen">
      <div className="start-screen__card">
        <h1>🚂 Mexican Train</h1>
        <p className="start-screen__subtitle">
          Build your train off the double-12 hub each round, dump your heaviest tiles first, and watch out for open
          doubles. Lowest pip total after 13 rounds wins.
        </p>

        <div className="home-screen__choices">
          <button type="button" className="home-screen__choice" onClick={onSelectLocal}>
            <span className="home-screen__choice-emoji">🚃</span>
            <span className="home-screen__choice-title">Play against AI</span>
            <span className="home-screen__choice-sub">Just you and this browser — no one else needed.</span>
          </button>
          <button type="button" className="home-screen__choice" onClick={onSelectOnline}>
            <span className="home-screen__choice-emoji">🌐</span>
            <span className="home-screen__choice-title">Play online vs. a friend</span>
            <span className="home-screen__choice-sub">Create a room, share the code, play from anywhere.</span>
          </button>
        </div>
      </div>
    </div>
  );
}
