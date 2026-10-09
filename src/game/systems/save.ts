import Decimal from 'break_infinity.js';
import { createInitialState, statisticIds } from '../state';
import { balance } from '../content/config';
import { resources } from '../content/resources';
import { units } from '../content/units';
import { settlements } from '../content/settlements';
import { militaryUnits, legacyMilitary } from '../content/military';
import { territories, frontierTypes } from '../content/territories';
import { militaryTier } from '../engine/military';
import {
  ownedTerritories,
  settlementCount,
  settlementSlots,
} from '../engine/settlements';
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
import { isLanguage } from '../../i18n/types';

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
function validateMessage(
  value: unknown,
): NonNullable<GameEvent['translation']> {
  const source = object(value);
  if (typeof source.key !== 'string' || source.key.length > 1000)
    throw new Error('Invalid event translation.');
  const values = source.values === undefined ? {} : object(source.values);
  if (
    Object.keys(values).length > 20 ||
    Object.entries(values).some(
      ([key, parameter]) =>
        !/^\w+$/.test(key) ||
        (typeof parameter !== 'string' && typeof parameter !== 'number') ||
        (typeof parameter === 'string'
          ? parameter.length > 1000
          : !Number.isFinite(parameter)),
    )
  )
    throw new Error('Invalid event translation.');
  return {
    key: source.key,
    ...(source.values !== undefined
      ? { values: values as Record<string, string | number> }
      : {}),
  };
}
function migrateMilitary(value: unknown) {
  const counts = Object.fromEntries(
    militaryUnits.map((u) => [u.id, new Decimal(0)]),
  );
  const tiers = Object.fromEntries(militaryUnits.map((u) => [u.id, 0]));
  for (const [id, raw] of Object.entries(object(value))) {
    const n = decimal(raw, true);
    if (Object.hasOwn(legacyMilitary, id)) {
      const legacy = legacyMilitary[id];
      counts[legacy.role] = counts[legacy.role].add(n);
      if (n.gt(0))
        tiers[legacy.role] = Math.max(tiers[legacy.role], legacy.tier);
    } else if (!Object.hasOwn(counts, id) || n.gt(0))
      throw new Error('Unknown legacy military unit.');
  }
  return {
    counts: Object.fromEntries(
      Object.entries(counts).map(([id, n]) => [id, n.toString()]),
    ),
    tiers,
  };
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
  if (save.saveVersion === 3) {
    save.ownedTerritories = Object.fromEntries(
      territories.map((t) => [t.id, t.id === 'homeland' ? '1' : '0']),
    );
    save.settlements = Object.fromEntries(
      settlements.map((s) => [s.id, s.id === 'camp' ? '1' : '0']),
    );
    save.militaryUnits = Object.fromEntries(
      Object.keys(legacyMilitary).map((id) => [id, '0']),
    );
    save.activeCampaign = null;
    save.populationCapacityBonus = '0';
    save.statistics = {
      ...object(save.statistics),
      totalSettlementsBuilt: '1',
      territoriesConquered: '0',
      militaryCasualties: '0',
      campaignsCompleted: '0',
    };
    save.saveVersion = 4;
  }
  if (save.saveVersion === 4) {
    save.settings = { ...object(save.settings), language: 'en' };
    // Preserve discoveries legitimately bought before these new edges existed.
    // Only the newly added prerequisites are granted; validation still checks old edges.
    const known = ids(
      save.researchedTechnologies,
      technologies.map((t) => t.id),
    );
    const additions: Record<string, string[]> = {
      organizedSettlements: ['organizedWarfare'],
      classicalArmy: ['archery', 'engineering', 'organizedWarfare'],
    };
    save.researchedTechnologies = [
      ...new Set([...known, ...known.flatMap((id) => additions[id] ?? [])]),
    ];
    save.saveVersion = 5;
  }
  if (save.saveVersion === 5) {
    const army = migrateMilitary(save.militaryUnits);
    save.militaryUnits = army.counts;
    save.militaryTiers = army.tiers;
    save.militaryReadiness = 1;
    if (army.tiers.cavalry > 0)
      save.researchedTechnologies = [
        ...new Set([
          ...ids(
            save.researchedTechnologies,
            technologies.map((t) => t.id),
          ),
          'horsemanship',
        ]),
      ];
    const existing = object(save.settlements);
    save.settlementInvestments = Object.fromEntries(
      settlements.map((s) => [
        s.id,
        s.tier === 0
          ? '1'
          : sum(
              settlements
                .filter((t) => t.tier >= s.tier)
                .map((t) => decimal(existing[t.id] ?? '0', true)),
            ).toString(),
      ]),
    );
    save.territoryProductionBonuses = {
      food: '0',
      materials: '0',
      research: '0',
    };
    if (save.activeCampaign !== null) {
      const old = object(save.activeCampaign);
      if (
        typeof old.casualtyRate !== 'number' ||
        !Number.isFinite(old.casualtyRate) ||
        old.casualtyRate < 0 ||
        old.casualtyRate >= 1
      )
        throw new Error('Invalid legacy campaign.');
      const rate = old.casualtyRate;
      const losses = migrateMilitary(
        Object.fromEntries(
          Object.entries(object(old.committedUnits)).map(([id, n]) => [
            id,
            decimal(n, true).mul(rate).floor().toString(),
          ]),
        ),
      ).counts;
      save.activeCampaign = {
        ...old,
        committedUnits: migrateMilitary(old.committedUnits).counts,
        targetId: 'legacy',
        rewardTerritory: 'frontier',
        rewardResource: null,
        productionBonus: '0',
        initialReadiness: 1,
        lowestReadiness: 1,
        casualtyMultiplier: 1,
        legacyLosses: losses,
      };
    }
    save.saveVersion = 6;
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
  const counts = (value: unknown, definitions: { id: string }[]) => {
    const source = object(value);
    if (Object.keys(source).some((id) => !definitions.some((d) => d.id === id)))
      throw new Error('Unknown settlement, military unit or territory.');
    return Object.fromEntries(
      definitions.map((d) => [d.id, decimal(source[d.id] ?? '0', true)]),
    );
  };
  state.ownedTerritories = counts(raw.ownedTerritories, territories);
  state.settlements = counts(raw.settlements, settlements);
  state.militaryUnits = counts(raw.militaryUnits, militaryUnits);
  state.settlementInvestments = counts(raw.settlementInvestments, settlements);
  if (
    settlements.some((s) =>
      state.settlementInvestments[s.id].lt(state.settlements[s.id]),
    )
  )
    throw new Error('Invalid settlement investment history.');
  const tierValues = object(raw.militaryTiers);
  if (
    Object.keys(tierValues).some(
      (id) => !militaryUnits.some((u) => u.id === id),
    )
  )
    throw new Error('Unknown military category.');
  for (const unit of militaryUnits) {
    const tier = tierValues[unit.id] ?? 0;
    if (
      typeof tier !== 'number' ||
      !Number.isInteger(tier) ||
      tier < 0 ||
      tier >= unit.tiers.length
    )
      throw new Error('Invalid military tier.');
    state.militaryTiers[unit.id] = tier;
  }
  if (
    typeof raw.militaryReadiness !== 'number' ||
    !Number.isFinite(raw.militaryReadiness) ||
    raw.militaryReadiness < balance.military.minimumReadiness ||
    raw.militaryReadiness > 1
  )
    throw new Error('Invalid army readiness.');
  state.militaryReadiness = raw.militaryReadiness;
  const bonuses = object(raw.territoryProductionBonuses);
  if (
    Object.keys(bonuses).some(
      (id) => !['food', 'materials', 'research'].includes(id),
    )
  )
    throw new Error('Unknown territory production bonus.');
  for (const id of ['food', 'materials', 'research'])
    state.territoryProductionBonuses[id] = decimal(bonuses[id] ?? '0');
  state.populationCapacityBonus = decimal(raw.populationCapacityBonus);
  if (
    ownedTerritories(state).lt(1) ||
    settlementCount(state).gt(settlementSlots(state))
  )
    throw new Error('Settlements exceed territory slots.');
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
  if (
    typeof settings.notifications !== 'boolean' ||
    !isLanguage(settings.language)
  )
    throw new Error('Invalid settings.');
  state.settings = {
    notifications: settings.notifications,
    language: settings.language,
  };
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
  if (raw.activeCampaign !== null) {
    const campaign = object(raw.activeCampaign);
    const power = decimal(campaign.power),
      defense = decimal(campaign.defense);
    const frontierIndex = decimal(campaign.frontierIndex, true);
    const reward = frontierTypes.find((t) => t.id === campaign.targetId);
    const legacy = campaign.targetId === 'legacy';
    const productionBonus = decimal(campaign.productionBonus);
    if (
      !frontierIndex.eq(state.statistics.territoriesConquered.add(1)) ||
      (!legacy &&
        (!reward ||
          campaign.rewardTerritory !== reward.territory ||
          campaign.rewardResource !== reward.resource)) ||
      (legacy &&
        (campaign.rewardTerritory !== 'frontier' ||
          campaign.rewardResource !== null ||
          !productionBonus.eq(0))) ||
      productionBonus.gt(1) ||
      typeof campaign.initialReadiness !== 'number' ||
      !Number.isFinite(campaign.initialReadiness) ||
      campaign.initialReadiness < balance.military.minimumReadiness ||
      campaign.initialReadiness > 1 ||
      typeof campaign.lowestReadiness !== 'number' ||
      !Number.isFinite(campaign.lowestReadiness) ||
      campaign.lowestReadiness < balance.military.minimumReadiness ||
      campaign.lowestReadiness > campaign.initialReadiness ||
      typeof campaign.casualtyMultiplier !== 'number' ||
      !Number.isFinite(campaign.casualtyMultiplier) ||
      campaign.casualtyMultiplier <= 0 ||
      campaign.casualtyMultiplier > 10 ||
      power.lte(0) ||
      defense.lte(0) ||
      typeof campaign.victory !== 'boolean' ||
      campaign.victory !== power.gte(defense) ||
      typeof campaign.durationSeconds !== 'number' ||
      !Number.isFinite(campaign.durationSeconds) ||
      campaign.durationSeconds <= 0 ||
      typeof campaign.elapsedSeconds !== 'number' ||
      !Number.isFinite(campaign.elapsedSeconds) ||
      campaign.elapsedSeconds < 0 ||
      campaign.elapsedSeconds > campaign.durationSeconds ||
      typeof campaign.casualtyRate !== 'number' ||
      !Number.isFinite(campaign.casualtyRate) ||
      campaign.casualtyRate < 0 ||
      campaign.casualtyRate >= 1 ||
      !state.unlockedFeatures.includes('territory')
    )
      throw new Error('Invalid campaign.');
    const committedUnits = counts(campaign.committedUnits, militaryUnits);
    const legacyLosses =
      campaign.legacyLosses === null
        ? null
        : counts(campaign.legacyLosses, militaryUnits);
    if (
      (legacy && !legacyLosses) ||
      (!legacy && legacyLosses) ||
      (legacyLosses &&
        militaryUnits.some((u) => legacyLosses[u.id].gt(committedUnits[u.id])))
    )
      throw new Error('Invalid legacy campaign losses.');
    if (
      militaryUnits.some(
        (u) => !committedUnits[u.id].eq(state.militaryUnits[u.id]),
      ) ||
      sum(Object.values(committedUnits)).lte(0)
    )
      throw new Error('Campaign army is inconsistent.');
    state.activeCampaign = {
      frontierIndex: frontierIndex.toString(),
      committedUnits,
      power,
      defense,
      durationSeconds: campaign.durationSeconds,
      elapsedSeconds: campaign.elapsedSeconds,
      casualtyRate: campaign.casualtyRate,
      victory: campaign.victory,
      targetId: campaign.targetId as string,
      rewardTerritory: campaign.rewardTerritory as string,
      rewardResource: campaign.rewardResource as string | null,
      productionBonus,
      initialReadiness: campaign.initialReadiness,
      lowestReadiness: campaign.lowestReadiness,
      casualtyMultiplier: campaign.casualtyMultiplier,
      legacyLosses,
    };
  }
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
      ...(e.translation !== undefined
        ? { translation: validateMessage(e.translation) }
        : {}),
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
  if (
    militaryUnits.some(
      (unit) =>
        state.militaryUnits[unit.id].gt(0) &&
        (!state.unlockedFeatures.includes('military') ||
          !evaluateCondition(unit.unlockCondition, state) ||
          !evaluateCondition(militaryTier(state, unit).unlockCondition, state)),
    )
  )
    throw new Error('Save contains an undiscovered military unit.');
  if (
    militaryUnits.some(
      (unit) =>
        state.militaryTiers[unit.id] > 0 &&
        (!state.unlockedFeatures.includes('military') ||
          !evaluateCondition(unit.unlockCondition, state) ||
          !evaluateCondition(militaryTier(state, unit).unlockCondition, state)),
    )
  )
    throw new Error('Save contains an undiscovered military tier.');
  if (
    settlements.some(
      (settlement) =>
        settlement.tier > 0 &&
        state.settlements[settlement.id].gt(0) &&
        !evaluateCondition(settlement.unlockCondition, state),
    )
  )
    throw new Error('Save contains an undiscovered settlement.');
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
    ownedTerritories: decimals(state.ownedTerritories),
    settlements: decimals(state.settlements),
    militaryUnits: decimals(state.militaryUnits),
    settlementInvestments: decimals(state.settlementInvestments),
    territoryProductionBonuses: decimals(state.territoryProductionBonuses),
    populationCapacityBonus: state.populationCapacityBonus.toString(),
    activeCampaign: state.activeCampaign
      ? {
          ...state.activeCampaign,
          committedUnits: decimals(state.activeCampaign.committedUnits),
          power: state.activeCampaign.power.toString(),
          defense: state.activeCampaign.defense.toString(),
          productionBonus: state.activeCampaign.productionBonus.toString(),
          legacyLosses: state.activeCampaign.legacyLosses
            ? decimals(state.activeCampaign.legacyLosses)
            : null,
        }
      : null,
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
