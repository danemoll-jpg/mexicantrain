import { PublicGameState, Tile, tileId } from '@mexicantrain/engine';
import { Domino } from './Domino';
import { isMyTurn, playableTrainIds } from '../lib/legality';

interface HandTrayProps {
  hand: Tile[];
  state: PublicGameState;
  selectedTileId: string | null;
  onSelect: (tileId: string) => void;
}

/** The viewer's own hand — a horizontally scrollable row of tiles (vertical dominoes, held
 * like you would in real life). Tiles with nowhere to go right now are dimmed but still
 * tappable (so a hint about "why can't I play this" is always one tap of explanation away
 * via the natural disabled-look), except during a genuine draw/pass-only turn where nothing
 * is selectable at all. */
export function HandTray({ hand, state, selectedTileId, onSelect }: HandTrayProps) {
  const myTurn = isMyTurn(state);

  return (
    <div className="hand-tray">
      <div className="hand-tray__scroll">
        {hand.map((tile) => {
          const id = tileId(tile);
          const playable = myTurn && playableTrainIds(state, tile).length > 0;
          return (
            <Domino
              key={id}
              tile={tile}
              orientation="vertical"
              isDouble={tile.a === tile.b}
              playable={playable}
              selected={selectedTileId === id}
              faded={myTurn && !playable}
              size="md"
              onClick={playable ? () => onSelect(id) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
