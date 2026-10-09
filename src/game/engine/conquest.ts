import { message } from '../../i18n/core';
import { balance } from '../content/config';
import { militaryUnits } from '../content/military';
import { D, sum } from '../utils/numbers';
import { activeEffects } from './effects';
import { militaryPower } from './military';
import { isFeatureUnlocked } from './conditions';
import { logEvent } from '../systems/progression';
import type { GameState } from '../types';

export const frontierDefense = (state: GameState) =>
  D(balance.conquest.baseDefense).mul(
    D(balance.conquest.defenseGrowth).pow(
      state.statistics.territoriesConquered,
    ),
  );
export function campaignForecast(state: GameState) {
  const config = balance.conquest,
    power = militaryPower(state),
    defense = frontierDefense(state);
  const ratio = power.div(defense).toNumber(),
    victory = power.gte(defense);
  const multiplier = (
    type: 'militaryCasualtyMultiplier' | 'campaignDurationMultiplier',
  ) =>
    activeEffects(state)
      .reduce((n, e) => (e.type === type ? n.mul(e.value) : n), D(1))
      .toNumber();
  const rate = victory
    ? Math.max(
        config.minimumCasualtyRate,
        config.victoryCasualtyFactor / Math.max(1, ratio) ** 2,
      )
    : Math.min(
        config.maximumCasualtyRate,
        config.defeatCasualtyRate +
          config.defeatRatioPenalty * (1 - Math.max(0, ratio)),
      );
  return {
    power,
    defense,
    victory,
    assessment:
      ratio >= 1.5
        ? 'Strong advantage'
        : victory
          ? 'Advantage'
          : ratio >= 0.75
            ? 'Disadvantage'
            : 'Severe disadvantage',
    casualtyRate: Math.min(
      config.maximumCasualtyRate,
      rate * multiplier('militaryCasualtyMultiplier'),
    ),
    durationSeconds: Math.max(
      config.minimumDurationSeconds,
      Math.min(
        config.maximumDurationSeconds,
        (config.baseDurationSeconds / Math.max(0.01, ratio)) *
          multiplier('campaignDurationMultiplier'),
      ),
    ),
  };
}
export function launchCampaign(state: GameState) {
  if (!isFeatureUnlocked(state, 'territory') || state.activeCampaign)
    return false;
  const forecast = campaignForecast(state);
  if (forecast.power.lte(0)) return false;
  state.activeCampaign = {
    ...forecast,
    frontierIndex: state.statistics.territoriesConquered.add(1).toString(),
    committedUnits: { ...state.militaryUnits },
    elapsedSeconds: 0,
  };
  logEvent(
    state,
    message('Campaign launched for Frontier {0}.', {
      '0': state.activeCampaign.frontierIndex,
    }),
    'milestone',
    false,
  );
  return true;
}
export function finishCampaign(state: GameState) {
  const campaign = state.activeCampaign;
  if (!campaign || campaign.elapsedSeconds < campaign.durationSeconds - 1e-8)
    return;
  const deaths = sum(
    militaryUnits.map((unit) => {
      const lost = (campaign.committedUnits[unit.id] ?? D())
        .mul(campaign.casualtyRate)
        .floor();
      state.militaryUnits[unit.id] = (state.militaryUnits[unit.id] ?? D()).sub(
        lost,
      );
      return lost.mul(unit.populationCost);
    }),
  );
  state.population = state.population.sub(deaths);
  state.statistics.militaryCasualties =
    state.statistics.militaryCasualties.add(deaths);
  state.statistics.campaignsCompleted =
    state.statistics.campaignsCompleted.add(1);
  if (campaign.victory) {
    const id = balance.conquest.rewardTerritory;
    state.ownedTerritories[id] = (state.ownedTerritories[id] ?? D()).add(1);
    state.statistics.territoriesConquered =
      state.statistics.territoriesConquered.add(1);
    logEvent(
      state,
      'A new territory has been conquered. New territory acquired. You can establish another settlement.',
      'milestone',
    );
  }
  logEvent(
    state,
    message('Campaign {0}. {1} people lost.', {
      '0': campaign.victory ? 'won' : 'lost',
      '1': deaths.toString(),
    }),
    'milestone',
    !campaign.victory,
  );
  state.activeCampaign = null;
}
