export const sheetDefinitions = [
  { id: 'overview', name: 'Overview', requiredFeature: 'manualGathering' },
  { id: 'workforce', name: 'Workforce', requiredFeature: 'jobs' },
  { id: 'population', name: 'Population', requiredFeature: 'population' },
  { id: 'statistics', name: 'Statistics', requiredFeature: 'statistics' },
  { id: 'settlements', name: 'Settlements', requiredFeature: 'settlements' },
  { id: 'military', name: 'Military', requiredFeature: 'military' },
  { id: 'territory', name: 'Territory', requiredFeature: 'territory' },
  { id: 'research', name: 'Research', requiredFeature: 'research' },
  { id: 'skills', name: 'Skills', requiredFeature: 'skillTree' },
  { id: 'achievements', name: 'Achievements', requiredFeature: 'achievements' },
] as const;
export type SheetId = (typeof sheetDefinitions)[number]['id'];
