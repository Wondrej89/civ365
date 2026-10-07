import {
  LayoutDashboard,
  Users,
  FlaskConical,
  GitBranch,
  Award,
} from 'lucide-react';
import { Overview } from './Overview';
import { PopulationSheet } from './Workforce';
import { ResearchSheet } from './Research';
import { SkillsSheet } from './Skills';
import { AchievementsSheet } from './Achievements';

export const sheets = [
  {
    id: 'overview',
    name: 'Overview',
    requiredFeature: 'manualGathering',
    icon: LayoutDashboard,
    component: Overview,
  },
  {
    id: 'population',
    name: 'Population',
    requiredFeature: 'jobs',
    icon: Users,
    component: PopulationSheet,
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
