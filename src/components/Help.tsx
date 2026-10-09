import { useI18n } from '../i18n/LocaleContext';
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
  const { t: tr } = useI18n();

  const { state } = useGame();
  return (
    <>
      <div className="sheet-heading">
        <div>
          <div className="eyebrow">{tr('A LITTLE FIELD GUIDE')}</div>
          <h1>{tr('A little spreadsheet. A whole civilization.')}</h1>
          <p>
            {tr(
              'Take your time. Your next possibility will appear when you’re ready.',
            )}
          </p>
        </div>
      </div>
      <div className="help-cards">
        <div className="panel">
          <Leaf size={25} />
          <h2>{tr('Start small')}</h2>
          <p>
            {tr(
              'Click Gather Food to collect one Food. The “Your next step” card helps you find your next milestone.',
            )}
          </p>
        </div>
        {isFeatureUnlocked(state, 'population') && (
          <div className="panel">
            <Users size={25} />
            <h2>{tr('Grow together')}</h2>
            <p>
              {tr(
                'Spend Food to welcome new people. Urban Communities, Public Health and Sanitation increase people per growth step; Civil Administration adds a person per City or Metropolis. Food is charged for each person and partial groups are allowed. Growth stops at Population Capacity.',
              )}
            </p>
          </div>
        )}
        {isFeatureUnlocked(state, 'research') && (
          <div className="panel">
            <Lightbulb size={25} />
            <h2>{tr('Make discoveries')}</h2>
            <p>
              {tr(
                'Thinkers produce Research. Spend it in the Research sheet; each discovery may reveal another. Keep Woodcutters working for discoveries that also need Materials.',
              )}
            </p>
          </div>
        )}
        {isFeatureUnlocked(state, 'skillTree') && (
          <div className="panel">
            <Sparkles size={25} />
            <h2>{tr('Choose your direction')}</h2>
            <p>
              {tr(
                'Entering a new era earns a Civilization point. Spend it on a skill in the Skills sheet. Bonuses from skills, technologies, and achievements multiply together.',
              )}
            </p>
          </div>
        )}
        {isFeatureUnlocked(state, 'settlements') && (
          <div className="panel">
            <Building2 size={25} />
            <h2>{tr('Make room to grow')}</h2>
            <p>
              {tr(
                'Settlements provide Population Capacity. New settlements use one territory slot; upgrades keep it. Further Town, City and Metropolis upgrades become progressively more expensive in Materials. Building more cities also increases growth after Civil Administration.',
              )}
            </p>
          </div>
        )}
        {isFeatureUnlocked(state, 'military') && (
          <div className="panel">
            <Swords size={25} />
            <h2>{tr('Prepare an army')}</h2>
            <p>
              {tr(
                'Recruit Infantry, Cavalry and Ranged troops from Idle Population. Equipment upgrades improve an entire category without using more people. Every soldier consumes Food and Materials each second. Keep production above upkeep or readiness and combat power fall. Demobilization returns soldiers to Idle Population.',
              )}
            </p>
          </div>
        )}
        {isFeatureUnlocked(state, 'territory') && (
          <div className="panel">
            <Map size={25} />
            <h2>{tr('Expand your realm')}</h2>
            <p>
              {tr(
                'Choose one of three regions in Territory: Food, Materials or Research. Harder defenders offer larger permanent production bonuses. Infantry counters Cavalry, Cavalry counters Ranged, and Ranged counters Infantry; balanced armies reduce uncertainty. Espionage reveals defenders. Campaigns consume supplies and continue offline; casualties reduce Population.',
              )}
            </p>
          </div>
        )}
        {isFeatureUnlocked(state, 'autoPopulationGrowth') && (
          <div className="panel">
            <Timer size={25} />
            <h2>{tr('Let your community grow')}</h2>
            <p>
              {tr(
                'Enable Auto Growth in Population. Each attempt uses the same Food price as manual growth and protects your selected share of current Food. Turn it off to save for upgrades. It also works while you’re away.',
              )}
            </p>
          </div>
        )}
        {isFeatureUnlocked(state, 'statistics') && (
          <div className="panel">
            <ChartLine size={25} />
            <h2>{tr('Keep a record')}</h2>
            <p>
              {tr(
                'Statistics charts your population as time passes, including your time away. It counts people represented by production units, so upgrades keep your population totals intact.',
              )}
            </p>
          </div>
        )}
        <div className="panel">
          <h2>{tr('Come back to more')}</h2>
          <p>
            {tr(
              'Production units work for up to 8 hours while you’re away. Progress is stored in this browser every 10 seconds. Use Settings to export a backup or move your game to another browser.',
            )}
          </p>
        </div>
      </div>
    </>
  );
}
