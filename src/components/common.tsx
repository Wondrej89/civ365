import {
  Leaf,
  Boxes,
  Lightbulb,
  Users,
  Sparkles,
  ArrowUpRight,
  type LucideIcon,
} from 'lucide-react';
import { resources } from '../game/content/resources';
import { D, formatNumber } from '../game/utils/numbers';
import { productionPerSecond } from '../game/engine/production';
import { isFeatureUnlocked } from '../game/engine/conditions';
import type { GameState, ResourceCost } from '../game/types';

export const resourceIcon: Record<string, LucideIcon> = {
  food: Leaf,
  materials: Boxes,
  research: Lightbulb,
  civilizationPoints: Sparkles,
};
export function ResourceIcon({ id, size = 18 }: { id: string; size?: number }) {
  const Icon = resourceIcon[id] ?? Boxes;
  return <Icon size={size} strokeWidth={1.65} />;
}
export const visibleResources = (state: GameState) =>
  resources.filter(
    (r) =>
      !r.meta && (r.initiallyVisible || isFeatureUnlocked(state, r.feature)),
  );
export function ResourceLedger({ state }: { state: GameState }) {
  const rates = productionPerSecond(state);
  return (
    <div className="panel ledger">
      <div className="panel-heading">
        <h2>Resource ledger</h2>
        <span className="subtle">Live production</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Resource</th>
            <th className="numeric">Available</th>
            <th className="numeric">Per second</th>
          </tr>
        </thead>
        <tbody>
          {visibleResources(state).map((r) => (
            <tr key={r.id}>
              <td>
                <span className="resource-name">
                  <span className="resource-icon" style={{ color: r.color }}>
                    <ResourceIcon id={r.id} />
                  </span>
                  {r.name}
                </span>
              </td>
              <td className="numeric strong">
                {formatNumber(state.resources[r.id])}
              </td>
              <td className="numeric rate">
                +{formatNumber(rates[r.id])}
                <span className="unit"> /s</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="table-foot">
        <span className="tiny-dot" />
        {isFeatureUnlocked(state, 'jobs')
          ? 'Your workers keep producing while you’re away.'
          : 'Start gathering to write your first row.'}
      </div>
    </div>
  );
}
export function PopulationKpi({ state }: { state: GameState }) {
  return (
    <div className="kpi">
      <div className="kpi-label">
        <Users size={16} /> Population
      </div>
      <div className="kpi-value">
        {formatNumber(state.population, 0)}
        <span className="kpi-unit">
          {state.population.eq(1) ? 'person' : 'people'}
        </span>
      </div>
      <p>Your civilization, one person at a time.</p>
    </div>
  );
}
export function ResourceKpi({
  state,
  id,
  onOpenProduction,
}: {
  state: GameState;
  id: string;
  onOpenProduction?: (resource: string) => void;
}) {
  const r = resources.find((r) => r.id === id)!;
  return (
    <div className="kpi">
      <div className="kpi-label">
        <ResourceIcon id={id} size={16} />
        {r.name}
      </div>
      <div className="kpi-value">
        {formatNumber(state.resources[id])}
        <span className="kpi-rate">
          +{formatNumber(productionPerSecond(state)[id])}/s
        </span>
      </div>
      <p>{r.description}</p>
      {onOpenProduction && (
        <button
          className="production-link"
          onClick={() => onOpenProduction(id)}
        >
          Open {r.productionLabel ?? `${r.name} Production`}
          <ArrowUpRight size={13} />
        </button>
      )}
    </div>
  );
}
export function Costs({
  costs,
  state,
}: {
  costs: ResourceCost[];
  state: GameState;
}) {
  return (
    <div className="costs">
      {costs.map((c) => (
        <span
          key={c.resource}
          className={
            state.resources[c.resource].lt(c.amount) ? 'insufficient' : ''
          }
        >
          <ResourceIcon id={c.resource} size={14} />
          {formatNumber(c.amount)}{' '}
          {resources.find((r) => r.id === c.resource)?.name}
        </span>
      ))}
    </div>
  );
}
export function costReason(costs: ResourceCost[], state: GameState) {
  return costs
    .filter((c) => (state.resources[c.resource] ?? D()).lt(c.amount))
    .map(
      (c) =>
        `${formatNumber(D(c.amount).sub(state.resources[c.resource]))} more ${resources.find((r) => r.id === c.resource)?.name ?? c.resource}`,
    )
    .join(', ');
}
