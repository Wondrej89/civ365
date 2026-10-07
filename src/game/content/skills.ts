import type { SkillDefinition } from '../types';
export const skills: SkillDefinition[] = [
  {
    id: 'growingTribe',
    name: 'Growing Tribe',
    branch: 'Expansion',
    description:
      'People are your greatest possibility. Population costs 10% less Food.',
    cost: 1,
    maxLevel: 1,
    costGrowth: 1,
    prerequisites: [],
    exclusiveWith: [],
    effects: [{ type: 'populationCostMultiplier', value: 0.9 }],
  },
  {
    id: 'efficientHands',
    name: 'Efficient Hands',
    branch: 'Industry',
    description:
      'A little less waste, a little more craft. +10% Materials production.',
    cost: 1,
    maxLevel: 1,
    costGrowth: 1,
    prerequisites: [],
    exclusiveWith: [],
    effects: [
      { type: 'productionMultiplier', resource: 'materials', value: 1.1 },
    ],
  },
  {
    id: 'oralTradition',
    name: 'Oral Tradition',
    branch: 'Knowledge',
    description: 'Keep the stories worth telling. +10% Research production.',
    cost: 1,
    maxLevel: 1,
    costGrowth: 1,
    prerequisites: [],
    exclusiveWith: [],
    effects: [
      { type: 'productionMultiplier', resource: 'research', value: 1.1 },
    ],
  },
];
