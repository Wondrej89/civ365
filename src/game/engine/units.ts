import { units } from '../content/units';
import { resources } from '../content/resources';
import type {
  Amount,
  GameAction,
  GameState,
  ProductionUnitDefinition,
} from '../types';
import { D, sum } from '../utils/numbers';
import { evaluateCondition } from './conditions';
import { activeEffects } from './effects';

export const unitById = (id: string) => units.find((u) => u.id === id);
export const ownedUnits = (state: GameState, id: string) =>
  state.productionUnits[id] ?? D();
export type UnitStatus = 'hidden' | 'revealed' | 'available' | 'owned';

/** Derive the full population carried through a chain; never charge it twice. */
export function getPopulationFootprint(
  id: string,
  ancestors: string[] = [],
): ReturnType<typeof D> {
  const unit = unitById(id);
  if (!unit) throw new Error(`Unknown production unit: ${id}`);
  if (ancestors.includes(id)) throw new Error('Cyclic production unit chain.');
  if (unit.upgradeFrom)
    return getPopulationFootprint(unit.upgradeFrom.unitId, [
      ...ancestors,
      id,
    ]).mul(unit.upgradeFrom.amount);
  return D(unit.populationCost ?? 1);
}
export const representedPopulation = (state: GameState) =>
  sum(
    units.map((u) => ownedUnits(state, u.id).mul(getPopulationFootprint(u.id))),
  );
export const idlePopulation = (state: GameState) =>
  state.population.sub(representedPopulation(state));
export function isUnitUnlocked(
  state: GameState,
  unit: ProductionUnitDefinition,
) {
  return (
    evaluateCondition(unit.unlockCondition, state) ||
    activeEffects(state).some(
      (e) =>
        (e.type === 'unlockUnit' || e.type === 'unlockJob') && e.id === unit.id,
    )
  );
}
export function unitStatus(
  state: GameState,
  unit: ProductionUnitDefinition,
): UnitStatus {
  if (ownedUnits(state, unit.id).gt(0)) return 'owned';
  if (isUnitUnlocked(state, unit)) return 'available';
  return unit.visibilityCondition &&
    evaluateCondition(unit.visibilityCondition, state)
    ? 'revealed'
    : 'hidden';
}
export function productionChains(state: GameState) {
  return resources
    .filter(
      (r) =>
        !r.meta &&
        (r.initiallyVisible || state.unlockedFeatures.includes(r.feature)),
    )
    .map((resource) => ({
      resource,
      units: units
        .filter(
          (u) =>
            u.category === resource.id && unitStatus(state, u) !== 'hidden',
        )
        .sort((a, b) => a.tier - b.tier),
    }))
    .filter((chain) => chain.units.length > 0);
}
/** Aggregate duplicate costs so affordability checks and payment agree. */
export function unitCosts(unit: ProductionUnitDefinition) {
  const costs: Record<string, ReturnType<typeof D>> = {};
  for (const c of unit.costs ?? [])
    costs[c.resource] = (costs[c.resource] ?? D()).add(c.amount);
  return Object.entries(costs).map(([resource, amount]) => ({
    resource,
    amount,
  }));
}
export function maxCreatable(state: GameState, unit: ProductionUnitDefinition) {
  if (!isUnitUnlocked(state, unit)) return D();
  let maximum = unit.upgradeFrom
    ? ownedUnits(state, unit.upgradeFrom.unitId)
        .div(unit.upgradeFrom.amount)
        .floor()
    : idlePopulation(state).div(getPopulationFootprint(unit.id)).floor();
  for (const c of unitCosts(unit))
    if (c.amount.gt(0))
      maximum = maximum.min(
        (state.resources[c.resource] ?? D()).div(c.amount).floor(),
      );
  return maximum.max(0);
}
export function creationBlockReason(
  state: GameState,
  unit: ProductionUnitDefinition,
  quantity: Amount = 1,
): string | null {
  const n = D(quantity);
  if (!isUnitUnlocked(state, unit)) return 'Requires new technology';
  if (
    unit.upgradeFrom &&
    ownedUnits(state, unit.upgradeFrom.unitId).lt(
      n.mul(unit.upgradeFrom.amount),
    )
  )
    return `Not enough ${unitById(unit.upgradeFrom.unitId)?.name} units`;
  if (
    !unit.upgradeFrom &&
    idlePopulation(state).lt(n.mul(getPopulationFootprint(unit.id)))
  )
    return 'Not enough Idle Population';
  const missing = unitCosts(unit).filter((c) =>
    (state.resources[c.resource] ?? D()).lt(c.amount.mul(n)),
  );
  if (missing.length)
    return `Not enough ${missing.map((c) => resources.find((r) => r.id === c.resource)?.name ?? c.resource).join(' / ')}`;
  return null;
}
type UnitAction = Extract<GameAction, { unitId: string }>;
/** Called only on an isolated state clone. Validate everything before paying/consuming anything. */
export function mutateUnitAction(
  state: GameState,
  action: UnitAction,
): boolean {
  const unit = unitById(action.unitId);
  if (!unit) return false;
  const creating = action.type === 'recruit' || action.type === 'upgrade';
  if (
    (action.type === 'recruit' || action.type === 'release') &&
    unit.upgradeFrom
  )
    return false;
  if (
    (action.type === 'upgrade' || action.type === 'dismantle') &&
    !unit.upgradeFrom
  )
    return false;
  let quantity: ReturnType<typeof D>;
  try {
    quantity =
      action.amount === 'max'
        ? creating
          ? maxCreatable(state, unit)
          : ownedUnits(state, unit.id)
        : D(action.amount);
  } catch {
    return false;
  }
  if (
    !Number.isFinite(quantity.mantissa) ||
    !Number.isFinite(quantity.exponent) ||
    quantity.lte(0) ||
    !quantity.eq(quantity.floor())
  )
    return false;
  if (creating) {
    if (creationBlockReason(state, unit, quantity)) return false;
    for (const cost of unitCosts(unit))
      state.resources[cost.resource] = state.resources[cost.resource].sub(
        cost.amount.mul(quantity),
      );
    if (unit.upgradeFrom)
      state.productionUnits[unit.upgradeFrom.unitId] = ownedUnits(
        state,
        unit.upgradeFrom.unitId,
      ).sub(quantity.mul(unit.upgradeFrom.amount));
    state.productionUnits[unit.id] = ownedUnits(state, unit.id).add(quantity);
  } else {
    if (ownedUnits(state, unit.id).lt(quantity)) return false;
    state.productionUnits[unit.id] = ownedUnits(state, unit.id).sub(quantity);
    if (unit.upgradeFrom)
      state.productionUnits[unit.upgradeFrom.unitId] = ownedUnits(
        state,
        unit.upgradeFrom.unitId,
      ).add(quantity.mul(unit.upgradeFrom.amount));
  }
  return true;
}
/** Fail early on authoring errors, including cycles and accidental double population charges. */
export function validateUnitDefinitions() {
  const seen = new Set<string>();
  for (const unit of units) {
    if (seen.has(unit.id)) throw new Error(`Duplicate unit: ${unit.id}`);
    seen.add(unit.id);
    if (
      !resources.some((r) => r.id === unit.category) ||
      !Number.isInteger(unit.tier) ||
      unit.tier < 1
    )
      throw new Error('Invalid production category or tier.');
    if (unit.upgradeFrom) {
      const source = unitById(unit.upgradeFrom.unitId);
      if (
        !source ||
        source.category !== unit.category ||
        source.tier >= unit.tier ||
        !Number.isSafeInteger(unit.upgradeFrom.amount) ||
        unit.upgradeFrom.amount < 1 ||
        unit.populationCost !== undefined
      )
        throw new Error('Invalid upgrade chain.');
    } else if (
      unit.tier !== 1 ||
      !Number.isSafeInteger(unit.populationCost ?? 1) ||
      (unit.populationCost ?? 1) < 1
    )
      throw new Error('Invalid tier-one population cost.');
    for (const entry of [...unit.baseProduction, ...(unit.costs ?? [])])
      if (
        !resources.some((r) => r.id === entry.resource) ||
        !Number.isFinite(D(entry.amount).mantissa) ||
        !Number.isFinite(D(entry.amount).exponent) ||
        D(entry.amount).lt(0)
      )
        throw new Error('Invalid unit production or cost.');
    if (unit.effects?.some((e) => e.type === 'grantResource'))
      throw new Error('Unit effects must be continuous ownership effects.');
    getPopulationFootprint(unit.id);
  }
}
validateUnitDefinitions();
