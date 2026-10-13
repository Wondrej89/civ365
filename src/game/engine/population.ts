import { balance } from '../content/config';
import { technologies } from '../content/technologies';
import { activeEffects } from './effects';
import { isFeatureUnlocked } from './conditions';
import { populationCost } from './production';
import { logEvent } from '../systems/progression';
import { D } from '../utils/numbers';
import { populationCapacity, settlementCount } from './settlements';
import { message } from '../../i18n/core';
import type { Amount } from '../types';
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
        .filter((e) =>
          [
            'populationGrowthIntervalMultiplier',
            'populationGrowthAmountMultiplier',
            'populationGrowthPerCity',
          ].includes(e.type),
        )
        .map((e) => ({
          id: t.id,
          name: t.name,
          type: e.type,
          value: 'value' in e ? D(e.value) : D(),
        })),
    );
}
export function populationGrowthAmount(state: GameState) {
  const effects = activeEffects(state);
  const base = effects.reduce(
    (n, e) =>
      e.type === 'populationGrowthAmountMultiplier' ? n.mul(e.value) : n,
    D(1),
  );
  const cityBonus = effects.reduce(
    (n, e) => (e.type === 'populationGrowthPerCity' ? n.add(e.value) : n),
    D(),
  );
  return base
    .add(cityBonus.mul(settlementCount(state, 3)))
    .floor()
    .max(1);
}
/** A growth step costs one person's current price; research increases the people it provides. */
export function growthCost(
  state: GameState,
  quantity: Amount = populationGrowthAmount(state).min(
    populationCapacity(state).sub(state.population).max(0),
  ),
) {
  return D(quantity).floor().gt(0) ? populationCost(state) : D();
}
/** Capacity can shorten a batch. Food must cover one step, after protecting the reserve. */
export function growthQuote(state: GameState, reservePercent = 0) {
  const limit = populationGrowthAmount(state).min(
    populationCapacity(state).sub(state.population).max(0),
  );
  const budget = state.resources.food.mul(1 - reservePercent / 100),
    foodCost = growthCost(state, limit);
  return limit.gt(0) && budget.gte(foodCost)
    ? { amount: limit, foodCost }
    : { amount: D(), foodCost: D() };
}
/** The only implementation of growth, used by the button and by simulation events. */
export function growPopulation(state: GameState, reservePercent = 0): boolean {
  if (!isFeatureUnlocked(state, 'population')) return false;
  const quote = growthQuote(state, reservePercent),
    previous = state.population;
  if (quote.amount.lte(0)) return false;
  state.resources.food = state.resources.food.sub(quote.foodCost).max(0);
  state.population = state.population.add(quote.amount);
  state.statistics.totalPopulationCreated =
    state.statistics.totalPopulationCreated.add(quote.amount);
  state.statistics.foodSpentOnGrowth = state.statistics.foodSpentOnGrowth.add(
    quote.foodCost,
  );
  if (
    state.population.eq(2) ||
    state.population.div(25).floor().gt(previous.div(25).floor())
  )
    logEvent(
      state,
      message('Population reached {population}.', {
        population: state.population.toString(),
      }),
      'milestone',
      false,
    );
  return true;
}
