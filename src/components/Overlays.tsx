import { Sprout, X, ArrowRight, Clock, Wrench } from 'lucide-react';
import { useGame } from '../hooks/useGame';
import { gameStore } from '../game/store';
import { resources } from '../game/content/resources';
import { isFeatureUnlocked } from '../game/engine/conditions';
import { formatDuration, formatNumber } from '../game/utils/numbers';
import { ResourceIcon } from './common';
export function OfflineModal() {
  const { state, report } = useGame();
  if (!report) return null;
  return (
    <div className="modal-backdrop">
      <section
        className="modal offline-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="offline-title"
      >
        <button
          className="modal-close"
          aria-label="Dismiss offline report"
          onClick={gameStore.dismissOffline}
        >
          <X size={19} />
        </button>
        <div className="modal-symbol">
          <Sprout size={29} />
        </div>
        <div className="eyebrow">YOUR PEOPLE KEPT GOING</div>
        <h2 id="offline-title">Welcome back.</h2>
        <p>
          Away for <strong>{formatDuration(report.awaySeconds)}</strong>. Here’s
          what your civilization produced.
        </p>
        <div className="offline-resources">
          {resources
            .filter(
              (r) =>
                !r.meta &&
                (r.initiallyVisible || isFeatureUnlocked(state, r.feature)),
            )
            .map((r) => (
              <div key={r.id}>
                <span>
                  <ResourceIcon id={r.id} />
                  {r.name}
                </span>
                <strong>+{formatNumber(report.produced[r.id])}</strong>
              </div>
            ))}
        </div>
        {report.populationCreated.gt(0) && (
          <p className="offline-growth">
            Your community grew by{' '}
            <strong>{formatNumber(report.populationCreated, 0)} people</strong>,
            spending {formatNumber(report.foodSpentOnGrowth)} Food.
          </p>
        )}
        {report.awaySeconds > report.simulatedSeconds && (
          <p className="offline-cap">
            <Clock size={14} />
            Production capped at {formatDuration(report.simulatedSeconds)}.
          </p>
        )}
        <button
          className="button primary"
          autoFocus
          onClick={gameStore.dismissOffline}
        >
          Back to my civilization
          <ArrowRight size={17} />
        </button>
      </section>
    </div>
  );
}
export function Toasts() {
  const { state } = useGame();
  if (!state.settings.notifications) return null;
  const events = state.eventLog
    .filter((e) => e.notify && state.lastSimulationTime - e.time < 5500)
    .slice(-3);
  return (
    <div className="toast-stack" aria-live="polite">
      {events.map((e) => (
        <div className="toast" key={e.id}>
          <span className="toast-icon">
            <Sprout size={17} />
          </span>
          <span>{e.message}</span>
        </div>
      ))}
    </div>
  );
}
export function DebugPanel() {
  const { speed } = useGame();
  if (!import.meta.env.DEV) return null;
  return (
    <details className="debug-panel">
      <summary>
        <Wrench size={13} />
        Developer tools
      </summary>
      <div>
        {(
          [
            'food',
            'materials',
            'research',
            'population',
            'speed',
            'technologies',
          ] as const
        ).map((action) => (
          <button key={action} onClick={() => gameStore.debug(action)}>
            {action === 'population'
              ? '+10 Population'
              : action === 'speed'
                ? `${speed === 1 ? '×10' : speed === 10 ? '×100' : speed === 100 ? '×1000' : '×1'} simulation speed`
                : action === 'technologies'
                  ? 'Unlock all MVP technologies'
                  : `+100 ${action[0].toUpperCase()}${action.slice(1)}`}
          </button>
        ))}
        <button
          onClick={() => {
            if (window.confirm('Reset the current save?')) gameStore.reset();
          }}
        >
          Reset save
        </button>
      </div>
    </details>
  );
}
