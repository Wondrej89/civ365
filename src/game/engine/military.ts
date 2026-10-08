import { militaryUnits } from '../content/military';
import { balance } from '../content/config';
import { D, sum } from '../utils/numbers';
import { activeEffects } from './effects';
import { evaluateCondition, isFeatureUnlocked } from './conditions';
import { idlePopulation } from './population-accounting';
import { affordableQuantity, geometricCosts, wholeQuantity } from './costs';
import { payCosts } from '../systems/progression';
import type {
  GameState,
  MilitaryUnitDefinition,
  GameAction,
  Amount,
} from '../types';

export const armyCount = (state: GameState) =>
  sum(Object.values(state.militaryUnits));
export function powerPerMilitaryUnit(
  state: GameState,
  unit: MilitaryUnitDefinition,
) {
  return activeEffects(state).reduce(
    (n, e) =>
      e.type === 'militaryPowerMultiplier' && (!e.unit || e.unit === unit.id)
        ? n.mul(e.value)
        : n,
    D(unit.basePower),
  );
}
export const militaryPower = (state: GameState) =>
  sum(
    militaryUnits.map((u) =>
      (state.militaryUnits[u.id] ?? D()).mul(powerPerMilitaryUnit(state, u)),
    ),
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
    unit.resourceCosts,
    balance.military.recruitCostGrowth,
    armyCount(state),
    quantity,
  );
export function maxMilitaryRecruit(
  state: GameState,
  unit: MilitaryUnitDefinition,
) {
  if (state.activeCampaign || !militaryUnlocked(state, unit)) return D();
  return affordableQuantity(
    state,
    unit.resourceCosts,
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
    recruit
      ? maxMilitaryRecruit(state, unit)
      : (state.militaryUnits[unit.id] ?? D()),
  );
  if (!n) return false;
  if (recruit) payCosts(state, militaryQuote(state, unit, n));
  state.militaryUnits[unit.id] = (state.militaryUnits[unit.id] ?? D()).add(
    recruit ? n : n.neg(),
  );
  return true;
}
