import { Award, Check, Circle } from 'lucide-react';
import { useGame } from '../hooks/useGame';
import { achievements } from '../game/content/achievements';
import { formatNumber } from '../game/utils/numbers';
export function AchievementsSheet() {
  const { state } = useGame(),
    visible = achievements.filter(
      (a) => !a.hidden || state.achievements.includes(a.id),
    );
  return (
    <>
      <div className="sheet-heading">
        <div>
          <div className="eyebrow">SMALL MOMENTS, LASTING IMPACT</div>
          <h1>Look how far you’ve come.</h1>
          <p>
            Milestones are earned automatically. Their bonuses stay with you.
          </p>
        </div>
        <span className="era-chip">
          <Award size={18} />
          {formatNumber(state.achievements.length, 0)} earned
        </span>
      </div>
      <div className="panel achievement-list">
        <table>
          <thead>
            <tr>
              <th>Milestone</th>
              <th>Reward</th>
              <th className="numeric">Status</th>
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
                        <strong>{a.name}</strong>
                        <small>{a.description}</small>
                      </span>
                    </span>
                  </td>
                  <td>{a.reward}</td>
                  <td className="numeric">
                    <span
                      className={`achievement-status ${owned ? 'earned' : ''}`}
                    >
                      {owned ? <Check size={14} /> : <Circle size={12} />}
                      {owned ? 'Earned' : 'In progress'}
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
