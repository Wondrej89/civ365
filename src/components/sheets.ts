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
import { TerritorySheet } from './Territory';

export const sheets = [
  {
    id: 'overview',
    name: 'Overview',
    requiredFeature: 'manualGathering',
    icon: LayoutDashboard,
    component: Overview,
  },
  {
    id: 'workforce',
    name: 'Workforce',
    requiredFeature: 'jobs',
    icon: Factory,
    component: WorkforceSheet,
  },
  {
    id: 'population',
    name: 'Population',
    requiredFeature: 'population',
    icon: Users,
    component: PopulationSheet,
  },
  {
    id: 'statistics',
    name: 'Statistics',
    requiredFeature: 'statistics',
    icon: ChartNoAxesCombined,
    component: StatisticsSheet,
  },
  {
    id: 'settlements',
    name: 'Settlements',
    requiredFeature: 'settlements',
    icon: Building2,
    component: SettlementsSheet,
  },
  {
    id: 'military',
    name: 'Military',
    requiredFeature: 'military',
    icon: Swords,
    component: MilitarySheet,
  },
  {
    id: 'territory',
    name: 'Territory',
    requiredFeature: 'territory',
    icon: Map,
    component: TerritorySheet,
  },
  {
    id: 'research',
    name: 'Research',
    requiredFeature: 'research',
    icon: FlaskConical,
    component: ResearchSheet,
  },
  {
    id: 'skills',
    name: 'Skills',
    requiredFeature: 'skillTree',
    icon: GitBranch,
    component: SkillsSheet,
  },
  {
    id: 'achievements',
    name: 'Achievements',
    requiredFeature: 'achievements',
    icon: Award,
    component: AchievementsSheet,
  },
];
