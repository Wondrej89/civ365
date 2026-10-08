import { cloneState } from '../state';
import { balance } from '../content/config';
import { skills } from '../content/skills';
import { eras } from '../content/eras';
import { resources } from '../content/resources';
import { D } from '../utils/numbers';
import type { GameAction, GameState } from '../types';
import { isFeatureUnlocked } from './conditions';
import { activeEffects, resourceMultiplier } from './effects';
import { productionPerSecond } from './production';
import {
  autoGrowthActive,
  growPopulation,
  growthInterval,
  nextGrowthSeconds,
} from './population';
import { sampleStatistics } from '../systems/statistics';
import { units } from '../content/units';
import { mutateUnitAction } from './units';
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
    const automatic = autoGrowthActive(next);
    const recording = isFeatureUnlocked(next, 'statistics');
    const step = Math.min(
      remaining,
      balance.offlineStepSeconds,
      automatic ? nextGrowthSeconds(next) : Infinity,
      recording
        ? Math.max(
            0,
            balance.statistics.sampleIntervalSeconds -
              next.statisticsSamplingAccumulator,
          )
        : Infinity,
    );
    const rates = productionPerSecond(next);
    for (const r of resources) addProduction(next, r.id, rates[r.id].mul(step));
    next.statistics.totalPlayTime = next.statistics.totalPlayTime.add(step);
    next.lastSimulationTime += step * 1000;
    if (automatic) next.autoPopulationGrowth.accumulator += step;
    if (recording) next.statisticsSamplingAccumulator += step;
    if (
      automatic &&
      next.autoPopulationGrowth.accumulator >= growthInterval(next) - 1e-8
    ) {
      next.autoPopulationGrowth.accumulator = Math.max(
        0,
        next.autoPopulationGrowth.accumulator - growthInterval(next),
      );
      growPopulation(next, next.autoPopulationGrowth.foodReservePercent);
    }
    settleProgression(next);
    if (
      recording &&
      next.statisticsSamplingAccumulator >=
        balance.statistics.sampleIntervalSeconds - 1e-8
    ) {
      next.statisticsSamplingAccumulator = Math.max(
        0,
        next.statisticsSamplingAccumulator -
          balance.statistics.sampleIntervalSeconds,
      );
      sampleStatistics(next);
    }
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
      if (!growPopulation(next)) return state;
      break;
    }
    case 'autoGrowth': {
      if (!isFeatureUnlocked(next, 'autoPopulationGrowth')) return state;
      if (action.enabled !== undefined && typeof action.enabled !== 'boolean')
        return state;
      if (
        action.foodReservePercent !== undefined &&
        !balance.automaticGrowth.reserveOptions.includes(
          action.foodReservePercent,
        )
      )
        return state;
      if (
        action.enabled !== undefined &&
        action.enabled !== next.autoPopulationGrowth.enabled
      ) {
        next.autoPopulationGrowth.enabled = action.enabled;
        next.autoPopulationGrowth.accumulator = 0;
      }
      if (action.foodReservePercent !== undefined)
        next.autoPopulationGrowth.foodReservePercent =
          action.foodReservePercent;
      break;
    }
    case 'recruit':
    case 'release':
    case 'upgrade':
    case 'dismantle': {
      if (!mutateUnitAction(next, action)) return state;
      if (
        action.type === 'upgrade' &&
        !next.constructedProductionUnits.includes(action.unitId)
      ) {
        next.constructedProductionUnits.push(action.unitId);
        logEvent(
          next,
          `First ${units.find((u) => u.id === action.unitId)!.name} constructed.`,
          'milestone',
        );
      }
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
      next.autoPopulationGrowth.accumulator = Math.min(
        next.autoPopulationGrowth.accumulator,
        growthInterval(next),
      );
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
      logEvent(next, `A new era has begun: ${era.name}.`, 'era');
      break;
    }
    case 'settings':
      next.settings = { ...next.settings, ...action.settings };
      break;
  }
  settleProgression(next);
  return next;
}
