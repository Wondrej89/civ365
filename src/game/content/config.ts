export const balance = {
  populationGrowth: { baseFoodCost: 10, multiplier: 1.12 },
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
  saveVersion: 2,
};
