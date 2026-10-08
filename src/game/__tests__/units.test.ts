import { describe, expect, it } from 'vitest';
import { createInitialState } from '../state';
import { applyAction, simulate } from '../engine/simulation';
import { productionPerSecond, upgradePreview } from '../engine/production';
import {
  getPopulationFootprint,
  idlePopulation,
  representedPopulation,
  maxCreatable,
  unitById,
  unitStatus,
  validateUnitDefinitions,
  unitCosts,
  productionChains,
} from '../engine/units';
import { activeEffects } from '../engine/effects';
import { settleProgression } from '../systems/progression';
import {
  deserializeSave,
  serializeSave,
  migrateSave,
  exportSave,
  importSave,
} from '../systems/save';
import { applyOfflineProgress } from '../systems/offline';
import { units } from '../content/units';
import { resources } from '../content/resources';
import { technologies } from '../content/technologies';
import { D } from '../utils/numbers';
import type { GameAction, GameState } from '../types';

function ready(population = 50) {
  const state = createInitialState(1000);
  state.population = D(population);
  state.resources.food = D(10_000);
  state.resources.materials = D(10_000);
  state.resources.research = D(1000);
  state.statistics.totalFoodProduced = D(10_000);
  state.researchedTechnologies = technologies
    .filter((t) => t.era === 'tribal')
    .map((t) => t.id);
  state.unlockedProductionUnits = ['miner', 'scholar'];
  settleProgression(state);
  return state;
}
const action = (
  state: GameState,
  type: Extract<GameAction, { unitId: string }>['type'],
  unitId: string,
  amount: number | string = 1,
) => applyAction(state, { type, unitId, amount });
function withFutureUnits(run: () => void) {
  technologies.push({
    id: 'futureUnits',
    name: 'Future test',
    era: 'tribal',
    description: '',
    prerequisites: [],
    visibilityCondition: { type: 'always' },
    unlockCondition: { type: 'always' },
    cost: [],
    effectText: '',
    effects: units
      .filter((u) => u.tier > 2)
      .map((u) => ({ type: 'unlockUnit', id: u.id })),
  });
  try {
    run();
  } finally {
    technologies.pop();
  }
}
function assertPopulation(state: GameState, original = state.population) {
  expect(state.population.eq(original)).toBe(true);
  expect(idlePopulation(state).gte(0)).toBe(true);
  expect(
    idlePopulation(state)
      .add(representedPopulation(state))
      .eq(state.population),
  ).toBe(true);
}

describe('tier-one recruitment and release', () => {
  it('recruits 1, 10 and Max from idle people, then releases 1, 10 and All', () => {
    let state = ready(30);
    state = action(state, 'recruit', 'gatherer');
    expect(state.productionUnits.gatherer.eq(1)).toBe(true);
    state = action(state, 'recruit', 'gatherer', 10);
    expect(idlePopulation(state).eq(19)).toBe(true);
    state = action(state, 'recruit', 'woodcutter', 'max');
    expect(state.productionUnits.woodcutter.eq(19)).toBe(true);
    expect(idlePopulation(state).eq(0)).toBe(true);
    state = action(state, 'release', 'gatherer');
    state = action(state, 'release', 'gatherer', 10);
    state = action(state, 'release', 'woodcutter', 'max');
    expect(idlePopulation(state).eq(30)).toBe(true);
    assertPopulation(state, D(30));
  });
  it('refuses recruitment without idle population and locked tier-one units', () => {
    const state = action(ready(2), 'recruit', 'gatherer', 'max');
    expect(action(state, 'recruit', 'woodcutter')).toBe(state);
    const early = createInitialState(1000);
    expect(action(early, 'recruit', 'gatherer')).toBe(early);
  });
  it.each([-1, 0, 0.5, 'invalid', 'Infinity'])(
    'rejects malformed quantities without changing state: %s',
    (amount) => {
      const state = ready();
      expect(action(state, 'recruit', 'gatherer', amount)).toBe(state);
    },
  );
  it('does not loop or convert large Max counts into native numbers', () => {
    const state = ready();
    state.population = D('1e400');
    const recruited = action(state, 'recruit', 'gatherer', 'max');
    expect(recruited.productionUnits.gatherer.eq('1e400')).toBe(true);
    expect(idlePopulation(recruited).eq(0)).toBe(true);
    assertPopulation(recruited);
  });
});

describe('upgrades, dismantling and population accounting', () => {
  it('derives footprints through all four tiers in all three chains', () => {
    for (const ids of [
      ['gatherer', 'farmer', 'farm', 'industrialFarm'],
      ['woodcutter', 'miner', 'workshop', 'factory'],
      ['thinker', 'scholar', 'academy', 'laboratory'],
    ])
      expect(ids.map((id) => getPopulationFootprint(id).toNumber())).toEqual([
        1, 5, 20, 100,
      ]);
    expect(() => validateUnitDefinitions()).not.toThrow();
  });
  it('consumes five Gatherers, charges resources and preserves population and idle people', () => {
    const before = action(ready(), 'recruit', 'gatherer', 8);
    const next = action(before, 'upgrade', 'farmer');
    expect(next.productionUnits.gatherer.eq(3)).toBe(true);
    expect(next.productionUnits.farmer.eq(1)).toBe(true);
    expect(next.resources.food.eq(before.resources.food.sub(50))).toBe(true);
    expect(
      next.resources.materials.eq(before.resources.materials.sub(20)),
    ).toBe(true);
    expect(idlePopulation(next).eq(idlePopulation(before))).toBe(true);
    assertPopulation(next, before.population);
    expect(before.productionUnits.gatherer.eq(8)).toBe(true);
  });
  it('cannot recruit or release higher tiers directly or upgrade/dismantle a base tier', () => {
    const state = ready();
    for (const [type, id] of [
      ['recruit', 'farmer'],
      ['release', 'farmer'],
      ['upgrade', 'gatherer'],
      ['dismantle', 'gatherer'],
    ] as const)
      expect(action(state, type, id)).toBe(state);
  });
  it('refuses an upgrade without input units, without resources, or without technology', () => {
    const state = ready();
    expect(action(state, 'upgrade', 'farmer')).toBe(state);
    const inputs = action(state, 'recruit', 'gatherer', 5);
    inputs.resources.materials = D(19);
    expect(action(inputs, 'upgrade', 'farmer')).toBe(inputs);
    inputs.resources.materials = D(20);
    inputs.resources.food = D(49);
    expect(action(inputs, 'upgrade', 'farmer')).toBe(inputs);
    inputs.resources.food = D(100);
    inputs.researchedTechnologies = [];
    inputs.unlockedProductionUnits = [];
    expect(action(inputs, 'upgrade', 'farmer')).toBe(inputs);
  });
  it('Upgrade Max is limited by both sources and the scarcest resource', () => {
    const state = action(ready(), 'recruit', 'gatherer', 16);
    state.resources.food = D(100);
    state.resources.materials = D(45);
    expect(maxCreatable(state, unitById('farmer')!).eq(2)).toBe(true);
    const next = action(state, 'upgrade', 'farmer', 'max');
    expect(next.productionUnits.farmer.eq(2)).toBe(true);
    expect(next.productionUnits.gatherer.eq(6)).toBe(true);
    expect(next.resources.food.eq(0)).toBe(true);
    expect(next.resources.materials.eq(5)).toBe(true);
    assertPopulation(next, state.population);
    expect(action(next, 'upgrade', 'farmer', 'max')).toBe(next);
  });
  it('aggregates duplicate resource costs before calculating Max and charging', () => {
    const unit = unitById('farmer')!,
      costs = unit.costs;
    unit.costs = [
      { resource: 'food', amount: 20 },
      { resource: 'food', amount: 30 },
    ];
    try {
      let state = action(ready(), 'recruit', 'gatherer', 10);
      state.resources.food = D(70);
      expect(unitCosts(unit)[0].amount.eq(50)).toBe(true);
      state = action(state, 'upgrade', 'farmer', 'max');
      expect(state.productionUnits.farmer.eq(1)).toBe(true);
      expect(state.resources.food.eq(20)).toBe(true);
    } finally {
      unit.costs = costs;
    }
  });
  it('dismantles one or all units, returns the inputs, and never refunds resource costs', () => {
    let state = action(ready(), 'recruit', 'gatherer', 10);
    state = action(state, 'upgrade', 'farmer', 2);
    const food = state.resources.food,
      materials = state.resources.materials;
    state = action(state, 'dismantle', 'farmer');
    expect(state.productionUnits.gatherer.eq(5)).toBe(true);
    state = action(state, 'dismantle', 'farmer', 'max');
    expect(state.productionUnits.gatherer.eq(10)).toBe(true);
    expect(state.productionUnits.farmer.eq(0)).toBe(true);
    expect(state.resources.food.eq(food)).toBe(true);
    expect(state.resources.materials.eq(materials)).toBe(true);
    state = action(state, 'release', 'gatherer', 'max');
    expect(idlePopulation(state).eq(50)).toBe(true);
    assertPopulation(state);
  });
  it('supports an entire four-tier upgrade/downgrade chain without losing a single person', () =>
    withFutureUnits(() => {
      let state = ready(120);
      state.researchedTechnologies.push('futureUnits');
      state.resources.food = D('1e6');
      state.resources.materials = D('1e6');
      state = action(state, 'recruit', 'gatherer', 100);
      for (const id of ['farmer', 'farm', 'industrialFarm']) {
        state = action(state, 'upgrade', id, 'max');
        assertPopulation(state, D(120));
        expect(idlePopulation(state).eq(20)).toBe(true);
      }
      expect(state.productionUnits.industrialFarm.eq(1)).toBe(true);
      for (const id of ['industrialFarm', 'farm', 'farmer']) {
        state = action(state, 'dismantle', id, 'max');
        assertPopulation(state, D(120));
      }
      expect(state.productionUnits.gatherer.eq(100)).toBe(true);
    }));
  it('rejects cyclic definitions and accidental extra population charges', () => {
    const farmer = unitById('farmer')!,
      original = farmer.upgradeFrom;
    farmer.upgradeFrom = { unitId: 'farm', amount: 1 };
    try {
      expect(() => getPopulationFootprint('farmer')).toThrow('Cyclic');
      expect(() => validateUnitDefinitions()).toThrow();
    } finally {
      farmer.upgradeFrom = original;
    }
    farmer.populationCost = 1;
    try {
      expect(() => validateUnitDefinitions()).toThrow();
    } finally {
      delete farmer.populationCost;
    }
  });
});

describe('tier production, modifiers and reveal states', () => {
  it('adds a new resource chain from data, including multi-person base units and duplicate outputs', () => {
    resources.push({
      id: 'energy',
      name: 'Energy',
      description: '',
      color: '#ccad52',
      feature: 'manualGathering',
      initiallyVisible: true,
      productionLabel: 'Energy Production',
    });
    units.push(
      {
        id: 'solarPanel',
        name: 'Solar Panel',
        description: '',
        category: 'energy',
        tier: 1,
        populationCost: 2,
        baseProduction: [
          { resource: 'energy', amount: 1 },
          { resource: 'energy', amount: 1 },
        ],
        unlockCondition: { type: 'always' },
      },
      {
        id: 'solarFarm',
        name: 'Solar Farm',
        description: '',
        category: 'energy',
        tier: 2,
        upgradeFrom: { unitId: 'solarPanel', amount: 4 },
        baseProduction: [{ resource: 'energy', amount: 12 }],
        unlockCondition: { type: 'always' },
      },
    );
    try {
      validateUnitDefinitions();
      let state = action(ready(11), 'recruit', 'solarPanel', 'max');
      expect(state.productionUnits.solarPanel.eq(5)).toBe(true);
      expect(idlePopulation(state).eq(1)).toBe(true);
      expect(productionPerSecond(state).energy.eq(10)).toBe(true);
      state = action(state, 'upgrade', 'solarFarm');
      expect(productionPerSecond(state).energy.eq(14)).toBe(true);
      expect(
        productionChains(state)
          .find((c) => c.resource.id === 'energy')
          ?.units.map((u) => u.id),
      ).toEqual(['solarPanel', 'solarFarm']);
      expect(getPopulationFootprint('solarFarm').eq(8)).toBe(true);
      assertPopulation(state, D(11));
      const loaded = deserializeSave(JSON.parse(serializeSave(state)));
      expect(loaded.productionUnits.solarFarm.eq(1)).toBe(true);
      assertPopulation(loaded, D(11));
    } finally {
      units.splice(-2);
      resources.pop();
    }
  });
  it('adds all owned tiers and previews the actual net production improvement', () => {
    const before = action(ready(), 'recruit', 'gatherer', 13),
      preview = upgradePreview(before, unitById('farmer')!)!;
    const after = action(before, 'upgrade', 'farmer', 2);
    expect(productionPerSecond(after).food.toNumber()).toBeCloseTo(
      (3 * 0.5 + 2 * 4) * 1.02 * 1.02 * 1.3,
    );
    const one = action(before, 'upgrade', 'farmer');
    expect(preview.gain.food.toNumber()).toBeCloseTo(
      productionPerSecond(one)
        .food.sub(productionPerSecond(before).food)
        .toNumber(),
    );
  });
  it('ownership effects use the existing modifier infrastructure and disappear when dismantled', () =>
    withFutureUnits(() => {
      let state = ready(50);
      state.researchedTechnologies.push('futureUnits');
      state = action(state, 'recruit', 'gatherer', 50);
      state = action(state, 'upgrade', 'farmer', 10);
      const before = state;
      const preview = upgradePreview(before, unitById('farm')!)!;
      state = action(state, 'upgrade', 'farm');
      expect(preview.gain.food.toNumber()).toBeCloseTo(
        productionPerSecond(state)
          .food.sub(productionPerSecond(before).food)
          .toNumber(),
      );
      state = action(state, 'upgrade', 'farm');
      expect(state.productionUnits.farmer.eq(2)).toBe(true);
      expect(productionPerSecond(state).food.toNumber()).toBeCloseTo(
        (2 * 4 * 1.1 ** 2 + 2 * 28) * 1.02 * 1.02 * 1.3,
      );
      expect(
        activeEffects(state).some((e) => e.type === 'unitProductionMultiplier'),
      ).toBe(true);
      state = action(state, 'dismantle', 'farm', 'max');
      expect(
        activeEffects(state).some((e) => e.type === 'unitProductionMultiplier'),
      ).toBe(false);
      expect(productionPerSecond(state).food.toNumber()).toBeCloseTo(
        10 * 4 * 1.02 * 1.02 * 1.3,
      );
    }));
  it('keeps future tiers hidden, reveals unknown tiers, then makes purchased tiers available/owned', () => {
    const state = ready();
    state.researchedTechnologies = [];
    state.unlockedProductionUnits = [];
    expect(unitStatus(state, unitById('farm')!)).toBe('hidden');
    expect(unitStatus(state, unitById('farmer')!)).toBe('revealed');
    state.researchedTechnologies = [
      'language',
      'knowledgeSharing',
      'agriculture',
    ];
    expect(unitStatus(state, unitById('farmer')!)).toBe('available');
    const owned = action(
      action(state, 'recruit', 'gatherer', 5),
      'upgrade',
      'farmer',
    );
    expect(unitStatus(owned, unitById('farmer')!)).toBe('owned');
  });
});

describe('tiered saves, legacy migration and offline progress', () => {
  it('roundtrips tier counts and weighted population through JSON and export/import', () => {
    let state = action(ready(), 'recruit', 'gatherer', 13);
    state = action(state, 'upgrade', 'farmer', 2);
    state = action(state, 'recruit', 'thinker', 5);
    state = action(state, 'upgrade', 'scholar');
    const loaded = importSave(exportSave(state));
    expect(loaded.saveVersion).toBe(4);
    expect(loaded.productionUnits.farmer.eq(2)).toBe(true);
    expect(loaded.productionUnits.scholar.eq(1)).toBe(true);
    expect(idlePopulation(loaded).eq(idlePopulation(state))).toBe(true);
    expect(JSON.parse(serializeSave(state)).jobAssignments).toBeUndefined();
    assertPopulation(loaded);
  });
  it('migrates old Gatherers and one-person Farmers into tier-one units while preserving everything else', () => {
    const state = ready(20),
      raw = JSON.parse(serializeSave(state));
    raw.saveVersion = 1;
    raw.jobAssignments = {
      gatherer: '4',
      farmer: '3',
      woodcutter: '2',
      thinker: '1',
    };
    delete raw.productionUnits;
    const original = JSON.stringify(raw),
      migrated = deserializeSave(raw);
    expect(migrated.productionUnits.gatherer.eq(7)).toBe(true);
    expect(migrated.productionUnits.farmer.eq(0)).toBe(true);
    expect(migrated.productionUnits.woodcutter.eq(2)).toBe(true);
    expect(migrated.productionUnits.thinker.eq(1)).toBe(true);
    expect(idlePopulation(migrated).eq(10)).toBe(true);
    expect(migrated.resources.food.eq(state.resources.food)).toBe(true);
    expect(migrated.resources.materials.eq(state.resources.materials)).toBe(
      true,
    );
    expect(migrated.researchedTechnologies).toEqual(
      state.researchedTechnologies,
    );
    expect(migrated.eventLog.at(-1)?.message).toContain('previous Farmers');
    expect(JSON.stringify(raw)).toBe(original);
    assertPopulation(migrated, D(20));
    expect(migrateSave(migrateSave(raw))).toEqual(migrateSave(raw));
  });
  it('rejects weighted over-allocation, unknown units, fractions, negatives and locked tiers', () => {
    const raw = JSON.parse(serializeSave(ready(6)));
    raw.productionUnits.farmer = '2';
    expect(() => deserializeSave(raw)).toThrow('exceed population');
    raw.productionUnits.farmer = '1.5';
    expect(() => deserializeSave(raw)).toThrow();
    raw.productionUnits.farmer = '-1';
    expect(() => deserializeSave(raw)).toThrow();
    raw.productionUnits.farmer = '0';
    raw.productionUnits.unknown = '1';
    expect(() => deserializeSave(raw)).toThrow('Unknown');
    delete raw.productionUnits.unknown;
    raw.productionUnits.farm = '1';
    raw.population = '50';
    expect(() => deserializeSave(raw)).toThrow('undiscovered unit');
  });
  it('uses all tiers and the same modifiers for offline production, without changing counts or population', () => {
    let state = action(ready(), 'recruit', 'gatherer', 10);
    state = action(state, 'upgrade', 'farmer');
    state = action(state, 'recruit', 'woodcutter', 5);
    state = action(state, 'upgrade', 'miner');
    const { state: offline, report } = applyOfflineProgress(
        state,
        state.lastSimulationTime + 3600_000,
      ),
      live = simulate(state, 3600);
    expect(offline.resources.food.eq(live.resources.food)).toBe(true);
    expect(offline.resources.materials.eq(live.resources.materials)).toBe(true);
    expect(report?.produced.food.toNumber()).toBeGreaterThan(4 * 3600);
    expect(offline.productionUnits.farmer.eq(1)).toBe(true);
    expect(offline.productionUnits.miner.eq(1)).toBe(true);
    assertPopulation(offline, state.population);
  });
});
