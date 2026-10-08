import type { EraDefinition, Condition } from '../types';
import { balance } from './config';
const tech = (...ids: string[]): Condition[] =>
  ids.map((technologyId) => ({ type: 'technologyOwned', technologyId }));
const config = balance.eraRequirements;
const milestones = (values: {
  population: number;
  territories?: number;
  settlements?: number;
  cities?: number;
  capacity?: number;
  military?: number;
}): Condition[] => [
  { type: 'populationAtLeast', value: values.population },
  ...(values.territories
    ? [{ type: 'territoriesAtLeast' as const, value: values.territories }]
    : []),
  ...(values.settlements
    ? [
        {
          type: 'settlementsAtLeast' as const,
          value: values.settlements,
          minimumTier: 1,
        },
      ]
    : []),
  ...(values.cities
    ? [
        {
          type: 'settlementsAtLeast' as const,
          value: values.cities,
          minimumTier: 3,
        },
      ]
    : []),
  ...(values.capacity
    ? [{ type: 'populationCapacityAtLeast' as const, value: values.capacity }]
    : []),
  ...(values.military
    ? [{ type: 'militaryPowerAtLeast' as const, value: values.military }]
    : []),
];
const chapter = (
  id: string,
  name: string,
  subtitle: string,
  previous: string,
  requirements: Condition[],
): EraDefinition => ({
  id,
  name,
  subtitle,
  previous,
  requirements,
  effects: [],
  onEnterEffects: [
    { type: 'grantResource', resource: 'civilizationPoints', value: 1 },
  ],
});
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
    ...chapter(
      'agricultural',
      'Agricultural Age',
      'From wandering to putting down roots.',
      'tribal',
      [...tech('agriculture'), ...milestones(config.agricultural)],
    ),
    onEnterEffects: [
      { type: 'grantResource', resource: 'civilizationPoints', value: 1 },
      { type: 'unlockFeature', id: 'skillTree' },
    ],
  },
  chapter(
    'bronze',
    'Bronze Age',
    'Build homes, organize your people, and expand beyond the homeland.',
    'agricultural',
    [
      ...tech('mining', 'writing', 'organizedWarfare'),
      ...milestones(config.bronze),
    ],
  ),
  chapter(
    'classical',
    'Classical Age',
    'Cities, institutions, and ideas built to last.',
    'bronze',
    [
      ...tech('mathematics', 'construction', 'formalEducation'),
      ...milestones(config.classical),
    ],
  ),
  chapter(
    'medieval',
    'Medieval Age',
    'Cities and armies hold a growing realm together.',
    'classical',
    [
      ...tech('engineering', 'institutionalLearning', 'classicalArmy'),
      ...milestones(config.medieval),
    ],
  ),
  chapter(
    'renaissance',
    'Renaissance Age',
    'Knowledge travels further, and your cities grow with it.',
    'medieval',
    [
      ...tech(
        'universities',
        'civilAdministration',
        'professionalArmy',
        'longDistanceTrade',
      ),
      ...milestones(config.renaissance),
    ],
  ),
  chapter(
    'industrial',
    'Industrial Age',
    'The first machines point toward a new kind of civilization.',
    'renaissance',
    [
      ...tech('steamPower', 'mechanization', 'earlyIndustry'),
      ...milestones(config.industrial),
    ],
  ),
];
