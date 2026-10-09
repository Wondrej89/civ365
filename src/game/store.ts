import { createInitialState, cloneState } from './state';
import { balance } from './content/config';
import { resources } from './content/resources';
import { technologies } from './content/technologies';
import { eras } from './content/eras';
import { idlePopulation } from './engine/population-accounting';
import { availableSlots } from './engine/settlements';
import { finishCampaign } from './engine/conquest';
import { applyAction, addProduction, simulate } from './engine/simulation';
import { settleProgression } from './systems/progression';
import { applyOfflineProgress, type OfflineReport } from './systems/offline';
import { importSave, loadGame, saveGame, exportSave } from './systems/save';
import { D } from './utils/numbers';
import type { GameAction } from './types';

const loaded = loadGame();
const offline = applyOfflineProgress(loaded.state);
let current = offline.state;
let savedAt = loaded.state.savedAt;
let saveError = loaded.error;
let report = offline.report;
let speed = 1;
let snapshot = { state: current, savedAt, saveError, report, speed };
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
let lastRender = 0,
  lastSave = Date.now();
function publish() {
  snapshot = { state: current, savedAt, saveError, report, speed };
  listeners.forEach((l) => l());
}
function sync() {
  const now = Date.now(),
    seconds = Math.max(0, (now - current.lastSimulationTime) / 1000);
  if (seconds > 30 && speed === 1) {
    const result = applyOfflineProgress(current, now);
    current = result.state;
    report = result.report;
  } else
    current = simulate(
      current,
      Math.min(seconds * speed, balance.maxOfflineSeconds),
      now,
    );
}
function save() {
  try {
    saveGame(current);
    savedAt = Date.now();
    current.savedAt = savedAt;
    saveError = null;
  } catch {
    saveError = 'Autosave failed. Export your save to keep your progress.';
  }
  lastSave = Date.now();
}
export const gameStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: () => snapshot,
  start() {
    if (timer) return () => {};
    const flush = () => {
      sync();
      save();
      publish();
    };
    const visibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    timer = setInterval(() => {
      sync();
      if (Date.now() - lastSave >= balance.autosaveMs) save();
      if (Date.now() - lastRender >= balance.renderMs) {
        lastRender = Date.now();
        publish();
      }
    }, balance.tickMs);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      clearInterval(timer);
      timer = undefined;
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', visibility);
    };
  },
  dispatch(action: GameAction) {
    sync();
    current = applyAction(current, action);
    publish();
  },
  save() {
    sync();
    save();
    publish();
  },
  export() {
    sync();
    return exportSave(current);
  },
  import(text: string) {
    const imported = importSave(text);
    const result = applyOfflineProgress(imported);
    // Persist before replacing a running game so an unavailable storage cannot silently lose it.
    saveGame(result.state);
    current = result.state;
    report = result.report;
    speed = 1;
    save();
    publish();
  },
  reset() {
    current = { ...createInitialState(), settings: { ...current.settings } };
    report = null;
    speed = 1;
    save();
    publish();
  },
  dismissOffline() {
    report = null;
    publish();
  },
  debug(
    action:
      | 'food'
      | 'materials'
      | 'research'
      | 'population'
      | 'speed'
      | 'technologies'
      | 'territory'
      | 'settlement'
      | 'capacity'
      | 'military'
      | 'campaign',
  ) {
    if (!import.meta.env.DEV) return;
    sync();
    current = cloneState(current);
    if (resources.some((r) => r.id === action))
      addProduction(current, action, D(100));
    if (action === 'population') {
      current.population = current.population.add(10);
      current.statistics.totalPopulationCreated =
        current.statistics.totalPopulationCreated.add(10);
    }
    if (action === 'territory')
      current.ownedTerritories.frontier =
        current.ownedTerritories.frontier.add(1);
    if (
      action === 'settlement' &&
      current.unlockedFeatures.includes('settlements') &&
      availableSlots(current).gte(1)
    ) {
      current.settlements.settlement = current.settlements.settlement.add(1);
      current.statistics.totalSettlementsBuilt =
        current.statistics.totalSettlementsBuilt.add(1);
    }
    if (action === 'capacity')
      current.populationCapacityBonus =
        current.populationCapacityBonus.add(100);
    if (
      action === 'military' &&
      !current.activeCampaign &&
      current.unlockedFeatures.includes('military')
    )
      current.militaryUnits.levy = current.militaryUnits.levy.add(
        idlePopulation(current).min(10).floor(),
      );
    if (action === 'campaign' && current.activeCampaign) {
      current.activeCampaign.elapsedSeconds =
        current.activeCampaign.durationSeconds;
      finishCampaign(current);
    }
    if (action === 'speed') {
      const speeds = [1, 10, 100, 1000];
      speed = speeds[(speeds.indexOf(speed) + 1) % speeds.length];
    }
    if (action === 'technologies') {
      const index = eras.findIndex((e) => e.id === current.currentEra);
      current.researchedTechnologies = technologies
        .filter((t) => eras.findIndex((e) => e.id === t.era) <= index)
        .map((t) => t.id);
    }
    settleProgression(current);
    publish();
  },
};
export type GameSnapshot = {
  state: typeof current;
  savedAt: number;
  saveError: string | null;
  report: OfflineReport | null;
  speed: number;
};
