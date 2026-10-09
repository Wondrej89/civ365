import { resources } from './content/resources';
import { units } from './content/units';
import { territories } from './content/territories';
import { settlements } from './content/settlements';
import { militaryUnits } from './content/military';
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
  'totalSettlementsBuilt',
  'territoriesConquered',
  'militaryCasualties',
  'campaignsCompleted',
  'foodSpentOnMilitary',
  'materialsSpentOnMilitary',
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
    ownedTerritories: Object.fromEntries(
      territories.map((t) => [t.id, D(t.id === 'homeland' ? 1 : 0)]),
    ),
    settlements: Object.fromEntries(
      settlements.map((s) => [s.id, D(s.id === 'camp' ? 1 : 0)]),
    ),
    militaryUnits: Object.fromEntries(militaryUnits.map((u) => [u.id, D()])),
    militaryTiers: Object.fromEntries(militaryUnits.map((u) => [u.id, 0])),
    militaryReadiness: 1,
    settlementInvestments: Object.fromEntries(
      settlements.map((s) => [s.id, D(s.id === 'camp' ? 1 : 0)]),
    ),
    territoryProductionBonuses: Object.fromEntries(
      ['food', 'materials', 'research'].map((id) => [id, D()]),
    ),
    activeCampaign: null,
    populationCapacityBonus: D(),
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
        D(
          id === 'maxPopulation' ||
            id === 'totalPopulationCreated' ||
            id === 'totalSettlementsBuilt'
            ? 1
            : 0,
        ),
      ]),
    ),
    settings: { notifications: true, language: 'en' },
    eventLog: [
      {
        id: 1,
        time: now,
        message: 'A new beginning. Your civilization starts here.',
        translation: { key: 'A new beginning. Your civilization starts here.' },
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
    ownedTerritories: { ...state.ownedTerritories },
    settlements: { ...state.settlements },
    militaryUnits: { ...state.militaryUnits },
    militaryTiers: { ...state.militaryTiers },
    settlementInvestments: { ...state.settlementInvestments },
    territoryProductionBonuses: { ...state.territoryProductionBonuses },
    activeCampaign: state.activeCampaign
      ? {
          ...state.activeCampaign,
          committedUnits: { ...state.activeCampaign.committedUnits },
        }
      : null,
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
