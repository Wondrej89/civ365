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
    id: 'smallTribe',
    name: 'Small Tribe',
    description: 'Reach a population of 10.',
    condition: { type: 'populationAtLeast', value: 10 },
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
];
