interface ChatterToggleProps {
  silenced: boolean;
  onToggle: () => void;
}

export function ChatterToggle({ silenced, onToggle }: ChatterToggleProps) {
  const label = silenced ? 'Turn bot chatter back on' : 'Silence bot chatter';
  return (
    <button
      type="button"
      className="sound-toggle sound-toggle--chatter"
      onClick={onToggle}
      aria-label={label}
      aria-pressed={silenced}
      title={label}
    >
      {silenced ? '🤐' : '💬'}
    </button>
  );
}
