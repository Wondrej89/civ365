import { useI18n } from '../i18n/LocaleContext';
import {
  ArrowRight,
  Check,
  Sparkles,
  Users,
  Hammer,
  BookOpen,
} from 'lucide-react';
import { useGame } from '../hooks/useGame';
import { skills } from '../game/content/skills';
import { skillBlockReason, skillCost } from '../game/systems/progression';
import { gameStore } from '../game/store';

const branchIcons = [Users, Hammer, BookOpen];
export function SkillsSheet() {
  const { t: tr, formatNumber } = useI18n();

  const { state } = useGame();
  return (
    <>
      <div className="sheet-heading">
        <div>
          <div className="eyebrow">{tr('THE WAY YOU GROW')}</div>
          <h1>{tr('Choose what matters.')}</h1>
          <p>
            {tr(
              'Discoveries tell you what is possible. Skills decide your direction.',
            )}
          </p>
        </div>
        <div className="point-balance">
          <Sparkles size={23} />
          <span>
            <strong>
              {formatNumber(state.resources.civilizationPoints, 0)}{' '}
              {tr('Civilization points')}
            </strong>
            <small>{tr('Earned when you enter a new age')}</small>
          </span>
        </div>
      </div>
      <div className="skill-intro">
        <Sparkles size={18} />
        <p>
          {tr(
            'Your first point, your first choice. Learn one skill; its bonus stays with your civilization.',
          )}
        </p>
      </div>
      <div className="skill-grid">
        {skills.map((s, i) => {
          const level = state.purchasedSkills[s.id] ?? 0,
            reason = skillBlockReason(state, s),
            Icon = branchIcons[i % branchIcons.length];
          return (
            <div
              className={`panel skill-card ${level ? 'purchased' : ''}`}
              key={s.id}
            >
              <span className="branch-name">{tr(s.branch ?? '')}</span>
              <div className="skill-icon">
                <Icon size={31} strokeWidth={1.4} />
              </div>
              <h2>{tr(s.name)}</h2>
              <p>{tr(s.description)}</p>
              <div className="skill-level">
                {tr('Level')} {formatNumber(level, 0)} /{' '}
                {formatNumber(s.maxLevel, 0)}
              </div>
              <button
                className="button"
                disabled={!!reason}
                title={tr(reason ?? '') || tr('Learn {0}', { '0': tr(s.name) })}
                onClick={() => gameStore.dispatch({ type: 'skill', id: s.id })}
              >
                {level >= s.maxLevel ? (
                  <>
                    <Check size={16} />
                    {tr('Learned')}
                  </>
                ) : (
                  <>
                    {tr('Learn ·')} {formatNumber(skillCost(state, s), 0)}{' '}
                    {tr('point')}
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
              {reason && level < s.maxLevel && (
                <small className="block-reason">{tr(reason ?? '')}</small>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
