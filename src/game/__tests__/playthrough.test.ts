import { expect, it } from 'vitest';
import { createInitialState } from '../state';
import { applyAction, simulate } from '../engine/simulation';
import { populationDistribution } from '../systems/statistics';
import { canAdvance, technologyStatus } from '../systems/progression';
import { idlePopulation, isUnitUnlocked, maxCreatable } from '../engine/units';
import { technologies } from '../content/technologies';
import { eras } from '../content/eras';
import { units } from '../content/units';
import { D } from '../utils/numbers';

it('reaches Classical Age from ten opening clicks without free resources, unlocks, or population', () => {
  let state = createInitialState(1000);
  for (let i = 0; i < 10; i++)
    state = applyAction(state, { type: 'gather', resource: 'food' });
  state = applyAction(state, { type: 'grow' });
  state = applyAction(state, {
    type: 'recruit',
    unitId: 'gatherer',
    amount: 'max',
  });
  const milestones: Record<string, number> = {};
  for (
    let time = 5;
    time <= 10800 && state.currentEra !== 'classical';
    time += 5
  ) {
    state = simulate(state, 5);
    if (state.unlockedFeatures.includes('autoPopulationGrowth')) {
      if (!state.autoPopulationGrowth.enabled)
        state = applyAction(state, { type: 'autoGrowth', enabled: true });
    } else state = applyAction(state, { type: 'grow' });
    const population = state.population.toNumber();
    if (population >= 5) {
      for (const [resource, id] of [
        ['research', 'thinker'],
        ['materials', 'woodcutter'],
      ]) {
        const allocation = populationDistribution(state).find(
          (g) => g.id === resource,
        )!.value;
        if (allocation.eq(0) && idlePopulation(state).eq(0))
          state = applyAction(state, {
            type: 'release',
            unitId: 'gatherer',
            amount: 1,
          });
        if (allocation.eq(0))
          state = applyAction(state, {
            type: 'recruit',
            unitId: id,
            amount: 1,
          });
      }
    }
    for (const [resource, id, share] of [
      ['research', 'thinker', 0.3],
      ['materials', 'woodcutter', 0.25],
      ['food', 'gatherer', 0.45],
    ] as const) {
      const current = populationDistribution(state).find(
        (g) => g.id === resource,
      )!.value;
      const wanted = D(Math.floor(population * share))
        .sub(current)
        .max(0)
        .min(idlePopulation(state));
      if (wanted.gt(0))
        state = applyAction(state, {
          type: 'recruit',
          unitId: id,
          amount: wanted,
        });
    }
    if (idlePopulation(state).gt(0))
      state = applyAction(state, {
        type: 'recruit',
        unitId: 'gatherer',
        amount: 'max',
      });
    for (const technology of technologies)
      if (technologyStatus(state, technology) === 'available')
        state = applyAction(state, { type: 'research', id: technology.id });
    for (const unit of units.filter((u) => u.upgradeFrom))
      if (isUnitUnlocked(state, unit) && maxCreatable(state, unit).gt(0))
        state = applyAction(state, {
          type: 'upgrade',
          unitId: unit.id,
          amount: 'max',
        });
    for (const era of eras)
      if (canAdvance(state, era)) {
        state = applyAction(state, { type: 'advance', id: era.id });
        milestones[era.id] = time;
      }
  }
  console.log('Expanded progression (simulated seconds):', milestones);
  expect(state.currentEra).toBe('classical');
  expect(state.statistics.totalManualClicks.eq(10)).toBe(true);
  expect(state.unlockedFeatures).toEqual(
    expect.arrayContaining([
      'autoPopulationGrowth',
      'statistics',
      'populationDistribution',
    ]),
  );
  expect(state.researchedTechnologies).toEqual(
    expect.arrayContaining(['mining', 'writing', 'formalEducation']),
  );
  expect(state.statisticsHistory.population.length).toBeGreaterThan(10);
  expect(state.resources.food.gte(0)).toBe(true);
  expect(state.resources.materials.gte(0)).toBe(true);
}, 20000);
