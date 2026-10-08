import type { Condition, GameState } from '../types';
import { D } from '../utils/numbers';
import {
  ownedTerritories,
  populationCapacity,
  settlementCount,
} from './settlements';
import { militaryPower } from './military';
export const isFeatureUnlocked = (state: GameState, id: string) =>
  state.unlockedFeatures.includes(id);
export function evaluateCondition(
  condition: Condition,
  state: GameState,
): boolean {
  switch (condition.type) {
    case 'always':
      return true;
    case 'never':
      return false;
    case 'resourceAtLeast':
      return (state.resources[condition.resource] ?? D()).gte(condition.value);
    case 'populationAtLeast':
      return state.population.gte(condition.value);
    case 'territoriesAtLeast':
      return ownedTerritories(state).gte(condition.value);
    case 'populationCapacityAtLeast':
      return populationCapacity(state).gte(condition.value);
    case 'settlementsAtLeast':
      return settlementCount(state, condition.minimumTier).gte(condition.value);
    case 'militaryPowerAtLeast':
      return militaryPower(state).gte(condition.value);
    case 'technologyOwned':
      return state.researchedTechnologies.includes(condition.technologyId);
    case 'achievementOwned':
      return state.achievements.includes(condition.achievementId);
    case 'eraReached':
      return state.reachedEras.includes(condition.eraId);
    case 'featureUnlocked':
      return isFeatureUnlocked(state, condition.featureId);
    case 'statAtLeast':
      return (state.statistics[condition.stat] ?? D()).gte(condition.value);
    case 'all':
      return condition.conditions.every((c) => evaluateCondition(c, state));
    case 'any':
      return condition.conditions.some((c) => evaluateCondition(c, state));
    case 'not':
      return !evaluateCondition(condition.condition, state);
  }
}
