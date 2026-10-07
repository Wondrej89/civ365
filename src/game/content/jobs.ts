import type { JobDefinition } from '../types';
export const jobs: JobDefinition[] = [
  {
    id: 'gatherer',
    name: 'Gatherer',
    description: 'Find food in the wild.',
    unlockedBy: { type: 'featureUnlocked', featureId: 'jobs' },
    production: [{ resource: 'food', amount: 0.2 }],
  },
  {
    id: 'woodcutter',
    name: 'Woodcutter',
    description: 'Gather wood and useful materials.',
    unlockedBy: { type: 'featureUnlocked', featureId: 'jobs' },
    production: [{ resource: 'materials', amount: 0.2 }],
  },
  {
    id: 'thinker',
    name: 'Thinker',
    description: 'Turn curiosity into knowledge.',
    unlockedBy: { type: 'featureUnlocked', featureId: 'research' },
    production: [{ resource: 'research', amount: 0.15 }],
  },
  {
    id: 'farmer',
    name: 'Farmer',
    description: 'Cultivate a more reliable food supply.',
    unlockedBy: { type: 'never' },
    production: [{ resource: 'food', amount: 0.85 }],
  },
];
