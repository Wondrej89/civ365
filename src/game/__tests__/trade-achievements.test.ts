import { describe, expect, it } from 'vitest';
import { createInitialState } from '../state';
import { D } from '../utils/numbers';
import { technologies } from '../content/technologies';
import { eras } from '../content/eras';
import { balance } from '../content/config';
import { achievements } from '../content/achievements';
import { achievementTrackProgress } from '../content/achievement-tracks';
import { applyAction, simulate } from '../engine/simulation';
import { tradeQuote, tradeRate, tradeEfficiency } from '../engine/trade';
import { productionPerSecond } from '../engine/production';
import { canAdvance, settleProgression } from '../systems/progression';
import { deserializeSave, serializeSave } from '../systems/save';
import {
  acknowledgeSheet,
  currentDiscoveries,
  newDiscoverySheets,
  seedDiscoveries,
} from '../systems/discoveries';

function realm(era = 'medieval') {
  const s = createInitialState(1000);
  s.population = D(5);
  s.statistics.totalPopulationCreated = D(5);
  s.statistics.totalFoodProduced = D(10);
  s.currentEra = era;
  s.reachedEras = eras
    .slice(0, eras.findIndex((e) => e.id === era) + 1)
    .map((e) => e.id);
  s.researchedTechnologies = technologies
    .filter((t) => s.reachedEras.includes(t.era))
    .map((t) => t.id);
  for (const id of ['food', 'materials', 'research'])
    s.resources[id] = D(10000);
  settleProgression(s);
  return s;
}
describe('international trade', () => {
  it('unlocks through Long Distance Trade and re-announces the sheet for improved rates', () => {
    let s = realm();
    expect(s.unlockedFeatures).toContain('trade');
    expect(s.unlockedFeatures).not.toContain('economy');
    expect(newDiscoverySheets(s).has('trade')).toBe(true);
    s = acknowledgeSheet(s, 'trade');
    expect(newDiscoverySheets(s).has('trade')).toBe(false);
    s.researchedTechnologies.push('banking');
    expect(newDiscoverySheets(s).has('trade')).toBe(true);
  });
  it('atomically exchanges resources, records volume without claiming production, and keeps the input state intact', () => {
    const s = realm(),
      before = serializeSave(s, 1000);
    const next = applyAction(s, {
      type: 'trade',
      sell: 'materials',
      buy: 'food',
      amount: 1000,
    });
    expect(next.resources.materials.toNumber()).toBeCloseTo(9000);
    expect(next.resources.food.eq(11200)).toBe(true);
    expect(next.statistics.tradeValueExchanged.eq(2000)).toBe(true);
    expect(next.statistics.materialsTradedAway.eq(1000)).toBe(true);
    expect(next.statistics.tradesCompleted.eq(1)).toBe(true);
    expect(
      next.statistics.totalFoodProduced.eq(s.statistics.totalFoodProduced),
    ).toBe(true);
    expect(next.achievements).toContain('firstTrade');
    expect(tradeEfficiency(next).toNumber()).toBeCloseTo(0.61);
    expect(serializeSave(s, 1000)).toBe(before);
  });
  it.each([
    ['food', 'materials', 300],
    ['food', 'research', 100],
    ['materials', 'food', 1200],
    ['materials', 'research', 200],
    ['research', 'food', 3600],
    ['research', 'materials', 1800],
  ] as const)(
    'quotes a consistent whole-unit receipt for %s → %s',
    (sell, buy, received) => {
      const s = realm();
      expect(tradeQuote(s, sell, buy, 1000).received.toNumber()).toBe(received);
    },
  );
  it('supports Max while preserving fractional unsold stock and previewing the exact receipt', () => {
    const s = realm();
    s.resources.materials = D(1000.75);
    const quote = tradeQuote(s, 'materials', 'research', 'max');
    const next = applyAction(s, {
      type: 'trade',
      sell: 'materials',
      buy: 'research',
      amount: 'max',
    });
    expect(quote.received.toNumber()).toBe(200);
    expect(next.resources.materials.toNumber()).toBeCloseTo(0.75);
    expect(
      next.resources.research.eq(s.resources.research.add(quote.received)),
    ).toBe(true);
  });
  it.each(['-1', '0', '1.5', 'NaN', 'Infinity', '1e1000000001', '10001'])(
    'rejects invalid or unaffordable amount %s without mutations',
    (amount) => {
      const s = realm();
      expect(
        applyAction(s, {
          type: 'trade',
          sell: 'materials',
          buy: 'food',
          amount,
        }),
      ).toBe(s);
    },
  );
  it('rejects locked trade, identical goods, unknown IDs and meta resources', () => {
    const s = realm();
    for (const [sell, buy] of [
      ['food', 'food'],
      ['wealth', 'food'],
      ['civilizationPoints', 'research'],
      ['__proto__', 'food'],
      ['food', 'missing'],
    ])
      expect(applyAction(s, { type: 'trade', sell, buy, amount: 1 })).toBe(s);
    const locked = createInitialState();
    locked.resources.food = D(100);
    expect(
      applyAction(locked, {
        type: 'trade',
        sell: 'food',
        buy: 'materials',
        amount: 100,
      }),
    ).toBe(locked);
  });
  it('uses generic technology effects and prevents every two- or three-resource profit cycle even at the best rate', () => {
    const s = realm('modern');
    const bonus = technologies.find((t) => t.id === 'globalMarkets')!;
    bonus.effects.push({ type: 'tradeEfficiencyBonus', value: 100 });
    try {
      expect(tradeEfficiency(s).eq(balance.trade.maximumEfficiency)).toBe(true);
      for (const a of ['food', 'materials', 'research'])
        for (const b of ['food', 'materials', 'research'].filter(
          (b) => b !== a,
        )) {
          expect(
            tradeRate(s, a, b)
              .mul(tradeRate(s, b, a))
              .lt(1),
          ).toBe(true);
          for (const c of ['food', 'materials', 'research'].filter(
            (c) => c !== a && c !== b,
          ))
            expect(
              tradeRate(s, a, b)
                .mul(tradeRate(s, b, c))
                .mul(tradeRate(s, c, a))
                .lt(1),
            ).toBe(true);
        }
    } finally {
      bonus.effects.pop();
    }
  });
  it('roundtrips exchange statistics and research receipts without minting them again', () => {
    let s = realm();
    s = applyAction(s, {
      type: 'trade',
      sell: 'food',
      buy: 'research',
      amount: 1000,
    });
    const loaded = deserializeSave(JSON.parse(serializeSave(s)));
    expect(loaded.resources).toEqual(s.resources);
    expect(loaded.statistics).toMatchObject(s.statistics);
    expect(loaded.achievements).toEqual(s.achievements);
    settleProgression(loaded);
    expect(loaded.resources).toEqual(s.resources);
  });
});
describe('persistent milestone series', () => {
  it('awards 10, 100 and 1000 population milestones in one catch-up and applies every reward once', () => {
    const s = realm();
    s.population = D(1000);
    s.statistics.totalPopulationCreated = D(1000);
    s.productionUnits.gatherer = D(10);
    const base = productionPerSecond(s).food;
    settleProgression(s);
    expect(
      achievementTrackProgress(s, 'population').earned.map(
        (a) => a.track!.target,
      ),
    ).toEqual(['10', '100', '1000']);
    expect(achievementTrackProgress(s, 'population').next!.track!.target).toBe(
      '10000',
    );
    expect(productionPerSecond(s).food.div(base).toNumber()).toBeCloseTo(
      1.02 ** 3,
    ); // three new population tiers
    const logSize = s.eventLog.length;
    settleProgression(s);
    expect(s.eventLog.length).toBe(logSize);
    expect(s.statistics.achievementCount.eq(s.achievements.length)).toBe(true);
  });
  it('retains rewards after casualties and regrowth, including save/load and offline ticks', () => {
    const s = realm();
    s.population = D(1000);
    s.statistics.totalPopulationCreated = D(1000);
    settleProgression(s);
    s.population = D(10);
    const loaded = deserializeSave(JSON.parse(serializeSave(s))),
      earned = [...loaded.achievements];
    const tick = simulate(loaded, 60);
    tick.population = D(1000);
    settleProgression(tick);
    expect(tick.achievements).toEqual(earned);
    expect(tick.statistics.maxPopulation.eq(1000)).toBe(true);
  });
  it('discovers a newly completed tier after the previous series card was read', () => {
    const s = realm();
    s.population = D(10);
    settleProgression(s);
    s.discoveryProgress = seedDiscoveries(s);
    expect(newDiscoverySheets(s).has('achievements')).toBe(false);
    s.population = D(100);
    settleProgression(s);
    expect(newDiscoverySheets(s).has('achievements')).toBe(true);
    expect(currentDiscoveries(s)).toContainEqual({
      sheet: 'achievements',
      id: 'achievements:track:population:2',
      mode: 'passive',
    });
  });
  it('migrates genuine v8 statistics without re-awarding Small Tribe or deleting population above capacity', () => {
    const s = realm();
    s.population = D(1000);
    s.statistics.totalPopulationCreated = D(1000);
    settleProgression(s);
    const raw = JSON.parse(serializeSave(s));
    raw.saveVersion = 8;
    raw.achievements = raw.achievements.filter((id: string) =>
      ['firstSteps', 'smallTribe', 'organized', 'curious', 'settled'].includes(
        id,
      ),
    );
    for (const id of [
      'tradesCompleted',
      'tradeValueExchanged',
      'foodTradedAway',
      'materialsTradedAway',
      'researchTradedAway',
    ])
      delete raw.statistics[id];
    const before = JSON.stringify(raw),
      loaded = deserializeSave(raw);
    expect(loaded.saveVersion).toBe(9);
    expect(loaded.population.eq(1000)).toBe(true);
    expect(loaded.discoveryProgress).toEqual(raw.discoveryProgress);
    expect(loaded.statistics.tradesCompleted.eq(0)).toBe(true);
    settleProgression(loaded);
    expect(
      loaded.achievements.filter((id) => id === 'smallTribe'),
    ).toHaveLength(1);
    expect(achievementTrackProgress(loaded, 'population').earned).toHaveLength(
      3,
    );
    expect(JSON.stringify(raw)).toBe(before);
  });
  it('keeps duplicate or unknown claimed achievements and corrupted v8 discovery defaults invalid', () => {
    const raw = JSON.parse(serializeSave(realm()));
    raw.achievements.push(raw.achievements[0]);
    expect(() => deserializeSave(raw)).toThrow();
    raw.achievements = ['populationMilestone999'];
    expect(() => deserializeSave(raw)).toThrow();
    raw.achievements = [];
    raw.saveVersion = 8;
    raw.discoveryProgress = null;
    expect(() => deserializeSave(raw)).toThrow();
    expect(new Set(achievements.map((a) => a.id)).size).toBe(
      achievements.length,
    );
  });
});
describe('future eras', () => {
  it('gates Modern and Atomic on research, territory, cities, population, capacity and military independently', () => {
    for (const id of ['modern', 'atomic']) {
      const era = eras.find((e) => e.id === id)!,
        s = realm(era.previous!);
      s.population = D(20000);
      s.statistics.totalPopulationCreated = D(20000);
      s.populationCapacityBonus = D(20000);
      s.ownedTerritories.frontier = D(30);
      s.settlements.camp = D();
      s.settlements.city = D(20);
      s.settlementInvestments.city = D(20);
      s.militaryUnits.infantry = D(10000);
      s.militaryTiers.infantry = id === 'atomic' ? 6 : 5;
      expect(canAdvance(s, era), id).toBe(true);
      for (const condition of era.requirements) {
        const next = deserializeSave(JSON.parse(serializeSave(s)));
        if (condition.type === 'technologyOwned')
          next.researchedTechnologies = next.researchedTechnologies.filter(
            (t) => t !== condition.technologyId,
          );
        if (condition.type === 'populationAtLeast') next.population = D(1);
        if (condition.type === 'territoriesAtLeast')
          next.ownedTerritories.frontier = D();
        if (condition.type === 'settlementsAtLeast')
          next.settlements.city = D();
        if (condition.type === 'populationCapacityAtLeast') {
          next.settlements.city = D();
          next.populationCapacityBonus = D();
        }
        if (condition.type === 'militaryPowerAtLeast')
          next.militaryUnits.infantry = D();
        expect(canAdvance(next, era), `${id}: ${condition.type}`).toBe(false);
      }
    }
  });
});
