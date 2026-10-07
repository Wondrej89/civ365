import Decimal from 'break_infinity.js';
import { createInitialState, statisticIds } from '../state';
import { balance } from '../content/config';
import { resources } from '../content/resources';
import { jobs } from '../content/jobs';
import { technologies } from '../content/technologies';
import { skills } from '../content/skills';
import { achievements } from '../content/achievements';
import { eras } from '../content/eras';
import { features } from '../content/features';
import { isJobUnlocked } from '../engine/production';
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
/** Version-zero prototype migration; future migrations can be chained here before validation. */
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
    rawJobs = object(raw.jobAssignments),
    rawStats = object(raw.statistics);
  for (const r of resources)
    state.resources[r.id] = decimal(rawResources[r.id] ?? '0');
  for (const j of jobs)
    state.jobAssignments[j.id] = decimal(rawJobs[j.id] ?? '0', true);
  if (sum(Object.values(state.jobAssignments)).gt(state.population))
    throw new Error('Assigned workers exceed population.');
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
    !state.reachedEras.includes('tribal') ||
    state.reachedEras.at(-1) !== state.currentEra
  )
    throw new Error('Invalid era history.');
  const settings = object(raw.settings);
  if (typeof settings.notifications !== 'boolean')
    throw new Error('Invalid settings.');
  state.settings = { notifications: settings.notifications };
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
    jobs.some(
      (job) => state.jobAssignments[job.id].gt(0) && !isJobUnlocked(state, job),
    )
  )
    throw new Error('Workers assigned to an undiscovered job.');
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
    jobAssignments: decimals(state.jobAssignments),
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
