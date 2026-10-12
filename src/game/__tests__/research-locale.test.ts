import { describe, expect, it } from 'vitest';
import { technologies, prerequisitesAddedInV7 } from '../content/technologies';
import { eras } from '../content/eras';
import { createInitialState } from '../state';
import { D } from '../utils/numbers';
import { applyAction } from '../engine/simulation';
import { settleProgression, technologyStatus } from '../systems/progression';
import {
  nextUnresearchedTechnology,
  technologyTree,
  treeDimensions,
} from '../systems/technology-tree';
import {
  deserializeSave,
  serializeSave,
  exportSave,
  importSave,
} from '../systems/save';
import {
  translate,
  translateMessage,
  message,
  translateError,
  translateLegacyEvent,
} from '../../i18n/core';
import { formatNumber } from '../utils/numbers';
import cs from '../../i18n/locales/cs.json';
import { growthInterval, populationGrowthAmount } from '../engine/population';
function researched(era = 'classical') {
  const s = createInitialState(1000),
    index = eras.findIndex((e) => e.id === era);
  s.currentEra = era;
  s.reachedEras = eras.slice(0, index + 1).map((e) => e.id);
  s.researchedTechnologies = technologies
    .filter((t) => eras.findIndex((e) => e.id === t.era) <= index)
    .map((t) => t.id);
  s.population = D(50);
  s.statistics.totalFoodProduced = D(1000);
  for (const id of ['food', 'materials', 'research'])
    s.resources[id] = D('1e10');
  settleProgression(s);
  return s;
}
describe('research dependencies and navigation', () => {
  it('gives consecutive cards in each era branch distinct benefits, rather than repeating the same multiplier', () => {
    const groups = new Map<string, typeof technologies>();
    for (const tech of technologies) {
      const key = `${tech.era}:${tech.treePosition!.x}`;
      groups.set(key, [...(groups.get(key) ?? []), tech]);
    }
    const benefits = (tech: (typeof technologies)[number]) =>
      tech.effects
        .map((effect) => JSON.stringify({ ...effect, value: undefined }))
        .sort();
    for (const group of groups.values()) {
      group.sort((a, b) => a.treePosition!.y - b.treePosition!.y);
      for (let i = 1; i < group.length; i++) {
        // Empty effect lists can unlock content through generic conditions.
        if (!group[i].effects.length || !group[i - 1].effects.length) continue;
        expect(
          benefits(group[i]),
          `${group[i - 1].id} → ${group[i].id}`,
        ).not.toEqual(benefits(group[i - 1]));
      }
    }
  });
  it('separates Classical growth amount from growth interval while retaining the completed-era throughput', () => {
    const state = researched();
    state.researchedTechnologies = state.researchedTechnologies.filter(
      (id) => !['urbanCommunities', 'publicHealth', 'aqueducts'].includes(id),
    );
    expect(populationGrowthAmount(state).eq(1)).toBe(true);
    expect(growthInterval(state)).toBeCloseTo(7);
    const communities = applyAction(state, {
      type: 'research',
      id: 'urbanCommunities',
    });
    expect(populationGrowthAmount(communities).eq(4)).toBe(true);
    expect(growthInterval(communities)).toBeCloseTo(7);
    const baths = applyAction(communities, {
      type: 'research',
      id: 'publicHealth',
    });
    expect(populationGrowthAmount(baths).eq(4)).toBe(true);
    expect(growthInterval(baths)).toBeCloseTo(2);
  });
  it('has valid, acyclic prerequisites, unique positions and no dependencies from future eras', () => {
    const visited = new Set<string>(),
      active = new Set<string>(),
      positions = new Set<string>();
    function visit(id: string) {
      expect(active.has(id), `technology cycle at ${id}`).toBe(false);
      if (visited.has(id)) return;
      const t = technologies.find((t) => t.id === id);
      expect(t, `unknown technology ${id}`).toBeDefined();
      active.add(id);
      for (const parent of t!.prerequisites) {
        const p = technologies.find((t) => t.id === parent);
        expect(p, `unknown prerequisite ${parent}`).toBeDefined();
        expect(eras.findIndex((e) => e.id === p!.era)).toBeLessThanOrEqual(
          eras.findIndex((e) => e.id === t!.era),
        );
        visit(parent);
      }
      active.delete(id);
      visited.add(id);
    }
    for (const t of technologies) {
      visit(t.id);
      const position = `${t.era}:${t.treePosition?.x}:${t.treePosition?.y}`;
      expect(positions.has(position), `overlapping node ${position}`).toBe(
        false,
      );
      positions.add(position);
    }
  });
  it('rejects a purchase with any individual prerequisite missing, including Classical Army after entering Classical', () => {
    for (const t of technologies)
      for (const missing of t.prerequisites) {
        const s = researched(t.era);
        s.researchedTechnologies = s.researchedTechnologies.filter(
          (id) => id !== t.id && id !== missing,
        );
        expect(technologyStatus(s, t), `${t.id} without ${missing}`).not.toBe(
          'available',
        );
        expect(applyAction(s, { type: 'research', id: t.id })).toBe(s);
      }
    expect(
      technologies.find((t) => t.id === 'classicalArmy')!.prerequisites,
    ).toEqual(
      expect.arrayContaining(['organizedWarfare', 'archery', 'engineering']),
    );
  });
  it('lays out complete dependency layers and gives every vertical successor a real path from the node above', () => {
    const tree = technologyTree(researched('industrial'));
    const ancestors = (id: string): string[] =>
      technologies
        .find((t) => t.id === id)!
        .prerequisites.flatMap((parent) => [parent, ...ancestors(parent)]);
    for (const node of tree.nodes) {
      if (node.technology.branch === 'military')
        expect(node.technology.treePosition!.x).toBe(4);
      const parents = node.technology.prerequisites.map((id) =>
        tree.nodes.find((n) => n.technology.id === id)!,
      );
      expect(node.technology.treePosition!.y).toBe(
        Math.max(
          0,
          ...parents
            .filter((p) => p.technology.era === node.technology.era)
            .map((p) => p.technology.treePosition!.y + 1),
        ),
      );
      for (const parent of parents)
        expect(
          parent.y + treeDimensions.nodeHeight,
          `${parent.technology.id} must be above ${node.technology.id}`,
        ).toBeLessThan(node.y);
      const above = tree.nodes
        .filter(
          (n) =>
            n.technology.era === node.technology.era &&
            n.x === node.x &&
            n.y < node.y,
        )
        .sort((a, b) => b.y - a.y)[0];
      if (above)
        expect(
          ancestors(node.technology.id),
          `${node.technology.id} bypasses the preceding step in its column`,
        ).toContain(above.technology.id);
    }
    for (const [id, additions] of Object.entries(prerequisitesAddedInV7))
      expect(technologies.find((t) => t.id === id)!.prerequisites).toEqual(
        expect.arrayContaining(additions),
      );
  });
  it('places warfare beside Village Organization immediately after Settled Life and before automatic growth', () => {
    const s = researched('agricultural');
    s.researchedTechnologies = s.researchedTechnologies.filter(
      (id) =>
        technologies.find((t) => t.id === id)!.era !== 'agricultural' ||
        id === 'settledLife',
    );
    const tree = technologyTree(s);
    const warfare = tree.nodes.find(
      (n) => n.technology.id === 'organizedWarfare',
    )!;
    const village = tree.nodes.find(
      (n) => n.technology.id === 'villageOrganization',
    )!;
    expect(warfare.status).toBe('available');
    expect(warfare.y).toBe(village.y);
    expect(warfare.x).toBeGreaterThan(village.x);
    expect(warfare.technology.treePosition!.y).toBe(1);
    expect(warfare.technology.treePosition!.y).toBeLessThan(
      technologies.find((t) => t.id === 'naturalGrowth')!.treePosition!.y,
    );
    expect(
      applyAction(s, { type: 'research', id: 'organizedWarfare' })
        .researchedTechnologies,
    ).toContain('organizedWarfare');
  });
  it('blocks the later steps of every era until their actual preceding discoveries are complete', () => {
    for (const t of technologies) {
      if (t.treePosition!.y === 0) continue;
      const s = researched(t.era);
      s.researchedTechnologies = s.researchedTechnologies.filter(
        (id) => technologies.find((p) => p.id === id)!.era !== t.era,
      );
      expect(technologyStatus(s, t), t.id).not.toBe('available');
      expect(applyAction(s, { type: 'research', id: t.id }), t.id).toBe(s);
    }
    const s = researched();
    s.researchedTechnologies = s.researchedTechnologies.filter(
      (id) => !['aqueducts', 'publicHealth'].includes(id),
    );
    const aqueducts = technologies.find((t) => t.id === 'aqueducts')!;
    expect(technologyStatus(s, aqueducts)).toBe('revealed');
    expect(applyAction(s, { type: 'research', id: aqueducts.id })).toBe(s);
    expect(
      applyAction(applyAction(s, { type: 'research', id: 'publicHealth' }), {
        type: 'research',
        id: aqueducts.id,
      }).researchedTechnologies,
    ).toContain('aqueducts');
  });
  it('opens affordable warfare after Settled Life without Division of Labor or automatic-growth prerequisites', () => {
    const s = researched('agricultural');
    s.researchedTechnologies = s.researchedTechnologies.filter(
      (id) =>
        ![
          'organizedWarfare',
          'organizedSettlements',
          'divisionOfLabor',
          'naturalGrowth',
        ].includes(id),
    );
    const warfare = technologies.find((t) => t.id === 'organizedWarfare')!,
      organized = technologies.find((t) => t.id === 'organizedSettlements')!;
    expect(warfare.treePosition!.y).toBeLessThan(organized.treePosition!.y);
    expect(
      warfare.cost.find((c) => c.resource === 'research')!.amount,
    ).toBeLessThan(
      organized.cost.find((c) => c.resource === 'research')!.amount as number,
    );
    const next = applyAction(s, { type: 'research', id: warfare.id });
    expect(next.researchedTechnologies).toContain(warfare.id);
    expect(next.unlockedFeatures).toEqual(
      expect.arrayContaining(['military', 'territory']),
    );
    expect(technologyStatus(s, organized)).not.toBe('available');
  });
  it('cycles only visible unresearched nodes and starts with available discoveries', () => {
    const s = createInitialState(1000);
    expect(nextUnresearchedTechnology(s)).toBeNull();
    s.population = D(5);
    settleProgression(s);
    const first = nextUnresearchedTechnology(s)!;
    expect(first.status).toBe('available');
    const second = nextUnresearchedTechnology(s, first.technology.id)!;
    expect(second.technology.id).not.toBe(first.technology.id);
    const nodes = technologyTree(s).nodes.filter(
      (n) => n.status !== 'researched',
    );
    let current = first;
    const seen = new Set<string>();
    for (let i = 0; i < nodes.length; i++) {
      seen.add(current.technology.id);
      current = nextUnresearchedTechnology(s, current.technology.id)!;
    }
    expect(seen.size).toBe(nodes.length);
    expect(current.technology.id).toBe(first.technology.id);
    s.researchedTechnologies.push(first.technology.id);
    expect(
      nextUnresearchedTechnology(s, first.technology.id)!.technology.id,
    ).not.toBe(first.technology.id);
    expect(nextUnresearchedTechnology(researched('industrial'))).toBeNull();
  });
});
describe('saved locale and legacy discoveries', () => {
  it('loads genuine v8 growth acknowledgement IDs after effect and name changes without losing progress', () => {
    const state = researched('medieval');
    state.autoPopulationGrowth.accumulator = 1.75;
    const raw = JSON.parse(serializeSave(state));
    const retired = [
      'population:growth:urbanCommunities:populationGrowthIntervalMultiplier',
      'population:growth:publicHealth:populationGrowthAmountMultiplier',
    ];
    raw.discoveryProgress = {
      openedSheets: ['population', 'research'],
      noticedItems: retired,
      acknowledgedItems: retired,
    };
    const loaded = deserializeSave(raw);
    expect(loaded.researchedTechnologies).toEqual(state.researchedTechnologies);
    expect(loaded.resources).toEqual(state.resources);
    expect(loaded.population).toEqual(state.population);
    expect(loaded.autoPopulationGrowth).toEqual(state.autoPopulationGrowth);
    expect(loaded.discoveryProgress.acknowledgedItems).toEqual(retired);
    expect(importSave(exportSave(loaded)).discoveryProgress).toEqual(
      loaded.discoveryProgress,
    );
    // The old 4-second Urban Communities phase is also valid under the new 7-second interval.
    raw.researchedTechnologies = raw.researchedTechnologies.filter(
      (id: string) =>
        !['publicHealth', 'aqueducts'].includes(id) &&
        technologies.find((t) => t.id === id)!.era !== 'medieval',
    );
    raw.autoPopulationGrowth.accumulator = 3.5;
    expect(deserializeSave(raw).autoPopulationGrowth.accumulator).toBe(3.5);
  });
  it('migrates v6 Aqueducts with the full new path while preserving resources, people, army, campaign and language', () => {
    const s = researched();
    s.settings.language = 'cs';
    s.militaryUnits.infantry = D(5);
    s.militaryTiers.infantry = 2;
    const running = applyAction(s, {
      type: 'launchCampaign',
      targetId: 'materials',
    });
    expect(running.activeCampaign).not.toBeNull();
    const raw = JSON.parse(serializeSave(running));
    raw.saveVersion = 6;
    raw.researchedTechnologies = raw.researchedTechnologies.filter(
      (id: string) => !['urbanCommunities', 'publicHealth'].includes(id),
    );
    raw.autoPopulationGrowth.accumulator = 5;
    const original = JSON.stringify(raw);
    const loaded = deserializeSave(raw);
    expect(loaded.saveVersion).toBe(8);
    expect(loaded.researchedTechnologies).toEqual(
      expect.arrayContaining([
        ...raw.researchedTechnologies,
        'urbanCommunities',
        'publicHealth',
      ]),
    );
    expect(loaded.population).toEqual(running.population);
    expect(loaded.resources).toEqual(running.resources);
    expect(loaded.productionUnits).toEqual(running.productionUnits);
    expect(loaded.militaryUnits).toEqual(running.militaryUnits);
    expect(loaded.militaryTiers).toEqual(running.militaryTiers);
    expect(loaded.activeCampaign).toEqual(running.activeCampaign);
    expect(loaded.eventLog).toEqual(running.eventLog);
    expect(loaded.settings.language).toBe('cs');
    expect(loaded.autoPopulationGrowth.accumulator).toBe(0);
    expect(JSON.stringify(raw)).toBe(original);
    expect(serializeSave(importSave(exportSave(loaded)), 1000)).toBe(
      serializeSave(loaded, 1000),
    );
  });
  it('adds ancestors needed by a newly granted prerequisite without granting unrelated research', () => {
    const raw = JSON.parse(serializeSave(researched('medieval')));
    raw.saveVersion = 6;
    raw.researchedTechnologies = raw.researchedTechnologies.filter(
      (id: string) =>
        technologies.find((t) => t.id === id)!.era !== 'medieval' ||
        id === 'sanitation',
    );
    const loaded = deserializeSave(raw);
    expect(loaded.researchedTechnologies).toEqual(
      expect.arrayContaining([
        'sanitation',
        'civilAdministration',
        'feudalOrganization',
      ]),
    );
    expect(loaded.researchedTechnologies).not.toContain('professionalArmy');
    expect(loaded.researchedTechnologies).not.toContain('espionage');
    expect(loaded.resources).toEqual(researched('medieval').resources);
  });
  it('rejects a v6 save missing an original prerequisite and a v7 save bypassing the new paths', () => {
    const raw = JSON.parse(serializeSave(researched()));
    raw.saveVersion = 6;
    raw.researchedTechnologies = raw.researchedTechnologies.filter(
      (id: string) => id !== 'urbanPlanning',
    );
    expect(() => deserializeSave(raw)).toThrow('prerequisites');
    const current = JSON.parse(serializeSave(researched()));
    current.researchedTechnologies = current.researchedTechnologies.filter(
      (id: string) => id !== 'publicHealth',
    );
    expect(() => deserializeSave(current)).toThrow('prerequisites');
  });
  it('roundtrips Czech through JSON and export/import without changing gameplay', () => {
    const initial = researched();
    const s = applyAction(initial, {
      type: 'settings',
      settings: { language: 'cs' },
    });
    expect(initial.settings.language).toBe('en');
    expect(s.settings.language).toBe('cs');
    expect(importSave(exportSave(s)).settings.language).toBe('cs');
    expect(deserializeSave(JSON.parse(serializeSave(s))).population).toEqual(
      initial.population,
    );
    expect(
      applyAction(s, {
        type: 'settings',
        settings: { language: 'fr' as 'en' },
      }),
    ).toBe(s);
    const raw = JSON.parse(serializeSave(s));
    raw.settings.language = 'fr';
    expect(() => deserializeSave(raw)).toThrow('Invalid settings');
  });
  it('migrates v4 with defaults and retains legitimately owned army/settlement discoveries with the newly added edges', () => {
    const old = researched();
    old.researchedTechnologies = old.researchedTechnologies.filter(
      (id) =>
        !['engineering', 'aqueducts', 'archery', 'organizedWarfare'].includes(
          id,
        ),
    );
    const raw = JSON.parse(serializeSave(old));
    raw.saveVersion = 4;
    delete raw.settings.language;
    const original = JSON.stringify(raw);
    const loaded = deserializeSave(raw);
    expect(loaded.settings.language).toBe('en');
    expect(loaded.saveVersion).toBe(8);
    expect(loaded.researchedTechnologies).toEqual(
      expect.arrayContaining([
        ...old.researchedTechnologies,
        'engineering',
        'archery',
        'organizedWarfare',
      ]),
    );
    expect(loaded.resources).toEqual(old.resources);
    expect(loaded.productionUnits).toEqual(old.productionUnits);
    expect(loaded.population).toEqual(old.population);
    expect(JSON.stringify(raw)).toBe(original);
    const broken = structuredClone(raw);
    broken.researchedTechnologies = broken.researchedTechnologies.filter(
      (id: string) => id !== 'census',
    );
    expect(() => deserializeSave(broken)).toThrow('prerequisites');
  });
  it('keeps new event descriptors across saves and rejects malformed translation payloads', () => {
    const s = researched('agricultural');
    s.researchedTechnologies = s.researchedTechnologies.filter(
      (id) => id !== 'organizedWarfare' && id !== 'organizedSettlements',
    );
    const next = applyAction(s, { type: 'research', id: 'organizedWarfare' }),
      loaded = importSave(exportSave(next));
    expect(
      loaded.eventLog.find(
        (e) => e.message === 'Organized Warfare researched.',
      )!.translation!.values,
    ).toEqual({ '0': 'Organized Warfare' });
    const raw = JSON.parse(serializeSave(next));
    raw.eventLog[0].translation = {
      key: 'Bad',
      values: { x: { nested: true } },
    };
    expect(() => deserializeSave(raw)).toThrow('event translation');
  });
});
describe('translation fallback, interpolation and formatting', () => {
  it('switches the placeholder controls and falls back to English for the unfinished Czech catalog', () => {
    expect(translate('cs', 'Language')).toBe('Jazyk');
    expect(translate('en', 'Language')).toBe('Language');
    expect(translate('cs', 'Gather Food')).toBe('Gather Food');
    expect(translate('cs', 'future unknown message')).toBe(
      'future unknown message',
    );
    expect(formatNumber(123.5, 2, 'cs')).toBe('123,5');
    expect(formatNumber(123.5, 2, 'en')).toBe('123.5');
  });
  it('uses translated templates and content names for events, independently of the stored English message', () => {
    const catalog = cs as Record<string, string>;
    catalog['Organized Warfare'] = 'Organizované válčení';
    catalog['{0} researched.'] = 'Výzkum dokončen: {0}.';
    try {
      expect(
        translateMessage(
          'cs',
          message('{0} researched.', { '0': 'Organized Warfare' }),
        ),
      ).toBe('Výzkum dokončen: Organizované válčení.');
      expect(translateLegacyEvent('cs', 'Organized Warfare researched.')).toBe(
        'Výzkum dokončen: Organizované válčení.',
      );
    } finally {
      delete catalog['Organized Warfare'];
      delete catalog['{0} researched.'];
    }
    expect(
      translate('en', 'Power {power} / {target}', { power: 100, target: 200 }),
    ).toBe('Power 100 / 200');
    expect(translate('cs', 'Missing {unknown}')).toBe('Missing {unknown}');
    expect(translate('en', '{constructor}')).toBe('{constructor}');
    expect(translate('cs', 'constructor')).toBe('constructor');
    expect(translateError('cs', 'Could not import save: Unknown reason.')).toBe(
      'Could not import save: Unknown reason.',
    );
  });
});
