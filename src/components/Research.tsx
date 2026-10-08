import { useState } from 'react';
import { Check, FlaskConical, LockKeyhole } from 'lucide-react';
import { useGame } from '../hooks/useGame';
import { canAfford } from '../game/systems/progression';
import {
  technologyTree,
  treeDimensions as dimensions,
} from '../game/systems/technology-tree';
import { gameStore } from '../game/store';
import { formatNumber } from '../game/utils/numbers';
import { productionPerSecond } from '../game/engine/production';
import { Costs, costReason } from './common';
export function ResearchSheet() {
  const { state } = useGame(),
    [zoom, setZoom] = useState(100);
  const tree = technologyTree(state),
    scale = zoom / 100;
  return (
    <>
      <div className="sheet-heading">
        <div>
          <div className="eyebrow">CURIOSITY BECOMES PROGRESS</div>
          <h1>One idea changes everything.</h1>
          <p>
            Follow the connections. Each discovery opens the next possibility.
          </p>
        </div>
        <div className="point-balance">
          <FlaskConical size={22} />
          <span>
            <strong>{formatNumber(state.resources.research)} Research</strong>
            <small>
              +{formatNumber(productionPerSecond(state).research)}/s
            </small>
          </span>
        </div>
      </div>
      <div className="tree-toolbar">
        <span className="tree-legend">
          <i className="researched" /> Researched <i className="available" />{' '}
          Available <i /> Revealed
        </span>
        <label>
          Tree zoom{' '}
          <select
            aria-label="Technology tree zoom"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          >
            {[75, 100, 125].map((value) => (
              <option key={value} value={value}>
                {value}%
              </option>
            ))}
          </select>
        </label>
      </div>
      <div
        className="technology-tree-scroll"
        role="region"
        aria-label="Technology tree"
        tabIndex={0}
      >
        <div style={{ width: tree.width * scale, height: tree.height * scale }}>
          <div
            className="technology-tree"
            style={{
              width: tree.width,
              height: tree.height,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            {tree.groups.map((group) => (
              <section
                className="tree-era-region"
                key={group.era.id}
                aria-label={group.era.name}
                style={{
                  top: group.y,
                  width: tree.width,
                  height: group.height,
                }}
              >
                <h2>{group.era.name}</h2>
              </section>
            ))}
            <svg
              className="tree-connectors"
              width={tree.width}
              height={tree.height}
              aria-hidden="true"
            >
              <defs>
                <marker
                  id="tech-arrow"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#8fa99a" />
                </marker>
              </defs>
              {tree.edges.map(({ source, target }) => {
                const x1 = source.x + dimensions.nodeWidth / 2,
                  y1 = source.y + dimensions.nodeHeight,
                  x2 = target.x + dimensions.nodeWidth / 2,
                  y2 = target.y;
                const middle = (y1 + y2) / 2;
                return (
                  <path
                    key={`${source.technology.id}-${target.technology.id}`}
                    data-edge={`${source.technology.id}-${target.technology.id}`}
                    d={`M${x1},${y1} C${x1},${middle} ${x2},${middle} ${x2},${y2 - 3}`}
                    fill="none"
                    stroke={
                      source.status === 'researched' ? '#6a9c80' : '#c8d7ce'
                    }
                    strokeWidth="1.5"
                    markerEnd="url(#tech-arrow)"
                  />
                );
              })}
            </svg>
            {tree.nodes.map(({ technology: t, status, x, y }) => {
              const researched = status === 'researched',
                available = status === 'available',
                unknown = status === 'revealed' && t.lockedPreview;
              const prerequisites = t.prerequisites
                .map(
                  (id) =>
                    tree.nodes.find((n) => n.technology.id === id)?.technology
                      .name ?? 'An undiscovered technology',
                )
                .join(', ');
              const eraName = tree.groups.find((g) => g.era.id === t.era)?.era
                .name;
              const reason = available
                ? costReason(t.cost, state)
                : !state.reachedEras.includes(t.era)
                  ? `Reach ${eraName} to research this discovery.`
                  : `Requires ${prerequisites || 'a new discovery'}.`;
              return (
                <article
                  key={t.id}
                  data-tech={t.id}
                  data-status={status}
                  className={`technology-node ${status}`}
                  style={{
                    left: x,
                    top: y,
                    width: dimensions.nodeWidth,
                    minHeight: dimensions.nodeHeight,
                  }}
                  aria-label={unknown ? 'Unknown technology' : t.name}
                >
                  <div className="technology-node-top">
                    <span className="tag">{t.branch ?? 'Discovery'}</span>
                    {researched ? (
                      <Check size={16} />
                    ) : available ? (
                      <FlaskConical size={16} />
                    ) : (
                      <LockKeyhole size={16} />
                    )}
                  </div>
                  <h3>{unknown ? '???' : t.name}</h3>
                  <small className="tech-era-name">
                    {tree.groups.find((g) => g.era.id === t.era)?.era.name} ·{' '}
                    {researched
                      ? 'Researched'
                      : available
                        ? 'Available'
                        : 'Revealed'}
                  </small>
                  <p>{unknown ? 'A discovery is waiting.' : t.effectText}</p>
                  <Costs costs={t.cost} state={state} />
                  <button
                    className={`button ${available ? 'primary' : ''}`}
                    disabled={!available || !canAfford(state, t.cost)}
                    title={reason || t.effectText}
                    aria-label={`Research ${unknown ? 'unknown technology' : t.name}`}
                    onClick={() =>
                      gameStore.dispatch({ type: 'research', id: t.id })
                    }
                  >
                    {researched
                      ? 'Researched'
                      : `Research ${unknown ? '???' : t.name}`}
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      </div>
      <p className="sheet-note">
        Scroll in both directions to explore. Only your discoveries and the next
        step are shown.
      </p>
    </>
  );
}
