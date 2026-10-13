import {
  LayoutDashboard,
  Users,
  FlaskConical,
  GitBranch,
  Award,
  ChartNoAxesCombined,
  Factory,
  Building2,
  Swords,
  Map,
  ArrowRightLeft,
} from 'lucide-react';
import { Overview } from './Overview';
import { WorkforceSheet } from './Workforce';
import { ResearchSheet } from './Research';
import { SkillsSheet } from './Skills';
import { AchievementsSheet } from './Achievements';
import { PopulationSheet } from './Population';
import { StatisticsSheet } from './Statistics';
import { SettlementsSheet } from './Settlements';
import { MilitarySheet } from './Military';
import { TradeSheet } from './Trade';
import { TerritorySheet } from './Territory';

import { sheetDefinitions } from '../game/content/sheets';
const views = {
  overview: { icon: LayoutDashboard, component: Overview },
  workforce: { icon: Factory, component: WorkforceSheet },
  population: { icon: Users, component: PopulationSheet },
  statistics: { icon: ChartNoAxesCombined, component: StatisticsSheet },
  settlements: { icon: Building2, component: SettlementsSheet },
  military: { icon: Swords, component: MilitarySheet },
  territory: { icon: Map, component: TerritorySheet },
  trade: { icon: ArrowRightLeft, component: TradeSheet },
  research: { icon: FlaskConical, component: ResearchSheet },
  skills: { icon: GitBranch, component: SkillsSheet },
  achievements: { icon: Award, component: AchievementsSheet },
};
export const sheets = sheetDefinitions.map((sheet) => ({
  ...sheet,
  ...views[sheet.id],
}));
