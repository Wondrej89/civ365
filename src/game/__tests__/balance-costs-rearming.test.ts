import { describe, expect, it } from 'vitest';
import { createInitialState } from '../state';
import { D } from '../utils/numbers';
import { balance } from '../content/config';
import { technologies } from '../content/technologies';
import { militaryUnits } from '../content/military';
import {
  technologyCost,
  technologyCostMultiplier,
  technologyStatus,
} from '../systems/progression';
import { applyAction, simulate } from '../engine/simulation';
import { populationCost } from '../engine/production';
import {
  militaryPower,
  militaryUpgradePreview,
  militaryUpgradeQuote,
} from '../engine/military';
import {
  idlePopulation,
  militaryPopulation,
} from '../engine/population-accounting';
import { growthCost, populationGrowthAmount } from '../engine/population';
import { populationCapacity } from '../engine/settlements';
import { netProductionPerSecond } from '../engine/economy';
import { deserializeSave, serializeSave } from '../systems/save';
import { applyOfflineProgress } from '../systems/offline';
import {
  currentDiscoveries,
  newDiscoverySheets,
  seedDiscoveries,
} from '../systems/discoveries';
import { reportedAtomicState } from './helpers/reported-atomic';

describe('progressive technology prices', () => {
  it('announces the pricing and rearming explanations for old saves, without treating changing numbers as new items', () => {
    const state = reportedAtomicState();
    state.militaryTiers.infantry = 4;
    state.discoveryProgress = seedDiscoveries(state);
    const newIds = ['research:pricing', 'military:rearming:infantry'];
    state.discoveryProgress.noticedItems =
      state.discoveryProgress.noticedItems.filter((id) => !newIds.includes(id));
    state.discoveryProgress.acknowledgedItems =
      state.discoveryProgress.acknowledgedItems.filter(
        (id) => !newIds.includes(id),
      );
    const loaded = deserializeSave(JSON.parse(serializeSave(state)));
    expect(newDiscoverySheets(loaded).has('research')).toBe(true);
    expect(newDiscoverySheets(loaded).has('military')).toBe(true);
    for (const id of newIds)
      expect(currentDiscoveries(loaded).find((i) => i.id === id)?.mode).toBe(
        'passive',
      );
    loaded.discoveryProgress = seedDiscoveries(loaded);
    loaded.resources.research = loaded.resources.research.add('1e10');
    loaded.militaryUnits.infantry = D(100);
    expect(newDiscoverySheets(loaded).has('research')).toBe(false);
    expect(newDiscoverySheets(loaded).has('military')).toBe(false);
  });
  it('charges the displayed dynamic quote and raises all subsequent prices once per completed technology', () => {
    const state = reportedAtomicState();
    for (const id of ['food', 'materials', 'research'])
      state.resources[id] = D('1e15');
    const tech = technologies.find((t) => t.id === 'electronics')!;
    const before = technologyCost(state, tech),
      original = JSON.stringify(tech.cost),
      count = state.researchedTechnologies.length;
    expect(technologyCostMultiplier(state, 'research').toNumber()).toBeCloseTo(
      balance.technologyPurchaseGrowth.research ** count,
    );
    const next = applyAction(state, { type: 'research', id: tech.id });
    expect(next.researchedTechnologies.length).toBe(count + 1);
    for (const cost of before)
      expect(
        next.resources[cost.resource].eq(
          state.resources[cost.resource].sub(cost.amount),
        ),
      ).toBe(true);
    const later = technologyCost(
      next,
      technologies.find((t) => t.id === 'antibiotics')!,
    );
    const earlier = technologyCost(
      state,
      technologies.find((t) => t.id === 'antibiotics')!,
    );
    for (let i = 0; i < later.length; i++)
      expect(D(later[i].amount).div(earlier[i].amount).toNumber()).toBeCloseTo(
        balance.technologyPurchaseGrowth[later[i].resource],
      );
    expect(applyAction(next, { type: 'research', id: tech.id })).toBe(next);
    expect(JSON.stringify(tech.cost)).toBe(original);
    expect(state.researchedTechnologies.length).toBe(count);
  });
  it('blocks a purchase affordable at the old static price and does not raise prices for failed actions, skills or era changes', () => {
    const state = reportedAtomicState(),
      tech = technologies.find((t) => t.id === 'electronics')!;
    state.resources.research = D(tech.cost[0].amount);
    const quote = technologyCost(state, tech);
    expect(technologyStatus(state, tech)).toBe('available');
    expect(applyAction(state, { type: 'research', id: tech.id })).toBe(state);
    const skill = applyAction(state, { type: 'skill', id: 'growingTribe' });
    expect(technologyCost(skill, tech)).toEqual(quote);
    state.statistics.technologiesResearched = D(999999);
    expect(technologyCost(state, tech)).toEqual(quote); // derive from owned IDs, including old saves
    state.currentEra = 'modern';
    expect(technologyCost(state, tech)).toEqual(quote);
  });
  it('starts at content cost with no purchases, preserves free/generic costs and serializes the scaling without a new counter', () => {
    const state = createInitialState(1000),
      base = technologies[0];
    expect(
      D(technologyCost(state, base)[0].amount).eq(base.cost[0].amount),
    ).toBe(true);
    const generic = {
      ...base,
      cost: [
        { resource: 'civilizationPoints', amount: 2 },
        { resource: 'research', amount: 0 },
      ],
    };
    const old = reportedAtomicState();
    expect(
      technologyCost(old, generic).map((c) => D(c.amount).toNumber()),
    ).toEqual([2, 0]);
    const loaded = deserializeSave(JSON.parse(serializeSave(old)));
    expect(technologyCost(loaded, base)).toEqual(technologyCost(old, base));
    expect(loaded.saveVersion).toBe(9);
  });
  it('does not let the reported Atomic stockpile buy all entry discoveries immediately', () => {
    const state = reportedAtomicState();
    const available = technologies.filter(
      (t) => t.era === 'atomic' && technologyStatus(state, t) === 'available',
    );
    expect(available).toHaveLength(3);
    expect(
      available.every((t) =>
        D(technologyCost(state, t)[0].amount).gt(state.resources.research),
      ),
    ).toBe(true);
  });
});

describe('population price beyond 2000', () => {
  it('preserves the entire previous early curve and switches continuously to an unbounded polynomial', () => {
    const state = createInitialState(1000),
      c = balance.populationGrowth;
    for (const p of [1, 2, 19, 20, 21, 399, 400, 401, 1000, 1999, 2000]) {
      const legacy =
        10 *
        1.12 ** Math.min(Math.max(p - 1, 0), 19) *
        1.008 ** Math.min(Math.max(p - 20, 0), 380) *
        1.001 ** Math.max(p - 400, 0);
      expect(populationCost(state, D(p)).toNumber()).toBeCloseTo(legacy, 5);
    }
    const boundary = populationCost(state, D(c.softScalingBreakpoint));
    expect(populationCost(state, D(2001)).div(boundary).toNumber()).toBeCloseTo(
      (1 + 1 / c.softScalingPopulation) ** c.softScalingPower,
    );
    const a = populationCost(state, D(20000)),
      b = populationCost(state, D(40000)),
      huge = populationCost(state, D('1e400'));
    expect(b.gt(a)).toBe(true);
    expect(b.div(a).lt(5)).toBe(true);
    expect(Number.isFinite(huge.mantissa)).toBe(true);
    expect(huge.gt(b)).toBe(true);
  });
  it('makes a ~20k Atomic growth group affordable from normal production without multiplying its price by people', () => {
    const state = reportedAtomicState(),
      cost = growthCost(state),
      rate = netProductionPerSecond(state).food;
    expect(cost.lt(200000)).toBe(true);
    expect(cost.div(rate).lt(10)).toBe(true);
    const amount = populationGrowthAmount(state),
      next = applyAction(state, { type: 'grow' });
    expect(next.population.eq(state.population.add(amount))).toBe(true);
    expect(next.resources.food.eq(state.resources.food.sub(cost))).toBe(true);
    expect(next.statistics.foodSpentOnGrowth.eq(cost)).toBe(true);
  });
  it('recovers the old 20k save through automatic and offline growth while preserving its people, army and discoveries', () => {
    const original = reportedAtomicState(),
      raw = JSON.parse(serializeSave(original, 1000)),
      text = JSON.stringify(raw);
    const loaded = deserializeSave(raw);
    expect(loaded.population.eq(20000)).toBe(true);
    expect(loaded.militaryUnits).toEqual(original.militaryUnits);
    expect(loaded.researchedTechnologies).toEqual(
      original.researchedTechnologies,
    );
    let state = applyAction(loaded, { type: 'autoGrowth', enabled: true });
    const live = simulate(state, 600, state.lastSimulationTime + 600000),
      offline = applyOfflineProgress(
        state,
        state.lastSimulationTime + 600000,
      ).state;
    expect(live.population.gte(30000)).toBe(true);
    expect(live.population.lte(populationCapacity(live))).toBe(true);
    expect(live.population.eq(offline.population)).toBe(true);
    expect(
      live.statistics.foodSpentOnGrowth.eq(
        offline.statistics.foodSpentOnGrowth,
      ),
    ).toBe(true);
    expect(live.resources.food.toNumber()).toBeCloseTo(
      offline.resources.food.toNumber(),
      3,
    );
    state = deserializeSave(JSON.parse(serializeSave(live)));
    expect(state.population.eq(live.population)).toBe(true);
    expect(JSON.stringify(raw)).toBe(text);
  });
});

describe('rearming opportunity cost', () => {
  function unarmedRole(count = 10) {
    const state = reportedAtomicState();
    state.militaryTiers.infantry = 4;
    state.militaryUnits.infantry = D(count);
    state.militaryUnits.cavalry = D();
    state.militaryUnits.ranged = D();
    return state;
  }
  it('doubles per-soldier power while returning half the army to Idle Population; re-recruitment is paid', () => {
    const state = unarmedRole(),
      preview = militaryUpgradePreview(state, militaryUnits[0])!,
      quote = militaryUpgradeQuote(state, militaryUnits[0]);
    const idle = idlePopulation(state),
      next = applyAction(state, { type: 'upgradeMilitary', id: 'infantry' });
    expect(next.militaryTiers.infantry).toBe(5);
    expect(next.militaryUnits.infantry.eq(5)).toBe(true);
    expect(next.population.eq(state.population)).toBe(true);
    expect(idlePopulation(next).eq(idle.add(5))).toBe(true);
    expect(militaryPopulation(next).eq(5)).toBe(true);
    expect(militaryPower(next).toNumber()).toBeCloseTo(
      militaryPower(state).toNumber(),
    );
    expect(preview.afterPower.eq(militaryPower(next))).toBe(true);
    for (const c of quote)
      expect(
        next.resources[c.resource].eq(
          state.resources[c.resource].sub(c.amount),
        ),
      ).toBe(true);
    const recruited = applyAction(next, {
      type: 'recruitMilitary',
      id: 'infantry',
      amount: 5,
    });
    expect(recruited.militaryUnits.infantry.eq(10)).toBe(true);
    expect(recruited.resources.food.lt(next.resources.food)).toBe(true);
    expect(recruited.resources.materials.lt(next.resources.materials)).toBe(
      true,
    );
    expect(militaryPower(recruited).toNumber()).toBeCloseTo(
      militaryPower(state).mul(2).toNumber(),
    );
    expect(
      recruited.statistics.militaryCasualties.eq(
        state.statistics.militaryCasualties,
      ),
    ).toBe(true);
    expect(state.militaryUnits.infantry.eq(10)).toBe(true);
  });
  it.each([
    [9, 4],
    [1, 0],
    [0, 0],
  ])(
    'rounds the withdrawn portion up for %s soldiers, leaving %s',
    (count, retained) => {
      const state = unarmedRole(count),
        next = applyAction(state, { type: 'upgradeMilitary', id: 'infantry' });
      expect(next.militaryUnits.infantry.eq(retained)).toBe(true);
      expect(
        idlePopulation(next).eq(idlePopulation(state).add(count - retained)),
      ).toBe(true);
      expect(next.population.eq(state.population)).toBe(true);
      expect(
        militaryUpgradeQuote(state, militaryUnits[0]).every((c) =>
          D(c.amount).gt(0),
        ),
      ).toBe(true);
      expect(next.militaryReadiness).toBe(1);
    },
  );
  it('does not withdraw troops when resources or research are missing, or during a committed campaign', () => {
    const state = unarmedRole();
    state.resources.materials = D();
    expect(
      applyAction(state, { type: 'upgradeMilitary', id: 'infantry' }),
    ).toBe(state);
    state.resources.materials = D('1e10');
    state.researchedTechnologies = state.researchedTechnologies.filter(
      (id) => id !== 'rifling',
    );
    expect(
      applyAction(state, { type: 'upgradeMilitary', id: 'infantry' }),
    ).toBe(state);
    state.researchedTechnologies.push('rifling');
    const army = reportedAtomicState();
    const campaign = applyAction(army, { type: 'launchCampaign' });
    campaign.militaryTiers.infantry = 4;
    expect(campaign.activeCampaign).not.toBeNull();
    expect(
      applyAction(campaign, { type: 'upgradeMilitary', id: 'infantry' }),
    ).toBe(campaign);
  });
  it('honors a generic multi-person footprint and persists the reduced counts without a second withdrawal', () => {
    const unit = militaryUnits[0],
      state = unarmedRole(10);
    unit.populationCost = 2;
    try {
      const idle = idlePopulation(state),
        next = applyAction(state, { type: 'upgradeMilitary', id: unit.id });
      expect(idlePopulation(next).eq(idle.add(10))).toBe(true);
      const loaded = deserializeSave(JSON.parse(serializeSave(next)));
      expect(loaded.militaryUnits.infantry.eq(5)).toBe(true);
      expect(loaded.population.eq(state.population)).toBe(true);
      expect(simulate(loaded, 10).militaryUnits.infantry.eq(5)).toBe(true);
    } finally {
      unit.populationCost = 1;
    }
  });
});
