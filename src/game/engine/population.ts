import { balance } from '../content/config';
import { technologies } from '../content/technologies';
import { activeEffects } from './effects';
import { isFeatureUnlocked } from './conditions';
import { populationCost } from './production';
import { logEvent } from '../systems/progression';
import { D } from '../utils/numbers';
import { populationCapacity, settlementCount } from './settlements';
import { affordableQuantity, geometricCosts } from './costs';
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
/** Sum the individual marginal costs, including batches crossing either scaling breakpoint. */
function growthSegments(state: GameState, quantity: Amount) {
  const config = balance.populationGrowth;
  let population = state.population,
    remaining = D(quantity).floor().max(0);
  return [
    { end: D(config.scalingBreakpoint), growth: config.multiplier },
    { end: D(config.lateScalingBreakpoint), growth: config.laterMultiplier },
    { end: null, growth: config.lateMultiplier },
  ].flatMap(({ end, growth }) => {
    const amount = remaining.min(end ? end.sub(population).max(0) : remaining);
    if (amount.lte(0)) return [];
    const costs = [
      { resource: 'food', amount: populationCost(state, population) },
    ];
    population = population.add(amount);
    remaining = remaining.sub(amount);
    return [{ amount, growth, costs }];
  });
}
export function growthCost(
  state: GameState,
  quantity: Amount = populationGrowthAmount(state).min(
    populationCapacity(state).sub(state.population).max(0),
  ),
) {
  return growthSegments(state, quantity).reduce(
    (total, segment) =>
      total.add(
        geometricCosts(segment.costs, segment.growth, 0, segment.amount)[0]
          .amount,
      ),
    D(),
  );
}
/** Affordable partial batches prevent food or capacity from locking an otherwise valid growth step. */
export function growthQuote(state: GameState, reservePercent = 0) {
  const limit = populationGrowthAmount(state).min(
    populationCapacity(state).sub(state.population).max(0),
  );
  let budget = state.resources.food.mul(1 - reservePercent / 100),
    amount = D(),
    foodCost = D();
  for (const segment of growthSegments(state, limit)) {
    const n = affordableQuantity(
      { ...state, resources: { ...state.resources, food: budget } },
      segment.costs,
      segment.growth,
      0,
      segment.amount,
    );
    const cost = D(
      geometricCosts(segment.costs, segment.growth, 0, n)[0].amount,
    );
    amount = amount.add(n);
    foodCost = foodCost.add(cost);
    budget = budget.sub(cost);
    if (n.lt(segment.amount)) break;
  }
  return { amount, foodCost };
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
