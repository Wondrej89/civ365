import { describe, expect, it } from 'vitest';
import { createInitialState } from '../state';
import { eras } from '../content/eras';
import { technologies } from '../content/technologies';
import { balance } from '../content/config';
import { units } from '../content/units';
import { D } from '../utils/numbers';
import { applyAction, simulate } from '../engine/simulation';
import { nextPlaythroughAction } from './helpers/playthrough';
import { militaryPower } from '../engine/military';
import { militaryPopulation } from '../engine/population-accounting';
import {
  frontierDefense,
  frontierOptions,
  campaignPreview,
} from '../engine/conquest';
import { populationCost } from '../engine/production';
import { growthInterval, populationGrowthAmount } from '../engine/population';
import { netProductionPerSecond } from '../engine/economy';
import { ownedTerritories } from '../engine/settlements';
import { settleProgression } from '../systems/progression';
import { seedDiscoveries } from '../systems/discoveries';
import { serializeSave, deserializeSave } from '../systems/save';
import { applyOfflineProgress } from '../systems/offline';

/** Reconstruct the reported state from screenshots; recovery gets no additional grants. */
function reportedRealm() {
  const state = createInitialState(1000);
  state.currentEra = 'renaissance';
  state.reachedEras = eras.slice(0, 6).map((e) => e.id);
  state.researchedTechnologies = technologies
    .filter((t) => state.reachedEras.includes(t.era))
    .map((t) => t.id);
  state.population = D(5730);
  state.statistics.totalPopulationCreated = D(5842);
  state.statistics.maxPopulation = D(5730);
  state.statistics.totalFoodProduced = D('1e8');
  state.statistics.totalPlayTime = D(60780);
  state.statistics.militaryCasualties = D(112);
  state.statistics.totalSettlementsBuilt = D(12);
  state.statistics.territoriesConquered = D(11);
  state.ownedTerritories.frontier = D(11);
  state.settlements.camp = D();
  state.settlements.town = D(4);
  state.settlements.city = D(6);
  state.settlements.metropolis = D(2);
  state.settlementInvestments = {
    camp: D(1),
    settlement: D(12),
    town: D(12),
    city: D(8),
    metropolis: D(2),
  };
  state.productionUnits.farm = D(270);
  state.productionUnits.farmer = D(9);
  state.productionUnits.gatherer = D(3);
  state.militaryUnits = { infantry: D(94), cavalry: D(66), ranged: D(73) };
  state.militaryTiers = { infantry: 4, cavalry: 3, ranged: 3 };
  state.territoryProductionBonuses = {
    food: D(0.3),
    materials: D(0.11),
    research: D(0.11),
  };
  state.purchasedSkills = {
    growingTribe: 1,
    efficientHands: 1,
    oralTradition: 1,
  };
  state.resources.food = D(137000);
  state.resources.materials = D(18_700_000);
  state.resources.research = D(25_650_000);
  state.resources.civilizationPoints = D(2);
  settleProgression(state);
  state.discoveryProgress = seedDiscoveries(state);
  return state;
}

describe('Renaissance recovery and Industrial balance', () => {
  it('keeps early difficulty, changes continuously to the late slope, and remains unbounded', () => {
    const state = reportedRealm();
    for (let conquered = 0; conquered <= 25; conquered++) {
      state.statistics.territoriesConquered = D(conquered);
      expect(frontierDefense(state).toNumber()).toBeCloseTo(
        40 * 1.8 ** Math.min(conquered, 8) * 1.35 ** Math.max(0, conquered - 8),
        5,
      );
    }
    state.statistics.territoriesConquered = D(100);
    expect(frontierDefense(state).gt(40_000)).toBe(true);
  });

  it('supports all three final frontiers with the required population and a balanced, supplied Renaissance army', () => {
    const state = reportedRealm();
    state.population = D(balance.eraRequirements.industrial.population);
    for (const unit of units) state.productionUnits[unit.id] = D();
    state.productionUnits.farm = D(50); // 1,000 Food workers
    state.productionUnits.workshop = D(17); // 340 Materials workers
    state.militaryUnits = { infantry: D(220), cavalry: D(220), ranged: D(220) }; // 660 soldiers
    state.statistics.territoriesConquered = D(14);
    state.ownedTerritories.frontier = D(14);
    expect(
      militaryPower(state).gte(balance.eraRequirements.industrial.military),
    ).toBe(true);
    expect(militaryPopulation(state).lte(state.population.mul(0.35))).toBe(
      true,
    );
    for (const target of frontierOptions(state)) {
      expect(
        target.defense.lt(balance.eraRequirements.industrial.military),
      ).toBe(true);
      expect(
        campaignPreview(state, target.id).minimumPower.gte(target.defense),
      ).toBe(true);
    }
    const net = netProductionPerSecond(state);
    expect(net.materials.gt(0)).toBe(true);
    expect(net.food.gt(populationCost(state).div(growthInterval(state)))).toBe(
      true,
    );
    expect(populationGrowthAmount(state).eq(20)).toBe(true);
  });

  it('recovers the reported saved state and reaches Industrial using only normal actions and balanced production', () => {
    const raw = JSON.parse(serializeSave(reportedRealm()));
    let state = deserializeSave(raw);
    expect(state.population.toString()).toBe(raw.population);
    expect(state.resources.materials.toString()).toBe(raw.resources.materials);
    expect(state.statistics.foodSpentOnGrowth.toString()).toBe(
      raw.statistics.foodSpentOnGrowth,
    );
    const startingTime = state.statistics.totalPlayTime;
    for (
      let time = 0;
      time < 8 * 3600 && state.currentEra !== 'industrial';
      time += 30
    ) {
      for (let i = 0; i < 1000; i++) {
        const action = nextPlaythroughAction(state);
        if (!action) break;
        const next = applyAction(state, action);
        if (next === state)
          throw Error(`Invalid recovery action: ${JSON.stringify(action)}`);
        state = next;
        if (i === 999) throw Error('Recovery policy cycled');
      }
      state = simulate(state, 30);
    }
    console.log(
      'Reported Renaissance recovery:',
      state.statistics.totalPlayTime.sub(startingTime).toString(),
      'seconds',
    );
    expect(state.currentEra).toBe('industrial');
    expect(ownedTerritories(state).gte(16)).toBe(true);
    expect(state.productionUnits.workshop.gt(0)).toBe(true);
    expect(netProductionPerSecond(state).materials.gt(0)).toBe(true);
    expect(netProductionPerSecond(state).food.gt(0)).toBe(true);
    expect(deserializeSave(JSON.parse(serializeSave(state))).currentEra).toBe(
      'industrial',
    );
  }, 120000);

  it('preserves a campaign launched under the old defense curve and finishes it offline exactly once', () => {
    const state = reportedRealm();
    state.productionUnits.farm = D(180);
    state.militaryUnits = { infantry: D(500), cavalry: D(500), ranged: D(500) };
    const original = balance.conquest.lateDefenseGrowth;
    let running;
    try {
      balance.conquest.lateDefenseGrowth = balance.conquest.defenseGrowth;
      running = simulate(
        applyAction(state, { type: 'launchCampaign', targetId: 'food' }),
        10,
      );
      expect(running.activeCampaign).not.toBeNull();
    } finally {
      balance.conquest.lateDefenseGrowth = original;
    }
    const loaded = deserializeSave(JSON.parse(serializeSave(running!)));
    expect(loaded.activeCampaign).toEqual(running!.activeCampaign);
    expect(
      loaded.activeCampaign!.defense.gt(
        frontierOptions(loaded).find((t) => t.id === 'food')!.defense,
      ),
    ).toBe(true);
    const offline = applyOfflineProgress(
      loaded,
      loaded.lastSimulationTime + 600_000,
    ).state;
    expect(offline.activeCampaign).toBeNull();
    expect(ownedTerritories(offline).eq(13)).toBe(true);
    expect(simulate(offline, 60).statistics.territoriesConquered.eq(12)).toBe(
      true,
    );
  });
});
