import type { StatisticSeriesDefinition, Condition } from '../types';
import { populationDistribution } from '../systems/statistics';
import { populationCapacity, ownedTerritories } from '../engine/settlements';
import { militaryPower } from '../engine/military';
const discovered = (featureId: string): Condition => ({
  type: 'all',
  conditions: [
    { type: 'featureUnlocked', featureId: 'statistics' },
    { type: 'featureUnlocked', featureId },
  ],
});
export const statisticSeries: StatisticSeriesDefinition[] = [
  {
    id: 'population',
    name: 'Population over time',
    color: '#21764f',
    sampleValue: (state) => state.population,
    unlockCondition: { type: 'featureUnlocked', featureId: 'statistics' },
  },
  {
    id: 'populationCapacity',
    name: 'Population Capacity over time',
    color: '#709e82',
    sampleValue: populationCapacity,
    unlockCondition: discovered('settlements'),
  },
  {
    id: 'territories',
    name: 'Owned Territories over time',
    color: '#a58b5e',
    sampleValue: (state) => ownedTerritories(state),
    unlockCondition: discovered('territory'),
  },
  {
    id: 'militaryPower',
    name: 'Military Power over time',
    color: '#bd7070',
    sampleValue: (state) => militaryPower(state),
    unlockCondition: discovered('military'),
  },
];
export const statisticDistributions: {
  id: string;
  name: string;
  unlockCondition: Condition;
  values: typeof populationDistribution;
}[] = [
  {
    id: 'populationDistribution',
    name: 'Population distribution',
    unlockCondition: {
      type: 'featureUnlocked',
      featureId: 'populationDistribution',
    },
    values: populationDistribution,
  },
];
