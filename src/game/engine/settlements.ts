import { message } from '../../i18n/core';
import { settlements } from '../content/settlements';
import { territories } from '../content/territories';
import { balance } from '../content/config';
import { D, sum } from '../utils/numbers';
import { activeEffects } from './effects';
import { evaluateCondition, isFeatureUnlocked } from './conditions';
import { affordableQuantity, geometricCosts, wholeQuantity } from './costs';
import { logEvent, payCosts } from '../systems/progression';
import type {
  GameState,
  SettlementDefinition,
  GameAction,
  Amount,
} from '../types';

export const ownedTerritories = (state: GameState) =>
  sum(Object.values(state.ownedTerritories));
export const settlementSlots = (state: GameState) =>
  sum(
    territories.map((t) =>
      (state.ownedTerritories[t.id] ?? D()).mul(t.settlementSlots),
    ),
  );
export const settlementCount = (state: GameState, minimumTier = 0) =>
  sum(
    settlements
      .filter((s) => s.tier >= minimumTier)
      .map((s) => state.settlements[s.id] ?? D()),
  );
export const availableSlots = (state: GameState) =>
  settlementSlots(state).sub(settlementCount(state));
export function capacityPerSettlement(
  state: GameState,
  settlement: SettlementDefinition,
) {
  return activeEffects(state).reduce(
    (n, e) =>
      e.type === 'settlementCapacityMultiplier' &&
      (!e.settlement || e.settlement === settlement.id)
        ? n.mul(e.value)
        : n,
    D(settlement.capacity),
  );
}
export function populationCapacity(state: GameState) {
  return sum(
    settlements.map((s) =>
      capacityPerSettlement(state, s).mul(state.settlements[s.id] ?? D()),
    ),
  )
    .add(state.populationCapacityBonus)
    .floor()
    .max(0);
}
export const capacityReached = (state: GameState) =>
  state.population.gte(populationCapacity(state));
export function settlementCosts(
  state: GameState,
  definition: SettlementDefinition,
) {
  const effects = activeEffects(state);
  return definition.costs.map((c) => ({
    resource: c.resource,
    amount: effects.reduce(
      (n, e) =>
        e.type === 'settlementCostMultiplier' &&
        (!e.resource || e.resource === c.resource)
          ? n.mul(e.value)
          : n,
      D(c.amount),
    ),
  }));
}
export function settlementQuote(
  state: GameState,
  definition: SettlementDefinition,
  quantity: Amount = 1,
  building = false,
) {
  return geometricCosts(
    settlementCosts(state, definition),
    building
      ? balance.settlements.costGrowth
      : (balance.settlements.upgradeCostGrowth[definition.id] ?? 1),
    building
      ? state.statistics.totalSettlementsBuilt.sub(1).max(0)
      : (state.settlementInvestments[definition.id] ?? D()),
    quantity,
  );
}
export function maxSettlementAction(
  state: GameState,
  definition: SettlementDefinition,
  building = false,
) {
  if (
    !isFeatureUnlocked(state, 'settlements') ||
    !evaluateCondition(definition.unlockCondition, state) ||
    (building && definition.tier !== 1)
  )
    return D();
  const limit = building
    ? availableSlots(state)
    : definition.upgradeFrom
      ? (state.settlements[definition.upgradeFrom] ?? D())
      : D();
  const costs = settlementCosts(state, definition);
  return affordableQuantity(
    state,
    costs,
    building
      ? balance.settlements.costGrowth
      : (balance.settlements.upgradeCostGrowth[definition.id] ?? 1),
    building
      ? state.statistics.totalSettlementsBuilt.sub(1).max(0)
      : (state.settlementInvestments[definition.id] ?? D()),
    limit,
  );
}
export function mutateSettlementAction(
  state: GameState,
  action: Extract<
    GameAction,
    { type: 'buildSettlement' | 'upgradeSettlement' }
  >,
) {
  const definition = settlements.find((s) => s.id === action.id),
    building = action.type === 'buildSettlement';
  if (!definition) return false;
  const n = wholeQuantity(
    action.amount,
    maxSettlementAction(state, definition, building),
  );
  if (!n) return false;
  payCosts(state, settlementQuote(state, definition, n, building));
  if (!building)
    state.settlements[definition.upgradeFrom!] =
      state.settlements[definition.upgradeFrom!].sub(n);
  state.settlements[definition.id] = (
    state.settlements[definition.id] ?? D()
  ).add(n);
  state.settlementInvestments[definition.id] = (
    state.settlementInvestments[definition.id] ?? D()
  ).add(n);
  if (building)
    state.statistics.totalSettlementsBuilt =
      state.statistics.totalSettlementsBuilt.add(n);
  logEvent(
    state,
    message('{0} {1} {2}.', {
      '0': building ? 'Built' : 'Upgraded to',
      '1': n.toString(),
      '2': definition.name,
    }),
    'milestone',
  );
  return true;
}
