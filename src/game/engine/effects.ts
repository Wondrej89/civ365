import { technologies } from '../content/technologies';
import { skills } from '../content/skills';
import { achievements } from '../content/achievements';
import { eras } from '../content/eras';
import type { GameEffect, GameState } from '../types';
import { D } from '../utils/numbers';

export function activeEffects(state: GameState): GameEffect[] {
  return [
    ...technologies
      .filter((t) => state.researchedTechnologies.includes(t.id))
      .flatMap((t) => t.effects),
    ...skills.flatMap((s) =>
      Array.from(
        { length: state.purchasedSkills[s.id] ?? 0 },
        () => s.effects,
      ).flat(),
    ),
    ...achievements
      .filter((a) => state.achievements.includes(a.id))
      .flatMap((a) => a.effects),
    ...eras
      .filter((e) => state.reachedEras.includes(e.id))
      .flatMap((e) => [
        ...e.effects,
        ...e.onEnterEffects.filter((effect) => effect.type !== 'grantResource'),
      ]),
  ];
}
export function resourceMultiplier(effects: GameEffect[], resource: string) {
  return effects.reduce(
    (v, e) =>
      e.type === 'resourceMultiplier' && e.resource === resource
        ? v.mul(e.value)
        : v,
    D(1),
  );
}
export function productionModifier(effects: GameEffect[], resource: string) {
  return effects.reduce(
    (v, e) =>
      e.type === 'productionMultiplier' && e.resource === resource
        ? v.mul(e.value)
        : v,
    D(1),
  );
}
export function populationModifier(effects: GameEffect[]) {
  return effects.reduce(
    (v, e) => (e.type === 'populationCostMultiplier' ? v.mul(e.value) : v),
    D(1),
  );
}
