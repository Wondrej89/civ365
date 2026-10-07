import { Minus, Plus, Users, ArrowUpRight } from 'lucide-react';
import { useGame } from '../hooks/useGame';
import { jobs } from '../game/content/jobs';
import { resources } from '../game/content/resources';
import {
  idleWorkers,
  isJobUnlocked,
  jobProduction,
  populationCost,
} from '../game/engine/production';
import { gameStore } from '../game/store';
import { D, formatNumber } from '../game/utils/numbers';
import { ResourceIcon } from './common';

export function GrowButton() {
  const { state } = useGame(),
    cost = populationCost(state),
    affordable = state.resources.food.gte(cost);
  return (
    <button
      className="button grow-button"
      disabled={!affordable}
      title={
        affordable
          ? 'Welcome one more person'
          : `Need ${formatNumber(cost.sub(state.resources.food))} more Food`
      }
      onClick={() => gameStore.dispatch({ type: 'grow' })}
    >
      <Users size={16} />
      <span>
        Grow Population
        <small>
          {formatNumber(cost)} Food
          {!affordable &&
            ` · need ${formatNumber(cost.sub(state.resources.food))} more`}
        </small>
      </span>
      <Plus size={16} />
    </button>
  );
}
export function Workforce({ compact = false }: { compact?: boolean }) {
  const { state } = useGame(),
    idle = idleWorkers(state);
  return (
    <div className="panel workforce">
      <div className="panel-heading">
        <div>
          <h2>{compact ? 'Your workforce' : 'Workforce allocation'}</h2>
          {!compact && (
            <p>Give everyone a purpose. Changes take effect immediately.</p>
          )}
        </div>
        <span className="idle-badge">
          <span className="tiny-dot" />
          {formatNumber(idle, 0)} idle
        </span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Occupation</th>
            <th className="numeric">Workers</th>
            <th className="numeric">Production</th>
          </tr>
        </thead>
        <tbody>
          {jobs
            .filter((j) => isJobUnlocked(state, j))
            .map((j) => {
              const production = jobProduction(state, j),
                count = state.jobAssignments[j.id];
              return (
                <tr key={j.id}>
                  <td>
                    <span className="resource-name">
                      <span className="job-symbol">
                        <ResourceIcon id={j.production[0].resource} />
                      </span>
                      <span>
                        {j.name}
                        {!compact && <small>{j.description}</small>}
                      </span>
                    </span>
                  </td>
                  <td>
                    <div className="stepper">
                      <button
                        aria-label={`Remove ${j.name}`}
                        title={
                          count.lt(1)
                            ? 'No workers to remove'
                            : `Remove one ${j.name}`
                        }
                        disabled={count.lt(1)}
                        onClick={() =>
                          gameStore.dispatch({
                            type: 'assign',
                            job: j.id,
                            amount: -1,
                          })
                        }
                      >
                        <Minus size={13} />
                      </button>
                      <span>{formatNumber(count, 0)}</span>
                      <button
                        aria-label={`Assign ${j.name}`}
                        title={
                          idle.lt(1)
                            ? 'Grow population or free a worker first'
                            : `Assign one ${j.name}`
                        }
                        disabled={idle.lt(1)}
                        onClick={() =>
                          gameStore.dispatch({
                            type: 'assign',
                            job: j.id,
                            amount: 1,
                          })
                        }
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </td>
                  <td className="numeric">
                    {j.production.map((p) => (
                      <div className="job-output" key={p.resource}>
                        +{formatNumber(production[p.resource] ?? D())}
                        <span className="unit">
                          {' '}
                          {resources.find((r) => r.id === p.resource)?.name}/s
                        </span>
                      </div>
                    ))}
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
      <div className="table-foot">
        <Users size={13} />
        {formatNumber(state.population.sub(idle), 0)} assigned /{' '}
        {formatNumber(state.population, 0)} total
        <span className="foot-right">
          <ArrowUpRight size={13} />
          Always working
        </span>
      </div>
    </div>
  );
}
export function PopulationSheet() {
  const { state } = useGame();
  return (
    <>
      <div className="sheet-heading">
        <div>
          <div className="eyebrow">PEOPLE & PURPOSE</div>
          <h1>A tribe, working together.</h1>
          <p>Small contributions add up to something bigger.</p>
        </div>
        <GrowButton />
      </div>
      <div className="population-banner">
        <Users size={23} />
        <div>
          <strong>{formatNumber(state.population, 0)} people</strong>
          <span>
            {formatNumber(idleWorkers(state), 0)} available for a new role
          </span>
        </div>
      </div>
      <Workforce />
    </>
  );
}
