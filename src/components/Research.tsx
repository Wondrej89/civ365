import { ArrowRight, Check, FlaskConical, LockKeyhole } from 'lucide-react';
import { useGame } from '../hooks/useGame';
import { technologies } from '../game/content/technologies';
import { technologyStatus, canAfford } from '../game/systems/progression';
import { gameStore } from '../game/store';
import { formatNumber } from '../game/utils/numbers';
import { productionPerSecond } from '../game/engine/production';
import { Costs, costReason } from './common';
export function ResearchSheet() {
  const { state } = useGame();
  return (
    <>
      <div className="sheet-heading">
        <div>
          <div className="eyebrow">CURIOSITY BECOMES PROGRESS</div>
          <h1>One idea changes everything.</h1>
          <p>Discover technologies. Give your people new possibilities.</p>
        </div>
        <div className="point-balance">
          <FlaskConical size={22} />
          <span>
            <strong>{formatNumber(state.resources.research)} Research</strong>
            <small>
              +{formatNumber(productionPerSecond(state).research)}/s
            </small>
          </span>
        </div>
      </div>
      <div className="technology-grid">
        {technologies
          .filter((t) => technologyStatus(state, t) !== 'hidden')
          .map((t) => {
            const status = technologyStatus(state, t),
              purchased = status === 'purchased',
              available = status === 'available',
              reason = available
                ? costReason(t.cost, state)
                : 'Requires prerequisite discoveries.';
            const unknown = status === 'revealed' && t.lockedPreview;
            return (
              <div
                className={`panel tech-card ${purchased ? 'purchased' : ''}`}
                key={t.id}
              >
                <div className="tech-heading">
                  <span className="tech-icon">
                    {purchased ? (
                      <Check size={21} />
                    ) : available ? (
                      <FlaskConical size={21} />
                    ) : (
                      <LockKeyhole size={21} />
                    )}
                  </span>
                  <span className={`tag ${purchased ? 'green-tag' : ''}`}>
                    {purchased
                      ? 'Discovered'
                      : available
                        ? 'Available'
                        : 'Locked'}
                  </span>
                </div>
                <h2>{unknown ? '???' : t.name}</h2>
                <p>{unknown ? 'A discovery is waiting.' : t.description}</p>
                <div className="tech-effect">{!unknown && t.effectText}</div>
                <div className="prerequisites">
                  Prerequisite:{' '}
                  {t.prerequisites.length
                    ? t.prerequisites
                        .map(
                          (id) => technologies.find((t) => t.id === id)?.name,
                        )
                        .join(', ')
                    : 'None'}
                </div>
                <Costs costs={t.cost} state={state} />
                {purchased ? (
                  <div className="learned">
                    <Check size={15} />
                    Applied to your civilization
                  </div>
                ) : (
                  <>
                    <button
                      className="button"
                      disabled={!available || !canAfford(state, t.cost)}
                      title={reason ? `Need ${reason}` : `Research ${t.name}`}
                      onClick={() =>
                        gameStore.dispatch({ type: 'research', id: t.id })
                      }
                    >
                      Research {unknown ? '???' : t.name}
                      <ArrowRight size={16} />
                    </button>
                    {reason && (
                      <small className="block-reason">
                        {available ? `Need ${reason}` : reason}
                      </small>
                    )}
                  </>
                )}
              </div>
            );
          })}
      </div>
      <p className="sheet-note">
        Each discovery can reveal the next. Production bonuses multiply with
        your other bonuses.
      </p>
    </>
  );
}
