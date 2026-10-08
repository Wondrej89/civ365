import Decimal from 'break_infinity.js';
import { createInitialState, statisticIds } from '../state';
import { balance } from '../content/config';
import { resources } from '../content/resources';
import { units } from '../content/units';
import { technologies } from '../content/technologies';
import { skills } from '../content/skills';
import { achievements } from '../content/achievements';
import { eras } from '../content/eras';
import { features } from '../content/features';
import { statisticSeries } from '../content/statistics';
import { growthInterval } from '../engine/population';
import { evaluateCondition } from '../engine/conditions';
import { isUnitUnlocked, representedPopulation } from '../engine/units';
import { sum } from '../utils/numbers';
import type { GameEvent, GameState } from '../types';

export const SAVE_KEY = 'civilization.xlsx.save';
const MAX_SAVE_LENGTH = 2_000_000;
type Obj = Record<string, unknown>;
function object(value: unknown): Obj {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected a save object.');
  return value as Obj;
}
function timestamp(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw new Error('Invalid save timestamp.');
  return value;
}
function decimal(value: unknown, integer = false): Decimal {
  if (
    typeof value !== 'string' ||
    value.length > 100 ||
    !/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value)
  )
    throw new Error('Invalid resource amount.');
  const n = new Decimal(value);
  if (
    !Number.isFinite(n.mantissa) ||
    !Number.isFinite(n.exponent) ||
    Math.abs(n.exponent) > 1e9 ||
    n.lt(0) ||
    (integer && !n.eq(n.floor()))
  )
    throw new Error('Resource amount is outside the supported range.');
  return n;
}
function ids(value: unknown, allowed: string[]): string[] {
  if (
    !Array.isArray(value) ||
    value.some((id) => typeof id !== 'string' || !allowed.includes(id)) ||
    new Set(value).size !== value.length
  )
    throw new Error('Unknown or duplicate content in save.');
  return value as string[];
}
/** Chain legacy versions before validating the current format. Never invent population. */
export function migrateSave(value: unknown): Obj {
  const save = { ...object(value) };
  if (save.saveVersion === 0) {
    save.saveVersion = 1;
    save.settings ??= { notifications: true };
    save.reachedEras ??=
      save.currentEra === 'agricultural'
        ? ['tribal', 'agricultural']
        : ['tribal'];
    save.announcedEras ??= [];
  }
  if (save.saveVersion === 1) {
    const assignments = object(save.jobAssignments);
    const legacyIds = units.flatMap((u) => u.legacyJobs ?? []);
    for (const [id, value] of Object.entries(assignments)) {
      if (!legacyIds.includes(id)) throw new Error('Unknown legacy job.');
      decimal(value, true);
    }
    if (
      sum(Object.values(assignments).map((value) => decimal(value, true))).gt(
        decimal(save.population, true),
      )
    )
      throw new Error('Assigned workers exceed population.');
    // An old Farmer represented one person, so it becomes one Gatherer, not a five-person Farmer.
    save.productionUnits = Object.fromEntries(
      units.map((u) => [
        u.id,
        sum(
          (u.legacyJobs ?? []).map((id) =>
            decimal(assignments[id] ?? '0', true),
          ),
        ).toString(),
      ]),
    );
    if (decimal(assignments.farmer ?? '0', true).gt(0)) {
      if (
        !Array.isArray(save.researchedTechnologies) ||
        !save.researchedTechnologies.includes('agriculture')
      )
        throw new Error('Legacy Farmers require Agriculture.');
      if (
        !Array.isArray(save.eventLog) ||
        save.eventLog.length > balance.eventLimit
      )
        throw new Error('Invalid event log.');
      const id = timestamp(save.nextEventId);
      save.eventLog = [
        ...save.eventLog,
        {
          id,
          time: timestamp(save.savedAt),
          message:
            'Workforce updated: previous Farmers are now Gatherers, preserving every person. Upgrade 5 Gatherers into a Farmer in Workforce.',
          kind: 'system',
          notify: true,
        },
      ].slice(-balance.eventLimit);
      save.nextEventId = id + 1;
    }
    delete save.jobAssignments;
    save.saveVersion = 2;
  }
  if (save.saveVersion === 2) {
    const counts = { ...object(save.productionUnits) };
    if (counts.scientist !== undefined) {
      counts.academy = decimal(counts.scientist, true)
        .add(decimal(counts.academy ?? '0', true))
        .toString();
      delete counts.scientist;
    }
    save.productionUnits = counts;
    const known = Array.isArray(save.researchedTechnologies)
      ? save.researchedTechnologies
      : [];
    save.unlockedProductionUnits = [
      ...(known.includes('woodworking') ? ['miner'] : []),
      ...(known.includes('knowledgeSharing') ? ['scholar'] : []),
    ];
    save.constructedProductionUnits = units
      .filter((u) => decimal(counts[u.id] ?? '0', true).gt(0))
      .map((u) => u.id);
    save.autoPopulationGrowth = {
      enabled: false,
      accumulator: 0,
      foodReservePercent: balance.automaticGrowth.defaultReservePercent,
    };
    save.statisticsHistory = {};
    save.statisticsSamplingAccumulator = 0;
    const stats = { ...object(save.statistics) };
    stats.totalPopulationCreated = decimal(
      stats.maxPopulation ?? save.population,
      true,
    )
      .max(decimal(save.population, true))
      .toString();
    stats.foodSpentOnGrowth = '0';
    save.statistics = stats;
    save.saveVersion = 3;
  }
  if (save.saveVersion !== balance.saveVersion)
    throw new Error(
      'Unsupported save version. Use a save from this version of Civilization.xlsx.',
    );
  return save;
}
export function deserializeSave(value: unknown): GameState {
  const raw = migrateSave(value),
    state = createInitialState(timestamp(raw.createdAt));
  state.savedAt = timestamp(raw.savedAt);
  state.lastSimulationTime = timestamp(raw.lastSimulationTime);
  state.population = decimal(raw.population, true);
  if (state.population.lt(1))
    throw new Error('A civilization needs at least one person.');
  const rawResources = object(raw.resources),
    rawUnits = object(raw.productionUnits),
    rawStats = object(raw.statistics);
  for (const r of resources)
    state.resources[r.id] = decimal(rawResources[r.id] ?? '0');
  if (Object.keys(rawUnits).some((id) => !units.some((u) => u.id === id)))
    throw new Error('Unknown production unit.');
  for (const unit of units)
    state.productionUnits[unit.id] = decimal(rawUnits[unit.id] ?? '0', true);
  state.unlockedProductionUnits = ids(
    raw.unlockedProductionUnits,
    units.map((u) => u.id),
  );
  state.constructedProductionUnits = ids(
    raw.constructedProductionUnits,
    units.map((u) => u.id),
  );
  if (representedPopulation(state).gt(state.population))
    throw new Error('Production units exceed population.');
  for (const id of new Set([
    ...statisticIds,
    ...resources.map(
      (r) => `total${r.id[0].toUpperCase()}${r.id.slice(1)}Produced`,
    ),
  ]))
    state.statistics[id] = decimal(rawStats[id] ?? '0');
  state.researchedTechnologies = ids(
    raw.researchedTechnologies,
    technologies.map((t) => t.id),
  );
  for (const tech of technologies.filter((t) =>
    state.researchedTechnologies.includes(t.id),
  ))
    if (
      !tech.prerequisites.every((id) =>
        state.researchedTechnologies.includes(id),
      )
    )
      throw new Error('Missing technology prerequisites.');
  const rawSkills = object(raw.purchasedSkills);
  for (const [id, value] of Object.entries(rawSkills)) {
    const skill = skills.find((s) => s.id === id);
    if (
      !skill ||
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      value < 0 ||
      value > skill.maxLevel
    )
      throw new Error('Invalid skill level.');
    state.purchasedSkills[id] = value;
  }
  for (const skill of skills.filter(
    (s) => (state.purchasedSkills[s.id] ?? 0) > 0,
  )) {
    if (
      !skill.prerequisites.every(
        (p) => (state.purchasedSkills[p.id] ?? 0) >= p.level,
      ) ||
      skill.exclusiveWith.some((id) => (state.purchasedSkills[id] ?? 0) > 0)
    )
      throw new Error('Conflicting skill prerequisites.');
  }
  state.achievements = ids(
    raw.achievements,
    achievements.map((a) => a.id),
  );
  state.unlockedFeatures = ids(
    raw.unlockedFeatures,
    features.map((f) => f.id),
  );
  if (!state.unlockedFeatures.includes('manualGathering'))
    throw new Error('Missing the initial gathering feature.');
  state.reachedEras = ids(
    raw.reachedEras,
    eras.map((e) => e.id),
  );
  state.announcedEras = ids(
    raw.announcedEras ?? [],
    eras.map((e) => e.id),
  );
  if (
    typeof raw.currentEra !== 'string' ||
    !state.reachedEras.includes(raw.currentEra) ||
    !eras.some((e) => e.id === raw.currentEra)
  )
    throw new Error('Invalid current era.');
  state.currentEra = raw.currentEra;
  if (
    state.reachedEras.some(
      (id, index) =>
        index > 0 &&
        eras.find((e) => e.id === id)?.previous !==
          state.reachedEras[index - 1],
    )
  )
    throw new Error('Invalid era sequence.');
  if (
    !state.reachedEras.includes('tribal') ||
    state.reachedEras.at(-1) !== state.currentEra
  )
    throw new Error('Invalid era history.');
  const settings = object(raw.settings);
  if (typeof settings.notifications !== 'boolean')
    throw new Error('Invalid settings.');
  state.settings = { notifications: settings.notifications };
  const automatic = object(raw.autoPopulationGrowth);
  if (
    typeof automatic.enabled !== 'boolean' ||
    typeof automatic.accumulator !== 'number' ||
    !Number.isFinite(automatic.accumulator) ||
    automatic.accumulator < 0 ||
    automatic.accumulator > growthInterval(state) ||
    typeof automatic.foodReservePercent !== 'number' ||
    !balance.automaticGrowth.reserveOptions.includes(
      automatic.foodReservePercent,
    )
  )
    throw new Error('Invalid automatic growth settings.');
  if (
    automatic.enabled &&
    !state.unlockedFeatures.includes('autoPopulationGrowth')
  )
    throw new Error('Automatic growth has not been discovered.');
  state.autoPopulationGrowth = {
    enabled: automatic.enabled,
    accumulator: automatic.accumulator,
    foodReservePercent: automatic.foodReservePercent,
  };
  if (
    typeof raw.statisticsSamplingAccumulator !== 'number' ||
    !Number.isFinite(raw.statisticsSamplingAccumulator) ||
    raw.statisticsSamplingAccumulator < 0 ||
    raw.statisticsSamplingAccumulator > balance.statistics.sampleIntervalSeconds
  )
    throw new Error('Invalid statistics sampling interval.');
  state.statisticsSamplingAccumulator = raw.statisticsSamplingAccumulator;
  const histories = object(raw.statisticsHistory);
  if (
    Object.keys(histories).some(
      (id) => !statisticSeries.some((s) => s.id === id),
    )
  )
    throw new Error('Unknown statistic series.');
  for (const [id, history] of Object.entries(histories)) {
    if (
      !Array.isArray(history) ||
      history.length > balance.statistics.maxSamples
    )
      throw new Error('Invalid statistics history size.');
    if (
      history.length &&
      !evaluateCondition(
        statisticSeries.find((s) => s.id === id)!.unlockCondition,
        state,
      )
    )
      throw new Error('Statistics series has not been discovered.');
    let previous = -1;
    state.statisticsHistory[id] = history.map((entry) => {
      const sample = object(entry),
        time = timestamp(sample.timestamp);
      if (
        time <= previous ||
        time > state.statistics.totalPlayTime.toNumber() + 1e-7
      )
        throw new Error('Invalid statistics sample time.');
      previous = time;
      return { timestamp: time, value: decimal(sample.value).toString() };
    });
  }
  if (!Array.isArray(raw.eventLog) || raw.eventLog.length > balance.eventLimit)
    throw new Error('Invalid event log.');
  state.eventLog = raw.eventLog.map((value) => {
    const e = object(value);
    if (
      typeof e.message !== 'string' ||
      e.message.length > 1000 ||
      typeof e.notify !== 'boolean' ||
      !['milestone', 'research', 'achievement', 'era', 'system'].includes(
        String(e.kind),
      )
    )
      throw new Error('Invalid event.');
    return {
      id: timestamp(e.id),
      time: timestamp(e.time),
      message: e.message,
      kind: e.kind as GameEvent['kind'],
      notify: e.notify,
    };
  });
  state.nextEventId = timestamp(raw.nextEventId);
  if (state.eventLog.some((e) => e.id >= state.nextEventId))
    throw new Error('Invalid event sequence.');
  if (
    units.some(
      (unit) =>
        state.productionUnits[unit.id].gt(0) && !isUnitUnlocked(state, unit),
    )
  )
    throw new Error('Save contains an undiscovered unit.');
  state.statistics.assignedWorkers = representedPopulation(state);
  return state;
}
export function serializeSave(state: GameState, now = Date.now()): string {
  const decimals = (values: Record<string, Decimal>) =>
    Object.fromEntries(
      Object.entries(values).map(([id, n]) => [id, n.toString()]),
    );
  return JSON.stringify({
    ...state,
    savedAt: now,
    population: state.population.toString(),
    resources: decimals(state.resources),
    productionUnits: decimals(state.productionUnits),
    statistics: decimals(state.statistics),
  });
}
export function exportSave(state: GameState): string {
  return btoa(
    Array.from(new TextEncoder().encode(serializeSave(state)), (byte) =>
      String.fromCharCode(byte),
    ).join(''),
  );
}
export function importSave(text: string): GameState {
  if (!text.trim() || text.length > MAX_SAVE_LENGTH)
    throw new Error('Save is empty or too large.');
  try {
    const trimmed = text.trim();
    const json = trimmed.startsWith('{')
      ? trimmed
      : new TextDecoder('utf-8', { fatal: true }).decode(
          Uint8Array.from(atob(trimmed), (c) => c.charCodeAt(0)),
        );
    return deserializeSave(JSON.parse(json));
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Could not import save: ${error.message}`
        : 'Could not import save.',
    );
  }
}
export function saveGame(
  state: GameState,
  storage: Pick<Storage, 'setItem'> = localStorage,
  now = Date.now(),
) {
  storage.setItem(SAVE_KEY, serializeSave(state, now));
}
export function loadGame(storage?: Pick<Storage, 'getItem' | 'setItem'>): {
  state: GameState;
  error: string | null;
} {
  try {
    // Accessing the browser property itself can throw in privacy-restricted contexts.
    const target = storage ?? localStorage;
    const text = target.getItem(SAVE_KEY);
    if (!text) return { state: createInitialState(), error: null };
    try {
      return { state: importSave(text), error: null };
    } catch (error) {
      target.setItem(`${SAVE_KEY}.recovery`, text);
      return {
        state: createInitialState(),
        error: `${error instanceof Error ? error.message : 'Invalid save.'} A recovery copy was kept in browser storage.`,
      };
    }
  } catch {
    return {
      state: createInitialState(),
      error:
        'Browser storage is unavailable. Export your save to keep your progress.',
    };
  }
}
