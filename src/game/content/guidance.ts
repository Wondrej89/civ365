import type { Condition } from '../types';
export const guidance: {
  id: string;
  visible: Condition;
  complete: Condition;
  title: string;
  text: string;
  stat?: string;
  resource?: string;
  target?: number;
}[] = [
  {
    id: 'firstFood',
    visible: { type: 'always' },
    complete: { type: 'featureUnlocked', featureId: 'materials' },
    title: 'Start with the essentials',
    text: 'Gather 5 Food. A small discovery is just around the corner.',
    stat: 'totalFoodProduced',
    target: 5,
  },
  {
    id: 'firstPerson',
    visible: { type: 'featureUnlocked', featureId: 'materials' },
    complete: { type: 'populationAtLeast', value: 2 },
    title: 'Make room for someone',
    text: 'Gather 10 Food and grow your population. You don’t have to do everything alone.',
    resource: 'food',
    target: 10,
  },
  {
    id: 'assign',
    visible: { type: 'featureUnlocked', featureId: 'jobs' },
    complete: { type: 'statAtLeast', stat: 'assignedWorkers', value: 1 },
    title: 'Let your people help',
    text: 'Open Food Production and recruit a Gatherer from Idle Population. They keep finding Food, even while you’re away.',
  },
  {
    id: 'grow',
    visible: { type: 'featureUnlocked', featureId: 'jobs' },
    complete: { type: 'featureUnlocked', featureId: 'research' },
    title: 'A growing community',
    text: 'Reach 5 people. Keep some gathering Food and make room for new possibilities.',
    target: 5,
  },
  {
    id: 'think',
    visible: { type: 'featureUnlocked', featureId: 'research' },
    complete: { type: 'statAtLeast', stat: 'totalResearchProduced', value: 1 },
    title: 'Give curiosity a little time',
    text: 'Open Research Production and recruit a Thinker. Then explore the Research sheet to discover your first technologies.',
  },
  {
    id: 'discover',
    visible: { type: 'featureUnlocked', featureId: 'research' },
    complete: { type: 'technologyOwned', technologyId: 'agriculture' },
    title: 'Ideas become possibilities',
    text: 'Explore the Language branch in Research. Keep Woodcutters working to supply your discoveries.',
  },
  {
    id: 'settle',
    visible: { type: 'technologyOwned', technologyId: 'agriculture' },
    complete: { type: 'eraReached', eraId: 'agricultural' },
    title: 'Put down roots',
    text: 'Upgrade 5 Gatherers into a Farmer in Food Production and reach 20 people. Your next chapter is almost here.',
    target: 20,
  },
  {
    id: 'choose',
    visible: { type: 'featureUnlocked', featureId: 'skillTree' },
    complete: {
      type: 'not',
      condition: {
        type: 'resourceAtLeast',
        resource: 'civilizationPoints',
        value: 1,
      },
    },
    title: 'A civilization of your own',
    text: 'Your first era is complete. Open Skills and spend your first Civilization point to choose a direction.',
  },
];
