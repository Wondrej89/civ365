import { useI18n } from '../i18n/LocaleContext';
import { Sprout, X, ArrowRight, Clock, Wrench } from 'lucide-react';
import { useGame } from '../hooks/useGame';
import { gameStore } from '../game/store';
import { resources } from '../game/content/resources';
import { isFeatureUnlocked } from '../game/engine/conditions';

import { ResourceIcon } from './common';
import { balance } from '../game/content/config';
export function OfflineModal() {
  const { t: tr, formatDuration, formatNumber } = useI18n();

  const { state, report } = useGame();
  if (!report) return null;
  return (
    <div className="modal-backdrop">
      <section
        className="modal offline-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="offline-title"
      >
        <button
          className="modal-close"
          aria-label={tr('Dismiss offline report')}
          onClick={gameStore.dismissOffline}
        >
          <X size={19} />
        </button>
        <div className="modal-symbol">
          <Sprout size={29} />
        </div>
        <div className="eyebrow">{tr('YOUR PEOPLE KEPT GOING')}</div>
        <h2 id="offline-title">{tr('Welcome back.')}</h2>
        <p>
          {tr('Away for')} <strong>{formatDuration(report.awaySeconds)}</strong>
          {tr('. Here’s what your civilization produced.')}
        </p>
        <div className="offline-resources">
          {resources
            .filter(
              (r) =>
                !r.meta &&
                (r.initiallyVisible || isFeatureUnlocked(state, r.feature)),
            )
            .map((r) => (
              <div key={r.id}>
                <span>
                  <ResourceIcon id={r.id} />
                  {tr(r.name)}
                </span>
                <strong>+{formatNumber(report.produced[r.id])}</strong>
              </div>
            ))}
        </div>
        {Object.entries(report.militaryUpkeepSpent)
          .filter(([, amount]) => amount.gt(0))
          .map(([id, amount]) => (
            <p className="offline-growth" key={id}>
              {tr('Army upkeep consumed {amount} {resource}.', {
                amount: formatNumber(amount),
                resource: tr(resources.find((r) => r.id === id)!.name),
              })}
            </p>
          ))}
        {report.populationCreated.gt(0) && (
          <p className="offline-growth">
            {tr('Your community grew by')}{' '}
            <strong>
              {formatNumber(report.populationCreated, 0)} {tr('people')}
            </strong>
            {tr(', spending')} {formatNumber(report.foodSpentOnGrowth)}{' '}
            {tr('Food.')}
          </p>
        )}
        {report.territoriesConquered.gt(0) && (
          <p className="offline-growth">
            {tr('Campaigns acquired')}{' '}
            {formatNumber(report.territoriesConquered, 0)}{' '}
            {tr('new territory.')}
          </p>
        )}
        {report.populationLost.gt(0) && (
          <p className="offline-growth">
            {tr('Campaign casualties:')}{' '}
            {formatNumber(report.populationLost, 0)} {tr('people.')}
          </p>
        )}
        {report.awaySeconds > report.simulatedSeconds && (
          <p className="offline-cap">
            <Clock size={14} />
            {tr('Production capped at')}{' '}
            {formatDuration(report.simulatedSeconds)}.
          </p>
        )}
        <button
          className="button primary"
          autoFocus
          onClick={gameStore.dismissOffline}
        >
          {tr('Back to my civilization')}
          <ArrowRight size={17} />
        </button>
      </section>
    </div>
  );
}
export function Toasts() {
  const { formatEvent } = useI18n();

  const { state } = useGame();
  if (!state.settings.notifications) return null;
  const events = state.eventLog
    .filter((e) => e.notify && state.lastSimulationTime - e.time < 5500)
    .slice(-3);
  return (
    <div className="toast-stack" aria-live="polite">
      {events.map((e) => (
        <div className="toast" key={e.id}>
          <span className="toast-icon">
            <Sprout size={17} />
          </span>
          <span>{formatEvent(e)}</span>
        </div>
      ))}
    </div>
  );
}
export function DebugPanel() {
  const { t: tr } = useI18n();

  const { speed, state } = useGame();
  if (!import.meta.env.DEV) return null;
  return (
    <details className="debug-panel">
      <summary>
        <Wrench size={13} />
        {tr('Developer tools')}
      </summary>
      <div>
        {(
          [
            'food',
            'materials',
            'research',
            'population',
            'speed',
            'technologies',
            'territory',
            'settlement',
            'capacity',
            'military',
            'campaign',
          ] as const
        ).map((action) => (
          <button
            key={action}
            disabled={
              (action === 'settlement' &&
                !state.unlockedFeatures.includes('settlements')) ||
              (action === 'military' &&
                (!state.unlockedFeatures.includes('military') ||
                  !!state.activeCampaign)) ||
              (action === 'campaign' && !state.activeCampaign)
            }
            onClick={() => gameStore.debug(action)}
          >
            {action === 'population'
              ? tr('+10 Population')
              : action === 'speed'
                ? tr('{0} simulation speed', {
                    '0':
                      speed === 1
                        ? '×10'
                        : speed === 10
                          ? '×100'
                          : speed === 100
                            ? '×1000'
                            : '×1',
                  })
                : action === 'technologies'
                  ? tr('Unlock era techs')
                  : action === 'territory'
                    ? tr('+ Territory')
                    : action === 'settlement'
                      ? tr('+ Settlement')
                      : action === 'capacity'
                        ? tr('+100 Population Capacity')
                        : action === 'military'
                          ? tr('+ Military Units')
                          : action === 'campaign'
                            ? tr('Complete Campaign')
                            : tr('+100 {0}{1}', {
                                '0': action[0].toUpperCase(),
                                '1': action.slice(1),
                              })}
          </button>
        ))}
        <button
          onClick={() => {
            if (window.confirm(tr('Reset the current save?')))
              gameStore.reset();
          }}
        >
          {tr('Reset save')}
        </button>
      </div>
      <p className="debug-scaling">
        {tr('Scaling: Research ×')}
        {balance.technologyCosts[state.currentEra]?.research ?? 1}{' '}
        {tr('· Materials ×')}
        {balance.technologyCosts[state.currentEra]?.materials ?? 1}{' '}
        {tr('· settlement costs ×')}
        {balance.settlements.costGrowth} {tr('per new home · army costs ×')}
        {balance.military.recruitCostGrowth} {tr('per soldier · defense')}{' '}
        {balance.conquest.baseDefense} × {balance.conquest.defenseGrowth}
        {tr('^conquests · growth ×')}
        {balance.populationGrowth.multiplier} / ×
        {balance.populationGrowth.laterMultiplier} / ×
        {balance.populationGrowth.lateMultiplier} {tr('· City upgrades ×')}
        {balance.settlements.upgradeCostGrowth.city} {tr('· counter strength')}
        {balance.military.counterStrength}
      </p>
    </details>
  );
}
