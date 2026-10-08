import { useGame } from '../hooks/useGame';
import { gameStore } from '../game/store';
import { balance } from '../game/content/config';
import { isFeatureUnlocked } from '../game/engine/conditions';
import { idlePopulation, representedPopulation } from '../game/engine/units';
import {
  growthInterval,
  growthModifiers,
  nextGrowthSeconds,
} from '../game/engine/population';
import { populationCost } from '../game/engine/production';
import { populationDistribution } from '../game/systems/statistics';
import { formatNumber } from '../game/utils/numbers';
import { visibleResources } from './common';
import { GrowButton } from './Workforce';
import {
  capacityReached,
  populationCapacity,
} from '../game/engine/settlements';
import { useWorkbookNavigation } from './navigation';
export function PopulationSheet() {
  const { state } = useGame(),
    automation = isFeatureUnlocked(state, 'autoPopulationGrowth');
  const { openSheet } = useWorkbookNavigation();
  return (
    <>
      <div className="sheet-heading">
        <div>
          <div className="eyebrow">PEOPLE MAKE A CIVILIZATION</div>
          <h1>Room for one more.</h1>
          <p>Grow your community and choose how your people work.</p>
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
            <span className="field-label">{String(name)}</span>
            <strong>{formatNumber(value, 0)}</strong>
          </div>
        ))}
      </div>
      {capacityReached(state) && (
        <section className="panel capacity-notice">
          <strong>Population capacity reached.</strong>
          <p>Expand your settlements or acquire more territory.</p>
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
              ? 'Open Settlements'
              : 'Research Agriculture and Settled Life'}
          </button>
        </section>
      )}
      <div className="population-panels">
        <section className="panel population-panel">
          <h2>Manual growth</h2>
          <p>Next Population Cost</p>
          <strong className="growth-cost">
            {formatNumber(populationCost(state))} Food
          </strong>
          <GrowButton />
          <p className="sheet-note">
            New people join Idle Population. Recruitment stays in Workforce.
          </p>
        </section>
        {automation && (
          <section
            className="panel population-panel"
            aria-label="Automatic growth"
          >
            <div className="panel-heading">
              <h2>Automatic growth</h2>
              <span className="tag green-tag">Unlocked</span>
            </div>
            <label className="toggle-row">
              <span>
                <strong>Auto Growth</strong>
                <small>
                  {state.autoPopulationGrowth.enabled ? 'ON' : 'OFF'}
                </small>
              </span>
              <input
                aria-label="Auto Growth"
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
                <dt>Next growth attempt</dt>
                <dd>
                  {state.autoPopulationGrowth.enabled
                    ? `${formatNumber(nextGrowthSeconds(state), 1)} s`
                    : 'Paused'}
                </dd>
              </div>
              <div>
                <dt>Growth interval</dt>
                <dd>{formatNumber(growthInterval(state), 1)} s</dd>
              </div>
              <div>
                <dt>
                  <label htmlFor="food-reserve">Food reserve</label>
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
              Each attempt protects the selected share of your current Food. If
              Food is insufficient, growth waits for the next interval. The same
              rules apply while you are away.
            </p>
            {growthModifiers(state).length > 0 && (
              <div className="growth-modifiers">
                <h3>Interval modifiers</h3>
                {growthModifiers(state).map((m) => (
                  <div key={m.name}>
                    <span>{m.name}</span>
                    <strong>
                      −{formatNumber(m.value.neg().add(1).mul(100), 1)}%
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
      <section className="panel population-panel">
        <h2>Population allocation</h2>
        <div className="allocation-list">
          {populationDistribution(state)
            .filter(
              (group) =>
                group.id === 'idle' ||
                group.id === 'military' ||
                visibleResources(state).some((r) => r.id === group.id),
            )
            .map((group) => (
              <div key={group.id}>
                <span>
                  <i style={{ background: group.color }} />
                  {group.name}
                </span>
                <strong>{formatNumber(group.value, 0)}</strong>
              </div>
            ))}
        </div>
        <p className="sheet-note">
          Counts include everyone represented by higher-tier production units.
        </p>
      </section>
    </>
  );
}
