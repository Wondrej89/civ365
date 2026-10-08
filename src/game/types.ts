import type Decimal from 'break_infinity.js';

export type Amount = Decimal | number | string;
export type Condition =
  | { type: 'always' | 'never' }
  | { type: 'resourceAtLeast'; resource: string; value: Amount }
  | { type: 'populationAtLeast'; value: Amount }
  | { type: 'technologyOwned'; technologyId: string }
  | { type: 'achievementOwned'; achievementId: string }
  | { type: 'eraReached'; eraId: string }
  | { type: 'featureUnlocked'; featureId: string }
  | { type: 'statAtLeast'; stat: string; value: Amount }
  | { type: 'all' | 'any'; conditions: Condition[] }
  | { type: 'not'; condition: Condition };

export type GameEffect =
  | {
      type:
        'productionMultiplier' | 'productionFlatBonus' | 'resourceMultiplier';
      resource: string;
      value: Amount;
    }
  | {
      type: 'jobProductionMultiplier';
      job: string;
      resource?: string;
      value: Amount;
    }
  | {
      type: 'unitProductionMultiplier';
      unit: string;
      resource?: string;
      value: Amount;
    }
  | { type: 'populationCostMultiplier'; value: Amount }
  | { type: 'populationGrowthIntervalMultiplier'; value: Amount }
  | { type: 'unlockFeature' | 'unlockJob' | 'unlockUnit'; id: string }
  | { type: 'grantResource'; resource: string; value: Amount };

export interface ResourceDefinition {
  id: string;
  name: string;
  description: string;
  feature: string;
  initiallyVisible: boolean;
  meta?: boolean;
  color: string;
  productionLabel?: string;
}
export interface FeatureDefinition {
  id: string;
  name: string;
  unlockCondition: Condition;
  notify?: boolean;
}
export interface ProductionUnitDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  tier: number;
  baseProduction: { resource: string; amount: Amount }[];
  populationCost?: number;
  upgradeFrom?: { unitId: string; amount: number };
  costs?: ResourceCost[];
  unlockCondition: Condition;
  visibilityCondition?: Condition;
  effects?: GameEffect[];
  /** Version-one assignment IDs represented by this tier-one unit. */
  legacyJobs?: string[];
}
export interface ResourceCost {
  resource: string;
  amount: Amount;
}
export interface TechnologyDefinition {
  id: string;
  name: string;
  description: string;
  era: string;
  cost: ResourceCost[];
  prerequisites: string[];
  effects: GameEffect[];
  effectText: string;
  visibilityCondition: Condition;
  unlockCondition: Condition;
  lockedPreview?: boolean;
  branch?: string;
  treePosition?: { x: number; y: number };
}
export interface StatisticSample {
  /** Whole seconds of simulated play, independent of development speed and wall clock. */
  timestamp: number;
  value: string;
}
export interface StatisticSeriesDefinition {
  id: string;
  name: string;
  color: string;
  sampleValue: (state: GameState) => Amount;
  unlockCondition: Condition;
}
export interface SkillDefinition {
  id: string;
  name: string;
  branch: string;
  description: string;
  cost: number;
  maxLevel: number;
  costGrowth: number;
  prerequisites: { id: string; level: number }[];
  exclusiveWith: string[];
  effects: GameEffect[];
}
export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  hidden?: boolean;
  condition: Condition;
  effects: GameEffect[];
  reward: string;
}
export interface EraDefinition {
  id: string;
  name: string;
  subtitle: string;
  previous?: string;
  requirements: Condition[];
  effects: GameEffect[];
  onEnterEffects: GameEffect[];
}
export interface GameEvent {
  id: number;
  time: number;
  message: string;
  kind: 'milestone' | 'research' | 'achievement' | 'era' | 'system';
  notify: boolean;
}
export interface Settings {
  notifications: boolean;
}
export interface GameState {
  saveVersion: number;
  createdAt: number;
  savedAt: number;
  lastSimulationTime: number;
  resources: Record<string, Decimal>;
  population: Decimal;
  productionUnits: Record<string, Decimal>;
  unlockedProductionUnits: string[];
  constructedProductionUnits: string[];
  autoPopulationGrowth: {
    enabled: boolean;
    accumulator: number;
    foodReservePercent: number;
  };
  statisticsHistory: Record<string, StatisticSample[]>;
  statisticsSamplingAccumulator: number;
  researchedTechnologies: string[];
  purchasedSkills: Record<string, number>;
  achievements: string[];
  currentEra: string;
  reachedEras: string[];
  announcedEras: string[];
  unlockedFeatures: string[];
  statistics: Record<string, Decimal>;
  settings: Settings;
  eventLog: GameEvent[];
  nextEventId: number;
}
export type GameAction =
  | { type: 'gather'; resource: string }
  | { type: 'grow' }
  | { type: 'autoGrowth'; enabled?: boolean; foodReservePercent?: number }
  | {
      type: 'recruit' | 'release' | 'upgrade' | 'dismantle';
      unitId: string;
      amount: Amount | 'max';
    }
  | { type: 'research'; id: string }
  | { type: 'skill'; id: string }
  | { type: 'advance'; id: string }
  | { type: 'settings'; settings: Partial<Settings> };
