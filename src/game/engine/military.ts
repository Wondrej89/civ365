import { militaryUnits } from '../content/military';
import { balance } from '../content/config';
import { D, sum } from '../utils/numbers';
import { activeEffects } from './effects';
import { evaluateCondition, isFeatureUnlocked } from './conditions';
import { idlePopulation } from './population-accounting';
import { affordableQuantity, geometricCosts, wholeQuantity } from './costs';
import { canAfford, logEvent, payCosts } from '../systems/progression';
import { message } from '../../i18n/core';
import type {
  GameState,
  MilitaryUnitDefinition,
  GameAction,
  Amount,
} from '../types';

export const armyCount = (state: GameState) =>
  sum(Object.values(state.militaryUnits));
export const militaryTier = (state: GameState, unit: MilitaryUnitDefinition) =>
  unit.tiers[state.militaryTiers[unit.id] ?? 0];
export const nextMilitaryTier = (
  state: GameState,
  unit: MilitaryUnitDefinition,
) => unit.tiers[(state.militaryTiers[unit.id] ?? 0) + 1];
export function powerPerMilitaryUnit(
  state: GameState,
  unit: MilitaryUnitDefinition,
) {
  return activeEffects(state).reduce(
    (n, e) =>
      e.type === 'militaryPowerMultiplier' && (!e.unit || e.unit === unit.id)
        ? n.mul(e.value)
        : n,
    D(militaryTier(state, unit).basePower),
  );
}
export const militaryPower = (state: GameState) =>
  D(
    sum(
      militaryUnits.map((u) =>
        (state.militaryUnits[u.id] ?? D()).mul(powerPerMilitaryUnit(state, u)),
      ),
    )
      .mul(state.militaryReadiness)
      .toString(),
  );
export const militaryUnlocked = (
  state: GameState,
  unit: MilitaryUnitDefinition,
) =>
  isFeatureUnlocked(state, 'military') &&
  evaluateCondition(unit.unlockCondition, state);
export const militaryQuote = (
  state: GameState,
  unit: MilitaryUnitDefinition,
  quantity: Amount = 1,
) =>
  geometricCosts(
    militaryTier(state, unit).resourceCosts,
    balance.military.recruitCostGrowth,
    armyCount(state),
    quantity,
  );
export function militaryUpgradeQuote(
  state: GameState,
  unit: MilitaryUnitDefinition,
) {
  return (nextMilitaryTier(state, unit)?.resourceCosts ?? []).map((c) => ({
    resource: c.resource,
    amount: D(c.amount)
      .mul(state.militaryUnits[unit.id].max(1))
      .mul(balance.military.upgradeCostMultiplier[c.resource] ?? 1),
  }));
}
export function canUpgradeMilitary(
  state: GameState,
  unit: MilitaryUnitDefinition,
) {
  const next = nextMilitaryTier(state, unit);
  return (
    !state.activeCampaign &&
    militaryUnlocked(state, unit) &&
    !!next &&
    evaluateCondition(next.unlockCondition, state) &&
    canAfford(state, militaryUpgradeQuote(state, unit))
  );
}
export function upgradeMilitary(state: GameState, id: string) {
  const unit = militaryUnits.find((u) => u.id === id);
  if (!unit || !canUpgradeMilitary(state, unit)) return false;
  const next = nextMilitaryTier(state, unit)!;
  payCosts(state, militaryUpgradeQuote(state, unit));
  state.militaryTiers[id]++;
  logEvent(
    state,
    message('{role} upgraded to {unit}.', { role: unit.name, unit: next.name }),
  );
  return true;
}
export function upkeepPerMilitaryUnit(
  state: GameState,
  unit: MilitaryUnitDefinition,
) {
  const effects = activeEffects(state);
  return militaryTier(state, unit).upkeep.map((c) => ({
    resource: c.resource,
    amount: effects.reduce(
      (n, e) =>
        e.type === 'militaryUpkeepMultiplier' &&
        (!e.resource || e.resource === c.resource)
          ? n.mul(e.value)
          : n,
      D(c.amount),
    ),
  }));
}
export function armyUpkeep(state: GameState) {
  const result = { food: D(), materials: D() };
  for (const unit of militaryUnits)
    for (const cost of upkeepPerMilitaryUnit(state, unit)) {
      const resource = cost.resource as keyof typeof result;
      result[resource] = result[resource].add(
        D(cost.amount).mul(state.militaryUnits[unit.id]),
      );
    }
  return result;
}
/** Unpaid supplies reduce readiness, never create negative resources or delete soldiers. */
export function payArmyUpkeep(state: GameState, seconds: number) {
  if (seconds <= 0) return;
  let supplied = 1;
  for (const [resource, rate] of Object.entries(armyUpkeep(state))) {
    const bill = rate.mul(seconds);
    if (bill.lte(0)) continue;
    const paid = state.resources[resource].min(bill);
    supplied = Math.min(supplied, paid.div(bill).toNumber());
    state.resources[resource] = state.resources[resource].sub(paid).max(0);
    const stat = resource + 'SpentOnMilitary';
    state.statistics[stat] = state.statistics[stat].add(paid);
  }
  const config = balance.military,
    target = config.minimumReadiness + (1 - config.minimumReadiness) * supplied;
  const delta =
    seconds /
    (target < state.militaryReadiness
      ? config.readinessLossSeconds
      : config.readinessRecoverySeconds);
  state.militaryReadiness =
    target < state.militaryReadiness
      ? Math.max(target, state.militaryReadiness - delta)
      : Math.min(target, state.militaryReadiness + delta);
  if (state.activeCampaign)
    state.activeCampaign.lowestReadiness = Math.min(
      state.activeCampaign.lowestReadiness,
      state.militaryReadiness,
    );
}
export function maxMilitaryRecruit(
  state: GameState,
  unit: MilitaryUnitDefinition,
) {
  if (state.activeCampaign || !militaryUnlocked(state, unit)) return D();
  return affordableQuantity(
    state,
    militaryTier(state, unit).resourceCosts,
    balance.military.recruitCostGrowth,
    armyCount(state),
    idlePopulation(state).div(unit.populationCost).floor(),
  );
}
export function mutateMilitaryAction(
  state: GameState,
  action: Extract<GameAction, { type: 'recruitMilitary' | 'demobilize' }>,
) {
  const unit = militaryUnits.find((u) => u.id === action.id);
  if (!unit || state.activeCampaign || !militaryUnlocked(state, unit))
    return false;
  const recruit = action.type === 'recruitMilitary';
  const n = wholeQuantity(
    action.amount,
    recruit ? maxMilitaryRecruit(state, unit) : state.militaryUnits[unit.id],
  );
  if (!n) return false;
  if (recruit) payCosts(state, militaryQuote(state, unit, n));
  state.militaryUnits[unit.id] = state.militaryUnits[unit.id].add(
    recruit ? n : n.neg(),
  );
  if (armyCount(state).eq(0)) state.militaryReadiness = 1;
  return true;
}
