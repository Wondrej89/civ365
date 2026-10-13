import { balance } from './config';
import { D } from '../utils/numbers';
import type { AchievementDefinition, GameEffect, GameState } from '../types';

export const achievementTracks = [
  {
    id: 'population',
    name: 'Growing Civilization',
    description: 'Reach new population records.',
    stat: 'maxPopulation',
    start: 10,
    legacyId: 'smallTribe',
    resource: 'food',
    reward: '+2% Food production',
  },
  {
    id: 'research',
    name: 'Knowledge Through the Ages',
    description:
      'Produce more Research over the lifetime of your civilization.',
    stat: 'totalResearchProduced',
    start: 100,
    resource: 'research',
    reward: '+2% Research production',
  },
  {
    id: 'materials',
    name: 'Builders of Civilization',
    description:
      'Produce more Materials over the lifetime of your civilization.',
    stat: 'totalMaterialsProduced',
    start: 1000,
    resource: 'materials',
    reward: '+2% Materials production',
  },
  {
    id: 'conquest',
    name: 'Beyond the Frontier',
    description:
      'Conquer more territories over the lifetime of your civilization.',
    stat: 'territoriesConquered',
    start: 1,
    resource: 'materials',
    reward: '+2% Materials production',
  },
  {
    id: 'trade',
    name: 'International Exchange',
    description:
      'Exchange more trade value over the lifetime of your civilization.',
    stat: 'tradeValueExchanged',
    start: 1000,
    resource: 'research',
    reward: '+2% Research production',
  },
];

/** Independent tier IDs preserve claimed rewards across losses, reloads and migrations. */
export const milestoneAchievements: AchievementDefinition[] =
  achievementTracks.flatMap((track) =>
    Array.from({ length: balance.achievementTracks.tiers }, (_, index) => {
      const target = D(track.start)
        .mul(D(balance.achievementTracks.growth).pow(index))
        .toString();
      const effects: GameEffect[] = [
        { type: 'productionMultiplier', resource: track.resource, value: 1.02 },
      ];
      return {
        id:
          index === 0 && track.legacyId
            ? track.legacyId
            : `${track.id}Milestone${index + 1}`,
        name: track.name,
        description: track.description,
        condition: {
          type: 'statAtLeast' as const,
          stat: track.stat,
          value: target,
        },
        effects,
        reward: track.reward,
        track: { id: track.id, tier: index + 1, target, stat: track.stat },
      };
    }),
  );

export function achievementTrackProgress(state: GameState, id: string) {
  const tiers = milestoneAchievements.filter((a) => a.track!.id === id);
  const earned = tiers.filter((a) => state.achievements.includes(a.id));
  const next = tiers.find((a) => !state.achievements.includes(a.id));
  const value = state.statistics[tiers[0].track!.stat];
  return { tiers, earned, next, value };
}
