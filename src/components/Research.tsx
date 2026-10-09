import { useI18n } from "../i18n/LocaleContext";
import { useRef, useState } from "react";
import { Check, FlaskConical, LockKeyhole, ScanSearch } from "lucide-react";
import { useGame } from "../hooks/useGame";
import { canAfford } from "../game/systems/progression";
import {
  technologyTree,
  treeDimensions as dimensions,
  nextUnresearchedTechnology,
} from "../game/systems/technology-tree";
import { gameStore } from "../game/store";

import { productionPerSecond } from "../game/engine/production";
import { Costs, costReason } from "./common";
export function ResearchSheet() {
  const { t: tr, formatNumber } = useI18n();

  const { state } = useGame(),
    [zoom, setZoom] = useState(100);
  const viewport = useRef<HTMLDivElement>(null),
    nodes = useRef<Record<string, HTMLElement | null>>({}),
    lastTarget = useRef<string | undefined>(undefined);
  const [focused, setFocused] = useState<string | null>(null);
  function focusNext() {
    const next = nextUnresearchedTechnology(state, lastTarget.current),
      element = next && nodes.current[next.technology.id],
      container = viewport.current;
    if (!next || !element || !container) return;
    lastTarget.current = next.technology.id;
    setFocused(next.technology.id);
    const scale = zoom / 100;
    container.scrollTo({
      left: Math.max(
        0,
        next.x * scale -
          (container.clientWidth - element.offsetWidth * scale) / 2,
      ),
      top: Math.max(
        0,
        next.y * scale -
          (container.clientHeight - element.offsetHeight * scale) / 2,
      ),
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
    element.focus({ preventScroll: true });
  }
  const tree = technologyTree(state),
    scale = zoom / 100;
  return (
    <>
      <div className="sheet-heading">
        <div>
          <div className="eyebrow">{tr("CURIOSITY BECOMES PROGRESS")}</div>
          <h1>{tr("One idea changes everything.")}</h1>
          <p>
            {tr(
              "Follow the connections. Each discovery opens the next possibility.",
            )}
          </p>
        </div>
        <div className="point-balance">
          <FlaskConical size={22} />
          <span>
            <strong>
              {formatNumber(state.resources.research)} {tr("Research")}
            </strong>
            <small>
              +{formatNumber(productionPerSecond(state).research)}
              {tr("/s")}
            </small>
          </span>
        </div>
      </div>
      <div className="tree-toolbar">
        <button
          className="button"
          onClick={focusNext}
          disabled={!nextUnresearchedTechnology(state)}
        >
          <ScanSearch size={16} /> {tr("Next unresearched technology")}
        </button>
        <span className="tree-legend">
          <i className="researched" /> {tr("Researched")}{" "}
          <i className="available" /> {tr("Available")} <i /> {tr("Revealed")}
        </span>
        <label>
          {tr("Tree zoom")}{" "}
          <select
            aria-label={tr("Technology tree zoom")}
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
        ref={viewport}
        role="region"
        aria-label={tr("Technology tree")}
        tabIndex={0}
      >
        <div style={{ width: tree.width * scale, height: tree.height * scale }}>
          <div
            className="technology-tree"
            style={{
              width: tree.width,
              height: tree.height,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            {tree.groups.map((group) => (
              <section
                className="tree-era-region"
                key={group.era.id}
                aria-label={tr(group.era.name)}
                style={{
                  top: group.y,
                  width: tree.width,
                  height: group.height,
                }}
              >
                <h2>{tr(group.era.name)}</h2>
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
                      source.status === "researched" ? "#6a9c80" : "#c8d7ce"
                    }
                    strokeWidth="1.5"
                    markerEnd="url(#tech-arrow)"
                  />
                );
              })}
            </svg>
            {tree.nodes.map(({ technology: t, status, x, y }) => {
              const researched = status === "researched",
                available = status === "available",
                unknown = status === "revealed" && t.lockedPreview;
              const prerequisites = t.prerequisites
                .map(
                  (id) =>
                    tr(
                      tree.nodes.find((n) => n.technology.id === id)?.technology
                        .name ?? "",
                    ) || tr("An undiscovered technology"),
                )
                .join(", ");
              const eraName = tr(
                tree.groups.find((g) => g.era.id === t.era)?.era.name ?? "",
              );
              const reason = available
                ? costReason(t.cost, state)
                : !state.reachedEras.includes(t.era)
                  ? tr("Reach {era} to research this discovery.", {
                      era: eraName,
                    })
                  : tr("Requires {technologies}.", {
                      technologies: prerequisites || tr("a new discovery"),
                    });
              return (
                <article
                  key={t.id}
                  data-tech={t.id}
                  data-status={status}
                  className={`technology-node ${status}${focused === t.id ? " focused-technology" : ""}`}
                  tabIndex={-1}
                  ref={(element) => {
                    nodes.current[t.id] = element;
                  }}
                  style={{
                    left: x,
                    top: y,
                    width: dimensions.nodeWidth,
                    minHeight: dimensions.nodeHeight,
                  }}
                  aria-label={unknown ? tr("Unknown technology") : tr(t.name)}
                >
                  <div className="technology-node-top">
                    <span className="tag">
                      {tr(t.branch ?? "") || tr("Discovery")}
                    </span>
                    {researched ? (
                      <Check size={16} />
                    ) : available ? (
                      <FlaskConical size={16} />
                    ) : (
                      <LockKeyhole size={16} />
                    )}
                  </div>
                  <h3>{unknown ? "???" : tr(t.name)}</h3>
                  <small className="tech-era-name">
                    {tr(
                      tree.groups.find((g) => g.era.id === t.era)?.era.name ??
                        "",
                    )}{" "}
                    ·{" "}
                    {researched
                      ? tr("Researched")
                      : available
                        ? tr("Available")
                        : tr("Revealed")}
                  </small>
                  <p>
                    {unknown ? tr("A discovery is waiting.") : tr(t.effectText)}
                  </p>
                  <Costs costs={t.cost} state={state} />
                  <button
                    className={`button ${available ? "primary" : ""}`}
                    disabled={!available || !canAfford(state, t.cost)}
                    title={tr(reason ?? "") || tr(t.effectText)}
                    aria-label={tr("Research {0}", {
                      "0": unknown ? tr("unknown technology") : tr(t.name),
                    })}
                    onClick={() =>
                      gameStore.dispatch({ type: "research", id: t.id })
                    }
                  >
                    {researched
                      ? tr("Researched")
                      : tr("Research {0}", {
                          "0": unknown ? "???" : tr(t.name),
                        })}
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      </div>
      <p className="sheet-note">
        {tr(
          "Scroll in both directions to explore. Only your discoveries and the next step are shown.",
        )}
      </p>
    </>
  );
}
