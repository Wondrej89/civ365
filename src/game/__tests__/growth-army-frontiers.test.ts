import { describe, expect, it } from 'vitest';
import { createInitialState } from '../state';
import { D } from '../utils/numbers';
import { eras } from '../content/eras';
import { technologies } from '../content/technologies';
import { militaryUnits } from '../content/military';
import { settlements } from '../content/settlements';
import { balance } from '../content/config';
import { applyAction, simulate } from '../engine/simulation';
import { settleProgression } from '../systems/progression';
import {
  deserializeSave,
  exportSave,
  importSave,
  serializeSave,
} from '../systems/save';
import { applyOfflineProgress } from '../systems/offline';
import {
  populationGrowthAmount,
  growthCost,
  growthQuote,
  growthInterval,
} from '../engine/population';
import { populationCost, productionPerSecond } from '../engine/production';
import {
  populationCapacity,
  settlementCount,
  settlementQuote,
} from '../engine/settlements';
import {
  militaryPopulation,
  idlePopulation,
} from '../engine/population-accounting';
import {
  armyUpkeep,
  militaryPower,
  militaryTier,
  militaryUpgradeQuote,
} from '../engine/military';
import {
  campaignForecast,
  campaignPreview,
  frontierOptions,
  tacticalPower,
  counterStrength,
} from '../engine/conquest';
import { netProductionPerSecond } from '../engine/economy';

function realm(era = 'medieval') {
  const state = createInitialState(1000),
    index = eras.findIndex((e) => e.id === era);
  state.currentEra = era;
  state.reachedEras = eras.slice(0, index + 1).map((e) => e.id);
  state.researchedTechnologies = technologies
    .filter((t) => state.reachedEras.includes(t.era))
    .map((t) => t.id);
  state.population = D(600);
  state.statistics.totalPopulationCreated = D(600);
  state.statistics.maxPopulation = D(600);
  state.statistics.totalFoodProduced = D(1000);
  state.ownedTerritories.frontier = D(3);
  state.statistics.territoriesConquered = D(3);
  state.settlements.camp = D();
  state.settlements.city = D(2);
  state.settlementInvestments = {
    camp: D(1),
    settlement: D(2),
    town: D(2),
    city: D(2),
    metropolis: D(),
  };
  state.statistics.totalSettlementsBuilt = D(2);
  for (const id of ['food', 'materials', 'research'])
    state.resources[id] = D('1e7');
  settleProgression(state);
  return state;
}
describe('growth groups and meaningful city investment', () => {
  it('progresses from one person to research batches and adds people per City/Metropolis', () => {
    expect(populationGrowthAmount(createInitialState(1000)).eq(1)).toBe(true);
    const state = realm();
    expect(populationGrowthAmount(state).eq(10)).toBe(true); // 2 × 2 × 2 + two Cities
    state.settlements.city = D(3);
    state.settlements.metropolis = D(1);
    expect(populationGrowthAmount(state).eq(12)).toBe(true);
    const era = eras.find((e) => e.id === 'medieval')!;
    era.effects.push({ type: 'populationGrowthAmountMultiplier', value: 3 });
    try {
      expect(populationGrowthAmount(state).eq(28)).toBe(true);
    } finally {
      era.effects.pop();
    }
  });
  it('manual and automatic batches pay the same marginal prices and preserve the population equation', () => {
    const state = realm(),
      quote = growthQuote(state),
      beforeIdle = idlePopulation(state);
    const manual = applyAction(state, { type: 'grow' });
    const automatic = simulate(
      applyAction(state, { type: 'autoGrowth', enabled: true }),
      growthInterval(state),
    );
    expect(manual.population.sub(state.population).eq(10)).toBe(true);
    expect(automatic.population.eq(manual.population)).toBe(true);
    expect(
      manual.resources.food.eq(state.resources.food.sub(quote.foodCost)),
    ).toBe(true);
    expect(automatic.resources.food.toNumber()).toBeCloseTo(
      manual.resources.food.toNumber(),
      7,
    );
    expect(idlePopulation(manual).sub(beforeIdle).eq(10)).toBe(true);
  });
  it('charges every marginal person when a batch crosses either food-scaling breakpoint', () => {
    const state = realm();
    for (const population of [18, 398]) {
      state.population = D(population);
      let sum = D();
      for (let i = 0; i < 10; i++)
        sum = sum.add(populationCost(state, D(population + i)));
      expect(growthCost(state, 10).toNumber()).toBeCloseTo(sum.toNumber(), 7);
    }
  });
  it('creates an affordable partial batch and protects the configured reserve', () => {
    const state = realm();
    state.resources.food = growthCost(state, 3).mul(2);
    const quote = growthQuote(state, 50);
    expect(quote.amount.eq(3)).toBe(true);
    const automatic = simulate(
      applyAction(state, {
        type: 'autoGrowth',
        enabled: true,
        foodReservePercent: 50,
      }),
      growthInterval(state),
    );
    expect(automatic.population.sub(state.population).eq(3)).toBe(true);
    expect(
      automatic.resources.food.gte(state.resources.food.mul(0.5).sub(1e-8)),
    ).toBe(true);
  });
  it('clamps a batch at capacity and preserves existing population above it', () => {
    const state = realm();
    state.population = populationCapacity(state).sub(3);
    const next = applyAction(state, { type: 'grow' });
    expect(next.population.eq(populationCapacity(next))).toBe(true);
    expect(
      next.statistics.totalPopulationCreated
        .sub(state.statistics.totalPopulationCreated)
        .eq(3),
    ).toBe(true);
    expect(applyAction(next, { type: 'grow' })).toBe(next);
    next.population = next.population.add(100);
    expect(
      simulate(
        applyAction(next, { type: 'autoGrowth', enabled: true }),
        100,
      ).population.eq(next.population),
    ).toBe(true);
  });
  it('keeps late food costs below the previous runaway curve without removing early scaling', () => {
    const state = realm();
    expect(populationCost(createInitialState()).eq(10)).toBe(true);
    expect(populationCost(state, D(2000)).lt(8000)).toBe(true);
    expect(
      populationCost(state, D(2000)).gt(populationCost(state, D(400))),
    ).toBe(true);
  });
  it('uses a per-tier lifetime price, charges geometric Max upgrades and preserves territory slots', () => {
    let state = realm();
    state.settlements.city = D();
    state.settlements.town = D(3);
    state.settlementInvestments.city = D();
    state.settlementInvestments.town = D(3);
    state.statistics.totalSettlementsBuilt = D(3);
    const city = settlements.find((s) => s.id === 'city')!,
      first = settlementQuote(state, city);
    const bulk = applyAction(state, {
      type: 'upgradeSettlement',
      id: 'city',
      amount: 3,
    });
    for (let i = 0; i < 3; i++)
      state = applyAction(state, {
        type: 'upgradeSettlement',
        id: 'city',
        amount: 1,
      });
    expect(state.resources.materials.toNumber()).toBeCloseTo(
      bulk.resources.materials.toNumber(),
      7,
    );
    expect(state.settlementInvestments.city.eq(3)).toBe(true);
    expect(settlementCount(state).eq(3)).toBe(true);
    expect(
      D(settlementQuote(state, city)[0].amount).eq(D(first[0].amount).mul(8)),
    ).toBe(true);
    expect(D(first[0].amount).gte(14000)).toBe(true);
    const loaded = importSave(exportSave(state));
    expect(loaded.settlementInvestments.city.eq(3)).toBe(true);
    expect(settlementQuote(loaded, city)).toEqual(settlementQuote(state, city));
  });
});
describe('three army categories, equipment and supply', () => {
  it('keeps exactly three persistent categories with researched sequential equipment upgrades', () => {
    let state = realm('bronze');
    expect(militaryUnits.map((u) => u.id)).toEqual([
      'infantry',
      'cavalry',
      'ranged',
    ]);
    state = applyAction(state, {
      type: 'recruitMilitary',
      id: 'infantry',
      amount: 10,
    });
    const people = state.population,
      idle = idlePopulation(state),
      before = militaryPower(state);
    const costs = militaryUpgradeQuote(state, militaryUnits[0]);
    const next = applyAction(state, {
      type: 'upgradeMilitary',
      id: 'infantry',
    });
    expect(militaryTier(next, militaryUnits[0]).name).toBe('Spearman');
    expect(next.militaryUnits.infantry.eq(10)).toBe(true);
    expect(next.population.eq(people)).toBe(true);
    expect(idlePopulation(next).eq(idle)).toBe(true);
    expect(militaryPopulation(next).eq(10)).toBe(true);
    expect(militaryPower(next).eq(before.mul(3))).toBe(true);
    expect(
      next.resources.materials.eq(
        state.resources.materials.sub(costs[1].amount),
      ),
    ).toBe(true);
    expect(applyAction(next, { type: 'upgradeMilitary', id: 'infantry' })).toBe(
      next,
    );
    next.resources.materials = D();
    expect(applyAction(next, { type: 'upgradeMilitary', id: 'cavalry' })).toBe(
      next,
    );
  });
  it('deducts real Food and Materials every second, including committed troops, with net production visible', () => {
    const state = realm();
    state.militaryTiers.infantry = 2;
    state.militaryUnits.infantry = D(100);
    const upkeep = armyUpkeep(state),
      next = simulate(state, 10);
    expect(upkeep.food.toNumber()).toBeCloseTo(25.6);
    expect(upkeep.materials.toNumber()).toBeCloseTo(32);
    expect(next.resources.food.toNumber()).toBeCloseTo(
      state.resources.food.sub(256).toNumber(),
    );
    expect(next.statistics.materialsSpentOnMilitary.toNumber()).toBeCloseTo(
      320,
    );
    expect(
      netProductionPerSecond(state).materials.eq(
        productionPerSecond(state).materials.sub(upkeep.materials),
      ),
    ).toBe(true);
    const campaign = applyAction(state, { type: 'launchCampaign' });
    const running = simulate(campaign, 1);
    expect(running.activeCampaign).not.toBeNull();
    expect(running.statistics.foodSpentOnMilitary.toNumber()).toBeCloseTo(
      upkeep.food.toNumber(),
    );
    expect(
      applyAction(campaign, { type: 'upgradeMilitary', id: 'infantry' }),
    ).toBe(campaign);
  });
  it('applies generic upkeep discounts and restores readiness when supplies return', () => {
    const state = realm();
    state.militaryUnits.infantry = D(20);
    state.researchedTechnologies = state.researchedTechnologies.filter(
      (id) => !['supplyLines', 'professionalArmy'].includes(id),
    );
    const before = armyUpkeep(state);
    state.researchedTechnologies.push('supplyLines', 'professionalArmy');
    expect(armyUpkeep(state).materials.toNumber()).toBeCloseTo(
      before.materials.mul(0.64).toNumber(),
    );
    state.militaryReadiness = 0.5;
    expect(simulate(state, 30).militaryReadiness).toBe(1);
  });
  it('never spends below zero, weakens an unfunded army and matches live and offline exhaustion boundaries', () => {
    const state = realm();
    state.militaryUnits.infantry = D(30);
    state.resources.food = D(12);
    state.resources.materials = D(9);
    const offline = applyOfflineProgress(
      state,
      state.lastSimulationTime + 90_000,
    );
    let live = state;
    for (let i = 0; i < 900; i++) live = simulate(live, 0.1);
    expect(offline.state.resources.food.eq(0)).toBe(true);
    expect(offline.state.resources.materials.eq(0)).toBe(true);
    expect(offline.state.militaryReadiness).toBe(
      balance.military.minimumReadiness,
    );
    expect(live.militaryReadiness).toBe(offline.state.militaryReadiness);
    expect(live.statistics.foodSpentOnMilitary.toNumber()).toBeCloseTo(12);
    expect(
      offline.report?.militaryUpkeepSpent.materials.toNumber(),
    ).toBeCloseTo(9);
    expect(offline.state.population.eq(state.population)).toBe(true);
    expect(offline.state.militaryUnits).toEqual(state.militaryUnits);
  });
});
describe('frontier choices, counters and intelligence', () => {
  it('generates three stable choices with increasing defense/rewards and a distinct economic purpose', () => {
    const state = realm(),
      choices = frontierOptions(state);
    expect(choices.map((c) => c.resource)).toEqual([
      'food',
      'materials',
      'research',
    ]);
    expect(new Set(choices.map((c) => c.difficulty)).size).toBe(3);
    const ranked = [...choices].sort((a, b) => a.defense.cmp(b.defense));
    expect(ranked[2].productionBonus.gt(ranked[0].productionBonus)).toBe(true);
    expect(frontierOptions(importSave(exportSave(state)))).toEqual(choices);
    expect(
      applyAction(state, { type: 'launchCampaign', targetId: 'bogus' }),
    ).toBe(state);
  });
  it('ignores counters before other types are unlocked and rewards combined arms later', () => {
    const early = realm('agricultural');
    early.militaryUnits.infantry = D(20);
    expect(counterStrength(early)).toBe(0);
    expect(
      tacticalPower(early, { infantry: 0.1, cavalry: 0.1, ranged: 0.8 }).eq(
        militaryPower(early),
      ),
    ).toBe(true);
    const single = realm('bronze');
    single.militaryTiers.infantry = 1;
    single.militaryUnits.infantry = D(12);
    const mixed = realm('bronze');
    mixed.militaryTiers.infantry = 1;
    mixed.militaryUnits = { infantry: D(4), cavalry: D(3), ranged: D(3) };
    expect(militaryPower(mixed).eq(militaryPower(single))).toBe(true);
    const defenders = { infantry: 0.2, cavalry: 0.1, ranged: 0.7 };
    expect(
      tacticalPower(mixed, defenders).gt(tacticalPower(single, defenders)),
    ).toBe(true);
  });
  it('hides enemy composition and exact forecasts until Espionage, with conservative bounds containing the result', () => {
    const state = realm('classical');
    state.militaryUnits.infantry = D(100);
    for (const target of frontierOptions(state)) {
      const preview = campaignPreview(state, target.id),
        actual = campaignForecast(state, target.id);
      expect(preview.composition).toBeNull();
      expect(actual.power.gte(preview.minimumPower)).toBe(true);
      expect(actual.power.lte(preview.maximumPower)).toBe(true);
      expect(preview.minimumPower.lt(preview.maximumPower)).toBe(true);
    }
    const informed = realm();
    informed.militaryUnits.infantry = D(100);
    const preview = campaignPreview(informed, 'food'),
      actual = campaignForecast(informed, 'food');
    expect(preview.composition).not.toBeNull();
    expect(preview.minimumPower.eq(actual.power)).toBe(true);
    expect(preview.maximumPower.eq(actual.power)).toBe(true);
  });
  it.each(['food', 'materials', 'research'])(
    'awards the chosen %s bonus and land once, then increases frontier difficulty',
    (targetId) => {
      const state = realm();
      state.militaryTiers.infantry = 2;
      state.militaryUnits.infantry = D(100);
      const forecast = campaignForecast(state, targetId),
        running = applyAction(state, { type: 'launchCampaign', targetId });
      const next = simulate(running, forecast.durationSeconds);
      expect(next.statistics.territoriesConquered.eq(4)).toBe(true);
      expect(next.ownedTerritories[forecast.target.territory].eq(1)).toBe(true);
      expect(
        next.territoryProductionBonuses[targetId].eq(
          forecast.target.productionBonus,
        ),
      ).toBe(true);
      expect(next.population.lt(state.population)).toBe(true);
      const later = simulate(next, 30);
      expect(later.territoryProductionBonuses).toEqual(
        next.territoryProductionBonuses,
      );
      expect(
        frontierOptions(next)
          .find((t) => t.id === targetId)!
          .defense.gt(forecast.defense),
      ).toBe(true);
      const worker = applyAction(next, {
        type: 'recruit',
        unitId:
          targetId === 'food'
            ? 'gatherer'
            : targetId === 'materials'
              ? 'woodcutter'
              : 'thinker',
        amount: 1,
      });
      const withoutBonus = {
        ...worker,
        territoryProductionBonuses: {
          ...worker.territoryProductionBonuses,
          [targetId]: D(),
        },
      };
      const unmodified = productionPerSecond(withoutBonus)[targetId];
      expect(productionPerSecond(worker)[targetId].toNumber()).toBeCloseTo(
        unmodified.mul(forecast.target.productionBonus.add(1)).toNumber(),
      );
      expect(importSave(exportSave(next)).territoryProductionBonuses).toEqual(
        next.territoryProductionBonuses,
      );
    },
  );
  it('lets a supply shortage change a near-equal campaign result without randomly wiping out the army', () => {
    const state = realm();
    state.statistics.territoriesConquered = D();
    state.militaryUnits.infantry = D(1);
    const first = campaignForecast(state, 'food');
    state.militaryUnits.infantry = first.defense
      .div(first.power)
      .mul(1.05)
      .ceil();
    const forecast = campaignForecast(state, 'food');
    expect(forecast.victory).toBe(true);
    const running = applyAction(state, {
      type: 'launchCampaign',
      targetId: 'food',
    });
    running.resources.food = D();
    running.resources.materials = D();
    const next = simulate(running, forecast.durationSeconds);
    expect(next.statistics.territoriesConquered.eq(0)).toBe(true);
    expect(next.militaryUnits.infantry.gt(0)).toBe(true);
    expect(next.population.lt(state.population)).toBe(true);
  });
});
describe('v6 migration and campaign persistence', () => {
  it('folds legacy soldiers into three categories, preserves population and language, and completes old campaign losses exactly', () => {
    const state = realm(),
      raw = JSON.parse(serializeSave(state));
    raw.saveVersion = 5;
    raw.settings.language = 'cs';
    raw.militaryUnits = {
      levy: '10',
      spearman: '15',
      heavyInfantry: '20',
      archer: '25',
      knight: '10',
      musketeer: '0',
    };
    raw.researchedTechnologies = raw.researchedTechnologies.filter(
      (id: string) =>
        !['horsemanship', 'supplyLines', 'espionage'].includes(id),
    );
    raw.unlockedFeatures = raw.unlockedFeatures.filter(
      (id: string) => id !== 'intelligence',
    );
    raw.activeCampaign = {
      frontierIndex: '4',
      committedUnits: { ...raw.militaryUnits },
      power: '475',
      defense: '200',
      durationSeconds: 80,
      elapsedSeconds: 10,
      casualtyRate: 0.05,
      victory: true,
    };
    for (const key of [
      'militaryTiers',
      'militaryReadiness',
      'settlementInvestments',
      'territoryProductionBonuses',
    ])
      delete raw[key];
    const original = JSON.stringify(raw),
      loaded = deserializeSave(raw);
    expect(loaded.saveVersion).toBe(6);
    expect(loaded.settings.language).toBe('cs');
    expect(loaded.population.eq(600)).toBe(true);
    expect(militaryPopulation(loaded).eq(80)).toBe(true);
    expect(loaded.militaryTiers).toEqual({
      infantry: 2,
      cavalry: 2,
      ranged: 0,
    });
    expect(loaded.researchedTechnologies).toContain('horsemanship');
    expect(loaded.settlementInvestments.city.eq(2)).toBe(true);
    expect(loaded.resources).toEqual(state.resources);
    expect(JSON.stringify(raw)).toBe(original);
    const roundtrip = importSave(exportSave(loaded)),
      next = simulate(roundtrip, 70);
    expect(next.activeCampaign).toBeNull();
    expect(next.population.eq(598)).toBe(true); // one Heavy Infantry and one Archer
    expect(next.ownedTerritories.frontier.eq(4)).toBe(true);
    expect(next.territoryProductionBonuses.food.eq(0)).toBe(true);
  });
  it('roundtrips a new selected frontier, frozen rewards and partial progress with the same offline result', () => {
    const state = realm();
    state.militaryUnits.infantry = D(100);
    state.militaryTiers.infantry = 2;
    const running = simulate(
      applyAction(state, { type: 'launchCampaign', targetId: 'materials' }),
      5,
    );
    const loaded = importSave(exportSave(running));
    expect(loaded.activeCampaign).toEqual(running.activeCampaign);
    const offline = applyOfflineProgress(
        loaded,
        loaded.lastSimulationTime + 60_000,
      ),
      live = simulate(running, 60);
    expect(offline.state.militaryUnits).toEqual(live.militaryUnits);
    expect(offline.state.territoryProductionBonuses).toEqual(
      live.territoryProductionBonuses,
    );
    expect(offline.state.population.eq(live.population)).toBe(true);
    expect(offline.state.resources.materials.toNumber()).toBeCloseTo(
      live.resources.materials.toNumber(),
      6,
    );
  });
  it('rejects corrupt tiers, readiness, investment history and mismatched campaign rewards', () => {
    const state = realm();
    state.militaryUnits.infantry = D(100);
    const raw = JSON.parse(
      serializeSave(
        applyAction(state, { type: 'launchCampaign', targetId: 'food' }),
      ),
    );
    for (const mutate of [
      (value: typeof raw) => {
        value.militaryTiers.infantry = 100;
      },
      (value: typeof raw) => {
        value.militaryReadiness = 0.1;
      },
      (value: typeof raw) => {
        value.settlementInvestments.city = '0';
      },
      (value: typeof raw) => {
        value.activeCampaign.rewardResource = 'materials';
      },
      (value: typeof raw) => {
        value.activeCampaign.lowestReadiness = 2;
      },
    ]) {
      const corrupt = structuredClone(raw);
      mutate(corrupt);
      expect(() => deserializeSave(corrupt)).toThrow();
    }
  });
});
