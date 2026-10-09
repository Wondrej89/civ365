import { describe, expect, it } from 'vitest';
import { technologies } from '../content/technologies';
import { eras } from '../content/eras';
import { createInitialState } from '../state';
import { D } from '../utils/numbers';
import { applyAction } from '../engine/simulation';
import { settleProgression, technologyStatus } from '../systems/progression';
import {
  nextUnresearchedTechnology,
  technologyTree,
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
    expect(loaded.saveVersion).toBe(5);
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
