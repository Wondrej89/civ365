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
} from '../game/engine/military';
import { D, sum } from '../game/utils/numbers';
import { Costs, costReason } from './common';
import { useWorkbookNavigation } from './navigation';
export function MilitarySheet() {
  const { t: tr, formatNumber } = useI18n();

  const { state } = useGame(),
    { openSheet } = useWorkbookNavigation(),
    power = militaryPower(state);
  const base = sum(
    militaryUnits.map((u) => state.militaryUnits[u.id].mul(u.basePower)),
  );
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
          ['Power from bonuses', power.sub(base)],
        ].map(([name, value]) => (
          <div className="panel" key={String(name)}>
            <span className="field-label">{tr(String(name))}</span>
            <strong>{formatNumber(value)}</strong>
          </div>
        ))}
      </div>
      {state.activeCampaign && (
        <div className="panel campaign-notice">
          {tr(
            'Your army is committed to a campaign. Recruitment and demobilization resume when it ends.',
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
              costs = militaryQuote(state, u);
            return (
              <article
                className="panel military-card"
                data-military={u.id}
                key={u.id}
              >
                <h2>{tr(u.name)}</h2>
                <p>{tr(u.description)}</p>
                <dl className="growth-details">
                  <div>
                    <dt>{tr('Count')}</dt>
                    <dd>{formatNumber(count, 0)}</dd>
                  </div>
                  <div>
                    <dt>{tr('Power each')}</dt>
                    <dd>{formatNumber(powerPerMilitaryUnit(state, u))}</dd>
                  </div>
                  <div>
                    <dt>{tr('Total power')}</dt>
                    <dd>
                      {formatNumber(count.mul(powerPerMilitaryUnit(state, u)))}
                    </dd>
                  </div>
                  <div>
                    <dt>{tr('People per unit')}</dt>
                    <dd>{u.populationCost}</dd>
                  </div>
                </dl>
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
          'Demobilization returns people to Idle Population; equipment is not refunded. Recruitment prices rise with army size. Release workers in Workforce to make room for soldiers.',
        )}
      </p>
      <button className="button" onClick={() => openSheet('workforce')}>
        {tr('Open Workforce')}
      </button>
    </>
  );
}
