import { useI18n } from '../i18n/LocaleContext';
import { useGame } from '../hooks/useGame';
import { gameStore } from '../game/store';
import { campaignPreview, frontierOptions } from '../game/engine/conquest';
import {
  ownedTerritories,
  settlementSlots,
  settlementCount,
  availableSlots,
} from '../game/engine/settlements';
import { militaryPower } from '../game/engine/military';
import { militaryUnits } from '../game/content/military';
import { resources } from '../game/content/resources';
import { netProductionPerSecond } from '../game/engine/economy';
import { useWorkbookNavigation } from './navigation';
export function TerritorySheet() {
  const { t: tr, formatNumber, formatDuration } = useI18n();
  const { state } = useGame(),
    { openSheet } = useWorkbookNavigation(),
    campaign = state.activeCampaign;
  const progress = campaign
    ? Math.min(100, (campaign.elapsedSeconds / campaign.durationSeconds) * 100)
    : 0;
  const choices = frontierOptions(state).map((target) =>
    campaignPreview(state, target.id),
  );
  const net = netProductionPerSecond(state),
    power = militaryPower(state);
  return (
    <>
      <div className="sheet-heading">
        <div>
          <div className="eyebrow">
            {tr('FRONTIER · EXPANSION · NEW HOMES')}
          </div>
          <h1>{tr('Choose your next frontier.')}</h1>
          <p>
            {tr(
              'Acquire territory for new homes and a permanent production bonus. Harder regions offer greater rewards.',
            )}
          </p>
        </div>
        <button className="button" onClick={() => openSheet('settlements')}>
          {tr('Open Settlements')}
        </button>
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
      <section className="panel territory-bonuses">
        <h2>{tr('Production from conquered regions')}</h2>
        <div className="territory-bonus-list">
          {resources
            .filter((r) => r.id in state.territoryProductionBonuses)
            .map((r) => (
              <span key={r.id}>
                {tr(r.name)}{' '}
                <strong>
                  +
                  {formatNumber(
                    state.territoryProductionBonuses[r.id].mul(100),
                    1,
                  )}
                  %
                </strong>
              </span>
            ))}
        </div>
      </section>
      {campaign && (
        <section
          className="panel frontier-panel"
          aria-label={tr('Active campaign')}
        >
          <div className="eyebrow">{tr('CAMPAIGN IN PROGRESS')}</div>
          <h2>
            {tr(
              choices.find((c) => c.id === campaign.targetId)?.name ??
                'Frontier',
            )}
          </h2>
          <progress
            className="campaign-progress"
            aria-label={tr('Campaign progress')}
            value={progress}
            max={100}
          />
          <p>
            {formatNumber(progress, 1)}% ·{' '}
            {formatDuration(campaign.durationSeconds - campaign.elapsedSeconds)}{' '}
            {tr('remaining')}
          </p>
          <p>
            {tr('Army readiness: {percent}%', {
              percent: formatNumber(state.militaryReadiness * 100, 1),
            })}
          </p>
          <p className="sheet-note">
            {tr(
              'The army stays committed and consumes supplies. A supply shortage can weaken the campaign. Progress continues while you are away.',
            )}
          </p>
        </section>
      )}
      <div className="sheet-heading">
        <div>
          <h2>{tr('Three territories to choose from')}</h2>
          <p>
            {tr('Your Military Power: {power}', { power: formatNumber(power) })}
          </p>
        </div>
      </div>
      <div className="realm-cards frontier-choices">
        {choices.map((choice) => {
          const shortage = ['food', 'materials'].some(
            (id) =>
              net[id].lt(0) &&
              state.resources[id].lt(
                net[id].neg().mul(choice.maximumDurationSeconds),
              ),
          );
          const resourceName = resources.find(
            (r) => r.id === choice.resource,
          )!.name;
          return (
            <section
              className="panel frontier-panel"
              key={choice.id}
              data-frontier={choice.id}
            >
              <div className="panel-heading">
                <h2>{tr(choice.name)}</h2>
                <span className="tag">
                  {tr(['Easy', 'Standard', 'Hard'][choice.difficulty])}
                </span>
              </div>
              <dl className="growth-details">
                <div>
                  <dt>{tr('Defense Power')}</dt>
                  <dd>{formatNumber(choice.defense)}</dd>
                </div>
                <div>
                  <dt>{tr('Effective combat power')}</dt>
                  <dd>
                    {formatNumber(choice.minimumPower)}
                    {!choice.minimumPower.eq(choice.maximumPower) && (
                      <>–{formatNumber(choice.maximumPower)}</>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{tr('Expected outcome')}</dt>
                  <dd>{tr(choice.assessment)}</dd>
                </div>
                <div>
                  <dt>{tr('Estimated casualties')}</dt>
                  <dd>
                    {formatNumber(choice.minimumCasualtyRate * 100, 1)}
                    {choice.maximumCasualtyRate !==
                      choice.minimumCasualtyRate && (
                      <>–{formatNumber(choice.maximumCasualtyRate * 100, 1)}</>
                    )}
                    %
                  </dd>
                </div>
                <div>
                  <dt>{tr('Campaign duration')}</dt>
                  <dd>
                    {formatDuration(choice.minimumDurationSeconds)}
                    {choice.maximumDurationSeconds !==
                      choice.minimumDurationSeconds && (
                      <>–{formatDuration(choice.maximumDurationSeconds)}</>
                    )}
                  </dd>
                </div>
              </dl>
              <h3>{tr('Victory reward')}</h3>
              <p>{tr('+1 territory · +1 settlement slot')}</p>
              <p className="frontier-reward">
                {tr('+{bonus}% permanent {resource} production', {
                  bonus: formatNumber(choice.productionBonus.mul(100), 1),
                  resource: tr(resourceName),
                })}
              </p>
              {choice.composition ? (
                <div className="enemy-composition">
                  <h3>{tr('Enemy composition')}</h3>
                  {militaryUnits.map((u) => (
                    <div key={u.id}>
                      <span>{tr(u.name)}</span>
                      <strong>
                        {formatNumber(choice.composition![u.id] * 100, 0)}%
                      </strong>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="sheet-note">
                  {tr(
                    'Enemy composition unknown. Research Espionage to reveal the defenders and exact forecasts.',
                  )}
                </p>
              )}
              {shortage && (
                <p className="supply-warning" role="status">
                  {tr(
                    'Supplies may run out during this campaign. Increase Food and Materials production or reduce the army.',
                  )}
                </p>
              )}
              <button
                className="button primary"
                disabled={!!campaign || power.lte(0)}
                aria-label={tr('Launch campaign for {territory}', {
                  territory: tr(choice.name),
                })}
                title={
                  campaign
                    ? tr('Army committed.')
                    : power.lte(0)
                      ? tr('Recruit an army first.')
                      : tr('Launch this campaign.')
                }
                onClick={() =>
                  gameStore.dispatch({
                    type: 'launchCampaign',
                    targetId: choice.id,
                  })
                }
              >
                {tr('Launch Campaign')}
              </button>
            </section>
          );
        })}
      </div>
      <p className="sheet-note">
        {tr(
          'Infantry counters Cavalry; Cavalry counters Ranged; Ranged counters Infantry. Keep a balanced army when defender composition is unknown. Early campaigns ignore counters until more troop types are available.',
        )}
      </p>
      <p className="sheet-note">
        {tr(
          'Casualties remove troops and Population. Each conquest makes the next frontier harder; defeated campaigns keep the same territory choices.',
        )}
      </p>
      <button className="button" onClick={() => openSheet('military')}>
        {tr('Prepare your army')}
      </button>
    </>
  );
}
