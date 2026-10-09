import { useI18n } from '../i18n/LocaleContext';
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
import { netProductionPerSecond as productionPerSecond } from '../game/engine/economy';
import { isFeatureUnlocked } from '../game/engine/conditions';
import type { GameState, ResourceCost } from '../game/types';
import { populationCapacity } from '../game/engine/settlements';
import { translate } from '../i18n/core';

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
  const { t: tr, formatNumber } = useI18n();

  const rates = productionPerSecond(state);
  return (
    <div className="panel ledger">
      <div className="panel-heading">
        <h2>{tr('Resource ledger')}</h2>
        <span className="subtle">{tr('Net production after army upkeep')}</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>{tr('Resource')}</th>
            <th className="numeric">{tr('Available')}</th>
            <th className="numeric">{tr('Per second')}</th>
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
                  {tr(r.name)}
                </span>
              </td>
              <td className="numeric strong">
                {formatNumber(state.resources[r.id])}
              </td>
              <td
                className={`numeric rate${rates[r.id].lt(0) ? ' negative-rate' : ''}`}
              >
                {rates[r.id].gte(0) ? '+' : ''}
                {formatNumber(rates[r.id])}
                <span className="unit"> {tr('/s')}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="table-foot">
        <span className="tiny-dot" />
        {isFeatureUnlocked(state, 'jobs')
          ? tr('Your workers keep producing while you’re away.')
          : tr('Start gathering to write your first row.')}
      </div>
    </div>
  );
}
export function PopulationKpi({ state }: { state: GameState }) {
  const { t: tr, formatNumber } = useI18n();

  return (
    <div className="kpi">
      <div className="kpi-label">
        <Users size={16} /> {tr('Population')}
      </div>
      <div className="kpi-value">
        {formatNumber(state.population, 0)}
        <span className="population-cap">
          {' '}
          / {formatNumber(populationCapacity(state), 0)}
        </span>
        <span className="kpi-unit">
          {state.population.eq(1) ? tr('person') : tr('people')}
        </span>
      </div>
      <p>{tr('People / Population Capacity')}</p>
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
  const { t: tr, formatNumber } = useI18n();

  const r = resources.find((r) => r.id === id)!;
  return (
    <div className="kpi">
      <div className="kpi-label">
        <ResourceIcon id={id} size={16} />
        {tr(r.name)}
      </div>
      <div className="kpi-value">
        {formatNumber(state.resources[id])}
        <span className="kpi-rate">
          {productionPerSecond(state)[id].gte(0) ? '+' : ''}
          {formatNumber(productionPerSecond(state)[id])}
          {tr('/s')}
        </span>
      </div>
      <p>{tr(r.description)}</p>
      {onOpenProduction && (
        <button
          className="production-link"
          onClick={() => onOpenProduction(id)}
        >
          {tr('Open')}{' '}
          {tr(r.productionLabel ?? '') ||
            tr('{0} Production', { '0': tr(r.name) })}
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
  const { formatNumber, t: tr } = useI18n();

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
          {tr(resources.find((r) => r.id === c.resource)?.name ?? '')}
        </span>
      ))}
    </div>
  );
}
export function costReason(costs: ResourceCost[], state: GameState) {
  return costs
    .filter((c) => (state.resources[c.resource] ?? D()).lt(c.amount))
    .map((c) =>
      translate(state.settings.language, '{amount} more {resource}', {
        amount: formatNumber(
          D(c.amount).sub(state.resources[c.resource]),
          2,
          state.settings.language,
        ),
        resource: translate(
          state.settings.language,
          resources.find((r) => r.id === c.resource)?.name ?? c.resource,
        ),
      }),
    )
    .join(', ');
}
