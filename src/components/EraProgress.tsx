import { Check, Circle } from 'lucide-react';
import { useGame } from '../hooks/useGame';
import { eras } from '../game/content/eras';
import { technologies } from '../game/content/technologies';
import { resources } from '../game/content/resources';
import { evaluateCondition } from '../game/engine/conditions';
import {
  ownedTerritories,
  populationCapacity,
  settlementCount,
} from '../game/engine/settlements';
import { militaryPower } from '../game/engine/military';
import { canAdvance } from '../game/systems/progression';
import { gameStore } from '../game/store';
import { formatNumber } from '../game/utils/numbers';
import type { Condition, GameState } from '../game/types';
function requirementText(condition: Condition, state: GameState): string {
  const progress = (
    name: string,
    current: Parameters<typeof formatNumber>[0],
    target: Parameters<typeof formatNumber>[0],
  ) => `${name} ${formatNumber(current, 0)} / ${formatNumber(target, 0)}`;
  switch (condition.type) {
    case 'technologyOwned':
      return (
        technologies.find((t) => t.id === condition.technologyId)?.name ??
        condition.technologyId
      );
    case 'populationAtLeast':
      return progress('Population', state.population, condition.value);
    case 'territoriesAtLeast':
      return progress('Territories', ownedTerritories(state), condition.value);
    case 'populationCapacityAtLeast':
      return progress(
        'Population Capacity',
        populationCapacity(state),
        condition.value,
      );
    case 'militaryPowerAtLeast':
      return progress('Military Power', militaryPower(state), condition.value);
    case 'settlementsAtLeast':
      return progress(
        condition.minimumTier === 3
          ? 'Cities or higher'
          : 'Settlements or higher',
        settlementCount(state, condition.minimumTier),
        condition.value,
      );
    case 'resourceAtLeast':
      return progress(
        resources.find((r) => r.id === condition.resource)?.name ??
          condition.resource,
        state.resources[condition.resource],
        condition.value,
      );
    case 'statAtLeast':
      return progress(
        condition.stat,
        state.statistics[condition.stat],
        condition.value,
      );
    case 'eraReached':
      return (
        eras.find((e) => e.id === condition.eraId)?.name ?? condition.eraId
      );
    case 'featureUnlocked':
      return condition.featureId;
    case 'achievementOwned':
      return condition.achievementId;
    case 'all':
      return condition.conditions
        .map((c) => requirementText(c, state))
        .join(' + ');
    case 'any':
      return condition.conditions
        .map((c) => requirementText(c, state))
        .join(' or ');
    case 'not':
      return `Without ${requirementText(condition.condition, state)}`;
    case 'always':
      return 'Ready';
    case 'never':
      return 'Future content';
  }
}
export function EraProgress() {
  const { state } = useGame(),
    next = eras.find((e) => e.previous === state.currentEra);
  if (!next || !state.unlockedFeatures.includes('research')) return null;
  return (
    <section className="panel era-progress" aria-label="Next era requirements">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">YOUR NEXT CHAPTER</div>
          <h2>Advance to {next.name}</h2>
        </div>
        <span className="tag">
          {canAdvance(state, next) ? 'Ready' : 'In progress'}
        </span>
      </div>
      <ul>
        {next.requirements.map((condition, i) => {
          const complete = evaluateCondition(condition, state);
          return (
            <li
              key={i}
              className={complete ? 'requirement-met' : 'requirement-pending'}
            >
              {complete ? <Check size={15} /> : <Circle size={15} />}
              <span>{requirementText(condition, state)}</span>
              <span className="requirement-status">
                {complete ? 'Met' : 'Needed'}
              </span>
            </li>
          );
        })}
      </ul>
      <button
        className="button primary"
        disabled={!canAdvance(state, next)}
        onClick={() => gameStore.dispatch({ type: 'advance', id: next.id })}
      >
        Advance to {next.name}
      </button>
      <p className="sheet-note">
        Advance without resetting. First entry earns one Civilization point.
        Grow your settlements and army alongside your discoveries.
      </p>
    </section>
  );
}
