import { useGame } from '../hooks/useGame';
import { gameStore } from '../game/store';
import { campaignForecast } from '../game/engine/conquest';
import {
  ownedTerritories,
  settlementSlots,
  settlementCount,
  availableSlots,
} from '../game/engine/settlements';
import { militaryPower } from '../game/engine/military';
import { formatDuration, formatNumber } from '../game/utils/numbers';
import { useWorkbookNavigation } from './navigation';
export function TerritorySheet() {
  const { state } = useGame(),
    { openSheet } = useWorkbookNavigation(),
    forecast = campaignForecast(state),
    campaign = state.activeCampaign;
  const progress = campaign
    ? Math.min(100, (campaign.elapsedSeconds / campaign.durationSeconds) * 100)
    : 0;
  return (
    <>
      <div className="sheet-heading">
        <div>
          <div className="eyebrow">FRONTIER · EXPANSION · NEW HOMES</div>
          <h1>Room beyond the homeland.</h1>
          <p>
            Acquire territory, then invest in a settlement to expand capacity.
          </p>
        </div>
        <button className="button" onClick={() => openSheet('settlements')}>
          Open Settlements
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
            <span className="field-label">{String(name)}</span>
            <strong>{formatNumber(value, 0)}</strong>
          </div>
        ))}
      </div>
      <section className="panel frontier-panel">
        <div className="eyebrow">
          {campaign ? 'CAMPAIGN IN PROGRESS' : 'NEXT FRONTIER'}
        </div>
        <h2>
          Frontier{' '}
          {campaign?.frontierIndex ??
            state.statistics.territoriesConquered.add(1).toString()}
        </h2>
        <dl className="growth-details">
          <div>
            <dt>Defense Power</dt>
            <dd>{formatNumber(campaign?.defense ?? forecast.defense)}</dd>
          </div>
          <div>
            <dt>{campaign ? 'Committed Power' : 'Your Military Power'}</dt>
            <dd>{formatNumber(campaign?.power ?? militaryPower(state))}</dd>
          </div>
          <div>
            <dt>Expected outcome</dt>
            <dd>
              {campaign
                ? campaign.victory
                  ? 'Victory'
                  : 'Defeat'
                : forecast.assessment}
            </dd>
          </div>
          <div>
            <dt>Estimated casualties</dt>
            <dd>
              {formatNumber(
                (campaign?.casualtyRate ?? forecast.casualtyRate) * 100,
                1,
              )}
              % of each unit type, rounded down
            </dd>
          </div>
          <div>
            <dt>Campaign duration</dt>
            <dd>
              {formatDuration(
                campaign?.durationSeconds ?? forecast.durationSeconds,
              )}
            </dd>
          </div>
          <div>
            <dt>Victory reward</dt>
            <dd>+1 territory · +1 settlement slot</dd>
          </div>
        </dl>
        {campaign ? (
          <>
            <progress
              className="campaign-progress"
              aria-label="Campaign progress"
              value={progress}
              max={100}
            />
            <p>
              {formatNumber(progress, 1)}% ·{' '}
              {formatDuration(
                campaign.durationSeconds - campaign.elapsedSeconds,
              )}{' '}
              remaining
            </p>
            <p className="sheet-note">
              The army stays committed. This campaign uses its launch power and
              forecast, and continues while you are away.
            </p>
          </>
        ) : (
          <>
            <button
              className="button primary"
              disabled={forecast.power.lte(0)}
              title={
                forecast.power.lte(0)
                  ? 'Recruit an army first.'
                  : forecast.victory
                    ? 'Launch this campaign.'
                    : 'Your army is likely to lose; recruit stronger troops first.'
              }
              onClick={() => gameStore.dispatch({ type: 'launchCampaign' })}
            >
              Launch Campaign
            </button>
            <p className="sheet-note">
              Results are deterministic from the power ratio. Casualties remove
              troops and Population. Each conquest makes the next frontier
              harder.
            </p>
          </>
        )}
        <button className="button" onClick={() => openSheet('military')}>
          Prepare your army
        </button>
      </section>
    </>
  );
}
