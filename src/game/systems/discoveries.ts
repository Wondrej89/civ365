import { sheetDefinitions, type SheetId } from '../content/sheets';
import { units } from '../content/units';
import { technologies } from '../content/technologies';
import { settlements } from '../content/settlements';
import { militaryUnits } from '../content/military';
import {
  achievementTracks,
  achievementTrackProgress,
} from '../content/achievement-tracks';
import { tradeDiscoveryId } from '../engine/trade';
import { achievements } from '../content/achievements';
import { skills } from '../content/skills';
import { resources } from '../content/resources';
import { eras } from '../content/eras';
import { guidance } from '../content/guidance';
import { balance } from '../content/config';
import { statisticSeries, statisticDistributions } from '../content/statistics';
import { evaluateCondition, isFeatureUnlocked } from '../engine/conditions';
import { unitStatus } from '../engine/units';
import { capacityReached } from '../engine/settlements';
import { militaryUnlocked, nextMilitaryTier } from '../engine/military';
import { technologyStatus, canAdvance } from './progression';
import type { GameState } from '../types';

export type Discovery = {
  id: string;
  sheet: SheetId;
  mode: 'interactive' | 'passive';
};
export const discoverySettings = {
  readingMilliseconds: 5000,
  visibleFraction: 0.5,
};
export const resourceDiscoveryId = (state: GameState, id: string) =>
  `overview:resource:${id}:${isFeatureUnlocked(state, 'jobs') ? 'production' : 'summary'}`;
export const researchDiscoveryId = (id: string, status: string) =>
  `research:technology:${id}:${status === 'revealed' ? 'preview' : 'available'}`;
export const unitDiscoveryId = (id: string, status: string) =>
  `workforce:unit:${id}:${status === 'revealed' ? 'preview' : 'available'}`;
export const allocationDiscoveryId = (state: GameState, sheet = 'population') =>
  `${sheet}:allocation:${isFeatureUnlocked(state, 'military') ? 'military' : 'civilian'}`;
export const territoryBonusDiscoveryId = (state: GameState, id: string) =>
  `territory:bonus:${id}:${state.territoryProductionBonuses[id].gt(0) ? 'earned' : 'preview'}`;
export const equipmentDiscoveryId = (
  state: GameState,
  id: string,
  unlocked: boolean,
) =>
  `military:equipment:${id}:${state.militaryTiers[id] + 1}:${unlocked ? 'available' : 'preview'}`;
export const eraDiscoveryId = (id: string, ready: boolean) =>
  `overview:era:${id}:${ready ? 'ready' : 'requirements'}`;

/** Stable discoveries, not fluctuating prices, production, counts or affordability. */
export function currentDiscoveries(state: GameState): Discovery[] {
  const result: Discovery[] = [];
  const add = (
    sheet: SheetId,
    id: string,
    mode: Discovery['mode'] = 'passive',
  ) => result.push({ sheet, id: `${sheet}:${id}`, mode });
  const unlocked = (id: string) => isFeatureUnlocked(state, id);
  add('overview', 'population');
  const goal = guidance.find(
    (g) =>
      evaluateCondition(g.visible, state) &&
      !evaluateCondition(g.complete, state),
  );
  add('overview', `guidance:${goal?.id ?? 'complete'}`);
  const visibleResources = resources.filter(
    (r) => !r.meta && (r.initiallyVisible || unlocked(r.feature)),
  );
  for (const r of visibleResources) {
    result.push({
      sheet: 'overview',
      id: resourceDiscoveryId(state, r.id),
      mode: unlocked('jobs') ? 'interactive' : 'passive',
    });
    add('overview', `ledger:${r.id}`);
    add('population', `allocation-group:${r.id}`);
  }
  add('population', 'allocation-group:idle');
  if (unlocked('military')) add('population', 'allocation-group:military');
  for (const [id, config] of Object.entries(balance.manualGathering))
    if (unlocked(config.feature))
      add('overview', `gather:${id}`, 'interactive');
  if (unlocked('population'))
    add(
      'overview',
      `growth:${unlocked('autoPopulationGrowth') ? 'auto' : 'manual'}`,
      'interactive',
    );
  if (unlocked('population')) add('overview', 'manual-growth', 'interactive');
  if (unlocked('settlements')) {
    add('overview', 'settlements', 'interactive');
    add('overview', 'territory', 'interactive');
  }
  if (unlocked('military')) add('overview', 'military', 'interactive');
  const next = eras.find((e) => e.previous === state.currentEra);
  if (next && unlocked('research')) {
    const ready = canAdvance(state, next);
    result.push({
      sheet: 'overview',
      id: eraDiscoveryId(next.id, ready),
      mode: ready ? 'interactive' : 'passive',
    });
  }
  for (const unit of units) {
    if (!visibleResources.some((r) => r.id === unit.category)) continue;
    const status = unitStatus(state, unit);
    if (status !== 'hidden')
      result.push({
        sheet: 'workforce',
        id: unitDiscoveryId(unit.id, status),
        mode: status === 'revealed' ? 'passive' : 'interactive',
      });
    if (unit.upgradeFrom && (status === 'available' || status === 'owned'))
      add('workforce', `yield:${unit.id}`);
  }
  add('population', 'manual', 'interactive');
  add('population', 'growth-base');
  if (capacityReached(state)) add('population', 'capacity', 'interactive');
  result.push({
    sheet: 'population',
    id: allocationDiscoveryId(state),
    mode: 'passive',
  });
  if (unlocked('autoPopulationGrowth')) {
    add('population', 'automation', 'interactive');
    for (const tech of technologies.filter((t) =>
      state.researchedTechnologies.includes(t.id),
    ))
      for (const effect of tech.effects)
        if (
          [
            'populationGrowthIntervalMultiplier',
            'populationGrowthAmountMultiplier',
            'populationGrowthPerCity',
          ].includes(effect.type)
        )
          add('population', `growth:${tech.id}:${effect.type}`);
  }
  for (const series of statisticSeries)
    if (evaluateCondition(series.unlockCondition, state))
      add('statistics', `series:${series.id}`);
  for (const chart of statisticDistributions)
    if (evaluateCondition(chart.unlockCondition, state))
      result.push({
        sheet: 'statistics',
        id: allocationDiscoveryId(state, 'statistics'),
        mode: 'passive',
      });
  for (const settlement of settlements)
    if (
      state.settlements[settlement.id].gt(0) ||
      evaluateCondition(settlement.unlockCondition, state)
    )
      add(
        'settlements',
        `tier:${settlement.id}`,
        settlement.tier === 0 ? 'passive' : 'interactive',
      );
  add('military', 'upkeep');
  if (state.activeCampaign) {
    add('military', 'committed');
    add('territory', 'campaign');
  }
  for (const unit of militaryUnits) {
    if (!militaryUnlocked(state, unit) && state.militaryUnits[unit.id].lte(0))
      continue;
    add('military', `unit:${unit.id}`, 'interactive');
    const nextTier = nextMilitaryTier(state, unit);
    if (nextTier) {
      const available = evaluateCondition(nextTier.unlockCondition, state);
      result.push({
        sheet: 'military',
        id: equipmentDiscoveryId(state, unit.id, available),
        mode: available ? 'interactive' : 'passive',
      });
    }
  }
  for (const id of ['food', 'materials', 'research']) {
    add('territory', `frontier:${id}`, 'interactive');
    if (unlocked('intelligence')) add('territory', `composition:${id}`);
    result.push({
      sheet: 'territory',
      id: territoryBonusDiscoveryId(state, id),
      mode: 'passive',
    });
  }
  for (const tech of technologies) {
    const status = technologyStatus(state, tech);
    if (status !== 'hidden')
      result.push({
        sheet: 'research',
        id: researchDiscoveryId(tech.id, status),
        mode: status === 'available' ? 'interactive' : 'passive',
      });
  }
  for (const skill of skills) {
    const level = state.purchasedSkills[skill.id] ?? 0;
    const usable =
      level < skill.maxLevel &&
      skill.prerequisites.every(
        (p) => (state.purchasedSkills[p.id] ?? 0) >= p.level,
      ) &&
      !skill.exclusiveWith.some((id) => (state.purchasedSkills[id] ?? 0) > 0);
    add('skills', `skill:${skill.id}`, usable ? 'interactive' : 'passive');
  }
  for (const achievement of achievements.filter((a) => !a.track)) {
    const owned = state.achievements.includes(achievement.id);
    if (!achievement.hidden || owned)
      add(
        'achievements',
        `achievement:${achievement.id}:${owned ? 'earned' : 'progress'}`,
      );
  }
  for (const track of achievementTracks)
    add(
      'achievements',
      `track:${track.id}:${achievementTrackProgress(state, track.id).earned.length}`,
    );
  result.push({
    sheet: 'trade',
    id: tradeDiscoveryId(state),
    mode: 'interactive',
  });
  for (const tech of technologies.filter((t) =>
    t.effects.some((e) => e.type === 'tradeEfficiencyBonus'),
  ))
    add(
      'trade',
      `improvement:${tech.id}:${state.researchedTechnologies.includes(tech.id) ? 'earned' : 'preview'}`,
    );
  const visible = new Set<string>(
    sheetDefinitions
      .filter((s) => unlocked(s.requiredFeature))
      .map((s) => s.id),
  );
  return result.filter((item) => visible.has(item.sheet));
}

export function seedDiscoveries(state: GameState) {
  const ids = currentDiscoveries(state).map((item) => item.id);
  return {
    openedSheets: sheetDefinitions
      .filter((s) => isFeatureUnlocked(state, s.requiredFeature))
      .map((s) => s.id as string),
    noticedItems: [...ids],
    acknowledgedItems: [...ids],
  };
}
export function newDiscoverySheets(
  state: GameState,
  items = currentDiscoveries(state),
) {
  const noticed = new Set(state.discoveryProgress.noticedItems);
  return new Set(
    sheetDefinitions
      .filter(
        (s) =>
          isFeatureUnlocked(state, s.requiredFeature) &&
          (!state.discoveryProgress.openedSheets.includes(s.id) ||
            items.some((i) => i.sheet === s.id && !noticed.has(i.id))),
      )
      .map((s) => s.id),
  );
}
export function acknowledgeSheet(state: GameState, id: string): GameState {
  const sheet = sheetDefinitions.find((s) => s.id === id);
  if (!sheet || !isFeatureUnlocked(state, sheet.requiredFeature)) return state;
  const items = currentDiscoveries(state)
    .filter((i) => i.sheet === id)
    .map((i) => i.id);
  const progress = state.discoveryProgress;
  if (
    progress.openedSheets.includes(id) &&
    items.every((i) => progress.noticedItems.includes(i))
  )
    return state;
  return {
    ...state,
    discoveryProgress: {
      ...progress,
      openedSheets: [...new Set([...progress.openedSheets, id])],
      noticedItems: [...new Set([...progress.noticedItems, ...items])],
    },
  };
}
export function acknowledgeDiscovery(state: GameState, id: string): GameState {
  if (
    state.discoveryProgress.acknowledgedItems.includes(id) ||
    !currentDiscoveries(state).some((i) => i.id === id)
  )
    return state;
  const progress = state.discoveryProgress;
  return {
    ...state,
    discoveryProgress: {
      ...progress,
      noticedItems: [...new Set([...progress.noticedItems, id])],
      acknowledgedItems: [...progress.acknowledgedItems, id],
    },
  };
}

/** Accept previously seen revisions too, so upgrades never invalidate a save. */
export function discoveryIds() {
  return new Set([
    ...Array.from({ length: 101 }, (_, i) => `trade:exchange:${i}`),
    ...technologies
      .filter((t) => t.effects.some((e) => e.type === 'tradeEfficiencyBonus'))
      .flatMap((t) =>
        ['preview', 'earned'].map(
          (mode) => `trade:improvement:${t.id}:${mode}`,
        ),
      ),
    ...achievementTracks.flatMap((t) =>
      Array.from(
        { length: balance.achievementTracks.tiers + 1 },
        (_, i) => `achievements:track:${t.id}:${i}`,
      ),
    ),
    'overview:population',
    ...[...guidance.map((g) => g.id), 'complete'].map(
      (id) => `overview:guidance:${id}`,
    ),
    'overview:growth:manual',
    'overview:growth:auto',
    'overview:manual-growth',
    ...Object.keys(balance.manualGathering).map(
      (id) => `overview:gather:${id}`,
    ),
    ...resources.map((r) => `overview:ledger:${r.id}`),
    ...[...resources.map((r) => r.id), 'idle', 'military'].map(
      (id) => `population:allocation-group:${id}`,
    ),
    'overview:settlements',
    'overview:territory',
    'overview:military',
    ...resources.flatMap((r) =>
      ['summary', 'production'].map(
        (mode) => `overview:resource:${r.id}:${mode}`,
      ),
    ),
    ...eras.flatMap((e) =>
      ['ready', 'requirements'].map((mode) =>
        eraDiscoveryId(e.id, mode === 'ready'),
      ),
    ),
    ...units.flatMap((u) =>
      ['revealed', 'available'].map((mode) => unitDiscoveryId(u.id, mode)),
    ),
    'population:manual',
    'population:growth-base',
    'population:capacity',
    'population:automation',
    ...units.filter((u) => u.upgradeFrom).map((u) => `workforce:yield:${u.id}`),
    ...['population', 'statistics'].flatMap((s) =>
      ['civilian', 'military'].map((mode) => `${s}:allocation:${mode}`),
    ),
    ...technologies.flatMap((t) =>
      t.effects.map((e) => `population:growth:${t.id}:${e.type}`),
    ),
    // v8 saves can have already acknowledged these older growth effects.
    'population:growth:urbanCommunities:populationGrowthIntervalMultiplier',
    'population:growth:publicHealth:populationGrowthAmountMultiplier',
    ...statisticSeries.map((s) => `statistics:series:${s.id}`),
    ...settlements.map((s) => `settlements:tier:${s.id}`),
    'military:upkeep',
    'military:committed',
    'territory:campaign',
    ...militaryUnits.map((u) => `military:unit:${u.id}`),
    ...militaryUnits.flatMap((u) =>
      u.tiers
        .slice(1)
        .flatMap((_, i) =>
          ['preview', 'available'].map(
            (mode) => `military:equipment:${u.id}:${i + 1}:${mode}`,
          ),
        ),
    ),
    ...['food', 'materials', 'research'].flatMap((id) =>
      ['frontier', 'composition'].map((kind) => `territory:${kind}:${id}`),
    ),
    ...['food', 'materials', 'research'].flatMap((id) =>
      ['preview', 'earned'].map((mode) => `territory:bonus:${id}:${mode}`),
    ),
    ...technologies.flatMap((t) =>
      ['revealed', 'available'].map((mode) => researchDiscoveryId(t.id, mode)),
    ),
    ...skills.map((s) => `skills:skill:${s.id}`),
    ...achievements.flatMap((a) =>
      ['earned', 'progress'].map(
        (mode) => `achievements:achievement:${a.id}:${mode}`,
      ),
    ),
  ]);
}
