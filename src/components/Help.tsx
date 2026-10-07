import { Leaf, Users, Lightbulb, Sparkles } from 'lucide-react';
import { useGame } from '../hooks/useGame';
import { isFeatureUnlocked } from '../game/engine/conditions';
export function HelpSheet() {
  const { state } = useGame();
  return (
    <>
      <div className="sheet-heading">
        <div>
          <div className="eyebrow">A LITTLE FIELD GUIDE</div>
          <h1>A little spreadsheet. A whole civilization.</h1>
          <p>
            Take your time. Your next possibility will appear when you’re ready.
          </p>
        </div>
      </div>
      <div className="help-cards">
        <div className="panel">
          <Leaf size={25} />
          <h2>Start small</h2>
          <p>
            Click Gather Food to collect one Food. The “Your next step” card
            helps you find your next milestone.
          </p>
        </div>
        {isFeatureUnlocked(state, 'population') && (
          <div className="panel">
            <Users size={25} />
            <h2>Grow together</h2>
            <p>
              Spend Food to welcome new people. The cost grows with your
              population. Assign available workers to keep resources coming in
              automatically.
            </p>
          </div>
        )}
        {isFeatureUnlocked(state, 'research') && (
          <div className="panel">
            <Lightbulb size={25} />
            <h2>Make discoveries</h2>
            <p>
              Thinkers produce Research. Spend it in the Research sheet; each
              discovery may reveal another. Keep Woodcutters working for
              discoveries that also need Materials.
            </p>
          </div>
        )}
        {isFeatureUnlocked(state, 'skillTree') && (
          <div className="panel">
            <Sparkles size={25} />
            <h2>Choose your direction</h2>
            <p>
              Entering a new era earns a Civilization point. Spend it on a skill
              in the Skills sheet. Bonuses from skills, technologies, and
              achievements multiply together.
            </p>
          </div>
        )}
        <div className="panel">
          <h2>Come back to more</h2>
          <p>
            Assigned workers produce for up to 8 hours while you’re away.
            Progress is stored in this browser every 10 seconds. Use Settings to
            export a backup or move your game to another browser.
          </p>
        </div>
      </div>
    </>
  );
}
