import { describe, expect, it } from 'vitest';
import { createInitialState } from '../state';
import { D } from '../utils/numbers';
import { technologies } from '../content/technologies';
import { eras } from '../content/eras';
import { applyAction, simulate } from '../engine/simulation';
import { settleProgression } from '../systems/progression';
import {
  serializeSave,
  deserializeSave,
  importSave,
  exportSave,
} from '../systems/save';
import { applyOfflineProgress } from '../systems/offline';
import {
  currentDiscoveries,
  newDiscoverySheets,
  acknowledgeSheet,
  acknowledgeDiscovery,
  seedDiscoveries,
  discoveryIds,
} from '../systems/discoveries';
function realm(era = 'agricultural') {
  const s = createInitialState(1000),
    index = eras.findIndex((e) => e.id === era);
  s.currentEra = era;
  s.reachedEras = eras.slice(0, index + 1).map((e) => e.id);
  s.researchedTechnologies = technologies
    .filter((t) => s.reachedEras.includes(t.era))
    .map((t) => t.id);
  s.population = D(50);
  s.statistics.totalPopulationCreated = D(50);
  s.statistics.totalFoodProduced = D(1000);
  for (const id of ['food', 'materials', 'research'])
    s.resources[id] = D('1e10');
  settleProgression(s);
  return s;
}
describe('persistent new discoveries', () => {
  it('marks newly revealed resource rows and controls on already visited sheets', () => {
    const s = createInitialState(1000);
    s.population = D(4);
    s.statistics.totalPopulationCreated = D(4);
    s.statistics.totalFoodProduced = D(10);
    s.resources.food = D(1000);
    settleProgression(s);
    s.discoveryProgress = seedDiscoveries(s);
    const next = applyAction(s, { type: 'grow' });
    expect(
      currentDiscoveries(next).find(
        (i) => i.id === 'population:allocation-group:research',
      )?.mode,
    ).toBe('passive');
    expect(newDiscoverySheets(next).has('population')).toBe(true);
    expect(next.discoveryProgress.acknowledgedItems).not.toContain(
      'population:allocation-group:research',
    );
    expect(
      currentDiscoveries(next).find((i) => i.id === 'overview:ledger:research')
        ?.mode,
    ).toBe('passive');
    expect(
      currentDiscoveries(s).find((i) => i.id === 'overview:gather:materials')
        ?.mode,
    ).toBe('interactive');
  });
  it('keeps the initial overview quiet, highlights each unlocked sheet and ignores hidden sheets', () => {
    const s = createInitialState(1000);
    expect([...newDiscoverySheets(s)]).toEqual([]);
    const opened = realm();
    for (const id of [
      'population',
      'workforce',
      'research',
      'skills',
      'achievements',
      'settlements',
      'military',
      'territory',
      'statistics',
    ])
      expect([...newDiscoverySheets(opened)]).toContain(id);
    expect(newDiscoverySheets(s).has('military')).toBe(false);
  });
  it('opening a tab clears its notice without acknowledging its new elements', () => {
    const s = realm();
    const next = acknowledgeSheet(s, 'population');
    expect(newDiscoverySheets(next).has('population')).toBe(false);
    expect(next.discoveryProgress.openedSheets).toContain('population');
    expect(next.discoveryProgress.acknowledgedItems).not.toContain(
      'population:automation',
    );
    expect(s.discoveryProgress.openedSheets).not.toContain('population');
    expect(acknowledgeSheet(next, 'population')).toBe(next);
    expect(acknowledgeSheet(s, 'unknown')).toBe(s);
    expect(
      acknowledgeSheet(createInitialState(1000), 'military').discoveryProgress
        .openedSheets,
    ).not.toContain('military');
  });
  it('a newly researched production tier re-highlights a visited sheet and is interactive', () => {
    const s = realm();
    s.researchedTechnologies = s.researchedTechnologies.filter(
      (id) => !['mining'].includes(id),
    );
    s.unlockedProductionUnits = s.unlockedProductionUnits.filter(
      (id) => id !== 'miner',
    );
    s.discoveryProgress = seedDiscoveries(s);
    expect(newDiscoverySheets(s).has('workforce')).toBe(false);
    const next = applyAction(s, { type: 'research', id: 'mining' });
    const item = currentDiscoveries(next).find(
      (i) => i.id === 'workforce:unit:miner:available',
    );
    expect(item?.mode).toBe('interactive');
    expect(newDiscoverySheets(next).has('workforce')).toBe(true);
    const visited = acknowledgeSheet(next, 'workforce');
    expect(visited.discoveryProgress.acknowledgedItems).not.toContain(item!.id);
    const acknowledged = acknowledgeDiscovery(visited, item!.id);
    expect(acknowledged.discoveryProgress.acknowledgedItems).toContain(
      item!.id,
    );
    expect(acknowledgeDiscovery(acknowledged, item!.id)).toBe(acknowledged);
  });
  it('reading a locked preview does not dismiss the actionable discovery when it unlocks', () => {
    let s = realm();
    s.researchedTechnologies = s.researchedTechnologies.filter(
      (id) => !['mining', 'stoneworking'].includes(id),
    );
    s.unlockedProductionUnits = s.unlockedProductionUnits.filter(
      (id) => id !== 'miner',
    );
    s = acknowledgeSheet(s, 'research');
    const preview = 'research:technology:mining:preview';
    expect(currentDiscoveries(s).find((i) => i.id === preview)?.mode).toBe(
      'passive',
    );
    s = acknowledgeDiscovery(s, preview);
    const next = applyAction(s, { type: 'research', id: 'stoneworking' });
    expect(
      currentDiscoveries(next).find(
        (i) => i.id === 'research:technology:mining:available',
      )?.mode,
    ).toBe('interactive');
    expect(next.discoveryProgress.acknowledgedItems).not.toContain(
      'research:technology:mining:available',
    );
    expect(newDiscoverySheets(next).has('research')).toBe(true);
  });
  it('equipment previews become fresh interactive content after research', () => {
    const s = realm('bronze');
    s.researchedTechnologies = s.researchedTechnologies.filter(
      (id) =>
        !['bronzeWorking', 'archery', 'horsemanship', 'construction'].includes(
          id,
        ),
    );
    s.militaryTiers.infantry = 0;
    s.discoveryProgress = seedDiscoveries(s);
    expect(newDiscoverySheets(s).has('military')).toBe(false);
    const next = applyAction(s, { type: 'research', id: 'bronzeWorking' });
    expect(
      currentDiscoveries(next).find(
        (i) => i.id === 'military:equipment:infantry:1:available',
      )?.mode,
    ).toBe('interactive');
    expect(newDiscoverySheets(next).has('military')).toBe(true);
  });
  it('exposes new passive growth modifiers and charts without re-notifying for changing numerical values', () => {
    const s = realm('classical');
    s.researchedTechnologies = s.researchedTechnologies.filter(
      (id) => !['publicHealth', 'aqueducts'].includes(id),
    );
    s.discoveryProgress = seedDiscoveries(s);
    const next = applyAction(s, { type: 'research', id: 'publicHealth' });
    expect(newDiscoverySheets(next).has('population')).toBe(true);
    expect(
      currentDiscoveries(next).find(
        (i) =>
          i.id ===
          'population:growth:publicHealth:populationGrowthIntervalMultiplier',
      )?.mode,
    ).toBe('passive');
    const baseline = realm();
    baseline.discoveryProgress = seedDiscoveries(baseline);
    const changed = simulate(baseline, 30);
    expect([...newDiscoverySheets(changed)]).toEqual([]);
    expect(currentDiscoveries(changed).map((i) => i.id)).toEqual(
      currentDiscoveries(baseline).map((i) => i.id),
    );
  });
  it('recognizes earned achievements as new passive content even when their in-progress row was read', () => {
    const s = realm();
    s.achievements = s.achievements.filter((id) => id !== 'curious');
    s.statistics.totalResearchProduced = D();
    s.discoveryProgress = seedDiscoveries(s);
    expect(newDiscoverySheets(s).has('achievements')).toBe(false);
    s.statistics.totalResearchProduced = D(10);
    settleProgression(s);
    expect(newDiscoverySheets(s).has('achievements')).toBe(true);
    expect(
      currentDiscoveries(s).find(
        (i) => i.id === 'achievements:achievement:curious:earned',
      )?.mode,
    ).toBe('passive');
  });
  it('revealing enemy composition creates passive discoveries on Territory', () => {
    const s = realm('medieval');
    s.researchedTechnologies = s.researchedTechnologies.filter(
      (id) => id !== 'espionage',
    );
    s.unlockedFeatures = s.unlockedFeatures.filter(
      (id) => id !== 'intelligence',
    );
    s.discoveryProgress = seedDiscoveries(s);
    const next = applyAction(s, { type: 'research', id: 'espionage' });
    expect(newDiscoverySheets(next).has('territory')).toBe(true);
    for (const id of ['food', 'materials', 'research'])
      expect(
        currentDiscoveries(next).find(
          (i) => i.id === `territory:composition:${id}`,
        )?.mode,
      ).toBe('passive');
  });
  it('acknowledgements preserve the economy, army, simulation time and event history', () => {
    const s = realm(),
      opened = acknowledgeSheet(s, 'population');
    const next = acknowledgeDiscovery(opened, 'population:automation');
    for (const field of [
      'population',
      'resources',
      'productionUnits',
      'militaryUnits',
      'activeCampaign',
      'statistics',
      'eventLog',
      'lastSimulationTime',
    ] as const)
      expect(next[field]).toEqual(s[field]);
    expect(acknowledgeDiscovery(s, 'unknown:content')).toBe(s);
  });
  it('roundtrips independent tab and item state, including previously seen revisions', () => {
    let s = realm();
    s = acknowledgeSheet(s, 'research');
    s = acknowledgeDiscovery(s, 'research:technology:mining:available');
    const loaded = importSave(exportSave(s));
    expect(loaded.discoveryProgress).toEqual(s.discoveryProgress);
    expect(newDiscoverySheets(loaded)).toEqual(newDiscoverySheets(s));
    expect(loaded.discoveryProgress.acknowledgedItems).not.toContain(
      'population:automation',
    );
  });
  it('seeds existing content for a legacy v7 save without losing gameplay or language', () => {
    const s = realm('medieval'),
      raw = JSON.parse(serializeSave(s, 1000));
    raw.saveVersion = 7;
    delete raw.discoveryProgress;
    raw.settings.language = 'cs';
    const original = JSON.stringify(raw),
      next = deserializeSave(raw);
    expect(next.saveVersion).toBe(8);
    expect([...newDiscoverySheets(next)]).toEqual([]);
    expect(next.discoveryProgress.acknowledgedItems).toEqual(
      currentDiscoveries(next).map((i) => i.id),
    );
    expect(next.population).toEqual(s.population);
    expect(next.resources).toEqual(s.resources);
    expect(next.settings.language).toBe('cs');
    expect(JSON.stringify(raw)).toBe(original);
  });
  it('offline discoveries stay unread until a player actually sees them', () => {
    const s = realm();
    s.statistics.totalResearchProduced = D();
    s.achievements = s.achievements.filter((id) => id !== 'curious');
    s.productionUnits.thinker = D(10);
    s.discoveryProgress = seedDiscoveries(s);
    const result = applyOfflineProgress(s, 31000).state;
    expect(result.achievements).toContain('curious');
    expect(result.discoveryProgress).toEqual(s.discoveryProgress);
    expect(newDiscoverySheets(result).has('achievements')).toBe(true);
  });
  it('validates discovered IDs and rejects invalid acknowledgement relationships', () => {
    for (const item of currentDiscoveries(realm('industrial')))
      expect(discoveryIds().has(item.id), item.id).toBe(true);
    const raw = JSON.parse(serializeSave(realm()));
    raw.discoveryProgress.acknowledgedItems = ['unknown:content'];
    expect(() => deserializeSave(raw)).toThrow();
    raw.discoveryProgress.acknowledgedItems = ['population:automation'];
    expect(() => deserializeSave(raw)).toThrow(
      'Invalid discovery acknowledgements',
    );
    raw.discoveryProgress = null;
    expect(() => deserializeSave(raw)).toThrow();
  });
});
