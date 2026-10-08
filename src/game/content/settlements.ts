import type { SettlementDefinition } from '../types';
export const settlements: SettlementDefinition[] = [
  {
    id: 'camp',
    name: 'Founding Camp',
    description:
      'Your first people have room to begin. Establish a permanent settlement here.',
    tier: 0,
    capacity: 20,
    costs: [],
    unlockCondition: { type: 'never' },
  },
  {
    id: 'settlement',
    name: 'Settlement',
    description: 'A permanent home on one territory slot.',
    tier: 1,
    capacity: 25,
    costs: [
      { resource: 'materials', amount: 100 },
      { resource: 'food', amount: 100 },
    ],
    upgradeFrom: 'camp',
    unlockCondition: { type: 'featureUnlocked', featureId: 'settlements' },
  },
  {
    id: 'town',
    name: 'Town',
    description: 'Expand a Settlement without using another slot.',
    tier: 2,
    capacity: 75,
    costs: [
      { resource: 'materials', amount: 500 },
      { resource: 'food', amount: 300 },
    ],
    upgradeFrom: 'settlement',
    unlockCondition: {
      type: 'technologyOwned',
      technologyId: 'villageOrganization',
    },
  },
  {
    id: 'city',
    name: 'City',
    description: 'Build lasting infrastructure for a larger community.',
    tier: 3,
    capacity: 250,
    costs: [
      { resource: 'materials', amount: 2500 },
      { resource: 'food', amount: 1000 },
    ],
    upgradeFrom: 'town',
    unlockCondition: { type: 'technologyOwned', technologyId: 'construction' },
  },
  {
    id: 'metropolis',
    name: 'Metropolis',
    description: 'A regional center with room for a growing civilization.',
    tier: 4,
    capacity: 1000,
    costs: [
      { resource: 'materials', amount: 25000 },
      { resource: 'food', amount: 10000 },
    ],
    upgradeFrom: 'city',
    unlockCondition: {
      type: 'technologyOwned',
      technologyId: 'advancedUrbanPlanning',
    },
  },
];
