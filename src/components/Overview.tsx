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
import { canAdvance } from '../game/systems/progression';
import { activeEffects, resourceMultiplier } from '../game/engine/effects';
import { D, formatNumber } from '../game/utils/numbers';
import {
  PopulationKpi,
  ResourceKpi,
  ResourceIcon,
  ResourceLedger,
  visibleResources,
} from './common';
import { GrowButton } from './Workforce';
import { useWorkbookNavigation } from './navigation';

export function Overview() {
  const { openWorkforce } = useWorkbookNavigation();
  const { state } = useGame();
  const era = eras.find((e) => e.id === state.currentEra)!;
  const nextEra = eras.find((e) => canAdvance(state, e));
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
          <div className="eyebrow">YOUR CIVILIZATION, AT A GLANCE</div>
          <h1>
            {state.currentEra === 'agricultural'
              ? 'A place to call home.'
              : isFeatureUnlocked(state, 'jobs')
                ? 'Small tribe. Big possibilities.'
                : 'A small beginning.'}
          </h1>
          <p>{era.subtitle}</p>
        </div>
        <div className="era-chip">
          <Sprout size={16} />
          {era.name}
          <span className="era-dot" />
        </div>
      </div>
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
      {nextEra && (
        <div className="era-banner">
          <div className="era-banner-icon">
            <Sprout size={28} />
          </div>
          <div>
            <span className="eyebrow">A NEW CHAPTER AWAITS</span>
            <h2>Your tribe is ready to settle.</h2>
            <p>
              Advance without resetting your progress. Earn your first
              Civilization point.
            </p>
          </div>
          <button
            className="button primary"
            onClick={() =>
              gameStore.dispatch({ type: 'advance', id: nextEra.id })
            }
          >
            Advance to {nextEra.name}
            <ArrowRight size={17} />
          </button>
        </div>
      )}
      <div className="overview-columns">
        <div className="main-column">
          <div className="panel gathering">
            <div className="panel-heading">
              <h2>Start with your own two hands</h2>
              <span className="tag">Manual actions</span>
            </div>
            <p>A little effort today. A whole civilization tomorrow.</p>
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
                      Gather {resources.find((r) => r.id === id)?.name}
                      <small>
                        +
                        {formatNumber(
                          D(g.amount).mul(
                            resourceMultiplier(activeEffects(state), id),
                          ),
                        )}{' '}
                        per click
                      </small>
                    </span>
                    <Plus size={17} />
                  </button>
                ))}
            </div>
            {isFeatureUnlocked(state, 'population') && (
              <div className="growth-row">
                <div>
                  <strong>There’s room for more.</strong>
                  <span>Food brings new people to your tribe.</span>
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
                Your next step
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
            <h3>{goal?.title ?? 'Look how far you’ve come.'}</h3>
            <p>
              {goal?.text ??
                'You have completed the first chapter. Keep growing, try your remaining discoveries, and make this civilization your own.'}
            </p>
            {goal && progress !== null && (
              <>
                <div className="goal-progress">
                  <span>Progress</span>
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
              One small step at a time.
            </div>
          </div>
          <div className="panel activity">
            <div className="panel-heading">
              <h2>
                <History size={16} />
                Activity
              </h2>
              <span className="subtle">Latest events</span>
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
                      <p>{e.message}</p>
                      <time>
                        {new Date(e.time).toLocaleTimeString('en-GB', {
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
              Every big thing starts
              <br />
              with a very small cell.
            </p>
            <span>CIVILIZATION.XLSX</span>
          </div>
        </aside>
      </div>
    </>
  );
}
