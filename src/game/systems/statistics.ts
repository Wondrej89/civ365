import { resources } from '../content/resources';
import { units } from '../content/units';
import { statisticSeries } from '../content/statistics';
import { balance } from '../content/config';
import { evaluateCondition } from '../engine/conditions';
import {
  getPopulationFootprint,
  ownedUnits,
  idlePopulation,
} from '../engine/units';
import { D, sum } from '../utils/numbers';
import { militaryPopulation } from '../engine/population-accounting';
import type { GameState, StatisticSample } from '../types';

/** Retention is isolated here so a future downsampler can replace it. */
export const retainSamples = (samples: StatisticSample[]) =>
  samples.slice(-balance.statistics.maxSamples);
export function sampleStatistics(state: GameState, onlyMissing = false) {
  const timestamp = Math.floor(
    Math.min(
      Number.MAX_SAFE_INTEGER,
      state.statistics.totalPlayTime.toNumber() + 1e-7,
    ),
  );
  for (const series of statisticSeries) {
    if (!evaluateCondition(series.unlockCondition, state)) continue;
    const history = state.statisticsHistory[series.id] ?? [];
    if (onlyMissing && history.length) continue;
    const sample = {
      timestamp,
      value: D(series.sampleValue(state)).toString(),
    };
    const previous = history.at(-1);
    state.statisticsHistory[series.id] = retainSamples(
      previous?.timestamp === timestamp
        ? [...history.slice(0, -1), sample]
        : [...history, sample],
    );
  }
}
export function populationDistribution(state: GameState) {
  return [
    {
      id: 'idle',
      name: 'Idle',
      color: '#a3b4a9',
      value: idlePopulation(state),
    },
    ...resources
      .filter((r) => !r.meta && units.some((u) => u.category === r.id))
      .map((r) => ({
        id: r.id,
        name: r.productionLabel ?? `${r.name} Production`,
        color: r.color,
        value: sum(
          units
            .filter((u) => u.category === r.id)
            .map((u) =>
              ownedUnits(state, u.id).mul(getPopulationFootprint(u.id)),
            ),
        ),
      })),
    ...(state.unlockedFeatures.includes('military')
      ? [
          {
            id: 'military',
            name: 'Military',
            color: '#bd7070',
            value: militaryPopulation(state),
          },
        ]
      : []),
  ];
}
