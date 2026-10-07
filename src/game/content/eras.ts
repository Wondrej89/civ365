import type { EraDefinition } from '../types';
export const eras: EraDefinition[] = [
  {
    id: 'tribal',
    name: 'Tribal Age',
    subtitle: 'Every civilization starts with someone.',
    requirements: [],
    effects: [],
    onEnterEffects: [],
  },
  {
    id: 'agricultural',
    name: 'Agricultural Age',
    subtitle: 'From wandering to putting down roots.',
    previous: 'tribal',
    requirements: [
      { type: 'technologyOwned', technologyId: 'agriculture' },
      { type: 'populationAtLeast', value: 20 },
    ],
    effects: [],
    onEnterEffects: [
      { type: 'grantResource', resource: 'civilizationPoints', value: 1 },
      { type: 'unlockFeature', id: 'skillTree' },
    ],
  },
];
