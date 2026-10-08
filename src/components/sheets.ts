import {
  LayoutDashboard,
  Users,
  FlaskConical,
  GitBranch,
  Award,
  ChartNoAxesCombined,
  Factory,
} from 'lucide-react';
import { Overview } from './Overview';
import { WorkforceSheet } from './Workforce';
import { ResearchSheet } from './Research';
import { SkillsSheet } from './Skills';
import { AchievementsSheet } from './Achievements';
import { PopulationSheet } from './Population';
import { StatisticsSheet } from './Statistics';

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
