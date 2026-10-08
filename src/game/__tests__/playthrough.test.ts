import { expect, it } from 'vitest';
import { createInitialState } from '../state';
import { applyAction, simulate } from '../engine/simulation';
import { nextPlaythroughAction } from './helpers/playthrough';
import { ownedTerritories, populationCapacity } from '../engine/settlements';
import { militaryPower } from '../engine/military';
import { idlePopulation } from '../engine/population-accounting';
import { deserializeSave, serializeSave } from '../systems/save';

it('reaches Renaissance from a new save through settlements and conquest without grants or time gates', () => {
  let state = createInitialState(1000);
  for (let i = 0; i < 10; i++)
    state = applyAction(state, { type: 'gather', resource: 'food' });
  const milestones: Record<string, number> = {};
  for (
    let time = 0;
    time <= 48 * 3600 && state.currentEra !== 'renaissance';
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
  console.log('Realm progression seconds:', milestones);
  expect(state.currentEra).toBe('renaissance');
  expect(milestones.bronze).toBeGreaterThan(1200);
  expect(milestones.classical).toBeGreaterThan(3600);
  expect(milestones.medieval).toBeGreaterThan(7200);
  expect(state.statistics.totalManualClicks.eq(10)).toBe(true);
  expect(state.statistics.territoriesConquered.gte(9)).toBe(true);
  expect(state.statistics.militaryCasualties.gt(0)).toBe(true);
  expect(state.population.lte(populationCapacity(state))).toBe(true);
  expect(idlePopulation(state).gte(0)).toBe(true);
  expect(() => deserializeSave(JSON.parse(serializeSave(state)))).not.toThrow();
}, 120000);
