import type { MilitaryUnitDefinition } from '../types';
const tech = (technologyId: string) => ({
  type: 'technologyOwned' as const,
  technologyId,
});
export const militaryUnits: MilitaryUnitDefinition[] = [
  {
    id: 'levy',
    name: 'Levy',
    description: 'A local levy takes people away from production.',
    populationCost: 1,
    resourceCosts: [
      { resource: 'food', amount: 10 },
      { resource: 'materials', amount: 2 },
    ],
    basePower: 1,
    unlockCondition: tech('organizedWarfare'),
  },
  {
    id: 'spearman',
    name: 'Spearman',
    description: 'Equipped with bronze weapons.',
    populationCost: 1,
    resourceCosts: [
      { resource: 'food', amount: 20 },
      { resource: 'materials', amount: 15 },
    ],
    basePower: 3,
    unlockCondition: tech('bronzeWorking'),
  },
  {
    id: 'archer',
    name: 'Archer',
    description: 'Trained ranged troops.',
    populationCost: 1,
    resourceCosts: [
      { resource: 'food', amount: 25 },
      { resource: 'materials', amount: 20 },
    ],
    basePower: 4,
    unlockCondition: tech('archery'),
  },
  {
    id: 'heavyInfantry',
    name: 'Heavy Infantry',
    description: 'A disciplined classical army.',
    populationCost: 1,
    resourceCosts: [
      { resource: 'food', amount: 40 },
      { resource: 'materials', amount: 50 },
    ],
    basePower: 8,
    unlockCondition: tech('classicalArmy'),
  },
  {
    id: 'knight',
    name: 'Knight',
    description: 'Expensive equipment gives each soldier greater power.',
    populationCost: 1,
    resourceCosts: [
      { resource: 'food', amount: 80 },
      { resource: 'materials', amount: 120 },
    ],
    basePower: 16,
    unlockCondition: tech('feudalOrganization'),
  },
  {
    id: 'musketeer',
    name: 'Musketeer',
    description: 'Gunpowder weapons change the frontier.',
    populationCost: 1,
    resourceCosts: [
      { resource: 'food', amount: 150 },
      { resource: 'materials', amount: 250 },
    ],
    basePower: 30,
    unlockCondition: tech('gunpowder'),
  },
];
