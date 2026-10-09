import { useI18n } from '../i18n/LocaleContext';
import {
  ArrowRight,
  Leaf,
  Plus,
  History,
  TrendingUp,
  Sprout,
  Check,
} from 'lucide-react';
import { useGame } from '../hooks/useGame';
import { gameStore } from '../game/store';
import {
  isFeatureUnlocked,
  evaluateCondition,
} from '../game/engine/conditions';
import { balance } from '../game/content/config';
import { resources } from '../game/content/resources';
import { eras } from '../game/content/eras';
import { guidance } from '../game/content/guidance';
import { EraProgress } from './EraProgress';
import {
  ownedTerritories,
  populationCapacity,
  settlementCount,
  settlementSlots,
  capacityReached,
} from '../game/engine/settlements';
import { militaryPower } from '../game/engine/military';
import { activeEffects, resourceMultiplier } from '../game/engine/effects';
import { D } from '../game/utils/numbers';
import {
  PopulationKpi,
  ResourceKpi,
  ResourceIcon,
  ResourceLedger,
  visibleResources,
} from './common';
import { GrowButton } from './Workforce';
import { useWorkbookNavigation } from './navigation';
import { autoGrowthActive, nextGrowthSeconds } from '../game/engine/population';

export function Overview() {
  const { t: tr, formatNumber, formatEvent, formatTime } = useI18n();

  const { openWorkforce, openSheet } = useWorkbookNavigation();
  const { state } = useGame();
  const era = eras.find((e) => e.id === state.currentEra)!;
  const goal = guidance.find(
    (g) =>
      evaluateCondition(g.visible, state) &&
      !evaluateCondition(g.complete, state),
  );
  const value = goal?.stat
    ? state.statistics[goal.stat]
    : goal?.resource
      ? state.resources[goal.resource]
      : state.population;
  const progress = goal?.target
    ? Math.min(100, value.div(goal.target).mul(100).toNumber())
    : null;
  return (
    <>
      <div className="sheet-heading">
        <div>
          <div className="eyebrow">{tr('YOUR CIVILIZATION, AT A GLANCE')}</div>
          <h1>
            {state.currentEra !== 'tribal'
              ? tr('A place to call home.')
              : isFeatureUnlocked(state, 'jobs')
                ? tr('Small tribe. Big possibilities.')
                : tr('A small beginning.')}
          </h1>
          <p>{tr(era.subtitle)}</p>
        </div>
        <div className="era-chip">
          <Sprout size={16} />
          {tr(era.name)}
          <span className="era-dot" />
        </div>
      </div>
      {isFeatureUnlocked(state, 'population') && (
        <div className="overview-shortcuts">
          <span>
            {tr('Growth:')}{' '}
            <strong>
              {capacityReached(state)
                ? tr('Population capacity reached.')
                : autoGrowthActive(state)
                  ? tr('Auto · next attempt in {0} s', {
                      '0': formatNumber(nextGrowthSeconds(state), 1),
                    })
                  : tr('Manual')}
            </strong>
          </span>
          <button className="button" onClick={() => openSheet('population')}>
            {tr('Open Population')}
          </button>
          {isFeatureUnlocked(state, 'jobs') && (
            <button className="button" onClick={() => openSheet('workforce')}>
              {tr('Open Production')}
            </button>
          )}
          {isFeatureUnlocked(state, 'research') && (
            <button className="button" onClick={() => openSheet('research')}>
              {tr('Open Research')}
            </button>
          )}
          {isFeatureUnlocked(state, 'statistics') && (
            <button className="button" onClick={() => openSheet('statistics')}>
              {tr('Open Statistics')}
            </button>
          )}
        </div>
      )}
      <div className="kpi-grid">
        <PopulationKpi state={state} />
        {visibleResources(state).map((r) => (
          <ResourceKpi
            key={r.id}
            state={state}
            id={r.id}
            onOpenProduction={
              isFeatureUnlocked(state, 'jobs') ? openWorkforce : undefined
            }
          />
        ))}
      </div>
      <div className="realm-overview">
        {isFeatureUnlocked(state, 'settlements') && (
          <>
            <button
              className="panel realm-overview-card"
              onClick={() => openSheet('settlements')}
            >
              <span>{tr('Settlements')}</span>
              <strong>
                {formatNumber(settlementCount(state), 0)} /{' '}
                {formatNumber(settlementSlots(state), 0)} {tr('slots')}
              </strong>
              <small>
                {tr('Capacity')} {formatNumber(populationCapacity(state), 0)}
              </small>
            </button>
            <button
              className="panel realm-overview-card"
              onClick={() =>
                openSheet(
                  isFeatureUnlocked(state, 'territory')
                    ? 'territory'
                    : 'settlements',
                )
              }
            >
              <span>{tr('Territory')}</span>
              <strong>{formatNumber(ownedTerritories(state), 0)}</strong>
              <small>{tr('Room for new settlements')}</small>
            </button>
          </>
        )}
        {isFeatureUnlocked(state, 'military') && (
          <button
            className="panel realm-overview-card"
            onClick={() => openSheet('military')}
          >
            <span>{tr('Military Power')}</span>
            <strong>{formatNumber(militaryPower(state))}</strong>
            <small>
              {state.activeCampaign
                ? tr('Campaign in progress')
                : tr('Prepare your next campaign')}
            </small>
          </button>
        )}
      </div>
      <EraProgress />
      <div className="overview-columns">
        <div className="main-column">
          <div className="panel gathering">
            <div className="panel-heading">
              <h2>{tr('Start with your own two hands')}</h2>
              <span className="tag">{tr('Manual actions')}</span>
            </div>
            <p>{tr('A little effort today. A whole civilization tomorrow.')}</p>
            <div className="gather-actions">
              {Object.entries(balance.manualGathering)
                .filter(([, g]) => isFeatureUnlocked(state, g.feature))
                .map(([id, g]) => (
                  <button
                    key={id}
                    className={`gather-button ${id === 'food' ? 'food-gather' : ''}`}
                    onClick={() =>
                      gameStore.dispatch({ type: 'gather', resource: id })
                    }
                  >
                    <ResourceIcon id={id} size={22} />
                    <span>
                      {tr('Gather')}{' '}
                      {tr(resources.find((r) => r.id === id)?.name ?? '')}
                      <small>
                        +
                        {formatNumber(
                          D(g.amount).mul(
                            resourceMultiplier(activeEffects(state), id),
                          ),
                        )}{' '}
                        {tr('per click')}
                      </small>
                    </span>
                    <Plus size={17} />
                  </button>
                ))}
            </div>
            {isFeatureUnlocked(state, 'population') && (
              <div className="growth-row">
                <div>
                  <strong>{tr('There’s room for more.')}</strong>
                  <span>{tr('Food brings new people to your tribe.')}</span>
                </div>
                <GrowButton />
              </div>
            )}
          </div>
          <ResourceLedger state={state} />
        </div>
        <aside className="side-column">
          <div className="panel next-step">
            <div className="panel-heading">
              <h2>
                <TrendingUp size={16} />
                {tr('Your next step')}
              </h2>
              <span className="step-number">
                {formatNumber(
                  guidance.indexOf(goal!) + 1 || guidance.length,
                  0,
                ).padStart(2, '0')}
              </span>
            </div>
            <div className="goal-icon">
              {goal ? <Leaf size={23} /> : <Check size={23} />}
            </div>
            <h3>{tr(goal?.title ?? '') || tr('Look how far you’ve come.')}</h3>
            <p>
              {tr(goal?.text ?? '') ||
                tr(
                  'You have completed the first chapter. Keep growing, try your remaining discoveries, and make this civilization your own.',
                )}
            </p>
            {goal && progress !== null && (
              <>
                <div className="goal-progress">
                  <span>{tr('Progress')}</span>
                  <strong>
                    {formatNumber(value.min(goal.target!), 0)} /{' '}
                    {formatNumber(goal.target!, 0)}
                  </strong>
                </div>
                <div className="progress-track">
                  <div style={{ width: `${progress}%` }} />
                </div>
              </>
            )}
            <div className="goal-note">
              <ArrowRight size={13} />
              {tr('One small step at a time.')}
            </div>
          </div>
          <div className="panel activity">
            <div className="panel-heading">
              <h2>
                <History size={16} />
                {tr('Activity')}
              </h2>
              <span className="subtle">{tr('Latest events')}</span>
            </div>
            <div className="events">
              {[...state.eventLog]
                .reverse()
                .slice(0, 5)
                .map((e, i) => (
                  <div
                    className={`event ${i === 0 ? 'latest' : ''}`}
                    key={e.id}
                  >
                    <span className="event-dot" />
                    <div>
                      <p>{formatEvent(e)}</p>
                      <time>
                        {formatTime(e.time, {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                    </div>
                  </div>
                ))}
            </div>
          </div>
          <div className="quiet-note">
            <span className="note-grid">▦</span>
            <p>
              {tr('Every big thing starts')}
              <br />
              {tr('with a very small cell.')}
            </p>
            <span>CIVILIZATION.XLSX</span>
          </div>
        </aside>
      </div>
    </>
  );
}
