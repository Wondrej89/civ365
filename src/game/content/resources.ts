import type { ResourceDefinition } from '../types';
export const resources: ResourceDefinition[] = [
  {
    id: 'food',
    name: 'Food',
    description: 'The beginning of everything.',
    feature: 'manualGathering',
    initiallyVisible: true,
    color: '#c18d30',
  },
  {
    id: 'materials',
    name: 'Materials',
    description: 'Make something that lasts.',
    feature: 'materials',
    initiallyVisible: false,
    color: '#957359',
  },
  {
    id: 'research',
    name: 'Research',
    description: 'Small ideas. New possibilities.',
    feature: 'research',
    initiallyVisible: false,
    color: '#627fb4',
  },
  {
    id: 'wealth',
    name: 'Wealth',
    description: 'Value in exchange.',
    feature: 'economy',
    initiallyVisible: false,
    color: '#ccad52',
  },
  {
    id: 'civilizationPoints',
    name: 'Civilization points',
    description: 'Choose your civilization’s direction.',
    feature: 'skillTree',
    initiallyVisible: false,
    meta: true,
    color: '#176b47',
  },
];
