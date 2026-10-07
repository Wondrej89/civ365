import { jobs } from '../content/jobs';
import { resources } from '../content/resources';
import { balance } from '../content/config';
import { D, sum } from '../utils/numbers';
import type { GameState, JobDefinition } from '../types';
import {
  activeEffects,
  populationModifier,
  productionModifier,
  resourceMultiplier,
} from './effects';
import { evaluateCondition } from './conditions';

export const assignedWorkers = (state: GameState) =>
  sum(Object.values(state.jobAssignments));
export const idleWorkers = (state: GameState) =>
  state.population.sub(assignedWorkers(state));
export function isJobUnlocked(state: GameState, job: JobDefinition) {
  return (
    evaluateCondition(job.unlockedBy, state) ||
    activeEffects(state).some((e) => e.type === 'unlockJob' && e.id === job.id)
  );
}
export function jobProduction(state: GameState, job: JobDefinition) {
  const effects = activeEffects(state);
  return Object.fromEntries(
    job.production.map((p) => {
      const modifier = effects.reduce(
        (n, e) =>
          e.type === 'jobProductionMultiplier' &&
          e.job === job.id &&
          (!e.resource || e.resource === p.resource)
            ? n.mul(e.value)
            : n,
        D(1),
      );
      return [
        p.resource,
        D(p.amount)
          .mul(state.jobAssignments[job.id] ?? D())
          .mul(modifier)
          .mul(productionModifier(effects, p.resource))
          .mul(resourceMultiplier(effects, p.resource)),
      ];
    }),
  );
}
export function productionPerSecond(state: GameState) {
  const result = Object.fromEntries(resources.map((r) => [r.id, D()]));
  const effects = activeEffects(state);
  for (const job of jobs.filter((j) => isJobUnlocked(state, j))) {
    for (const [resource, value] of Object.entries(jobProduction(state, job)))
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
export function populationCost(state: GameState) {
  const config = balance.populationGrowth;
  return D(config.baseFoodCost)
    .mul(D(config.multiplier).pow(state.population.sub(1)))
    .mul(populationModifier(activeEffects(state)));
}
