import { Tile } from '@mexicantrain/engine';

interface DominoProps {
  tile?: Tile; // undefined = face-down back
  /** 'vertical' stacks the two halves top/bottom (a hand tile, held in your fingers);
   * 'horizontal' lays them side by side (a tile placed in a train, read left to right). */
  orientation?: 'vertical' | 'horizontal';
  /** Which half is the "leading" one — the half that was already showing on the train before
   * this tile got played, vs. the new open end it leaves behind. Only meaningful for
   * orientation="horizontal"; purely cosmetic (swaps which half renders first). */
  leadingHalf?: 'a' | 'b';
  isDouble?: boolean;
  isOpenDouble?: boolean;
  playable?: boolean;
  selected?: boolean;
  faded?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  title?: string;
}

export function Domino({
  tile,
  orientation = 'vertical',
  leadingHalf = 'a',
  isDouble,
  isOpenDouble,
  playable,
  selected,
  faded,
  size = 'md',
  onClick,
  title,
}: DominoProps) {
  const classNames = ['domino', `domino--${size}`, `domino--${orientation}`];
  if (!tile) classNames.push('domino--back');
  if (isDouble) classNames.push('domino--double');
  if (isOpenDouble) classNames.push('domino--open-double');
  if (playable) classNames.push('domino--playable');
  if (selected) classNames.push('domino--selected');
  if (faded) classNames.push('domino--faded');
  if (onClick) classNames.push('domino--clickable');

  const halves = tile ? (leadingHalf === 'a' ? [tile.a, tile.b] : [tile.b, tile.a]) : [];

  return (
    <button type="button" className={classNames.join(' ')} onClick={onClick} disabled={!onClick} title={title}>
      {tile ? (
        halves.map((pips, i) => (
          <span className="domino__half" key={i}>
            {pips}
          </span>
        ))
      ) : (
        <span className="domino__back-pattern">🚂</span>
      )}
    </button>
  );
}
