export const balance = {
  technologyCosts: {
    tribal: { research: 1, materials: 1 },
    agricultural: { research: 3, materials: 2 },
    bronze: { research: 5, materials: 3 },
    classical: { research: 8, materials: 5 },
  } as Record<string, { research: number; materials: number }>,
  populationGrowth: {
    baseFoodCost: 10,
    multiplier: 1.12,
    scalingBreakpoint: 20,
    laterMultiplier: 1.02,
  },
  automaticGrowth: {
    intervalSeconds: 10,
    minimumIntervalSeconds: 0.5,
    defaultReservePercent: 10,
    reserveOptions: [0, 10, 25, 50],
  },
  statistics: { sampleIntervalSeconds: 30, maxSamples: 2000 },
  manualGathering: {
    food: { amount: 1, feature: 'manualGathering' },
    materials: { amount: 1, feature: 'materials' },
  } as Record<string, { amount: number; feature: string }>,
  tickMs: 100,
  renderMs: 250,
  autosaveMs: 10_000,
  maxOfflineSeconds: 8 * 60 * 60,
  offlineStepSeconds: 10,
  eventLimit: 100,
  saveVersion: 3,
};
