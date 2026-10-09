import type { TerritoryDefinition } from '../types';
export const territories: TerritoryDefinition[] = [
  { id: 'homeland', name: 'Homeland', settlementSlots: 1 },
  {
    id: 'frontier',
    name: 'Frontier territory',
    settlementSlots: 1,
    strategicResources: [],
  },
  { id: 'farmland', name: 'Fertile Plains', settlementSlots: 1 },
  { id: 'highlands', name: 'Mineral Highlands', settlementSlots: 1 },
  { id: 'scholarlands', name: 'Scholarly Province', settlementSlots: 1 },
];
export const frontierTypes = [
  {
    id: 'food',
    name: 'Fertile Plains',
    resource: 'food',
    territory: 'farmland',
  },
  {
    id: 'materials',
    name: 'Mineral Highlands',
    resource: 'materials',
    territory: 'highlands',
  },
  {
    id: 'research',
    name: 'Scholarly Province',
    resource: 'research',
    territory: 'scholarlands',
  },
];
