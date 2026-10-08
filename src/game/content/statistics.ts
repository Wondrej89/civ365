import type { StatisticSeriesDefinition, Condition } from '../types';
import { populationDistribution } from '../systems/statistics';
export const statisticSeries: StatisticSeriesDefinition[] = [
  {
    id: 'population',
    name: 'Population over time',
    color: '#21764f',
    sampleValue: (state) => state.population,
    unlockCondition: { type: 'featureUnlocked', featureId: 'statistics' },
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
