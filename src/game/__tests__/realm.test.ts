import { describe, expect, it } from 'vitest';
import { createInitialState } from '../state';
import { applyAction, simulate } from '../engine/simulation';
import {
  populationCapacity,
  settlementSlots,
  settlementCount,
  availableSlots,
  settlementQuote,
} from '../engine/settlements';
import {
  representedPopulation,
  idlePopulation,
  militaryPopulation,
} from '../engine/population-accounting';
import {
  militaryPower,
  militaryQuote,
  maxMilitaryRecruit,
} from '../engine/military';
import { campaignForecast, frontierDefense } from '../engine/conquest';
import { productionPerSecond } from '../engine/production';
import { evaluateCondition } from '../engine/conditions';
import {
  canAdvance,
  settleProgression,
  technologyStatus,
} from '../systems/progression';
import { deserializeSave, serializeSave, migrateSave } from '../systems/save';
import { applyOfflineProgress } from '../systems/offline';
import { populationDistribution } from '../systems/statistics';
import { technologies } from '../content/technologies';
import { eras } from '../content/eras';
import { settlements } from '../content/settlements';
import { militaryUnits } from '../content/military';
import { balance } from '../content/config';
import { D } from '../utils/numbers';

function realm(era = 'classical') {
  const state = createInitialState(1000),
    index = eras.findIndex((e) => e.id === era);
  state.population = D(200);
  state.statistics.totalPopulationCreated = D(200);
  state.statistics.totalFoodProduced = D(1000);
  for (const id of ['food', 'materials', 'research'])
    state.resources[id] = D('1e8');
  state.currentEra = era;
  state.reachedEras = eras.slice(0, index + 1).map((e) => e.id);
  state.researchedTechnologies = technologies
    .filter((t) => eras.findIndex((e) => e.id === t.era) <= index)
    .map((t) => t.id);
  state.ownedTerritories.frontier = D(3);
  state.statistics.territoriesConquered = D(3);
  state.settlements.camp = D();
  state.settlements.city = D(1);
  state.settlements.town = D(1);
  state.statistics.totalSettlementsBuilt = D(2);
  settleProgression(state);
  return state;
}
function armed(amount = 100, unit = 'heavyInfantry') {
  const state = realm();
  state.statistics.territoriesConquered = D();
  state.ownedTerritories.frontier = D();
  state.settlements.town = D();
  state.statistics.totalSettlementsBuilt = D(1);
  return applyAction(state, { type: 'recruitMilitary', id: unit, amount });
}

describe('settlement capacity and investment', () => {
  it('starts with one occupied territory slot and capacity supplied by the founding camp', () => {
    const state = createInitialState(1000);
    expect(populationCapacity(state).eq(20)).toBe(true);
    expect(settlementSlots(state).eq(1)).toBe(true);
    expect(availableSlots(state).eq(0)).toBe(true);
    state.ownedTerritories.frontier = D(5);
    expect(settlementSlots(state).eq(6)).toBe(true);
    expect(populationCapacity(state).eq(20)).toBe(true);
    expect(state.unlockedFeatures).not.toContain('settlements');
    expect(state.unlockedFeatures).not.toContain('military');
  });
  it('blocks manual and automatic growth at capacity and resumes after expansion without reducing old population', () => {
    let state = realm();
    state.population = populationCapacity(state);
    state.statistics.totalPopulationCreated = state.population;
    expect(applyAction(state, { type: 'grow' })).toBe(state);
    state = applyAction(state, { type: 'autoGrowth', enabled: true });
    expect(simulate(state, 100).population.eq(state.population)).toBe(true);
    const expanded = applyAction(state, {
      type: 'buildSettlement',
      id: 'settlement',
      amount: 1,
    });
    expect(simulate(expanded, 2).population.gt(state.population)).toBe(true);
    state.population = populationCapacity(state).add(100);
    expect(simulate(state, 100).population.eq(state.population)).toBe(true);
  });
  it('never rounds a fractional capacity upward into an extra person', () => {
    const state = realm();
    state.settlements.city = D();
    state.settlements.town = D(1);
    state.researchedTechnologies = state.researchedTechnologies.filter(
      (id) => id !== 'aqueducts',
    );
    state.population = populationCapacity(state);
    expect(populationCapacity(state).eq(93)).toBe(true);
    expect(applyAction(state, { type: 'grow' })).toBe(state);
  });
  it('requires an unlocked settlement, resources and a free slot before building', () => {
    const fresh = createInitialState(1000);
    expect(
      applyAction(fresh, {
        type: 'buildSettlement',
        id: 'settlement',
        amount: 1,
      }),
    ).toBe(fresh);
    const state = realm();
    state.ownedTerritories.frontier = D(1);
    expect(
      applyAction(state, {
        type: 'buildSettlement',
        id: 'settlement',
        amount: 1,
      }),
    ).toBe(state);
    state.ownedTerritories.frontier = D(3);
    state.resources.materials = D();
    expect(
      applyAction(state, {
        type: 'buildSettlement',
        id: 'settlement',
        amount: 1,
      }),
    ).toBe(state);
  });
  it('Max construction pays the geometric price, respects the slot limit and leaves the input unchanged', () => {
    const state = realm();
    state.settlements.city = D();
    state.settlements.town = D();
    state.settlements.camp = D(1);
    state.statistics.totalSettlementsBuilt = D(1);
    state.resources.materials = D(200);
    const cost = settlementQuote(
      state,
      settlements.find((s) => s.id === 'settlement')!,
      2,
      true,
    );
    const next = applyAction(state, {
      type: 'buildSettlement',
      id: 'settlement',
      amount: 'max',
    });
    expect(next.settlements.settlement.eq(2)).toBe(true);
    expect(
      next.resources.materials.eq(
        state.resources.materials.sub(cost[0].amount),
      ),
    ).toBe(true);
    expect(settlementCount(next).eq(3)).toBe(true);
    expect(state.settlements.settlement.eq(0)).toBe(true);
  });
  it('upgrading consumes the previous tier and Materials while preserving slot usage', () => {
    const state = realm(),
      before = settlementCount(state),
      bank = state.resources.materials;
    const quote = settlementQuote(
      state,
      settlements.find((s) => s.id === 'city')!,
    );
    const next = applyAction(state, {
      type: 'upgradeSettlement',
      id: 'city',
      amount: 1,
    });
    expect(next.settlements.town.eq(0)).toBe(true);
    expect(next.settlements.city.eq(2)).toBe(true);
    expect(settlementCount(next).eq(before)).toBe(true);
    expect(next.resources.materials.eq(bank.sub(quote[0].amount))).toBe(true);
  });
  it('applies generic technology and era capacity modifiers and generic resource cost discounts', () => {
    const state = realm();
    state.settlements.town = D();
    expect(populationCapacity(state).eq(Math.floor(250 * 1.25 * 1.5))).toBe(
      true,
    );
    const classical = eras.find((e) => e.id === 'classical')!;
    classical.effects.push({ type: 'settlementCapacityMultiplier', value: 2 });
    try {
      expect(
        populationCapacity(state).eq(Math.floor(250 * 1.25 * 1.5 * 2)),
      ).toBe(true);
    } finally {
      classical.effects.pop();
    }
    state.statistics.totalSettlementsBuilt = D(1);
    expect(
      D(
        settlementQuote(
          state,
          settlements.find((s) => s.id === 'city')!,
        )[0].amount,
      ).eq(2500 * 0.8),
    ).toBe(true);
  });
});

describe('population in an army', () => {
  it('recruitment charges Food/Materials, assigns idle people and returns them when demobilized', () => {
    const state = realm(),
      unit = militaryUnits.find((u) => u.id === 'spearman')!,
      cost = militaryQuote(state, unit, 10);
    const next = applyAction(state, {
      type: 'recruitMilitary',
      id: unit.id,
      amount: 10,
    });
    expect(next.militaryUnits.spearman.eq(10)).toBe(true);
    expect(next.population.eq(state.population)).toBe(true);
    expect(idlePopulation(next).eq(190)).toBe(true);
    expect(militaryPopulation(next).eq(10)).toBe(true);
    for (const c of cost)
      expect(
        next.resources[c.resource].eq(
          state.resources[c.resource].sub(c.amount),
        ),
      ).toBe(true);
    const back = applyAction(next, {
      type: 'demobilize',
      id: unit.id,
      amount: 'max',
    });
    expect(idlePopulation(back).eq(200)).toBe(true);
    expect(back.resources.materials.eq(next.resources.materials)).toBe(true);
  });
  it('rejects locked recruitment, lack of people, lack of resources and malformed amounts', () => {
    const fresh = createInitialState(1000);
    expect(
      applyAction(fresh, { type: 'recruitMilitary', id: 'levy', amount: 1 }),
    ).toBe(fresh);
    const state = realm();
    state.resources.food = D();
    expect(
      applyAction(state, { type: 'recruitMilitary', id: 'levy', amount: 1 }),
    ).toBe(state);
    for (const amount of [-1, 0.5, 'bad'])
      expect(
        applyAction(state, { type: 'recruitMilitary', id: 'levy', amount }),
      ).toBe(state);
    state.resources.food = D('1e8');
    state.productionUnits.gatherer = state.population;
    expect(
      applyAction(state, { type: 'recruitMilitary', id: 'levy', amount: 1 }),
    ).toBe(state);
  });
  it('Max and single recruitment share the same escalating bill', () => {
    const state = realm(),
      unit = militaryUnits.find((u) => u.id === 'levy')!;
    state.resources.food = D(100);
    const max = maxMilitaryRecruit(state, unit);
    const bulk = applyAction(state, {
      type: 'recruitMilitary',
      id: unit.id,
      amount: 'max',
    });
    let singles = state;
    for (let i = 0; i < max.toNumber(); i++)
      singles = applyAction(singles, {
        type: 'recruitMilitary',
        id: unit.id,
        amount: 1,
      });
    expect(bulk.militaryUnits.levy.eq(max)).toBe(true);
    expect(bulk.resources.food.toNumber()).toBeCloseTo(
      singles.resources.food.toNumber(),
      8,
    );
    expect(bulk.resources.food.gte(0)).toBe(true);
  });
  it('uses generic power modifiers and population footprints rather than unit counts for the distribution', () => {
    const state = realm(),
      unit = militaryUnits.find((u) => u.id === 'spearman')!;
    unit.populationCost = 2;
    try {
      const next = applyAction(state, {
        type: 'recruitMilitary',
        id: unit.id,
        amount: 10,
      });
      expect(representedPopulation(next).eq(20)).toBe(true);
      expect(militaryPower(next).eq(30)).toBe(true);
      expect(
        populationDistribution(next)
          .find((g) => g.id === 'military')!
          .value.eq(20),
      ).toBe(true);
      const medieval = realm('medieval');
      medieval.militaryUnits.spearman = D(10);
      expect(militaryPower(medieval).toNumber()).toBeCloseTo(30 * 1.15 * 1.5);
    } finally {
      unit.populationCost = 1;
    }
  });
  it('makes taking workers into military lower ordinary production', () => {
    let state = realm();
    state.productionUnits.gatherer = D(100);
    const before = productionPerSecond(state).food;
    state = applyAction(state, {
      type: 'release',
      unitId: 'gatherer',
      amount: 10,
    });
    state = applyAction(state, {
      type: 'recruitMilitary',
      id: 'levy',
      amount: 10,
    });
    expect(productionPerSecond(state).food.toNumber()).toBeCloseTo(
      before.mul(0.9).toNumber(),
    );
    expect(representedPopulation(state).eq(100)).toBe(true);
  });
});

describe('deterministic campaigns in the shared simulation', () => {
  it('commits the army and forbids launching twice or changing it during the campaign', () => {
    const state = applyAction(armed(), { type: 'launchCampaign' });
    expect(state.activeCampaign).not.toBeNull();
    for (const action of [
      { type: 'launchCampaign' as const },
      { type: 'recruitMilitary' as const, id: 'levy', amount: 1 },
      { type: 'demobilize' as const, id: 'heavyInfantry', amount: 1 },
    ])
      expect(applyAction(state, action)).toBe(state);
    const halfway = simulate(state, state.activeCampaign!.durationSeconds / 2);
    expect(halfway.activeCampaign!.elapsedSeconds).toBeCloseTo(
      state.activeCampaign!.durationSeconds / 2,
    );
    expect(halfway.ownedTerritories.frontier.eq(0)).toBe(true);
  });
  it('predicts success, scales duration with strength, grants land only once and loses real people', () => {
    const state = armed(),
      prediction = campaignForecast(state),
      running = applyAction(state, { type: 'launchCampaign' });
    expect(prediction.victory).toBe(true);
    expect(prediction.durationSeconds).toBe(
      balance.conquest.minimumDurationSeconds,
    );
    const next = simulate(running, prediction.durationSeconds);
    expect(next.activeCampaign).toBeNull();
    expect(next.ownedTerritories.frontier.eq(1)).toBe(true);
    expect(next.statistics.territoriesConquered.eq(1)).toBe(true);
    expect(next.population.lt(state.population)).toBe(true);
    expect(
      next.militaryUnits.heavyInfantry.lt(state.militaryUnits.heavyInfantry),
    ).toBe(true);
    expect(next.statistics.totalPopulationCreated.eq(200)).toBe(true);
    expect(simulate(next, 100).ownedTerritories.frontier.eq(1)).toBe(true);
    expect(settlementSlots(next).eq(2)).toBe(true);
    expect(populationCapacity(next).eq(populationCapacity(state))).toBe(true);
  });
  it('predictably loses a weak campaign without destroying the whole army or granting territory', () => {
    const state = armed(20, 'levy');
    expect(campaignForecast(state).victory).toBe(false);
    const next = simulate(applyAction(state, { type: 'launchCampaign' }), 600);
    expect(next.ownedTerritories.frontier.eq(0)).toBe(true);
    expect(next.militaryUnits.levy.gt(0)).toBe(true);
    expect(next.population.lt(state.population)).toBe(true);
  });
  it('has an unbounded configurable defense curve and generic casualty modifiers', () => {
    const state = armed();
    state.statistics.territoriesConquered = D(10);
    expect(frontierDefense(state).toNumber()).toBeCloseTo(40 * 1.8 ** 10);
    const before = campaignForecast(state).casualtyRate;
    state.researchedTechnologies.push('fortifications');
    expect(campaignForecast(state).casualtyRate).toBeCloseTo(before * 0.65);
  });
  it('preserves a partly completed campaign across save/reload and finishes it offline with the same outcome', () => {
    const initial = applyAction(armed(), { type: 'launchCampaign' }),
      half = simulate(initial, 5);
    const loaded = deserializeSave(JSON.parse(serializeSave(half)));
    expect(loaded.activeCampaign?.elapsedSeconds).toBe(5);
    expect(loaded.activeCampaign?.power.eq(initial.activeCampaign!.power)).toBe(
      true,
    );
    const live = simulate(half, 30),
      offline = applyOfflineProgress(
        loaded,
        loaded.lastSimulationTime + 30_000,
      );
    expect(offline.state.population.eq(live.population)).toBe(true);
    expect(offline.state.militaryUnits).toEqual(live.militaryUnits);
    expect(offline.state.ownedTerritories).toEqual(live.ownedTerritories);
    expect(offline.report?.territoriesConquered.eq(1)).toBe(true);
    expect(offline.report?.populationLost.gt(0)).toBe(true);
    expect(offline.report?.populationCreated.eq(0)).toBe(true);
    expect(
      applyOfflineProgress(offline.state, offline.state.lastSimulationTime)
        .state.ownedTerritories,
    ).toEqual(offline.state.ownedTerritories);
  });
  it('treats campaign boundaries identically during fractional live ticks and offline integration', () => {
    const state = applyAction(armed(), { type: 'launchCampaign' });
    let live = state;
    for (let i = 0; i < 300; i++) live = simulate(live, 0.1);
    const bulk = simulate(state, 30);
    expect(live.population.eq(bulk.population)).toBe(true);
    expect(live.ownedTerritories).toEqual(bulk.ownedTerritories);
    expect(live.activeCampaign).toBeNull();
  });
  it('keeps fractional campaign completion times compatible with the save timestamp format', () => {
    const state = applyAction(armed(55, 'levy'), { type: 'launchCampaign' });
    expect(Number.isInteger(state.activeCampaign!.durationSeconds)).toBe(false);
    const next = simulate(state, 300);
    expect(
      next.eventLog.every((event) => Number.isSafeInteger(event.time)),
    ).toBe(true);
    expect(() =>
      deserializeSave(JSON.parse(serializeSave(next))),
    ).not.toThrow();
  });
});

describe('era gates, discoveries and migration', () => {
  it('cannot buy future eras with Research alone', () => {
    const state = realm('agricultural');
    state.population = D(10000);
    state.resources.research = D('1e100');
    state.ownedTerritories.frontier = D();
    state.settlements.town = D();
    state.settlements.city = D();
    const bronze = eras.find((e) => e.id === 'bronze')!;
    expect(canAdvance(state, bronze)).toBe(false);
    expect(applyAction(state, { type: 'advance', id: 'bronze' })).toBe(state);
    expect(
      technologyStatus(
        state,
        technologies.find((t) => t.id === 'printingPress')!,
      ),
    ).toBe('hidden');
    for (const condition of [
      { type: 'territoriesAtLeast' as const, value: 2 },
      { type: 'settlementsAtLeast' as const, value: 2 },
      { type: 'populationCapacityAtLeast' as const, value: 200 },
      { type: 'militaryPowerAtLeast' as const, value: 700 },
    ])
      expect(evaluateCondition(condition, state)).toBe(false);
  });
  it('opens settlements through Settled Life and an early conquest path before the Bronze land requirement', () => {
    const state = realm('agricultural');
    expect(state.unlockedFeatures).toEqual(
      expect.arrayContaining(['settlements', 'military', 'territory']),
    );
    expect(technologies.find((t) => t.id === 'organizedWarfare')!.era).toBe(
      'agricultural',
    );
  });
  it('migrates v3 above capacity without removing population, workers, discoveries or history', () => {
    const state = realm();
    state.population = D(500);
    state.productionUnits.gatherer = D(100);
    state.purchasedSkills.growingTribe = 1;
    const raw = JSON.parse(serializeSave(state));
    raw.saveVersion = 3;
    raw.researchedTechnologies = raw.researchedTechnologies.filter(
      (id: string) =>
        ![
          'villageOrganization',
          'organizedWarfare',
          'archery',
          'aqueducts',
          'classicalArmy',
        ].includes(id),
    );
    raw.unlockedFeatures = raw.unlockedFeatures.filter(
      (id: string) => !['settlements', 'military', 'territory'].includes(id),
    );
    raw.statisticsHistory = { population: raw.statisticsHistory.population };
    for (const key of [
      'ownedTerritories',
      'settlements',
      'militaryUnits',
      'activeCampaign',
      'populationCapacityBonus',
    ])
      delete raw[key];
    const original = JSON.stringify(raw),
      loaded = deserializeSave(raw);
    expect(loaded.saveVersion).toBe(4);
    expect(loaded.population.eq(500)).toBe(true);
    expect(loaded.productionUnits.gatherer.eq(100)).toBe(true);
    expect(loaded.researchedTechnologies).toEqual(raw.researchedTechnologies);
    expect(loaded.statisticsHistory).toEqual(raw.statisticsHistory);
    expect(loaded.purchasedSkills).toEqual(state.purchasedSkills);
    expect(loaded.achievements).toEqual(state.achievements);
    for (const id of ['food', 'materials', 'research'])
      expect(loaded.resources[id].eq(state.resources[id])).toBe(true);
    expect(populationCapacity(loaded).lt(loaded.population)).toBe(true);
    expect(applyAction(loaded, { type: 'grow' })).toBe(loaded);
    expect(JSON.stringify(raw)).toBe(original);
    expect(migrateSave(migrateSave(raw))).toEqual(migrateSave(raw));
  });
  it('rejects overbooked slots, military overpopulation and corrupt campaign snapshots', () => {
    const state = applyAction(armed(), { type: 'launchCampaign' }),
      raw = JSON.parse(serializeSave(state));
    raw.settlements.city = '99';
    expect(() => deserializeSave(raw)).toThrow();
    raw.settlements.city = '1';
    raw.militaryUnits.heavyInfantry = '500';
    expect(() => deserializeSave(raw)).toThrow();
    raw.militaryUnits.heavyInfantry = '100';
    raw.activeCampaign.elapsedSeconds = -1;
    expect(() => deserializeSave(raw)).toThrow();
    raw.activeCampaign.elapsedSeconds = 0;
    raw.activeCampaign.committedUnits.heavyInfantry = '99';
    expect(() => deserializeSave(raw)).toThrow();
  });
  it('samples new series only after their features and keeps Military in the weighted distribution', () => {
    const fresh = createInitialState(1000);
    expect(fresh.statisticsHistory).toEqual({});
    const state = simulate(armed(), 30);
    for (const id of ['populationCapacity', 'territories', 'militaryPower'])
      expect(state.statisticsHistory[id].length).toBeGreaterThan(1);
    expect(
      populationDistribution(state)
        .find((g) => g.id === 'military')!
        .value.eq(100),
    ).toBe(true);
  });
});
