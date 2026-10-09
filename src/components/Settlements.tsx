import { useI18n } from '../i18n/LocaleContext';
import { useGame } from '../hooks/useGame';
import { gameStore } from '../game/store';
import { settlements } from '../game/content/settlements';
import { evaluateCondition } from '../game/engine/conditions';
import {
  ownedTerritories,
  settlementSlots,
  settlementCount,
  availableSlots,
  populationCapacity,
  capacityPerSettlement,
  maxSettlementAction,
  settlementQuote,
} from '../game/engine/settlements';

import { Costs, costReason } from './common';
import { useWorkbookNavigation } from './navigation';
export function SettlementsSheet() {
  const { t: tr, formatNumber } = useI18n();

  const { state } = useGame(),
    { openSheet } = useWorkbookNavigation();
  return (
    <>
      <div className="sheet-heading">
        <div>
          <div className="eyebrow">{tr('HOMES · LAND · ROOM TO GROW')}</div>
          <h1>{tr('Give your people a place.')}</h1>
          <p>
            {tr(
              'Territory provides slots. Settlements provide population capacity.',
            )}
          </p>
        </div>
      </div>
      <div className="realm-kpis">
        {[
          ['Owned territories', ownedTerritories(state)],
          ['Settlement slots', settlementSlots(state)],
          ['Used slots', settlementCount(state)],
          ['Available slots', availableSlots(state)],
        ].map(([name, value]) => (
          <div className="panel" key={String(name)}>
            <span className="field-label">{tr(String(name))}</span>
            <strong>{formatNumber(value, 0)}</strong>
          </div>
        ))}
      </div>
      <section className="panel capacity-summary">
        <div>
          <span className="field-label">{tr('Total Population Capacity')}</span>
          <strong>{formatNumber(populationCapacity(state), 0)}</strong>
          <p>
            {formatNumber(state.population, 0)}{' '}
            {tr('people live in your civilization.')}
          </p>
        </div>
        <button className="button" onClick={() => openSheet('population')}>
          {tr('Open Population')}
        </button>
      </section>
      <div className="realm-cards">
        {settlements
          .filter(
            (s) =>
              state.settlements[s.id].gt(0) ||
              evaluateCondition(s.unlockCondition, state),
          )
          .map((s) => {
            const maximum = maxSettlementAction(state, s),
              buildMaximum = maxSettlementAction(state, s, true),
              costs = settlementQuote(state, s),
              buildCosts = settlementQuote(state, s, 1, true);
            const source = settlements.find(
              (other) => other.id === s.upgradeFrom,
            );
            return (
              <article
                className="panel settlement-card"
                data-settlement={s.id}
                key={s.id}
              >
                <div className="panel-heading">
                  <h2>{tr(s.name)}</h2>
                  <span className="tag">
                    {s.tier === 0
                      ? tr('Founding home')
                      : tr('Tier {0}', { '0': s.tier })}
                  </span>
                </div>
                <p>{tr(s.description)}</p>
                <dl className="growth-details">
                  <div>
                    <dt>{tr('Owned')}</dt>
                    <dd>{formatNumber(state.settlements[s.id], 0)}</dd>
                  </div>
                  <div>
                    <dt>{tr('Capacity each')}</dt>
                    <dd>{formatNumber(capacityPerSettlement(state, s))}</dd>
                  </div>
                  <div>
                    <dt>{tr('Total capacity')}</dt>
                    <dd>
                      {formatNumber(
                        capacityPerSettlement(state, s).mul(
                          state.settlements[s.id],
                        ),
                      )}
                    </dd>
                  </div>
                </dl>
                {s.tier === 1 && (
                  <>
                    <h3>{tr('Build on an available slot')}</h3>
                    <Costs costs={buildCosts} state={state} />
                    <div className="realm-actions">
                      {[1, 'max'].map((n) => (
                        <button
                          className="button"
                          key={n}
                          aria-label={tr('Build {0} {1}', {
                            '0': n === 'max' ? tr('Max') : n,
                            '1': tr(s.name),
                          })}
                          disabled={buildMaximum.lt(1)}
                          title={
                            availableSlots(state).lte(0)
                              ? tr('No available territory slots.')
                              : costReason(buildCosts, state) ||
                                tr('Uses one slot per settlement.')
                          }
                          onClick={() =>
                            gameStore.dispatch({
                              type: 'buildSettlement',
                              id: s.id,
                              amount: n === 'max' ? 'max' : 1,
                            })
                          }
                        >
                          {tr('Build')} {n === 'max' ? tr('Max') : '+1'}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {source && (
                  <>
                    <h3>
                      {tr('Upgrade from')} {tr(source.name)}
                    </h3>
                    <Costs costs={costs} state={state} />
                    <div className="realm-actions">
                      {[1, 'max'].map((n) => (
                        <button
                          className="button primary"
                          key={n}
                          aria-label={tr('Upgrade {0} {1}', {
                            '0': n === 'max' ? tr('Max') : n,
                            '1': tr(s.name),
                          })}
                          disabled={maximum.lt(1)}
                          title={
                            state.settlements[source.id].lt(1)
                              ? tr('Requires {0}.', { '0': tr(source.name) })
                              : costReason(costs, state) ||
                                tr('Keeps the same territory slot.')
                          }
                          onClick={() =>
                            gameStore.dispatch({
                              type: 'upgradeSettlement',
                              id: s.id,
                              amount: n === 'max' ? 'max' : 1,
                            })
                          }
                        >
                          {tr('Upgrade')} {n === 'max' ? tr('Max') : '+1'} →{' '}
                          {tr(s.name)}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </article>
            );
          })}
      </div>
      <p className="sheet-note">
        {tr(
          'The founding camp holds 20 people and already uses one slot. Establish a Settlement here, then research Village Organization for Towns. Upgrades keep their slot; newly built homes need more land.',
        )}
      </p>
      {state.unlockedFeatures.includes('territory') && (
        <button className="button" onClick={() => openSheet('territory')}>
          {tr('Acquire more territory')}
        </button>
      )}
    </>
  );
}
