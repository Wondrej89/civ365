import { milestoneAchievements } from './achievement-tracks';
import type { AchievementDefinition } from '../types';
export const achievements: AchievementDefinition[] = [
  {
    id: 'firstSteps',
    name: 'First Steps',
    description: 'Reach a population of 2.',
    condition: { type: 'populationAtLeast', value: 2 },
    effects: [{ type: 'productionMultiplier', resource: 'food', value: 1.02 }],
    reward: '+2% Food production',
  },
  {
    id: 'organized',
    name: 'Getting Organized',
    description: 'Assign 5 workers at once.',
    condition: { type: 'statAtLeast', stat: 'assignedWorkers', value: 5 },
    effects: [
      { type: 'productionMultiplier', resource: 'materials', value: 1.02 },
    ],
    reward: '+2% Materials production',
  },
  {
    id: 'curious',
    name: 'Curious Minds',
    description: 'Generate a total of 10 Research.',
    condition: {
      type: 'statAtLeast',
      stat: 'totalResearchProduced',
      value: 10,
    },
    effects: [
      { type: 'productionMultiplier', resource: 'research', value: 1.02 },
    ],
    reward: '+2% Research production',
  },
  {
    id: 'settled',
    name: 'Settled Life',
    description: 'Enter the Agricultural Age.',
    hidden: true,
    condition: { type: 'eraReached', eraId: 'agricultural' },
    effects: [{ type: 'productionMultiplier', resource: 'food', value: 1.02 }],
    reward: '+2% Food production',
  },
  {
    id: 'firstCity',
    name: 'A City of Your Own',
    description: 'Establish your first City.',
    condition: { type: 'settlementsAtLeast', value: 1, minimumTier: 3 },
    effects: [
      { type: 'productionMultiplier', resource: 'materials', value: 1.02 },
    ],
    reward: '+2% Materials production',
  },
  {
    id: 'firstTrade',
    name: 'Across Borders',
    description: 'Complete your first international exchange.',
    condition: { type: 'statAtLeast', stat: 'tradesCompleted', value: 1 },
    effects: [{ type: 'tradeEfficiencyBonus', value: 0.01 }],
    reward: '+1 percentage point trade efficiency',
  },
  {
    id: 'industrialCivilization',
    name: 'The Industrial Revolution',
    description: 'Enter the Industrial Age.',
    condition: { type: 'eraReached', eraId: 'industrial' },
    effects: [
      { type: 'productionMultiplier', resource: 'materials', value: 1.03 },
    ],
    reward: '+3% Materials production',
  },
  {
    id: 'modernCivilization',
    name: 'A Connected World',
    description: 'Enter the Modern Age.',
    condition: { type: 'eraReached', eraId: 'modern' },
    effects: [
      { type: 'productionMultiplier', resource: 'research', value: 1.03 },
    ],
    reward: '+3% Research production',
  },
  ...milestoneAchievements,
];
