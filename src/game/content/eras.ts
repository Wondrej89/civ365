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
  {
    id: 'bronze',
    name: 'Bronze Age',
    subtitle: 'Tools, records, and a civilization taking shape.',
    previous: 'agricultural',
    requirements: [
      { type: 'technologyOwned', technologyId: 'mining' },
      { type: 'technologyOwned', technologyId: 'writing' },
      { type: 'populationAtLeast', value: 50 },
      { type: 'resourceAtLeast', resource: 'research', value: 250 },
    ],
    effects: [],
    onEnterEffects: [
      { type: 'grantResource', resource: 'civilizationPoints', value: 1 },
    ],
  },
  {
    id: 'classical',
    name: 'Classical Age',
    subtitle: 'Cities, institutions, and ideas built to last.',
    previous: 'bronze',
    requirements: [
      { type: 'populationAtLeast', value: 200 },
      ...['mathematics', 'construction', 'formalEducation'].map(
        (technologyId) => ({ type: 'technologyOwned' as const, technologyId }),
      ),
    ],
    effects: [],
    onEnterEffects: [
      { type: 'grantResource', resource: 'civilizationPoints', value: 1 },
    ],
  },
];
