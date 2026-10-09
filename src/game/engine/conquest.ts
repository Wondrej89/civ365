import { message } from '../../i18n/core';
import { balance } from '../content/config';
import { militaryUnits } from '../content/military';
import { frontierTypes } from '../content/territories';
import { resources } from '../content/resources';
import { D, sum } from '../utils/numbers';
import { activeEffects } from './effects';
import { militaryUnlocked, powerPerMilitaryUnit } from './military';
import { isFeatureUnlocked } from './conditions';
import { logEvent } from '../systems/progression';
import type { GameState, Amount } from '../types';

export const frontierDefense = (state: GameState) =>
  D(
    D(balance.conquest.baseDefense)
      .mul(
        D(balance.conquest.defenseGrowth).pow(
          state.statistics.territoriesConquered,
        ),
      )
      .toString(),
  );
function hash(text: string) {
  let result = 2166136261;
  for (const char of text)
    result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  return result >>> 0;
}
/** Choices remain identical through reload, a defeat, or changing army composition. */
export function frontierOptions(state: GameState) {
  const seed = hash(state.statistics.territoriesConquered.toString());
  return frontierTypes.map((type, index) => {
    const difficulty = (seed + index) % 3,
      dominant = (seed + index + 1) % 3;
    const shares = balance.conquest.compositionShares;
    const composition = Object.fromEntries(
      militaryUnits.map((unit, role) => [
        unit.id,
        shares[(role - dominant + 3) % 3],
      ]),
    );
    return {
      ...type,
      difficulty,
      defense: frontierDefense(state).mul(
        balance.conquest.difficultyFactors[difficulty],
      ),
      productionBonus: D(balance.conquest.productionBonuses[difficulty]),
      composition,
    };
  });
}
export function counterStrength(state: GameState) {
  const available = militaryUnits.filter((u) =>
    militaryUnlocked(state, u),
  ).length;
  return available < 2
    ? 0
    : available < 3
      ? balance.military.twoTypeCounterStrength
      : balance.military.counterStrength;
}
export function combinedArmsModifier(state: GameState) {
  const available = militaryUnits.filter((u) => militaryUnlocked(state, u)),
    total = sum(available.map((u) => state.militaryUnits[u.id]));
  return available.length > 1 &&
    total.gt(0) &&
    available.every((u) =>
      state.militaryUnits[u.id]
        .div(total)
        .gte(balance.military.minimumCombinedShare),
    )
    ? balance.military.combinedArmsBonus
    : 1;
}
/** Infantry counters cavalry, cavalry counters ranged, ranged counters infantry. */
export function tacticalPower(
  state: GameState,
  composition: Record<string, number>,
) {
  const strength = counterStrength(state);
  const power = sum(
    militaryUnits.map((unit, index) => {
      const weak = militaryUnits[(index + 1) % 3].id,
        strong = militaryUnits[(index + 2) % 3].id;
      return state.militaryUnits[unit.id]
        .mul(powerPerMilitaryUnit(state, unit))
        .mul(1 + strength * (composition[weak] - composition[strong]));
    }),
  )
    .mul(state.militaryReadiness)
    .mul(combinedArmsModifier(state));
  return D(power.toString());
}
function effectMultiplier(
  state: GameState,
  type: 'militaryCasualtyMultiplier' | 'campaignDurationMultiplier',
) {
  return activeEffects(state)
    .reduce((n, e) => (e.type === type ? n.mul(e.value) : n), D(1))
    .toNumber();
}
export function battleResult(
  power: Amount,
  defense: Amount,
  casualtyMultiplier = 1,
) {
  const config = balance.conquest,
    ratio = D(power).div(defense).toNumber(),
    victory = ratio >= 1;
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
    victory,
    casualtyRate: Math.min(
      config.maximumCasualtyRate,
      rate * casualtyMultiplier,
    ),
  };
}
function duration(state: GameState, power: Amount, defense: Amount) {
  const config = balance.conquest;
  return Math.max(
    config.minimumDurationSeconds,
    Math.min(
      config.maximumDurationSeconds,
      (config.baseDurationSeconds /
        Math.max(0.01, D(power).div(defense).toNumber())) *
        effectMultiplier(state, 'campaignDurationMultiplier'),
    ),
  );
}
const assessment = (ratio: number) =>
  ratio >= 1.5
    ? 'Strong advantage'
    : ratio >= 1
      ? 'Advantage'
      : ratio >= 0.75
        ? 'Disadvantage'
        : 'Severe disadvantage';
/** Engine forecast is exact; the UI must use campaignPreview until intelligence is unlocked. */
export function campaignForecast(state: GameState, targetId?: string) {
  const choices = frontierOptions(state),
    target = choices.find((t) => t.id === targetId) ?? choices[0];
  const power = tacticalPower(state, target.composition),
    casualtyMultiplier = effectMultiplier(state, 'militaryCasualtyMultiplier');
  return {
    power,
    defense: target.defense,
    ...battleResult(power, target.defense, casualtyMultiplier),
    assessment: assessment(power.div(target.defense).toNumber()),
    durationSeconds: duration(state, power, target.defense),
    casualtyMultiplier,
    target,
  };
}
/** Public preview exposes bounds, never a hidden composition or exact tactical power. */
export function campaignPreview(state: GameState, targetId: string) {
  const target = frontierOptions(state).find((t) => t.id === targetId)!;
  const known = isFeatureUnlocked(state, 'intelligence');
  const shares = balance.conquest.compositionShares;
  const possibilities = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [2, 0, 1],
    [1, 2, 0],
    [2, 1, 0],
  ].map((order) =>
    tacticalPower(
      state,
      Object.fromEntries(militaryUnits.map((u, i) => [u.id, shares[order[i]]])),
    ),
  );
  const minimumPower = known
    ? tacticalPower(state, target.composition)
    : possibilities.reduce((n, value) => n.min(value), possibilities[0]);
  const maximumPower = known
    ? minimumPower
    : possibilities.reduce((n, value) => n.max(value), possibilities[0]);
  const minimumRatio = minimumPower.div(target.defense).toNumber(),
    maximumRatio = maximumPower.div(target.defense).toNumber();
  const casualtyMultiplier = effectMultiplier(
    state,
    'militaryCasualtyMultiplier',
  );
  return {
    id: target.id,
    name: target.name,
    resource: target.resource,
    territory: target.territory,
    difficulty: target.difficulty,
    defense: target.defense,
    productionBonus: target.productionBonus,
    composition: known ? target.composition : null,
    minimumPower,
    maximumPower,
    assessment:
      minimumRatio < 1 && maximumRatio >= 1
        ? 'Uncertain outcome'
        : assessment(minimumRatio),
    minimumCasualtyRate: battleResult(
      maximumPower,
      target.defense,
      casualtyMultiplier,
    ).casualtyRate,
    maximumCasualtyRate: battleResult(
      minimumPower,
      target.defense,
      casualtyMultiplier,
    ).casualtyRate,
    minimumDurationSeconds: duration(state, maximumPower, target.defense),
    maximumDurationSeconds: duration(state, minimumPower, target.defense),
  };
}
export function launchCampaign(state: GameState, targetId?: string) {
  if (
    !isFeatureUnlocked(state, 'territory') ||
    state.activeCampaign ||
    (targetId !== undefined && !frontierTypes.some((t) => t.id === targetId))
  )
    return false;
  const forecast = campaignForecast(state, targetId);
  if (forecast.power.lte(0)) return false;
  state.activeCampaign = {
    power: forecast.power,
    defense: forecast.defense,
    victory: forecast.victory,
    casualtyRate: forecast.casualtyRate,
    durationSeconds: forecast.durationSeconds,
    casualtyMultiplier: forecast.casualtyMultiplier,
    frontierIndex: state.statistics.territoriesConquered.add(1).toString(),
    targetId: forecast.target.id,
    rewardTerritory: forecast.target.territory,
    rewardResource: forecast.target.resource,
    productionBonus: forecast.target.productionBonus,
    committedUnits: { ...state.militaryUnits },
    elapsedSeconds: 0,
    initialReadiness: state.militaryReadiness,
    lowestReadiness: state.militaryReadiness,
    legacyLosses: null,
  };
  logEvent(
    state,
    message('Campaign launched for {territory}.', {
      territory: forecast.target.name,
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
  const result =
    campaign.targetId === 'legacy' ||
    campaign.lowestReadiness >= campaign.initialReadiness
      ? campaign
      : battleResult(
          campaign.power.mul(
            campaign.lowestReadiness / campaign.initialReadiness,
          ),
          campaign.defense,
          campaign.casualtyMultiplier,
        );
  const deaths = sum(
    militaryUnits.map((unit) => {
      const lost =
        campaign.legacyLosses?.[unit.id] ??
        campaign.committedUnits[unit.id].mul(result.casualtyRate).floor();
      state.militaryUnits[unit.id] = state.militaryUnits[unit.id].sub(lost);
      return lost.mul(unit.populationCost);
    }),
  );
  state.population = state.population.sub(deaths);
  state.statistics.militaryCasualties =
    state.statistics.militaryCasualties.add(deaths);
  state.statistics.campaignsCompleted =
    state.statistics.campaignsCompleted.add(1);
  if (result.victory) {
    const id = campaign.rewardTerritory;
    state.ownedTerritories[id] = state.ownedTerritories[id].add(1);
    state.statistics.territoriesConquered =
      state.statistics.territoriesConquered.add(1);
    if (campaign.rewardResource) {
      state.territoryProductionBonuses[campaign.rewardResource] =
        state.territoryProductionBonuses[campaign.rewardResource].add(
          campaign.productionBonus,
        );
      logEvent(
        state,
        message(
          'Territory conquered! +1 settlement slot and +{bonus}% {resource} production.',
          {
            bonus: campaign.productionBonus.mul(100).toString(),
            resource: resources.find((r) => r.id === campaign.rewardResource)!
              .name,
          },
        ),
      );
    } else
      logEvent(
        state,
        'A new territory has been conquered. New territory acquired. You can establish another settlement.',
      );
  }
  logEvent(
    state,
    message('Campaign {0}. {1} people lost.', {
      '0': result.victory ? 'won' : 'lost',
      '1': deaths.toString(),
    }),
    'milestone',
    !result.victory,
  );
  state.activeCampaign = null;
}
