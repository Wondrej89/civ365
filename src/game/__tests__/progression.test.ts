import { describe, expect, it } from 'vitest';
import { createInitialState } from '../state';
import { applyAction, simulate } from '../engine/simulation';
import { populationCost, productionPerSecond } from '../engine/production';
import { growthInterval } from '../engine/population';
import {
  representedPopulation,
  unitById,
  getPopulationFootprint,
} from '../engine/units';
import { settleProgression, technologyStatus } from '../systems/progression';
import { technologyTree } from '../systems/technology-tree';
import { populationDistribution } from '../systems/statistics';
import { applyOfflineProgress } from '../systems/offline';
import { deserializeSave, serializeSave, migrateSave } from '../systems/save';
import { technologies } from '../content/technologies';
import { statisticSeries } from '../content/statistics';
import { units } from '../content/units';
import { balance } from '../content/config';
import { D, sum } from '../utils/numbers';

function automatic() {
  const state = createInitialState(1000);
  state.population = D(20);
  state.resources.food = D('1e7');
  state.resources.materials = D('1e7');
  state.resources.research = D('1e7');
  state.statistics.totalFoodProduced = D(1000);
  state.statistics.totalPopulationCreated = D(20);
  state.currentEra = 'agricultural';
  state.reachedEras = ['tribal', 'agricultural'];
  state.researchedTechnologies = [
    ...technologies.filter((t) => t.era === 'tribal').map((t) => t.id),
    'settledLife',
    'naturalGrowth',
  ];
  settleProgression(state);
  return applyAction(state, { type: 'autoGrowth', enabled: true });
}
function allContent(era = 'classical') {
  const state = automatic(),
    eras = ['tribal', 'agricultural', 'bronze', 'classical'];
  state.currentEra = era;
  state.reachedEras = eras.slice(0, eras.indexOf(era) + 1);
  state.researchedTechnologies = technologies
    .filter((t) => state.reachedEras.includes(t.era))
    .map((t) => t.id);
  settleProgression(state);
  return state;
}

describe('shared automatic population growth', () => {
  it('is gated behind Natural Growth and starts OFF with a 10% reserve', () => {
    const state = createInitialState(1000);
    expect(state.autoPopulationGrowth).toEqual({
      enabled: false,
      accumulator: 0,
      foodReservePercent: 10,
    });
    expect(applyAction(state, { type: 'autoGrowth', enabled: true })).toBe(
      state,
    );
  });
  it('uses exactly the manual growth price and preserves idle/assigned accounting', () => {
    const state = automatic(),
      cost = populationCost(state);
    const manual = applyAction(state, { type: 'grow' }),
      auto = simulate(state, 10);
    expect(auto.population.eq(manual.population)).toBe(true);
    expect(auto.resources.food.eq(manual.resources.food)).toBe(true);
    expect(auto.statistics.totalPopulationCreated.eq(21)).toBe(true);
    expect(auto.statistics.foodSpentOnGrowth.eq(cost)).toBe(true);
    expect(representedPopulation(auto).eq(0)).toBe(true);
    expect(state.population.eq(20)).toBe(true);
  });
  it('preserves partial intervals, can pause, and restarts with a full interval', () => {
    const state = simulate(automatic(), 9.5);
    expect(state.population.eq(20)).toBe(true);
    const grown = simulate(state, 0.5);
    expect(grown.population.eq(21)).toBe(true);
    const off = applyAction(grown, { type: 'autoGrowth', enabled: false });
    expect(simulate(off, 100).population.eq(21)).toBe(true);
    const on = applyAction(off, { type: 'autoGrowth', enabled: true });
    expect(simulate(on, 9.9).population.eq(21)).toBe(true);
  });
  it('protects a share of current Food on every attempt; manual growth can use the reserve', () => {
    const state = automatic();
    state.autoPopulationGrowth.foodReservePercent = 50;
    const cost = populationCost(state);
    state.resources.food = cost.mul(1.5);
    expect(simulate(state, 10).population.eq(20)).toBe(true);
    expect(applyAction(state, { type: 'grow' }).population.eq(21)).toBe(true);
    state.resources.food = cost.mul(2);
    expect(simulate(state, 10).population.eq(21)).toBe(true);
  });
  it('skips unaffordable events and charges successively increasing growth costs', () => {
    const state = automatic();
    state.resources.food = D(1);
    expect(simulate(state, 20).population.eq(20)).toBe(true);
    state.resources.food = D('1e7');
    const once = simulate(state, 10),
      twice = simulate(state, 20);
    expect(
      twice.resources.food.eq(
        state.resources.food
          .sub(populationCost(state))
          .sub(populationCost(once)),
      ),
    ).toBe(true);
    expect(populationCost(twice).gt(populationCost(once))).toBe(true);
  });
  it('gets 10 → 7 → 4 → 2 second intervals from effects, with no ID switch', () => {
    const state = automatic();
    expect(growthInterval(state)).toBeCloseTo(10);
    state.researchedTechnologies.push('organizedSettlements');
    expect(growthInterval(state)).toBeCloseTo(7);
    state.researchedTechnologies.push('urbanCommunities');
    expect(growthInterval(state)).toBeCloseTo(4);
    state.researchedTechnologies.push('publicHealth');
    expect(growthInterval(state)).toBeCloseTo(2);
  });
  it('matches a sequence of live ticks offline, including production, costs, reserve and modifiers', () => {
    let state = allContent('agricultural');
    state = applyAction(state, {
      type: 'recruit',
      unitId: 'gatherer',
      amount: 10,
    });
    const offline = applyOfflineProgress(
      state,
      state.lastSimulationTime + 3600_000,
    );
    let live = state;
    for (let i = 0; i < 3600; i++) live = simulate(live, 1);
    expect(offline.state.population.eq(live.population)).toBe(true);
    expect(offline.state.resources.food.toNumber()).toBeCloseTo(
      live.resources.food.toNumber(),
      5,
    );
    expect(
      offline.report?.populationCreated.eq(
        live.population.sub(state.population),
      ),
    ).toBe(true);
    expect(offline.report?.produced.food.toNumber()).toBeCloseTo(
      productionPerSecond(state).food.mul(3600).toNumber(),
    );
    expect(offline.state.statisticsHistory.population).toEqual(
      live.statisticsHistory.population,
    );
  });
  it('caps automatic growth and history at eight offline hours and cannot claim the same absence twice', () => {
    const state = allContent();
    const now = state.lastSimulationTime + 24 * 3600_000;
    const result = applyOfflineProgress(state, now);
    expect(result.report?.simulatedSeconds).toBe(balance.maxOfflineSeconds);
    expect(
      result.state.statistics.totalPlayTime.eq(balance.maxOfflineSeconds),
    ).toBe(true);
    expect(result.state.statisticsHistory.population.at(-1)?.timestamp).toBe(
      balance.maxOfflineSeconds,
    );
    expect(result.state.resources.food.gte(0)).toBe(true);
    expect(result.state.population.gt(state.population)).toBe(true);
    const repeated = applyOfflineProgress(result.state, now);
    expect(repeated.report).toBeNull();
    expect(repeated.state.population.eq(result.state.population)).toBe(true);
    expect(repeated.state.statisticsHistory).toEqual(
      result.state.statisticsHistory,
    );
  }, 20000);
});

describe('connected discoveries and eras', () => {
  it('shows roots and one frontier without leaking distant discoveries or eras', () => {
    const state = createInitialState(1000);
    state.population = D(5);
    state.statistics.totalFoodProduced = D(100);
    settleProgression(state);
    const ids = technologyTree(state).nodes.map((n) => n.technology.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'foraging',
        'language',
        'toolMaking',
        'knowledgeSharing',
      ]),
    );
    expect(ids).not.toContain('writing');
    expect(ids).not.toContain('engineering');
    expect(
      technologyStatus(
        state,
        technologies.find((t) => t.id === 'toolMaking')!,
      ),
    ).toBe('revealed');
    expect(applyAction(state, { type: 'research', id: 'toolMaking' })).toBe(
      state,
    );
    expect(technologyTree(state).groups.map((g) => g.era.id)).toEqual([
      'tribal',
    ]);
  });
  it('generates every visible connector from prerequisites', () => {
    const tree = technologyTree(allContent());
    expect(tree.edges.length).toBe(
      tree.nodes.reduce(
        (n, node) => n + node.technology.prerequisites.length,
        0,
      ),
    );
    for (const edge of tree.edges)
      expect(edge.target.technology.prerequisites).toContain(
        edge.source.technology.id,
      );
    expect(
      tree.nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y)),
    ).toBe(true);
  });
  it('enters Bronze and Classical without a reset and grants one point per first entry', () => {
    let state = allContent('agricultural');
    state.population = D(50);
    state.productionUnits.farmer = D(2);
    const bank = state.resources.food;
    state = applyAction(state, { type: 'advance', id: 'bronze' });
    expect(state.currentEra).toBe('bronze');
    expect(state.resources.food.eq(bank)).toBe(true);
    expect(state.productionUnits.farmer.eq(2)).toBe(true);
    state.researchedTechnologies = technologies
      .filter((t) => t.era !== 'classical')
      .map((t) => t.id);
    state.population = D(200);
    settleProgression(state);
    state = applyAction(state, { type: 'advance', id: 'classical' });
    expect(state.currentEra).toBe('classical');
    expect(state.resources.civilizationPoints.eq(2)).toBe(true);
    expect(applyAction(state, { type: 'advance', id: 'classical' })).toBe(
      state,
    );
  });
  it('requires Materials for every higher tier and always leaves a free tier-one Materials route', () => {
    expect(
      units
        .filter((u) => u.tier > 1)
        .every((u) =>
          u.costs?.some((c) => c.resource === 'materials' && D(c.amount).gt(0)),
        ),
    ).toBe(true);
    expect(unitById('woodcutter')!.costs ?? []).toEqual([]);
    const state = automatic();
    state.resources.materials = D(0);
    const recruited = applyAction(state, {
      type: 'recruit',
      unitId: 'woodcutter',
      amount: 5,
    });
    expect(recruited.productionUnits.woodcutter.eq(5)).toBe(true);
    expect(simulate(recruited, 10).resources.materials.gt(0)).toBe(true);
    expect(
      applyAction(recruited, { type: 'upgrade', unitId: 'farmer', amount: 1 }),
    ).toBe(recruited);
  });
});

describe('bounded generic statistics and save migration', () => {
  it('keeps records hidden before Record Keeping, then samples at configured boundaries', () => {
    let state = simulate(automatic(), 100);
    expect(state.statisticsHistory).toEqual({});
    state.researchedTechnologies.push('recordKeeping');
    settleProgression(state);
    expect(state.unlockedFeatures).toContain('statistics');
    expect(state.unlockedFeatures).not.toContain('populationDistribution');
    expect(state.statisticsHistory.population).toHaveLength(1);
    state = simulate(state, 29);
    expect(state.statisticsHistory.population).toHaveLength(1);
    state = simulate(state, 1);
    expect(state.statisticsHistory.population).toHaveLength(2);
    const census = allContent('bronze');
    expect(census.unlockedFeatures).toContain('populationDistribution');
  });
  it('counts higher-tier footprints in their resource groups and keeps the population equation', () => {
    const state = allContent();
    state.population = D(100);
    state.productionUnits.farm = D(2);
    state.productionUnits.workshop = D(1);
    state.productionUnits.academy = D(1);
    const groups = populationDistribution(state);
    expect(
      groups
        .find((g) => g.id === 'food')!
        .value.eq(getPopulationFootprint('farm').mul(2)),
    ).toBe(true);
    expect(sum(groups.map((g) => g.value)).eq(state.population)).toBe(true);
  });
  it('retains bounded history and adds another series without altering the sampler', () => {
    const limit = balance.statistics.maxSamples;
    balance.statistics.maxSamples = 3;
    statisticSeries.push({
      id: 'foodBank',
      name: 'Food bank',
      color: '#c18d30',
      sampleValue: (s) => s.resources.food,
      unlockCondition: { type: 'featureUnlocked', featureId: 'statistics' },
    });
    try {
      const state = simulate(allContent('agricultural'), 150);
      expect(state.statisticsHistory.population).toHaveLength(3);
      expect(state.statisticsHistory.foodBank).toHaveLength(3);
    } finally {
      balance.statistics.maxSamples = limit;
      statisticSeries.pop();
    }
  });
  it('samples fractional live ticks at the same boundaries as an offline interval', () => {
    const state = allContent('agricultural');
    let live = state;
    for (let i = 0; i < 600; i++) live = simulate(live, 0.1);
    expect(live.statisticsHistory.population).toEqual(
      simulate(state, 60).statisticsHistory.population,
    );
    expect(() =>
      deserializeSave(JSON.parse(serializeSave(live))),
    ).not.toThrow();
  });
  it('roundtrips history, growth phase, reserve and weighted population without mutating source', () => {
    const state = simulate(allContent('agricultural'), 65),
      original = JSON.stringify(state.statisticsHistory);
    const loaded = deserializeSave(JSON.parse(serializeSave(state)));
    expect(loaded.statisticsHistory).toEqual(state.statisticsHistory);
    expect(loaded.autoPopulationGrowth).toEqual(state.autoPopulationGrowth);
    simulate(loaded, 60);
    expect(JSON.stringify(state.statisticsHistory)).toBe(original);
  });
  it('migrates v2 without removing owned or previously unlocked units or granting new research', () => {
    const state = automatic(),
      raw = JSON.parse(serializeSave(state));
    raw.saveVersion = 2;
    raw.productionUnits.miner = '1';
    raw.productionUnits.scholar = '1';
    raw.productionUnits.scientist = raw.productionUnits.academy;
    delete raw.productionUnits.academy;
    raw.researchedTechnologies = technologies
      .filter((t) => t.era === 'tribal')
      .map((t) => t.id);
    raw.unlockedFeatures = raw.unlockedFeatures.filter(
      (id: string) =>
        !['autoPopulationGrowth', 'settlementPlanning'].includes(id),
    );
    for (const key of [
      'autoPopulationGrowth',
      'statisticsHistory',
      'statisticsSamplingAccumulator',
      'unlockedProductionUnits',
      'constructedProductionUnits',
    ])
      delete raw[key];
    const original = JSON.stringify(raw),
      migrated = deserializeSave(raw);
    expect(migrated.saveVersion).toBe(3);
    expect(migrated.productionUnits.miner.eq(1)).toBe(true);
    expect(migrated.productionUnits.scholar.eq(1)).toBe(true);
    expect(migrated.productionUnits.academy.eq(0)).toBe(true);
    expect(migrated.researchedTechnologies).toEqual(raw.researchedTechnologies);
    expect(migrated.autoPopulationGrowth.enabled).toBe(false);
    expect(migrated.statisticsHistory).toEqual({});
    expect(JSON.stringify(raw)).toBe(original);
    expect(migrateSave(migrateSave(raw))).toEqual(migrateSave(raw));
  });
  it('rejects invalid automation and corrupt or oversized histories', () => {
    const raw = JSON.parse(serializeSave(allContent('agricultural')));
    raw.autoPopulationGrowth.foodReservePercent = 200;
    expect(() => deserializeSave(raw)).toThrow();
    raw.autoPopulationGrowth.foodReservePercent = 10;
    raw.autoPopulationGrowth.accumulator = -1;
    expect(() => deserializeSave(raw)).toThrow();
    raw.autoPopulationGrowth.accumulator = 0;
    raw.statisticsHistory.population = [
      { timestamp: 1, value: '20' },
      { timestamp: 0, value: '20' },
    ];
    expect(() => deserializeSave(raw)).toThrow();
    raw.statisticsHistory.population = Array.from({ length: 2001 }, (_, i) => ({
      timestamp: i,
      value: '20',
    }));
    expect(() => deserializeSave(raw)).toThrow();
  });
});
