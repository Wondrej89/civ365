import type {
  MilitaryUnitDefinition,
  MilitaryTierDefinition,
  Condition,
} from '../types';
const tech = (technologyId: string): Condition => ({
  type: 'technologyOwned',
  technologyId,
});
function tier(
  name: string,
  era: string,
  technologyId: string | null,
  power: number,
  food: number,
  materials: number,
  upkeepFood: number,
  upkeepMaterials: number,
): MilitaryTierDefinition {
  return {
    name,
    era,
    basePower: power,
    unlockCondition: technologyId ? tech(technologyId) : { type: 'never' },
    resourceCosts: [
      { resource: 'food', amount: food },
      { resource: 'materials', amount: materials },
    ],
    upkeep: [
      { resource: 'food', amount: upkeepFood },
      { resource: 'materials', amount: upkeepMaterials },
    ],
  };
}
/** Exactly three persistent army categories; equipment upgrades replace the entire category. */
export const militaryUnits: MilitaryUnitDefinition[] = [
  {
    id: 'infantry',
    name: 'Infantry',
    description: 'Holds the line and counters cavalry.',
    populationCost: 1,
    unlockCondition: tech('organizedWarfare'),
    tiers: [
      tier('Levy', 'agricultural', 'organizedWarfare', 1, 10, 5, 0.1, 0.04),
      tier('Spearman', 'bronze', 'bronzeWorking', 3, 20, 30, 0.2, 0.15),
      tier(
        'Heavy Infantry',
        'classical',
        'classicalArmy',
        8,
        40,
        100,
        0.4,
        0.5,
      ),
      tier(
        'Men-at-Arms',
        'medieval',
        'professionalArmy',
        18,
        80,
        300,
        0.7,
        1.5,
      ),
      tier('Line Infantry', 'renaissance', 'gunpowder', 36, 150, 900, 1, 4),
      tier('Rifle Infantry', 'industrial', 'rifling', 72, 300, 4000, 2, 12),
    ],
  },
  {
    id: 'cavalry',
    name: 'Cavalry',
    description: 'Mobile troops counter ranged units.',
    populationCost: 1,
    unlockCondition: tech('horsemanship'),
    tiers: [
      tier('Horsemen', 'bronze', 'horsemanship', 4, 30, 80, 0.4, 0.25),
      tier('Lancers', 'classical', 'classicalArmy', 9, 60, 250, 0.7, 0.8),
      tier('Knight', 'medieval', 'feudalOrganization', 20, 100, 700, 1.2, 2),
      tier('Dragoon', 'renaissance', 'gunpowder', 40, 200, 1800, 1.8, 5),
      tier('Mounted Rifles', 'industrial', 'rifling', 80, 400, 6000, 3, 15),
    ],
  },
  {
    id: 'ranged',
    name: 'Ranged',
    description: 'Ranged troops counter infantry.',
    populationCost: 1,
    unlockCondition: tech('archery'),
    tiers: [
      tier('Archer', 'bronze', 'archery', 4, 25, 30, 0.2, 0.12),
      tier(
        'Composite Bowman',
        'classical',
        'classicalArmy',
        8,
        40,
        100,
        0.3,
        0.4,
      ),
      tier(
        'Crossbowman',
        'medieval',
        'feudalOrganization',
        18,
        80,
        400,
        0.5,
        1.5,
      ),
      tier('Musketeer', 'renaissance', 'gunpowder', 36, 150, 1000, 0.8, 4),
      tier('Rifleman', 'industrial', 'rifling', 72, 300, 4000, 1.6, 12),
      tier('Submachine Gunner', 'future', null, 140, 600, 16000, 3, 30),
    ],
  },
];
/** Only save migration uses legacy unit IDs. Population is preserved when categories are folded. */
export const legacyMilitary: Record<string, { role: string; tier: number }> = {
  levy: { role: 'infantry', tier: 0 },
  spearman: { role: 'infantry', tier: 1 },
  heavyInfantry: { role: 'infantry', tier: 2 },
  archer: { role: 'ranged', tier: 0 },
  knight: { role: 'cavalry', tier: 2 },
  musketeer: { role: 'ranged', tier: 3 },
};
