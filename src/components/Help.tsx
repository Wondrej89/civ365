import {
  Leaf,
  Users,
  Lightbulb,
  Sparkles,
  Timer,
  ChartLine,
  Building2,
  Swords,
  Map,
} from 'lucide-react';
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
              population. Open Workforce to recruit from Idle Population.
              Upgrades combine lower-tier units; dismantling restores them.
              Growth stops at Population Capacity, even with Auto Growth.
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
        {isFeatureUnlocked(state, 'settlements') && (
          <div className="panel">
            <Building2 size={25} />
            <h2>Make room to grow</h2>
            <p>
              Settlements provide Population Capacity. Upgrade your Founding
              Camp, then research Village Organization for Towns. New
              settlements use one territory slot; upgrades keep the same slot.
              Materials and Food pay for both. Overview lists every requirement
              for your next era.
            </p>
          </div>
        )}
        {isFeatureUnlocked(state, 'military') && (
          <div className="panel">
            <Swords size={25} />
            <h2>Prepare an army</h2>
            <p>
              Recruit soldiers from Idle Population using Food and Materials.
              Soldiers remain part of your population and produce no resources.
              Demobilizing returns them to Idle Population. Compare Military
              Power with the next frontier before committing your army.
            </p>
          </div>
        )}
        {isFeatureUnlocked(state, 'territory') && (
          <div className="panel">
            <Map size={25} />
            <h2>Expand your realm</h2>
            <p>
              Launch one campaign in Territory. Your army stays committed until
              it finishes, including while you’re away. Victory adds a territory
              slot for another settlement. Casualties also reduce Population; a
              stronger army reduces losses and finishes sooner.
            </p>
          </div>
        )}
        {isFeatureUnlocked(state, 'autoPopulationGrowth') && (
          <div className="panel">
            <Timer size={25} />
            <h2>Let your community grow</h2>
            <p>
              Enable Auto Growth in Population. Each attempt uses the same Food
              price as manual growth and protects your selected share of current
              Food. Turn it off to save for upgrades. It also works while you’re
              away.
            </p>
          </div>
        )}
        {isFeatureUnlocked(state, 'statistics') && (
          <div className="panel">
            <ChartLine size={25} />
            <h2>Keep a record</h2>
            <p>
              Statistics charts your population as time passes, including your
              time away. It counts people represented by production units, so
              upgrades keep your population totals intact.
            </p>
          </div>
        )}
        <div className="panel">
          <h2>Come back to more</h2>
          <p>
            Production units work for up to 8 hours while you’re away. Progress
            is stored in this browser every 10 seconds. Use Settings to export a
            backup or move your game to another browser.
          </p>
        </div>
      </div>
    </>
  );
}
