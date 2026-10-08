import { describe, expect, it } from 'vitest';
import { createInitialState } from '../state';
import { applyAction, simulate } from '../engine/simulation';
import { productionPerSecond, populationCost } from '../engine/production';
import { idlePopulation } from '../engine/units';
import { evaluateCondition, isFeatureUnlocked } from '../engine/conditions';
import {
  activeEffects,
  populationModifier,
  productionModifier,
  resourceMultiplier,
} from '../engine/effects';
import {
  settleProgression,
  technologyStatus,
  logEvent,
} from '../systems/progression';
import { applyOfflineProgress } from '../systems/offline';
import {
  deserializeSave,
  exportSave,
  importSave,
  loadGame,
  migrateSave,
  serializeSave,
  SAVE_KEY,
} from '../systems/save';
import { balance } from '../content/config';
import { technologies } from '../content/technologies';
import { skills } from '../content/skills';
import { D, formatNumber } from '../utils/numbers';
import type { Condition, GameState } from '../types';

const initial = () => createInitialState(1_000);
function developed(population = 5) {
  const s = initial();
  s.population = D(population);
  s.resources.food = D(1000);
  s.statistics.totalFoodProduced = D(1000);
  s.resources.materials = D(1000);
  s.resources.research = D(1000);
  settleProgression(s);
  return s;
}
function buy(s: GameState, id: string) {
  return applyAction(s, { type: 'research', id });
}

describe('opening and feature discovery', () => {
  it('starts with one person, zero resources, and only gathering', () => {
    const s = initial();
    expect(s.population.eq(1)).toBe(true);
    expect(Object.values(s.resources).every((n) => n.eq(0))).toBe(true);
    expect(s.unlockedFeatures).toEqual(['manualGathering']);
  });
  it('unlocks materials on the fifth click and growth on the tenth', () => {
    let s = initial();
    expect(applyAction(s, { type: 'gather', resource: 'materials' })).toBe(s);
    for (let i = 0; i < 4; i++)
      s = applyAction(s, { type: 'gather', resource: 'food' });
    expect(isFeatureUnlocked(s, 'materials')).toBe(false);
    s = applyAction(s, { type: 'gather', resource: 'food' });
    expect(isFeatureUnlocked(s, 'materials')).toBe(true);
    for (let i = 0; i < 5; i++)
      s = applyAction(s, { type: 'gather', resource: 'food' });
    s = applyAction(s, { type: 'grow' });
    expect(s.population.eq(2)).toBe(true);
    expect(s.resources.food.eq(0)).toBe(true);
    expect(isFeatureUnlocked(s, 'jobs')).toBe(true);
    expect(isFeatureUnlocked(s, 'research')).toBe(false);
    expect(s.achievements).toContain('firstSteps');
    expect(isFeatureUnlocked(s, 'achievements')).toBe(true);
    expect(s.statistics.totalManualClicks.eq(10)).toBe(true);
  });
  it('retains unlocks after resources are spent', () => {
    const s = developed();
    s.resources.food = D();
    settleProgression(s);
    expect(isFeatureUnlocked(s, 'research')).toBe(true);
  });
  it('has no effect for unaffordable growth or unknown actions', () => {
    const s = initial();
    expect(applyAction(s, { type: 'grow' })).toBe(s);
    expect(applyAction(s, { type: 'gather', resource: 'wealth' })).toBe(s);
  });
});

describe('workforce and production', () => {
  it('rejects excess recruitment, fractions, empty releases and locked units', () => {
    const s = developed(2);
    expect(
      applyAction(s, { type: 'recruit', unitId: 'gatherer', amount: 3 }),
    ).toBe(s);
    expect(
      applyAction(s, { type: 'recruit', unitId: 'gatherer', amount: 0.5 }),
    ).toBe(s);
    expect(
      applyAction(s, { type: 'release', unitId: 'gatherer', amount: 1 }),
    ).toBe(s);
    expect(
      applyAction(s, { type: 'recruit', unitId: 'thinker', amount: 1 }),
    ).toBe(s);
    expect(
      applyAction(s, { type: 'recruit', unitId: 'farmer', amount: 1 }),
    ).toBe(s);
  });
  it('recruits immediately, produces by elapsed time, and releases people', () => {
    let s = applyAction(developed(2), {
      type: 'recruit',
      unitId: 'gatherer',
      amount: 2,
    });
    expect(idlePopulation(s).eq(0)).toBe(true);
    expect(productionPerSecond(s).food.toNumber()).toBeCloseTo(1.02);
    const before = s.resources.food;
    s = simulate(s, 5);
    expect(s.resources.food.sub(before).toNumber()).toBeCloseTo(5.1);
    s = applyAction(s, { type: 'release', unitId: 'gatherer', amount: 1 });
    expect(idlePopulation(s).eq(1)).toBe(true);
  });
  it('is independent of tick frequency', () => {
    const s = applyAction(developed(), {
      type: 'recruit',
      unitId: 'woodcutter',
      amount: 2,
    });
    let small = s;
    for (let i = 0; i < 100; i++) small = simulate(small, 0.1);
    expect(small.resources.materials.toNumber()).toBeCloseTo(
      simulate(s, 10).resources.materials.toNumber(),
      8,
    );
  });
  it('preserves input state and ignores invalid delta time', () => {
    const s = developed();
    const text = serializeSave(s, 1000);
    simulate(s, 10);
    expect(serializeSave(s, 1000)).toBe(text);
    expect(simulate(s, -2)).toBe(s);
    expect(simulate(s, NaN)).toBe(s);
  });
  it('supports resource amounts far beyond Number.MAX_VALUE', () => {
    const s = developed();
    s.resources.food = D('1e400');
    const next = applyAction(s, { type: 'grow' });
    expect(next.population.eq(6)).toBe(true);
    expect(next.resources.food.exponent).toBe(400);
  });
  it('scales the next population cost from 10 Food', () => {
    expect(populationCost(initial()).eq(10)).toBe(true);
    expect(populationCost(developed(2)).toNumber()).toBeCloseTo(11.2);
  });
});

describe('shared conditions', () => {
  const cases: [Condition, boolean][] = [
    [{ type: 'always' }, true],
    [{ type: 'never' }, false],
    [{ type: 'resourceAtLeast', resource: 'food', value: 500 }, true],
    [{ type: 'resourceAtLeast', resource: 'unknown', value: 1 }, false],
    [{ type: 'populationAtLeast', value: 6 }, false],
    [{ type: 'technologyOwned', technologyId: 'foraging' }, true],
    [{ type: 'achievementOwned', achievementId: 'firstSteps' }, true],
    [{ type: 'eraReached', eraId: 'tribal' }, true],
    [{ type: 'featureUnlocked', featureId: 'research' }, true],
    [{ type: 'statAtLeast', stat: 'maxPopulation', value: 5 }, true],
    [
      { type: 'all', conditions: [{ type: 'always' }, { type: 'never' }] },
      false,
    ],
    [
      { type: 'any', conditions: [{ type: 'always' }, { type: 'never' }] },
      true,
    ],
    [{ type: 'not', condition: { type: 'never' } }, true],
  ];
  it.each(cases)('evaluates $type', (condition, expected) => {
    const s = developed();
    s.researchedTechnologies = ['foraging'];
    expect(evaluateCondition(condition, s)).toBe(expected);
  });
});

describe('technology, effects, achievements, and eras', () => {
  it('enforces prerequisites and charges once', () => {
    const s = developed();
    expect(buy(s, 'toolMaking')).toBe(s);
    expect(
      technologyStatus(
        s,
        technologies.find((t) => t.id === 'toolMaking')!,
      ),
    ).toBe('revealed');
    const first = buy(s, 'foraging'),
      tools = buy(first, 'toolMaking');
    expect(tools.researchedTechnologies).toEqual(['foraging', 'toolMaking']);
    expect(tools.resources.materials.eq(990)).toBe(true);
    expect(buy(tools, 'toolMaking')).toBe(tools);
    expect(technologyStatus(tools, technologies[0])).toBe('researched');
  });
  it('multiplicatively combines technology and skill bonuses without changing base data', () => {
    let s = applyAction(developed(), {
      type: 'recruit',
      unitId: 'woodcutter',
      amount: 1,
    });
    s = buy(buy(s, 'foraging'), 'toolMaking');
    s.purchasedSkills.efficientHands = 1;
    expect(productionPerSecond(s).materials.toNumber()).toBeCloseTo(
      0.5 * 1.25 * 1.1,
    );
    const effects = [
      { type: 'productionMultiplier' as const, resource: 'food', value: 2 },
      { type: 'resourceMultiplier' as const, resource: 'food', value: 3 },
      { type: 'populationCostMultiplier' as const, value: 0.9 },
    ];
    expect(productionModifier(effects, 'food').eq(2)).toBe(true);
    expect(resourceMultiplier(effects, 'food').eq(3)).toBe(true);
    expect(populationModifier(effects).eq(0.9)).toBe(true);
    expect(activeEffects(s).length).toBeGreaterThan(2);
  });
  it('accepts a data-only technology with flat, job, resource, unlock and one-shot effects', () => {
    technologies.push({
      id: 'testEffects',
      name: 'Test',
      description: '',
      era: 'tribal',
      cost: [],
      prerequisites: [],
      visibilityCondition: { type: 'always' },
      unlockCondition: { type: 'always' },
      effectText: '',
      effects: [
        { type: 'productionFlatBonus', resource: 'materials', value: 0.4 },
        {
          type: 'jobProductionMultiplier',
          job: 'woodcutter',
          resource: 'materials',
          value: 2,
        },
        { type: 'productionMultiplier', resource: 'materials', value: 2 },
        { type: 'resourceMultiplier', resource: 'materials', value: 3 },
        { type: 'unlockFeature', id: 'economy' },
        { type: 'grantResource', resource: 'civilizationPoints', value: 2 },
      ],
    });
    try {
      let s = applyAction(developed(), {
        type: 'recruit',
        unitId: 'woodcutter',
        amount: 1,
      });
      s = buy(s, 'testEffects');
      expect(productionPerSecond(s).materials.toNumber()).toBeCloseTo(8.4);
      expect(isFeatureUnlocked(s, 'economy')).toBe(true);
      expect(s.resources.civilizationPoints.eq(2)).toBe(true);
      s = simulate(s, 20);
      expect(s.resources.civilizationPoints.eq(2)).toBe(true);
    } finally {
      technologies.pop();
    }
  });
  it('awards production achievements once, during the simulation', () => {
    let s = developed();
    s.resources.research = D();
    s = applyAction(s, { type: 'recruit', unitId: 'thinker', amount: 1 });
    s = simulate(s, 70);
    expect(s.achievements).toContain('curious');
    const count = s.eventLog.filter((e) =>
      e.message.includes('Curious Minds'),
    ).length;
    s = simulate(s, 70);
    expect(
      s.eventLog.filter((e) => e.message.includes('Curious Minds')).length,
    ).toBe(count);
  });
  it('unlocks Farmer, advances with no reset, grants one point, and spends it on one skill', () => {
    let s = developed(19);
    for (const id of ['language', 'knowledgeSharing', 'agriculture'])
      s = buy(s, id);
    expect(applyAction(s, { type: 'advance', id: 'agricultural' })).toBe(s);
    s = applyAction(s, { type: 'recruit', unitId: 'gatherer', amount: 5 });
    s = applyAction(s, { type: 'upgrade', unitId: 'farmer', amount: 1 });
    expect(productionPerSecond(s).food.gt(0.85)).toBe(true);
    s = applyAction(s, { type: 'grow' });
    const resourcesBefore = s.resources.food;
    s = applyAction(s, { type: 'advance', id: 'agricultural' });
    expect(s.currentEra).toBe('agricultural');
    expect(s.population.eq(20)).toBe(true);
    expect(s.resources.food.eq(resourcesBefore)).toBe(true);
    expect(s.resources.civilizationPoints.eq(1)).toBe(true);
    expect(s.achievements).toContain('settled');
    expect(isFeatureUnlocked(s, 'skillTree')).toBe(true);
    expect(applyAction(s, { type: 'advance', id: 'agricultural' })).toBe(s);
    const cost = populationCost(s);
    s = applyAction(s, { type: 'skill', id: 'growingTribe' });
    expect(populationCost(s).toNumber()).toBeCloseTo(cost.mul(0.9).toNumber());
    expect(s.resources.civilizationPoints.eq(0)).toBe(true);
    expect(applyAction(s, { type: 'skill', id: 'efficientHands' })).toBe(s);
  });
  it('keeps at most 100 events and internal stats', () => {
    let s = developed(100);
    s.populationCapacityBonus=D(1000);
    for (let i = 0; i < 150; i++) {
      s.resources.food = D('1e100');
      s = applyAction(s, { type: 'grow' });
      logEvent(s, `Test milestone ${i}`, 'milestone', false);
    }
    expect(s.eventLog.length).toBe(balance.eventLimit);
    expect(s.statistics.maxPopulation.eq(250)).toBe(true);
  });
  it('supports skill prerequisites, growing costs, multiple levels and symmetric exclusion', () => {
    skills.push({
      id: 'testSkill',
      name: 'Test',
      branch: 'Industry',
      description: '',
      cost: 1,
      costGrowth: 2,
      maxLevel: 3,
      prerequisites: [{ id: 'efficientHands', level: 1 }],
      exclusiveWith: ['oralTradition'],
      effects: [
        { type: 'productionMultiplier', resource: 'materials', value: 1.2 },
      ],
    });
    try {
      let s = developed();
      s.unlockedFeatures.push('skillTree');
      s.resources.civilizationPoints = D(10);
      expect(applyAction(s, { type: 'skill', id: 'testSkill' })).toBe(s);
      s = applyAction(s, { type: 'skill', id: 'efficientHands' });
      for (let i = 0; i < 3; i++)
        s = applyAction(s, { type: 'skill', id: 'testSkill' });
      expect(s.purchasedSkills.testSkill).toBe(3);
      expect(s.resources.civilizationPoints.eq(2)).toBe(true);
      expect(applyAction(s, { type: 'skill', id: 'testSkill' })).toBe(s);
      expect(applyAction(s, { type: 'skill', id: 'oralTradition' })).toBe(s);
      expect(
        productionModifier(activeEffects(s), 'materials').toNumber(),
      ).toBeCloseTo(1.1 * 1.2 ** 3);
    } finally {
      skills.pop();
    }
  });
});

describe('saves and offline production', () => {
  it('roundtrips Decimal values, units, events, and settings through JSON and Base64', () => {
    let s = applyAction(developed(), {
      type: 'recruit',
      unitId: 'thinker',
      amount: 1,
    });
    s = buy(s, 'foraging');
    s.resources.food = D('1e400');
    s.settings.notifications = false;
    const restored = importSave(exportSave(s));
    expect(restored.resources.food.eq(s.resources.food)).toBe(true);
    expect(restored.population.eq(s.population)).toBe(true);
    expect(restored.productionUnits.thinker.eq(1)).toBe(true);
    expect(restored.researchedTechnologies).toEqual(s.researchedTechnologies);
    expect(restored.settings.notifications).toBe(false);
    expect(restored.eventLog).toEqual(s.eventLog);
    expect(
      deserializeSave(JSON.parse(serializeSave(s))).resources.food,
    ).toBeInstanceOf(D(0).constructor);
  });
  it.each(['', 'broken', '{}', 'eyJzYXZlVmVyc2lvbiI6OTk5fQ=='])(
    'rejects invalid input safely: %s',
    (text) => {
      expect(() => importSave(text)).toThrow();
    },
  );
  it('rejects negative, non-finite amounts and impossible worker allocations', () => {
    const raw = JSON.parse(serializeSave(developed()));
    raw.resources.food = '-1';
    expect(() => deserializeSave(raw)).toThrow();
    raw.resources.food = 'NaN';
    expect(() => deserializeSave(raw)).toThrow();
    raw.resources.food = '100';
    raw.productionUnits.gatherer = '6';
    expect(() => deserializeSave(raw)).toThrow();
  });
  it('refuses saves missing required initial features or era history', () => {
    const raw = JSON.parse(serializeSave(initial()));
    raw.unlockedFeatures = [];
    expect(() => deserializeSave(raw)).toThrow('initial gathering');
    raw.unlockedFeatures = ['manualGathering'];
    raw.reachedEras = ['agricultural'];
    raw.currentEra = 'agricultural';
    expect(() => deserializeSave(raw)).toThrow('era history');
  });
  it('rejects owned units that have not been discovered', () => {
    const raw = JSON.parse(serializeSave(initial()));
    raw.population = '5';
    raw.productionUnits.farmer = '1';
    expect(() => deserializeSave(raw)).toThrow('undiscovered unit');
  });
  it('migrates version zero before validation and refuses future versions', () => {
    const raw = JSON.parse(serializeSave(initial()));
    raw.saveVersion = 0;
    raw.jobAssignments = {
      gatherer: '0',
      woodcutter: '0',
      thinker: '0',
      farmer: '0',
    };
    delete raw.productionUnits;
    delete raw.settings;
    delete raw.reachedEras;
    delete raw.announcedEras;
    expect(migrateSave(raw).saveVersion).toBe(4);
    expect(deserializeSave(raw).settings.notifications).toBe(true);
    expect(() => migrateSave({ saveVersion: 5 })).toThrow('Unsupported');
  });
  it('uses the same simulation offline, including achievements and their changing bonuses', () => {
    const s = applyAction(developed(), {
      type: 'recruit',
      unitId: 'thinker',
      amount: 1,
    });
    const { state, report } = applyOfflineProgress(s, 181_000),
      live = simulate(s, 180, 181_000);
    expect(state.resources.research.eq(live.resources.research)).toBe(true);
    expect(report?.produced.research.toNumber()).toBeGreaterThan(27);
    expect(state.achievements).toContain('curious');
  });
  it('caps offline progress at 8 hours and resets the clock to avoid a second award', () => {
    const s = applyAction(developed(2), {
      type: 'recruit',
      unitId: 'gatherer',
      amount: 1,
    });
    const now = s.lastSimulationTime + 24 * 3600 * 1000,
      { state, report } = applyOfflineProgress(s, now);
    expect(report?.simulatedSeconds).toBe(28800);
    expect(report?.produced.food.toNumber()).toBeCloseTo(0.51 * 28800);
    expect(
      applyOfflineProgress(state, now).state.resources.food.eq(
        state.resources.food,
      ),
    ).toBe(true);
  });
  it('ignores clock rollback', () => {
    const s = developed();
    expect(
      applyOfflineProgress(s, 0).state.resources.food.eq(s.resources.food),
    ).toBe(true);
  });
  it('recovers a corrupt save without destroying the original backup', () => {
    const storage = new Map<string, string>([[SAVE_KEY, 'corrupt']]);
    const result = loadGame({
      getItem: (id) => storage.get(id) ?? null,
      setItem: (id, value) => {
        storage.set(id, value);
      },
    });
    expect(result.error).toContain('recovery');
    expect(storage.get(`${SAVE_KEY}.recovery`)).toBe('corrupt');
  });
  it('reports storage denial', () => {
    expect(
      loadGame({
        getItem: () => {
          throw new Error('denied');
        },
        setItem: () => {},
      }).error,
    ).toContain('unavailable');
  });
  it('recovers when merely accessing localStorage throws a security exception', () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      'localStorage',
    );
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError');
      },
    });
    try {
      const result = loadGame();
      expect(result.error).toContain('unavailable');
      expect(result.state.population.eq(1)).toBe(true);
    } finally {
      if (descriptor)
        Object.defineProperty(globalThis, 'localStorage', descriptor);
      else Reflect.deleteProperty(globalThis, 'localStorage');
    }
  });
});

describe('number formatting', () => {
  it.each([
    ['0', '0'],
    ['1250', '1 250'],
    ['18400', '18.4k'],
    ['7210000', '7.21M'],
    ['3140000000', '3.14B'],
    ['8700000000000', '8.7T'],
    ['1e400', '1e400'],
  ])('formats %s as %s', (input, output) =>
    expect(formatNumber(input)).toBe(output),
  );
});

it('completes the opening-to-skills loop without resource cheats or hundreds of clicks', () => {
  let s = initial();
  for (let i = 0; i < 10; i++)
    s = applyAction(s, { type: 'gather', resource: 'food' });
  s = applyAction(s, { type: 'grow' });
  s = applyAction(s, { type: 'recruit', unitId: 'gatherer', amount: 2 });
  let elapsed = 0;
  while (s.currentEra !== 'agricultural' && elapsed < 1800) {
    s = simulate(s, 1);
    elapsed++;
    if (s.population.lt(20)) s = applyAction(s, { type: 'grow' });
    if (s.population.gte(5) && s.productionUnits.thinker.eq(0)) {
      if (idlePopulation(s).eq(0))
        s = applyAction(s, { type: 'release', unitId: 'gatherer', amount: 1 });
      s = applyAction(s, { type: 'recruit', unitId: 'thinker', amount: 1 });
    }
    if (s.population.gte(5) && s.productionUnits.woodcutter.eq(0)) {
      if (idlePopulation(s).eq(0))
        s = applyAction(s, { type: 'release', unitId: 'gatherer', amount: 1 });
      s = applyAction(s, { type: 'recruit', unitId: 'woodcutter', amount: 1 });
    }
    const unitId = 'gatherer';
    if (idlePopulation(s).gt(0))
      s = applyAction(s, {
        type: 'recruit',
        unitId,
        amount: idlePopulation(s),
      });
    if (s.researchedTechnologies.includes('agriculture'))
      s = applyAction(s, { type: 'upgrade', unitId: 'farmer', amount: 'max' });
    for (const id of [
      'language',
      'knowledgeSharing',
      'agriculture',
      'foraging',
      'toolMaking',
      'woodworking',
    ])
      s = buy(s, id);
    s = applyAction(s, { type: 'advance', id: 'agricultural' });
  }
  expect(s.currentEra).toBe('agricultural');
  expect(elapsed).toBeLessThanOrEqual(1800);
  expect(s.statistics.totalManualClicks.eq(10)).toBe(true);
  expect(s.achievements.length).toBe(5);
  s = applyAction(s, { type: 'skill', id: 'oralTradition' });
  expect(s.purchasedSkills.oralTradition).toBe(1);
  console.info(
    `Balanced progression: Agricultural Age after ${elapsed}s, with 10 manual clicks.`,
  );
});
