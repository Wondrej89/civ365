import { technologies } from "../content/technologies";
import { eras } from "../content/eras";
import { technologyStatus } from "./progression";
import type { GameState } from "../types";
export const treeDimensions = {
  nodeWidth: 230,
  nodeHeight: 238,
  column: 264,
  row: 274,
  padding: 24,
  heading: 54,
};
export function technologyTree(state: GameState) {
  const visible = technologies.filter(
    (t) => technologyStatus(state, t) !== "hidden",
  );
  const width =
    Math.max(1, ...visible.map((t) => (t.treePosition?.x ?? 0) + 1)) *
      treeDimensions.column +
    48;
  let offset = 0;
  const groups = eras
    .filter((e) => visible.some((t) => t.era === e.id))
    .map((era) => {
      const height =
        (Math.max(
          0,
          ...visible
            .filter((t) => t.era === era.id)
            .map((t) => t.treePosition?.y ?? 0),
        ) +
          1) *
          treeDimensions.row +
        treeDimensions.heading +
        24;
      const group = { era, y: offset, height };
      offset += height + 24;
      return group;
    });
  const nodes = visible.map((technology) => ({
    technology,
    status: technologyStatus(state, technology),
    x:
      treeDimensions.padding +
      (technology.treePosition?.x ?? 0) * treeDimensions.column,
    y:
      groups.find((g) => g.era.id === technology.era)!.y +
      treeDimensions.heading +
      (technology.treePosition?.y ?? 0) * treeDimensions.row,
  }));
  const edges = nodes.flatMap((target) =>
    target.technology.prerequisites.flatMap((id) => {
      const source = nodes.find((n) => n.technology.id === id);
      return source ? [{ source, target }] : [];
    }),
  );
  return { nodes, edges, groups, width, height: Math.max(250, offset) };
}

/** Cycle accessible discoveries first, then revealed future nodes; never target hidden content. */
export function nextUnresearchedTechnology(state: GameState, afterId?: string) {
  const candidates = technologyTree(state)
    .nodes.filter((node) => node.status !== "researched")
    .sort(
      (a, b) =>
        Number(b.status === "available") - Number(a.status === "available") ||
        a.y - b.y ||
        a.x - b.x,
    );
  if (!candidates.length) return null;
  const index = candidates.findIndex((node) => node.technology.id === afterId);
  return candidates[(index + 1) % candidates.length];
}
