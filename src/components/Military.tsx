import { useI18n } from '../i18n/LocaleContext';
import { useGame } from '../hooks/useGame';
import { gameStore } from '../game/store';
import { militaryUnits } from '../game/content/military';
import {
  idlePopulation,
  militaryPopulation,
} from '../game/engine/population-accounting';
import {
  militaryPower,
  militaryUnlocked,
  powerPerMilitaryUnit,
  militaryQuote,
  maxMilitaryRecruit,
  armyUpkeep,
  militaryTier,
  nextMilitaryTier,
  militaryUpgradeQuote,
  canUpgradeMilitary,
  upkeepPerMilitaryUnit,
} from '../game/engine/military';
import { D } from '../game/utils/numbers';
import { productionPerSecond } from '../game/engine/production';
import { netProductionPerSecond } from '../game/engine/economy';
import { evaluateCondition } from '../game/engine/conditions';
import { technologies } from '../game/content/technologies';
import { balance } from '../game/content/config';
import { Costs, costReason } from './common';
import { useWorkbookNavigation } from './navigation';
export function MilitarySheet() {
  const { t: tr, formatNumber } = useI18n();

  const { state } = useGame(),
    { openSheet } = useWorkbookNavigation(),
    power = militaryPower(state);
  const upkeep = armyUpkeep(state),
    gross = productionPerSecond(state),
    net = netProductionPerSecond(state);
  return (
    <>
      <div className="sheet-heading">
        <div>
          <div className="eyebrow">{tr('PEOPLE · EQUIPMENT · COMMITMENT')}</div>
          <h1>{tr('An army has a cost.')}</h1>
          <p>
            {tr(
              'Every soldier is a person who could be producing Food, Materials or Research.',
            )}
          </p>
        </div>
        <button className="button" onClick={() => openSheet('territory')}>
          {tr('Open Territory')}
        </button>
      </div>
      <div className="realm-kpis">
        {[
          ['Military Power', power],
          ['Military population', militaryPopulation(state)],
          ['Idle Population', idlePopulation(state)],
          ['Army readiness (%)', state.militaryReadiness * 100],
        ].map(([name, value]) => (
          <div className="panel" key={String(name)}>
            <span className="field-label">{tr(String(name))}</span>
            <strong>{formatNumber(value)}</strong>
          </div>
        ))}
      </div>
      <section className="panel army-upkeep-panel">
        <h2>{tr('Standing army upkeep')}</h2>
        <p>
          {tr(
            'Food and equipment are consumed every second, including during campaigns and while you are away.',
          )}
        </p>
        <table>
          <thead>
            <tr>
              <th>{tr('Resource')}</th>
              <th>{tr('Production /s')}</th>
              <th>{tr('Army upkeep /s')}</th>
              <th>{tr('Net /s')}</th>
            </tr>
          </thead>
          <tbody>
            {(['food', 'materials'] as const).map((id) => (
              <tr key={id}>
                <td>{tr(id === 'food' ? 'Food' : 'Materials')}</td>
                <td>{formatNumber(gross[id])}</td>
                <td>−{formatNumber(upkeep[id])}</td>
                <td className={net[id].lt(0) ? 'insufficient' : ''}>
                  {net[id].gte(0) ? '+' : ''}
                  {formatNumber(net[id])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="sheet-note">
          {tr(
            'Supply shortages reduce readiness and Military Power, down to {percent}%. Restore production or demobilize troops to recover. Supply Lines, Professional Army and Military Logistics reduce upkeep.',
            { percent: balance.military.minimumReadiness * 100 },
          )}
        </p>
      </section>
      {state.activeCampaign && (
        <div className="panel campaign-notice">
          {tr(
            'Your army is committed to a campaign. Recruitment, equipment upgrades and demobilization resume when it ends.',
          )}
        </div>
      )}
      <div className="realm-cards">
        {militaryUnits
          .filter(
            (u) =>
              militaryUnlocked(state, u) || state.militaryUnits[u.id].gt(0),
          )
          .map((u) => {
            const maximum = maxMilitaryRecruit(state, u),
              count = state.militaryUnits[u.id],
              costs = militaryQuote(state, u),
              tier = militaryTier(state, u),
              next = nextMilitaryTier(state, u);
            const upgradeCosts = militaryUpgradeQuote(state, u),
              upgradeUnlocked =
                next && evaluateCondition(next.unlockCondition, state);
            const condition = next?.unlockCondition;
            const required =
              condition?.type === 'technologyOwned'
                ? (technologies.find((t) => t.id === condition.technologyId)
                    ?.name ?? '')
                : 'Future technology';
            return (
              <article
                className="panel military-card"
                data-military={u.id}
                key={u.id}
              >
                <h2>{tr(u.name)}</h2>
                <span className="tag">{tr(tier.name)}</span>
                <p>{tr(u.description)}</p>
                <dl className="growth-details">
                  <div>
                    <dt>{tr('Count')}</dt>
                    <dd>{formatNumber(count, 0)}</dd>
                  </div>
                  <div>
                    <dt>{tr('Power each at full readiness')}</dt>
                    <dd>{formatNumber(powerPerMilitaryUnit(state, u))}</dd>
                  </div>
                  <div>
                    <dt>{tr('Total power')}</dt>
                    <dd>
                      {formatNumber(
                        count
                          .mul(powerPerMilitaryUnit(state, u))
                          .mul(state.militaryReadiness),
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>{tr('People per unit')}</dt>
                    <dd>{u.populationCost}</dd>
                  </div>
                </dl>
                <h3>{tr('Upkeep per soldier /s')}</h3>
                <Costs costs={upkeepPerMilitaryUnit(state, u)} state={state} />
                {next && (
                  <section className="military-upgrade">
                    <h3>
                      {tr('Next equipment: {unit}', { unit: tr(next.name) })}
                    </h3>
                    <p>
                      {tr('Requires {technology}', {
                        technology: tr(required),
                      })}
                    </p>
                    <Costs costs={upgradeCosts} state={state} />
                    <button
                      className="button"
                      disabled={!canUpgradeMilitary(state, u)}
                      aria-label={tr('Upgrade {role} to {unit}', {
                        role: tr(u.name),
                        unit: tr(next.name),
                      })}
                      title={
                        state.activeCampaign
                          ? tr('Army committed.')
                          : !upgradeUnlocked
                            ? tr('Research {technology} first.', {
                                technology: tr(required),
                              })
                            : costReason(upgradeCosts, state) ||
                              tr(
                                'Re-equip the entire category without using more Population.',
                              )
                      }
                      onClick={() =>
                        gameStore.dispatch({
                          type: 'upgradeMilitary',
                          id: u.id,
                        })
                      }
                    >
                      {tr('Upgrade to {unit}', { unit: tr(next.name) })}
                    </button>
                    <p className="sheet-note">
                      {tr(
                        'This bill equips all current soldiers. Future recruits use the new tier. With no soldiers, pay for one training kit.',
                      )}
                    </p>
                  </section>
                )}
                <h3>{tr('Recruitment cost for one')}</h3>
                <Costs costs={costs} state={state} />
                <div className="realm-actions">
                  {[1, 10, 'max'].map((n) => (
                    <button
                      className="button primary"
                      key={n}
                      aria-label={tr('Recruit {0} {1}', {
                        '0': n === 'max' ? tr('Max') : n,
                        '1': tr(u.name),
                      })}
                      disabled={maximum.lt(n === 'max' ? 1 : n)}
                      title={
                        state.activeCampaign
                          ? tr('Army committed.')
                          : idlePopulation(state).lt(
                                D(n === 'max' ? 1 : n).mul(u.populationCost),
                              )
                            ? tr('Not enough Idle Population.')
                            : costReason(
                                militaryQuote(
                                  state,
                                  u,
                                  n === 'max' ? maximum : n,
                                ),
                                state,
                              ) ||
                              tr(
                                'Consumes equipment and assigns Idle Population.',
                              )
                      }
                      onClick={() =>
                        gameStore.dispatch({
                          type: 'recruitMilitary',
                          id: u.id,
                          amount: n === 'max' ? 'max' : Number(n),
                        })
                      }
                    >
                      {tr('Recruit')}{' '}
                      {n === 'max' ? tr('Max') : tr('+{0}', { '0': n })}
                    </button>
                  ))}
                </div>
                <div className="realm-actions">
                  {[1, 10, 'max'].map((n) => (
                    <button
                      className="button"
                      key={n}
                      aria-label={tr('Demobilize {0} {1}', {
                        '0': n === 'max' ? tr('All') : n,
                        '1': tr(u.name),
                      })}
                      disabled={
                        !!state.activeCampaign || count.lt(n === 'max' ? 1 : n)
                      }
                      onClick={() =>
                        gameStore.dispatch({
                          type: 'demobilize',
                          id: u.id,
                          amount: n === 'max' ? 'max' : Number(n),
                        })
                      }
                    >
                      {n === 'max'
                        ? tr('Demobilize All')
                        : tr('Demobilize {0}', { '0': n })}
                    </button>
                  ))}
                </div>
              </article>
            );
          })}
      </div>
      <p className="sheet-note">
        {tr(
          'Infantry counters Cavalry; Cavalry counters Ranged; Ranged counters Infantry. A balanced army earns a combined-arms bonus. Counters begin only when more troop types are available.',
        )}
      </p>
      <p className="sheet-note">
        {tr(
          'Demobilization returns people to Idle Population; equipment is not refunded. Recruitment prices rise with army size. Release workers in Workforce to make room for soldiers.',
        )}
      </p>
      <button className="button" onClick={() => openSheet('workforce')}>
        {tr('Open Workforce')}
      </button>
    </>
  );
}
