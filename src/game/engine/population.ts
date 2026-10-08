import { balance } from '../content/config';
import { technologies } from '../content/technologies';
import { activeEffects } from './effects';
import { isFeatureUnlocked } from './conditions';
import { populationCost } from './production';
import { logEvent } from '../systems/progression';
import { D } from '../utils/numbers';
import { capacityReached } from './settlements';
import type { GameState } from '../types';

export function growthInterval(state: GameState) {
  const interval = activeEffects(state).reduce(
    (n, effect) =>
      effect.type === 'populationGrowthIntervalMultiplier'
        ? n.mul(effect.value)
        : n,
    D(balance.automaticGrowth.intervalSeconds),
  );
  return Math.max(
    balance.automaticGrowth.minimumIntervalSeconds,
    interval.toNumber(),
  );
}
export const autoGrowthActive = (state: GameState) =>
  state.autoPopulationGrowth.enabled &&
  isFeatureUnlocked(state, 'autoPopulationGrowth');
export const nextGrowthSeconds = (state: GameState) =>
  Math.max(0, growthInterval(state) - state.autoPopulationGrowth.accumulator);
export function growthModifiers(state: GameState) {
  return technologies
    .filter((t) => state.researchedTechnologies.includes(t.id))
    .flatMap((t) =>
      t.effects
        .filter((e) => e.type === 'populationGrowthIntervalMultiplier')
        .map((e) => ({ name: t.name, value: D(e.value) })),
    );
}
/** The only implementation of growth, used by the button and by simulation events. */
export function growPopulation(state: GameState, reservePercent = 0): boolean {
  const cost = populationCost(state);
  const protectedFood = state.resources.food.mul(reservePercent / 100);
  if (
    !isFeatureUnlocked(state, 'population') ||
    capacityReached(state) ||
    state.resources.food.lt(cost) ||
    state.resources.food.sub(cost).lt(protectedFood)
  )
    return false;
  state.resources.food = state.resources.food.sub(cost);
  state.population = state.population.add(1);
  state.statistics.totalPopulationCreated =
    state.statistics.totalPopulationCreated.add(1);
  state.statistics.foodSpentOnGrowth =
    state.statistics.foodSpentOnGrowth.add(cost);
  if (
    state.population.eq(2) ||
    state.population.div(5).eq(state.population.div(5).floor())
  )
    logEvent(
      state,
      `Population reached ${state.population.toString()}.`,
      'milestone',
      false,
    );
  return true;
}
