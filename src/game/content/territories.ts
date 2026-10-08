import type { TerritoryDefinition } from '../types';
export const territories: TerritoryDefinition[] = [
  { id: 'homeland', name: 'Homeland', settlementSlots: 1 },
  {
    id: 'frontier',
    name: 'Frontier territory',
    settlementSlots: 1,
    strategicResources: [],
  },
];
