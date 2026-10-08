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
import { formatNumber } from '../game/utils/numbers';
import { Costs, costReason } from './common';
import { useWorkbookNavigation } from './navigation';
export function SettlementsSheet() {
  const { state } = useGame(),
    { openSheet } = useWorkbookNavigation();
  return (
    <>
      <div className="sheet-heading">
        <div>
          <div className="eyebrow">HOMES · LAND · ROOM TO GROW</div>
          <h1>Give your people a place.</h1>
          <p>
            Territory provides slots. Settlements provide population capacity.
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
            <span className="field-label">{String(name)}</span>
            <strong>{formatNumber(value, 0)}</strong>
          </div>
        ))}
      </div>
      <section className="panel capacity-summary">
        <div>
          <span className="field-label">Total Population Capacity</span>
          <strong>{formatNumber(populationCapacity(state), 0)}</strong>
          <p>
            {formatNumber(state.population, 0)} people live in your
            civilization.
          </p>
        </div>
        <button className="button" onClick={() => openSheet('population')}>
          Open Population
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
                  <h2>{s.name}</h2>
                  <span className="tag">
                    {s.tier === 0 ? 'Founding home' : `Tier ${s.tier}`}
                  </span>
                </div>
                <p>{s.description}</p>
                <dl className="growth-details">
                  <div>
                    <dt>Owned</dt>
                    <dd>{formatNumber(state.settlements[s.id], 0)}</dd>
                  </div>
                  <div>
                    <dt>Capacity each</dt>
                    <dd>{formatNumber(capacityPerSettlement(state, s))}</dd>
                  </div>
                  <div>
                    <dt>Total capacity</dt>
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
                    <h3>Build on an available slot</h3>
                    <Costs costs={buildCosts} state={state} />
                    <div className="realm-actions">
                      {[1, 'max'].map((n) => (
                        <button
                          className="button"
                          key={n}
                          aria-label={`Build ${n === 'max' ? 'Max' : n} ${s.name}`}
                          disabled={buildMaximum.lt(1)}
                          title={
                            availableSlots(state).lte(0)
                              ? 'No available territory slots.'
                              : costReason(buildCosts, state) ||
                                'Uses one slot per settlement.'
                          }
                          onClick={() =>
                            gameStore.dispatch({
                              type: 'buildSettlement',
                              id: s.id,
                              amount: n === 'max' ? 'max' : 1,
                            })
                          }
                        >
                          Build {n === 'max' ? 'Max' : '+1'}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {source && (
                  <>
                    <h3>Upgrade from {source.name}</h3>
                    <Costs costs={costs} state={state} />
                    <div className="realm-actions">
                      {[1, 'max'].map((n) => (
                        <button
                          className="button primary"
                          key={n}
                          aria-label={`Upgrade ${n === 'max' ? 'Max' : n} ${s.name}`}
                          disabled={maximum.lt(1)}
                          title={
                            state.settlements[source.id].lt(1)
                              ? `Requires ${source.name}.`
                              : costReason(costs, state) ||
                                'Keeps the same territory slot.'
                          }
                          onClick={() =>
                            gameStore.dispatch({
                              type: 'upgradeSettlement',
                              id: s.id,
                              amount: n === 'max' ? 'max' : 1,
                            })
                          }
                        >
                          Upgrade {n === 'max' ? 'Max' : '+1'} → {s.name}
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
        The founding camp holds 20 people and already uses one slot. Establish a
        Settlement here, then research Village Organization for Towns. Upgrades
        keep their slot; newly built homes need more land.
      </p>
      {state.unlockedFeatures.includes('territory') && (
        <button className="button" onClick={() => openSheet('territory')}>
          Acquire more territory
        </button>
      )}
    </>
  );
}
