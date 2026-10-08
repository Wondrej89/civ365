import { resources } from './content/resources';
import { units } from './content/units';
import { balance } from './content/config';
import { D } from './utils/numbers';
import type { GameState } from './types';

export const statisticIds = [
  'totalFoodProduced',
  'totalMaterialsProduced',
  'totalResearchProduced',
  'totalManualClicks',
  'maxPopulation',
  'totalPlayTime',
  'eraTransitions',
  'technologiesResearched',
  'assignedWorkers',
  'achievementCount',
  'totalPopulationCreated',
  'foodSpentOnGrowth',
];
export function createInitialState(now = Date.now()): GameState {
  return {
    saveVersion: balance.saveVersion,
    createdAt: now,
    savedAt: now,
    lastSimulationTime: now,
    resources: Object.fromEntries(resources.map((r) => [r.id, D()])),
    population: D(1),
    productionUnits: Object.fromEntries(units.map((u) => [u.id, D()])),
    unlockedProductionUnits: [],
    constructedProductionUnits: [],
    autoPopulationGrowth: {
      enabled: false,
      accumulator: 0,
      foodReservePercent: balance.automaticGrowth.defaultReservePercent,
    },
    statisticsHistory: {},
    statisticsSamplingAccumulator: 0,
    researchedTechnologies: [],
    purchasedSkills: {},
    achievements: [],
    currentEra: 'tribal',
    reachedEras: ['tribal'],
    announcedEras: [],
    unlockedFeatures: ['manualGathering'],
    statistics: Object.fromEntries(
      statisticIds.map((id) => [
        id,
        D(id === 'maxPopulation' || id === 'totalPopulationCreated' ? 1 : 0),
      ]),
    ),
    settings: { notifications: true },
    eventLog: [
      {
        id: 1,
        time: now,
        message: 'A new beginning. Your civilization starts here.',
        kind: 'system',
        notify: false,
      },
    ],
    nextEventId: 2,
  };
}
export function cloneState(state: GameState): GameState {
  return {
    ...state,
    resources: { ...state.resources },
    productionUnits: { ...state.productionUnits },
    unlockedProductionUnits: [...state.unlockedProductionUnits],
    constructedProductionUnits: [...state.constructedProductionUnits],
    autoPopulationGrowth: { ...state.autoPopulationGrowth },
    statisticsHistory: { ...state.statisticsHistory },
    researchedTechnologies: [...state.researchedTechnologies],
    purchasedSkills: { ...state.purchasedSkills },
    achievements: [...state.achievements],
    reachedEras: [...state.reachedEras],
    announcedEras: [...state.announcedEras],
    unlockedFeatures: [...state.unlockedFeatures],
    statistics: { ...state.statistics },
    settings: { ...state.settings },
    eventLog: [...state.eventLog],
  };
}
