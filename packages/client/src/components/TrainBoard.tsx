import { PublicGameState, Tile, Train } from '@mexicantrain/engine';
import { Domino } from './Domino';
import { playableTrainIds } from '../lib/legality';

interface TrainBoardProps {
  state: PublicGameState;
  selectedTile: Tile | null;
  onPlayToTrain: (trainId: string) => void;
  avatarFor: (playerId: string) => string;
}

/** Walks a train's tile chain in play order, pairing each tile with which of its two halves
 * was the one that matched the open end BEFORE it was played — so the row reads as a
 * continuous chain of touching numbers, the way it would lying on a real table. */
function chainWithLeadingHalves(train: Train, hubValue: number): Array<{ tile: Tile; leadingHalf: 'a' | 'b' }> {
  let openEnd = hubValue;
  return train.tiles.map((tile) => {
    const leadingHalf: 'a' | 'b' = tile.a === openEnd ? 'a' : 'b';
    openEnd = leadingHalf === 'a' ? tile.b : tile.a;
    return { tile, leadingHalf };
  });
}

function TrainRow({
  train,
  label,
  avatar,
  isMine,
  isActingPlayer,
  hubValue,
  destinationHighlighted,
  isOpenDoubleTarget,
  onClick,
}: {
  train: Train;
  label: string;
  avatar: string;
  isMine: boolean;
  isActingPlayer: boolean;
  hubValue: number;
  destinationHighlighted: boolean;
  isOpenDoubleTarget: boolean;
  onClick: (() => void) | undefined;
}) {
  const chain = chainWithLeadingHalves(train, hubValue);
  const lastTile = chain[chain.length - 1]?.tile;
  const openDoubleHere = isOpenDoubleTarget;

  return (
    <div
      className={[
        'train-row',
        train.isPublic ? 'train-row--public' : 'train-row--private',
        isMine ? 'train-row--mine' : '',
        isActingPlayer ? 'train-row--active' : '',
        destinationHighlighted ? 'train-row--highlighted' : '',
        openDoubleHere ? 'train-row--open-double' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="train-row__label">
        <span className="train-row__avatar">{avatar}</span>
        <span className="train-row__name">{label}</span>
        {train.ownerId && (
          <span className="train-row__badge" title={train.isPublic ? 'Public — anyone can play here' : 'Private — only the owner can play here'}>
            {train.isPublic ? '🔓' : '🔒'}
          </span>
        )}
      </div>
      {/* A <div role="button"> rather than a real <button> — the dominoes rendered inside
          are themselves <button> elements (Domino.tsx), and a <button> can't legally nest
          another interactive control inside it. */}
      <div
        className="train-row__track"
        role="button"
        tabIndex={onClick ? 0 : -1}
        aria-label={`Play onto ${label}`}
        aria-disabled={!onClick}
        onClick={onClick}
        onKeyDown={(e) => {
          if (onClick && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onClick();
          }
        }}
      >
        <div className="train-row__hub-stub" title={`Branches off the double-${hubValue} hub`}>
          {hubValue}
        </div>
        {chain.map(({ tile, leadingHalf }, i) => (
          <Domino
            key={i}
            tile={tile}
            orientation="horizontal"
            leadingHalf={leadingHalf}
            isDouble={tile.a === tile.b}
            isOpenDouble={openDoubleHere && i === chain.length - 1}
            size="sm"
          />
        ))}
        <div className={`train-row__open-end ${destinationHighlighted ? 'train-row__open-end--highlighted' : ''}`}>
          {lastTile ? train.openEnd : hubValue}
        </div>
      </div>
    </div>
  );
}

export function TrainBoard({ state, selectedTile, onPlayToTrain, avatarFor }: TrainBoardProps) {
  const highlightedTrains = new Set(selectedTile ? playableTrainIds(state, selectedTile) : []);

  return (
    <div className="train-board">
      <div className="train-board__hub" title={`This round's hub — double-${state.engineValue}`}>
        <Domino tile={{ a: state.engineValue, b: state.engineValue }} orientation="horizontal" isDouble size="md" />
        <span className="train-board__hub-label">Round {state.roundNumber} hub</span>
      </div>

      {state.trainOrder.map((trainId) => {
        const train = state.trains[trainId];
        const isMexican = trainId === 'mexican';
        const owner = isMexican ? null : state.players.find((p) => p.id === trainId);
        const label = isMexican ? 'Mexican Train' : owner?.name ?? trainId;
        const avatar = isMexican ? '🚉' : avatarFor(trainId);
        const isMine = trainId === state.players[state.viewerSeatIndex]?.id;
        const isActingPlayer = trainId === state.players[state.actingSeat]?.id;
        const isOpenDoubleTarget = state.openDouble?.trainId === trainId;
        const canClickHere = highlightedTrains.has(trainId);

        return (
          <TrainRow
            key={trainId}
            train={train}
            label={label}
            avatar={avatar}
            isMine={isMine}
            isActingPlayer={isActingPlayer}
            hubValue={state.engineValue}
            destinationHighlighted={canClickHere}
            isOpenDoubleTarget={isOpenDoubleTarget}
            onClick={canClickHere ? () => onPlayToTrain(trainId) : undefined}
          />
        );
      })}
    </div>
  );
}
