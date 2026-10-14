import { expect, it } from 'vitest';
import { technologies } from '../content/technologies';
import {
  technologyStatus,
  technologyCost,
  canAfford,
} from '../systems/progression';
import { createInitialState } from '../state';
import { applyAction, simulate } from '../engine/simulation';
import { nextPlaythroughAction } from './helpers/playthrough';
import { ownedTerritories, populationCapacity } from '../engine/settlements';
import { militaryPower } from '../engine/military';
import { idlePopulation } from '../engine/population-accounting';
import { D } from '../utils/numbers';
import { deserializeSave, serializeSave } from '../systems/save';

it('reaches Atomic from a new save through settlements and conquest without grants or time gates', () => {
  let state = createInitialState(1000);
  for (let i = 0; i < 10; i++)
    state = applyAction(state, { type: 'gather', resource: 'food' });
  const milestones: Record<string, number> = {};
  const entryBursts: Record<string, { bought: number; total: number }> = {};
  for (
    let time = 0;
    time <= 48 * 3600 && state.currentEra !== 'atomic';
    time += 30
  ) {
    for (let i = 0; i < 1000; i++) {
      const action = nextPlaythroughAction(state);
      if (!action) break;
      const next = applyAction(state, action);
      if (next === state)
        throw Error(
          `Player policy proposed an invalid action: ${JSON.stringify(action)}`,
        );
      if (next.currentEra !== state.currentEra) {
        milestones[next.currentEra] = time;
        // Try the cheapest available research first, without advancing time or
        // injecting resources. This protects against stockpiles clearing a new age.
        const eraTechs = technologies.filter((t) => t.era === next.currentEra);
        let shopper = next,
          bought = 0;
        for (let pass = 0; pass < eraTechs.length; pass++) {
          const cheapest = eraTechs
            .filter(
              (t) =>
                technologyStatus(shopper, t) === 'available' &&
                canAfford(shopper, technologyCost(shopper, t)),
            )
            .sort((a, b) =>
              D(technologyCost(shopper, a)[0].amount).cmp(
                technologyCost(shopper, b)[0].amount,
              ),
            )[0];
          if (!cheapest) break;
          shopper = applyAction(shopper, { type: 'research', id: cheapest.id });
          bought++;
        }
        entryBursts[next.currentEra] = { bought, total: eraTechs.length };
        console.log(
          'Research at era entry',
          next.currentEra,
          bought,
          '/',
          eraTechs.length,
        );
        expect(
          bought,
          `Stockpile instantly cleared ${next.currentEra}`,
        ).toBeLessThan(eraTechs.length);

        console.log(
          'Realm milestone',
          next.currentEra,
          time,
          'seconds',
          next.population.toString(),
          ownedTerritories(next).toString(),
          'territories',
        );
      }
      state = next;
      if (i === 999) throw Error('Player policy cycled without time advancing');
    }
    state = simulate(state, 30);
    if (time % 3600 === 0)
      console.log(
        'Balance hour',
        time / 3600,
        state.currentEra,
        'population',
        state.population.toString(),
        'capacity',
        populationCapacity(state).toString(),
        'territories',
        ownedTerritories(state).toString(),
        'power',
        militaryPower(state).toString(),
        'research',
        state.resources.research.toString(),
        'techs',
        state.researchedTechnologies.length,
      );
  }
  console.log(
    'Realm progression seconds:',
    milestones,
    'research entry bursts:',
    entryBursts,
  );
  expect(state.currentEra).toBe('atomic');
  expect(milestones.modern).toBeGreaterThan(milestones.industrial);
  expect(milestones.atomic).toBeGreaterThan(milestones.modern);
  expect(milestones.bronze).toBeGreaterThan(1200);
  expect(milestones.classical).toBeGreaterThan(3600);
  expect(milestones.medieval).toBeGreaterThan(7200);
  expect(state.statistics.totalManualClicks.eq(10)).toBe(true);
  expect(state.statistics.territoriesConquered.gte(23)).toBe(true);
  expect(state.statistics.militaryCasualties.gt(0)).toBe(true);
  expect(state.population.lte(populationCapacity(state))).toBe(true);
  expect(idlePopulation(state).gte(0)).toBe(true);
  expect(() => deserializeSave(JSON.parse(serializeSave(state)))).not.toThrow();
}, 120000);
