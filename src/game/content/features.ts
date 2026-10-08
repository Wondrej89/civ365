import type { FeatureDefinition } from '../types';
export const features: FeatureDefinition[] = [
  {
    id: 'manualGathering',
    name: 'Gathering',
    unlockCondition: { type: 'always' },
  },
  {
    id: 'materials',
    name: 'Materials',
    unlockCondition: {
      type: 'statAtLeast',
      stat: 'totalFoodProduced',
      value: 5,
    },
    notify: true,
  },
  {
    id: 'population',
    name: 'Population',
    unlockCondition: {
      type: 'statAtLeast',
      stat: 'totalFoodProduced',
      value: 10,
    },
    notify: true,
  },
  {
    id: 'jobs',
    name: 'Workforce',
    unlockCondition: { type: 'populationAtLeast', value: 2 },
    notify: true,
  },
  {
    id: 'research',
    name: 'Research',
    unlockCondition: { type: 'populationAtLeast', value: 5 },
    notify: true,
  },
  {
    id: 'technologyTree',
    name: 'Technologies',
    unlockCondition: { type: 'featureUnlocked', featureId: 'research' },
  },
  {
    id: 'skillTree',
    name: 'Skills',
    unlockCondition: { type: 'eraReached', eraId: 'agricultural' },
    notify: true,
  },
  {
    id: 'achievements',
    name: 'Achievements',
    unlockCondition: {
      type: 'statAtLeast',
      stat: 'achievementCount',
      value: 1,
    },
  },
  {
    id: 'settlementPlanning',
    name: 'Settlement Planning',
    unlockCondition: { type: 'technologyOwned', technologyId: 'settledLife' },
  },
  {
    id: 'autoPopulationGrowth',
    name: 'Automatic Population Growth',
    unlockCondition: { type: 'technologyOwned', technologyId: 'naturalGrowth' },
    notify: true,
  },
  {
    id: 'statistics',
    name: 'Statistics',
    unlockCondition: { type: 'technologyOwned', technologyId: 'recordKeeping' },
    notify: true,
  },
  {
    id: 'populationDistribution',
    name: 'Population Distribution',
    unlockCondition: { type: 'technologyOwned', technologyId: 'census' },
    notify: true,
  },
  ...['economy', 'energy', 'space', 'prestige'].map((id) => ({
    id,
    name: id,
    unlockCondition: { type: 'never' as const },
  })),
];
