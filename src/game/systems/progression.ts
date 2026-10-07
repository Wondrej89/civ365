import { features } from '../content/features';
import { achievements } from '../content/achievements';
import { eras } from '../content/eras';
import { technologies } from '../content/technologies';
import { skills } from '../content/skills';
import { balance } from '../content/config';
import { evaluateCondition, isFeatureUnlocked } from '../engine/conditions';
import { activeEffects } from '../engine/effects';
import { representedPopulation } from '../engine/units';
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

export function logEvent(
  state: GameState,
  message: string,
  kind: GameEvent['kind'] = 'milestone',
  notify = true,
) {
  state.eventLog.push({
    id: state.nextEventId++,
    time: state.lastSimulationTime,
    message,
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
  'hidden' | 'revealed' | 'available' | 'purchased';
export function technologyStatus(
  state: GameState,
  tech: TechnologyDefinition,
): TechnologyStatus {
  if (state.researchedTechnologies.includes(tech.id)) return 'purchased';
  if (
    !isFeatureUnlocked(state, 'technologyTree') ||
    !evaluateCondition(tech.visibilityCondition, state)
  )
    return 'hidden';
  return tech.prerequisites.every((id) =>
    state.researchedTechnologies.includes(id),
  ) && evaluateCondition(tech.unlockCondition, state)
    ? 'available'
    : 'revealed';
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
        if (f.notify) logEvent(state, `New feature discovered: ${f.name}.`);
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
        logEvent(state, `Achievement unlocked: ${a.name}.`, 'achievement');
      }
    if (!changed) break;
  }
  for (const era of eras)
    if (canAdvance(state, era) && !state.announcedEras.includes(era.id)) {
      state.announcedEras.push(era.id);
      logEvent(state, `New era available: ${era.name}.`, 'era');
    }
}
export const technologyById = (id: string) =>
  technologies.find((t) => t.id === id);
