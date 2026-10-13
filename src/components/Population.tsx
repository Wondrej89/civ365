import { allocationDiscoveryId } from '../game/systems/discoveries';
import { Discovery } from './Discovery';
import { useI18n } from '../i18n/LocaleContext';
import { useGame } from '../hooks/useGame';
import { gameStore } from '../game/store';
import { balance } from '../game/content/config';
import { isFeatureUnlocked } from '../game/engine/conditions';
import { idlePopulation, representedPopulation } from '../game/engine/units';
import {
  growthInterval,
  growthModifiers,
  nextGrowthSeconds,
  populationGrowthAmount,
  populationGrowthBreakdown,
  growthCost,
} from '../game/engine/population';
import { populationDistribution } from '../game/systems/statistics';

import { visibleResources } from './common';
import { GrowButton } from './Workforce';
import {
  capacityReached,
  populationCapacity,
} from '../game/engine/settlements';
import { useWorkbookNavigation } from './navigation';
export function PopulationSheet() {
  const { t: tr, formatNumber } = useI18n();

  const { state } = useGame(),
    automation = isFeatureUnlocked(state, 'autoPopulationGrowth'),
    growth = populationGrowthBreakdown(state);
  const { openSheet } = useWorkbookNavigation();
  return (
    <>
      <div className="sheet-heading">
        <div>
          <div className="eyebrow">{tr('PEOPLE MAKE A CIVILIZATION')}</div>
          <h1>{tr('A growing community.')}</h1>
          <p>{tr('Grow your community and choose how your people work.')}</p>
        </div>
      </div>
      <div className="population-kpis">
        {[
          ['Total Population', state.population],
          ['Population Capacity', populationCapacity(state)],
          ['Idle', idlePopulation(state)],
          ['Assigned', representedPopulation(state)],
        ].map(([name, value]) => (
          <div className="panel" key={String(name)}>
            <span className="field-label">{tr(String(name))}</span>
            <strong>{formatNumber(value, 0)}</strong>
          </div>
        ))}
      </div>
      {capacityReached(state) && (
        <Discovery
          as="section"
          discoveryId={'population:capacity'}
          className="panel capacity-notice"
        >
          <strong>{tr('Population capacity reached.')}</strong>
          <p>{tr('Expand your settlements or acquire more territory.')}</p>
          <button
            className="button"
            onClick={() =>
              openSheet(
                isFeatureUnlocked(state, 'settlements')
                  ? 'settlements'
                  : 'research',
              )
            }
          >
            {isFeatureUnlocked(state, 'settlements')
              ? tr('Open Settlements')
              : tr('Research Agriculture and Settled Life')}
          </button>
        </Discovery>
      )}
      <Discovery
        as="section"
        discoveryId="population:growth-base"
        className="panel population-panel growth-base"
      >
        <h2>{tr('Growth from your cities')}</h2>
        <dl className="growth-details">
          <div>
            <dt>{tr('Cities + Metropolises')}</dt>
            <dd>{formatNumber(growth.cities, 0)}</dd>
          </div>
          <div>
            <dt>{tr('Base people per City')}</dt>
            <dd>{formatNumber(growth.peoplePerCity, 1)}</dd>
          </div>
          <div>
            <dt>{tr('Base population per step')}</dt>
            <dd>{formatNumber(growth.base, 0)}</dd>
          </div>
          <div>
            <dt>{tr('Growth multiplier')}</dt>
            <dd>×{formatNumber(growth.multiplier, 2)}</dd>
          </div>
        </dl>
        <strong>
          {tr('{base} base people ×{multiplier} = {amount} people per step', {
            base: formatNumber(growth.base, 0),
            multiplier: formatNumber(growth.multiplier, 2),
            amount: formatNumber(growth.amount, 0),
          })}
        </strong>
        <p className="sheet-note">
          {tr(
            'Before your first City, base growth is one person. Cities and Metropolises contribute equally. The whole growth group still costs one person’s current Food price.',
          )}
        </p>
      </Discovery>
      <div className="population-panels">
        <Discovery
          as="section"
          discoveryId={'population:manual'}
          className="panel population-panel"
        >
          <h2>{tr('Manual growth')}</h2>
          <p>{tr('Food for one growth step')}</p>
          <strong className="growth-cost">
            {formatNumber(growthCost(state))} {tr('Food')}
          </strong>
          <GrowButton />
          <p className="sheet-note">
            {tr(
              'New people join Idle Population. Recruitment stays in Workforce.',
            )}
          </p>
        </Discovery>
        {automation && (
          <Discovery
            as="section"
            discoveryId={'population:automation'}
            className="panel population-panel"
            aria-label={tr('Automatic growth')}
          >
            <div className="panel-heading">
              <h2>{tr('Automatic growth')}</h2>
              <span className="tag green-tag">{tr('Unlocked')}</span>
            </div>
            <label className="toggle-row">
              <span>
                <strong>{tr('Auto Growth')}</strong>
                <small>
                  {state.autoPopulationGrowth.enabled ? tr('ON') : tr('OFF')}
                </small>
              </span>
              <input
                aria-label={tr('Auto Growth')}
                type="checkbox"
                checked={state.autoPopulationGrowth.enabled}
                onChange={(e) =>
                  gameStore.dispatch({
                    type: 'autoGrowth',
                    enabled: e.target.checked,
                  })
                }
              />
              <span className="toggle" />
            </label>
            <dl className="growth-details">
              <div>
                <dt>{tr('People per growth step')}</dt>
                <dd>+{formatNumber(populationGrowthAmount(state), 0)}</dd>
              </div>
              <div>
                <dt>{tr('Next growth attempt')}</dt>
                <dd>
                  {state.autoPopulationGrowth.enabled
                    ? tr('{0} s', {
                        '0': formatNumber(nextGrowthSeconds(state), 1),
                      })
                    : tr('Paused')}
                </dd>
              </div>
              <div>
                <dt>{tr('Growth interval')}</dt>
                <dd>
                  {formatNumber(growthInterval(state), 1)} {tr('s')}
                </dd>
              </div>
              <div>
                <dt>
                  <label htmlFor="food-reserve">{tr('Food reserve')}</label>
                </dt>
                <dd>
                  <select
                    id="food-reserve"
                    value={state.autoPopulationGrowth.foodReservePercent}
                    onChange={(e) =>
                      gameStore.dispatch({
                        type: 'autoGrowth',
                        foodReservePercent: Number(e.target.value),
                      })
                    }
                  >
                    {balance.automaticGrowth.reserveOptions.map((value) => (
                      <option key={value} value={value}>
                        {value}%
                      </option>
                    ))}
                  </select>
                </dd>
              </div>
            </dl>
            <p className="sheet-note">
              {tr(
                'Each step buys the whole group for the current Food price of one person and protects your Food reserve. Capacity can shorten the group; insufficient Food waits for the next attempt. The same rules apply while you are away.',
              )}
            </p>
            {growthModifiers(state).length > 0 && (
              <div className="growth-modifiers">
                <h3>{tr('Growth modifiers')}</h3>
                {growthModifiers(state).map((m) => (
                  <Discovery
                    discoveryId={`population:growth:${m.id}:${m.type}`}
                    key={m.id + m.type}
                  >
                    <span>{tr(m.name)}</span>
                    <strong>
                      {m.type === 'populationGrowthIntervalMultiplier'
                        ? tr('−{percent}% interval', {
                            percent: formatNumber(
                              m.value.neg().add(1).mul(100),
                              1,
                            ),
                          })
                        : m.type === 'populationGrowthPerCity'
                          ? tr('+{amount} base people per City/Metropolis', {
                              amount: formatNumber(m.value, 0),
                            })
                          : tr('×{amount} people', {
                              amount: formatNumber(m.value, 1),
                            })}
                    </strong>
                  </Discovery>
                ))}
              </div>
            )}
          </Discovery>
        )}
      </div>
      <Discovery
        as="section"
        discoveryId={allocationDiscoveryId(state)}
        className="panel population-panel"
      >
        <h2>{tr('Population allocation')}</h2>
        <div className="allocation-list">
          {populationDistribution(state)
            .filter(
              (group) =>
                group.id === 'idle' ||
                (group.id === 'military' &&
                  isFeatureUnlocked(state, 'military')) ||
                visibleResources(state).some((r) => r.id === group.id),
            )
            .map((group) => (
              <Discovery
                discoveryId={`population:allocation-group:${group.id}`}
                key={group.id}
              >
                <span>
                  <i style={{ background: group.color }} />
                  {tr(group.name)}
                </span>
                <strong>{formatNumber(group.value, 0)}</strong>
              </Discovery>
            ))}
        </div>
        <p className="sheet-note">
          {tr(
            'Counts include everyone represented by higher-tier production units.',
          )}
        </p>
      </Discovery>
    </>
  );
}
