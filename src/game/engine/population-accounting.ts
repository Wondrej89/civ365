import { units } from '../content/units';
import { militaryUnits } from '../content/military';
import type { GameState } from '../types';
import { D, sum } from '../utils/numbers';
/** Derive the full population carried through a chain; never charge it twice. */
export function getPopulationFootprint(
  id: string,
  ancestors: string[] = [],
): ReturnType<typeof D> {
  const unit = units.find((u) => u.id === id);
  if (!unit) throw new Error(`Unknown production unit: ${id}`);
  if (ancestors.includes(id)) throw new Error('Cyclic production unit chain.');
  if (unit.upgradeFrom)
    return getPopulationFootprint(unit.upgradeFrom.unitId, [
      ...ancestors,
      id,
    ]).mul(unit.upgradeFrom.amount);
  return D(unit.populationCost ?? 1);
}
export const productionPopulation = (state: GameState) =>
  sum(
    units.map((u) =>
      (state.productionUnits[u.id] ?? D()).mul(getPopulationFootprint(u.id)),
    ),
  );
export const militaryPopulation = (state: GameState) =>
  sum(
    militaryUnits.map((u) =>
      (state.militaryUnits[u.id] ?? D()).mul(u.populationCost),
    ),
  );
export const representedPopulation = (state: GameState) =>
  productionPopulation(state).add(militaryPopulation(state));
export const idlePopulation = (state: GameState) =>
  state.population.sub(representedPopulation(state));
