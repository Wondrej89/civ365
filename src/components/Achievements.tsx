import { Discovery } from './Discovery';
import { useI18n } from '../i18n/LocaleContext';
import { Award, Check, Circle } from 'lucide-react';
import { useGame } from '../hooks/useGame';
import {
  achievementTracks,
  achievementTrackProgress,
} from '../game/content/achievement-tracks';
import { achievements } from '../game/content/achievements';

export function AchievementsSheet() {
  const { t: tr, formatNumber } = useI18n();

  const { state } = useGame(),
    visible = achievements.filter(
      (a) => !a.track && (!a.hidden || state.achievements.includes(a.id)),
    );
  return (
    <>
      <div className="sheet-heading">
        <div>
          <div className="eyebrow">{tr('SMALL MOMENTS, LASTING IMPACT')}</div>
          <h1>{tr('Look how far you’ve come.')}</h1>
          <p>
            {tr(
              'Milestones are earned automatically. Their bonuses stay with you.',
            )}
          </p>
        </div>
        <span className="era-chip">
          <Award size={18} />
          {formatNumber(state.achievements.length, 0)} {tr('earned')}
        </span>
      </div>
      <h2>{tr('Milestone series')}</h2>
      <p className="sheet-note">
        {tr(
          'Each new milestone earns its reward once. Bonuses from all completed milestones stack permanently.',
        )}
      </p>
      <div className="achievement-tracks">
        {achievementTracks.map((track) => {
          const progress = achievementTrackProgress(state, track.id);
          return (
            <Discovery
              as="section"
              discoveryId={`achievements:track:${track.id}:${progress.earned.length}`}
              className="panel achievement-track"
              key={track.id}
            >
              <div className="panel-heading">
                <h2>{tr(track.name)}</h2>
                <span className="tag">
                  {tr('{count} milestones earned', {
                    count: progress.earned.length,
                  })}
                </span>
              </div>
              <p className="sheet-note">{tr(track.description)}</p>
              <strong>
                {formatNumber(progress.value, 0)} /{' '}
                {progress.next
                  ? formatNumber(progress.next.track!.target, 0)
                  : tr('Complete')}
              </strong>
              <progress
                max={100}
                value={
                  progress.next
                    ? Math.min(
                        100,
                        progress.value
                          .div(progress.next.track!.target)
                          .mul(100)
                          .toNumber(),
                      )
                    : 100
                }
                aria-label={tr('{name} milestone progress', {
                  name: tr(track.name),
                })}
              />
              <p>
                {tr('Reward per milestone: {reward}', {
                  reward: tr(track.reward),
                })}
              </p>
              <details>
                <summary>{tr('View milestones')}</summary>
                <ul>
                  {progress.tiers.map((a) => (
                    <li key={a.id}>
                      {state.achievements.includes(a.id) ? (
                        <Check size={14} />
                      ) : (
                        <Circle size={12} />
                      )}{' '}
                      {formatNumber(a.track!.target, 0)} ·{' '}
                      {state.achievements.includes(a.id)
                        ? tr('Earned')
                        : tr('In progress')}
                    </li>
                  ))}
                </ul>
              </details>
            </Discovery>
          );
        })}
      </div>
      <h2>{tr('One-time achievements')}</h2>
      <div className="panel achievement-list">
        <table>
          <thead>
            <tr>
              <th>{tr('Milestone')}</th>
              <th>{tr('Reward')}</th>
              <th className="numeric">{tr('Status')}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((a) => {
              const owned = state.achievements.includes(a.id);
              return (
                <Discovery
                  as="tr"
                  discoveryId={`achievements:achievement:${a.id}:${owned ? 'earned' : 'progress'}`}
                  className={owned ? 'achievement-owned' : ''}
                  key={a.id}
                >
                  <td>
                    <span className="resource-name">
                      <span className="award-icon">
                        <Award size={24} strokeWidth={1.5} />
                      </span>
                      <span>
                        <strong>{tr(a.name)}</strong>
                        <small>{tr(a.description)}</small>
                      </span>
                    </span>
                  </td>
                  <td>{tr(a.reward)}</td>
                  <td className="numeric">
                    <span
                      className={`achievement-status ${owned ? 'earned' : ''}`}
                    >
                      {owned ? <Check size={14} /> : <Circle size={12} />}
                      {owned ? tr('Earned') : tr('In progress')}
                    </span>
                  </td>
                </Discovery>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
