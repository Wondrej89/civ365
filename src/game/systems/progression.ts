import { features } from '../content/features';
import { achievements } from '../content/achievements';
import { eras } from '../content/eras';
import { technologies } from '../content/technologies';
import { units } from '../content/units';
import { skills } from '../content/skills';
import { balance } from '../content/config';
import { evaluateCondition, isFeatureUnlocked } from '../engine/conditions';
import { activeEffects } from '../engine/effects';
import { representedPopulation, isUnitUnlocked } from '../engine/units';
import { sampleStatistics } from './statistics';
import { D } from '../utils/numbers';
import type {
  GameState,
  GameEvent,
  GameEffect,
  ResourceCost,
  TechnologyDefinition,
  SkillDefinition,
  EraDefinition,
} from '../types';
import type { Message } from '../../i18n/types';
import { message as eventMessage, translate } from '../../i18n/core';

export function logEvent(
  state: GameState,
  message: string | Message,
  kind: GameEvent['kind'] = 'milestone',
  notify = true,
) {
  state.eventLog.push({
    id: state.nextEventId++,
    time: Math.round(state.lastSimulationTime),
    message:
      typeof message === 'string'
        ? message
        : translate('en', message.key, message.values),
    translation: typeof message === 'string' ? eventMessage(message) : message,
    kind,
    notify,
  });
  state.eventLog = state.eventLog.slice(-balance.eventLimit);
}
export function grantEffects(state: GameState, effects: GameEffect[]) {
  for (const effect of effects)
    if (effect.type === 'grantResource')
      state.resources[effect.resource] = (
        state.resources[effect.resource] ?? D()
      ).add(effect.value);
}
export function canAfford(state: GameState, costs: ResourceCost[]) {
  return costs.every((c) => (state.resources[c.resource] ?? D()).gte(c.amount));
}
export function payCosts(state: GameState, costs: ResourceCost[]) {
  for (const cost of costs)
    state.resources[cost.resource] = state.resources[cost.resource].sub(
      cost.amount,
    );
}
export type TechnologyStatus =
  'hidden' | 'revealed' | 'available' | 'researched';
export function technologyStatus(
  state: GameState,
  tech: TechnologyDefinition,
): TechnologyStatus {
  if (state.researchedTechnologies.includes(tech.id)) return 'researched';
  if (
    !isFeatureUnlocked(state, 'technologyTree') ||
    !evaluateCondition(tech.visibilityCondition, state)
  )
    return 'hidden';
  const known = (id: string) => state.researchedTechnologies.includes(id);
  const eligible = (t: TechnologyDefinition) =>
    t.prerequisites.every(known) && evaluateCondition(t.unlockCondition, state);
  if (eligible(tech)) return 'available';
  const era = eras.find((e) => e.id === tech.era);
  const reached = state.reachedEras.includes(tech.era);
  const nextEraFrontier =
    era?.previous === state.currentEra && tech.prerequisites.every(known);
  if (!reached && !nextEraFrontier) return 'hidden';
  return tech.prerequisites.every(
    (id) =>
      known(id) ||
      technologies.some((parent) => parent.id === id && eligible(parent)),
  )
    ? 'revealed'
    : 'hidden';
}
export function skillCost(state: GameState, skill: SkillDefinition) {
  return D(skill.cost).mul(
    D(skill.costGrowth).pow(state.purchasedSkills[skill.id] ?? 0),
  );
}
export function skillBlockReason(
  state: GameState,
  skill: SkillDefinition,
): string | null {
  if (!isFeatureUnlocked(state, 'skillTree'))
    return 'Skills have not been discovered.';
  if ((state.purchasedSkills[skill.id] ?? 0) >= skill.maxLevel)
    return 'Fully learned';
  if (
    !skill.prerequisites.every(
      (p) => (state.purchasedSkills[p.id] ?? 0) >= p.level,
    )
  )
    return 'Learn the prerequisite skills first.';
  if (
    skills.some(
      (other) =>
        (state.purchasedSkills[other.id] ?? 0) > 0 &&
        (skill.exclusiveWith.includes(other.id) ||
          other.exclusiveWith.includes(skill.id)),
    )
  )
    return 'Another choice excludes this skill.';
  if (state.resources.civilizationPoints.lt(skillCost(state, skill)))
    return 'Not enough Civilization points.';
  return null;
}
export function canAdvance(state: GameState, era: EraDefinition) {
  return (
    !!era.previous &&
    state.currentEra === era.previous &&
    !state.reachedEras.includes(era.id) &&
    era.requirements.every((c) => evaluateCondition(c, state))
  );
}

/** Evaluate to a fixed point so linked unlocks happen on the same action/tick. Eras remain a player choice. */
export function settleProgression(state: GameState) {
  state.statistics.assignedWorkers = representedPopulation(state);
  state.statistics.maxPopulation = state.statistics.maxPopulation.max(
    state.population,
  );
  for (let pass = 0; pass < features.length + achievements.length + 1; pass++) {
    let changed = false;
    const effects = activeEffects(state);
    for (const f of features)
      if (
        !isFeatureUnlocked(state, f.id) &&
        (evaluateCondition(f.unlockCondition, state) ||
          effects.some((e) => e.type === 'unlockFeature' && e.id === f.id))
      ) {
        state.unlockedFeatures.push(f.id);
        changed = true;
        if (f.notify)
          logEvent(
            state,
            eventMessage('New feature discovered: {0}.', { '0': f.name }),
          );
      }
    for (const a of achievements)
      if (
        !state.achievements.includes(a.id) &&
        evaluateCondition(a.condition, state)
      ) {
        state.achievements.push(a.id);
        state.statistics.achievementCount = D(state.achievements.length);
        grantEffects(state, a.effects);
        changed = true;
        logEvent(
          state,
          eventMessage('Achievement unlocked: {0}.', { '0': a.name }),
          'achievement',
        );
      }
    if (!changed) break;
  }
  for (const era of eras)
    if (canAdvance(state, era) && !state.announcedEras.includes(era.id)) {
      state.announcedEras.push(era.id);
      logEvent(
        state,
        eventMessage('New era available: {0}.', { '0': era.name }),
        'era',
      );
    }
  for (const unit of units)
    if (
      !state.unlockedProductionUnits.includes(unit.id) &&
      isUnitUnlocked(state, unit)
    ) {
      state.unlockedProductionUnits.push(unit.id);
      logEvent(
        state,
        eventMessage('New production unit unlocked: {0}.', { '0': unit.name }),
        'milestone',
        unit.tier > 1,
      );
    }
  sampleStatistics(state, true);
}
export const technologyById = (id: string) =>
  technologies.find((t) => t.id === id);
