import { cloneState } from '../state';
import { balance } from '../content/config';
import { jobs } from '../content/jobs';
import { skills } from '../content/skills';
import { eras } from '../content/eras';
import { resources } from '../content/resources';
import { D } from '../utils/numbers';
import type { GameAction, GameState } from '../types';
import { isFeatureUnlocked } from './conditions';
import { activeEffects, resourceMultiplier } from './effects';
import {
  idleWorkers,
  isJobUnlocked,
  populationCost,
  productionPerSecond,
} from './production';
import {
  canAdvance,
  canAfford,
  grantEffects,
  logEvent,
  payCosts,
  settleProgression,
  skillBlockReason,
  skillCost,
  technologyById,
  technologyStatus,
} from '../systems/progression';

export function addProduction(
  state: GameState,
  resource: string,
  amount: ReturnType<typeof D>,
) {
  state.resources[resource] = (state.resources[resource] ?? D()).add(amount);
  const stat = `total${resource[0].toUpperCase()}${resource.slice(1)}Produced`;
  state.statistics[stat] = (state.statistics[stat] ?? D()).add(amount);
}
/** Shared live/offline simulation, using bounded steps to apply earned modifiers along the way. */
export function simulate(
  state: GameState,
  seconds: number,
  endTime = state.lastSimulationTime + seconds * 1000,
): GameState {
  if (!Number.isFinite(seconds) || seconds <= 0) return state;
  const next = cloneState(state);
  let remaining = seconds;
  while (remaining > 0) {
    const step = Math.min(remaining, balance.offlineStepSeconds);
    const rates = productionPerSecond(next);
    for (const r of resources) addProduction(next, r.id, rates[r.id].mul(step));
    next.statistics.totalPlayTime = next.statistics.totalPlayTime.add(step);
    next.lastSimulationTime += step * 1000;
    settleProgression(next);
    remaining = Math.max(0, remaining - step);
  }
  next.lastSimulationTime = endTime;
  return next;
}
export function applyAction(state: GameState, action: GameAction): GameState {
  const next = cloneState(state);
  switch (action.type) {
    case 'gather': {
      const gather = balance.manualGathering[action.resource];
      if (!gather || !isFeatureUnlocked(next, gather.feature)) return state;
      addProduction(
        next,
        action.resource,
        D(gather.amount).mul(
          resourceMultiplier(activeEffects(next), action.resource),
        ),
      );
      next.statistics.totalManualClicks =
        next.statistics.totalManualClicks.add(1);
      break;
    }
    case 'grow': {
      const cost = populationCost(next);
      if (
        !isFeatureUnlocked(next, 'population') ||
        next.resources.food.lt(cost)
      )
        return state;
      next.resources.food = next.resources.food.sub(cost);
      next.population = next.population.add(1);
      if (
        next.population.eq(2) ||
        next.population.div(5).eq(next.population.div(5).floor())
      )
        logEvent(
          next,
          `Population reached ${next.population.toString()}.`,
          'milestone',
          false,
        );
      break;
    }
    case 'assign': {
      const job = jobs.find((j) => j.id === action.job),
        amount = D(action.amount);
      if (
        !job ||
        !isJobUnlocked(next, job) ||
        !Number.isFinite(amount.mantissa) ||
        !Number.isFinite(amount.exponent) ||
        !amount.eq(amount.floor())
      )
        return state;
      if (
        amount.gt(idleWorkers(next)) ||
        next.jobAssignments[job.id].add(amount).lt(0)
      )
        return state;
      next.jobAssignments[job.id] = next.jobAssignments[job.id].add(amount);
      break;
    }
    case 'research': {
      const tech = technologyById(action.id);
      if (
        !tech ||
        technologyStatus(next, tech) !== 'available' ||
        !canAfford(next, tech.cost)
      )
        return state;
      payCosts(next, tech.cost);
      next.researchedTechnologies.push(tech.id);
      grantEffects(next, tech.effects);
      next.statistics.technologiesResearched =
        next.statistics.technologiesResearched.add(1);
      logEvent(next, `${tech.name} researched.`, 'research');
      break;
    }
    case 'skill': {
      const skill = skills.find((s) => s.id === action.id);
      if (!skill || skillBlockReason(next, skill)) return state;
      next.resources.civilizationPoints = next.resources.civilizationPoints.sub(
        skillCost(next, skill),
      );
      next.purchasedSkills[skill.id] =
        (next.purchasedSkills[skill.id] ?? 0) + 1;
      grantEffects(next, skill.effects);
      logEvent(next, `${skill.name} learned.`, 'research');
      break;
    }
    case 'advance': {
      const era = eras.find((e) => e.id === action.id);
      if (!era || !canAdvance(next, era)) return state;
      next.currentEra = era.id;
      next.reachedEras.push(era.id);
      grantEffects(next, era.onEnterEffects);
      next.statistics.eraTransitions = next.statistics.eraTransitions.add(1);
      logEvent(next, `${era.name} reached. A new chapter begins.`, 'era');
      break;
    }
    case 'settings':
      next.settings = { ...next.settings, ...action.settings };
      break;
  }
  settleProgression(next);
  return next;
}
