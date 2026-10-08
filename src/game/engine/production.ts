import { units } from '../content/units';
import { resources } from '../content/resources';
import { balance } from '../content/config';
import { D } from '../utils/numbers';
import { cloneState } from '../state';
import type { Amount, GameState, ProductionUnitDefinition } from '../types';
import { ownedUnits, unitById } from './units';
import {
  activeEffects,
  populationModifier,
  productionModifier,
  resourceMultiplier,
} from './effects';
export function unitProduction(
  state: GameState,
  unit: ProductionUnitDefinition,
  count: Amount = ownedUnits(state, unit.id),
) {
  const effects = activeEffects(state);
  const result: Record<string, ReturnType<typeof D>> = {};
  for (const p of unit.baseProduction) {
    const modifier = effects.reduce(
      (n, e) =>
        ((e.type === 'unitProductionMultiplier' && e.unit === unit.id) ||
          (e.type === 'jobProductionMultiplier' && e.job === unit.id)) &&
        (!e.resource || e.resource === p.resource)
          ? n.mul(e.value)
          : n,
      D(1),
    );
    result[p.resource] = (result[p.resource] ?? D()).add(
      D(p.amount)
        .mul(count)
        .mul(modifier)
        .mul(productionModifier(effects, p.resource))
        .mul(resourceMultiplier(effects, p.resource)),
    );
  }
  return result;
}
export function productionPerSecond(state: GameState) {
  const result = Object.fromEntries(resources.map((r) => [r.id, D()]));
  const effects = activeEffects(state);
  for (const unit of units.filter((u) => ownedUnits(state, u.id).gt(0))) {
    for (const [resource, value] of Object.entries(unitProduction(state, unit)))
      result[resource] = (result[resource] ?? D()).add(value);
  }
  for (const e of effects)
    if (e.type === 'productionFlatBonus')
      result[e.resource] = (result[e.resource] ?? D()).add(
        D(e.value)
          .mul(productionModifier(effects, e.resource))
          .mul(resourceMultiplier(effects, e.resource)),
      );
  return result;
}
/** Include ownership effects gained/lost with the whole replacement group in the preview. */
export function upgradePreview(
  state: GameState,
  unit: ProductionUnitDefinition,
) {
  if (!unit.upgradeFrom) return null;
  const source = unitById(unit.upgradeFrom.unitId)!;
  const before = cloneState(state);
  before.productionUnits[source.id] = ownedUnits(state, source.id).max(
    unit.upgradeFrom.amount,
  );
  const next = cloneState(before);
  next.productionUnits[source.id] = before.productionUnits[source.id].sub(
    unit.upgradeFrom.amount,
  );
  next.productionUnits[unit.id] = ownedUnits(state, unit.id).add(1);
  const previous = productionPerSecond(before),
    future = productionPerSecond(next);
  return {
    replaced: unitProduction(before, source, unit.upgradeFrom.amount),
    produced: unitProduction(next, unit, 1),
    gain: Object.fromEntries(
      resources.map((r) => [r.id, future[r.id].sub(previous[r.id])]),
    ),
  };
}
export function populationCost(state: GameState) {
  const config = balance.populationGrowth;
  const early = state.population.sub(1).min(config.scalingBreakpoint - 1);
  const later = state.population.sub(config.scalingBreakpoint).max(0);
  return D(config.baseFoodCost)
    .mul(D(config.multiplier).pow(early))
    .mul(D(config.laterMultiplier).pow(later))
    .mul(populationModifier(activeEffects(state)));
}
