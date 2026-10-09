import { useI18n } from '../i18n/LocaleContext';
import { Award, Check, Circle } from 'lucide-react';
import { useGame } from '../hooks/useGame';
import { achievements } from '../game/content/achievements';

export function AchievementsSheet() {
  const { t: tr, formatNumber } = useI18n();

  const { state } = useGame(),
    visible = achievements.filter(
      (a) => !a.hidden || state.achievements.includes(a.id),
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
                <tr className={owned ? 'achievement-owned' : ''} key={a.id}>
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
