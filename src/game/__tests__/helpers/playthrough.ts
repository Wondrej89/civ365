/** A deterministic player policy. It only proposes ordinary game actions. */
import { technologies } from '../../content/technologies';
import { eras } from '../../content/eras';
import { units } from '../../content/units';
import { settlements } from '../../content/settlements';
import { militaryUnits } from '../../content/military';
import { populationCost } from '../../engine/production';
import {
  idlePopulation,
  militaryPopulation,
  getPopulationFootprint,
} from '../../engine/population-accounting';
import {
  ownedTerritories,
  populationCapacity,
  settlementCount,
  maxSettlementAction,
} from '../../engine/settlements';
import {
  militaryUnlocked,
  powerPerMilitaryUnit,
  maxMilitaryRecruit,
  militaryQuote,
  canUpgradeMilitary,
} from '../../engine/military';
import { campaignPreview, frontierOptions } from '../../engine/conquest';
import { isUnitUnlocked, maxCreatable } from '../../engine/units';
import { populationDistribution } from '../../systems/statistics';
import {
  canAdvance,
  canAfford,
  technologyStatus,
} from '../../systems/progression';
import { D } from '../../utils/numbers';
import type { GameAction, GameState } from '../../types';

export function nextPlaythroughAction(state: GameState): GameAction | null {
  const nextEra = eras.find((e) => e.previous === state.currentEra);
  if (nextEra && canAdvance(state, nextEra))
    return { type: 'advance', id: nextEra.id };
  if (
    state.unlockedFeatures.includes('autoPopulationGrowth') &&
    !state.autoPopulationGrowth.enabled
  )
    return { type: 'autoGrowth', enabled: true };
  const priority = [
    'settledLife',
    'villageOrganization',
    'naturalGrowth',
    'organizedWarfare',
    'mining',
    'recordKeeping',
    'writing',
    'bronzeWorking',
    'formalEducation',
    'construction',
    'classicalArmy',
    'horsemanship',
    'supplyLines',
    'urbanCommunities',
    'publicHealth',
    'sanitation',
    'civilAdministration',
    'professionalArmy',
    'institutionalLearning',
    'printingPress',
    'scientificMethod',
  ];
  const affordableTechs = technologies.filter(
    (t) =>
      technologyStatus(state, t) === 'available' && canAfford(state, t.cost),
  );
  affordableTechs.sort(
    (a, b) =>
      (priority.includes(a.id) ? priority.indexOf(a.id) : 100) -
      (priority.includes(b.id) ? priority.indexOf(b.id) : 100),
  );
  if (affordableTechs[0])
    return { type: 'research', id: affordableTechs[0].id };
  for (const definition of settlements) {
    const building = definition.tier === 1;
    if (building && maxSettlementAction(state, definition, true).gt(0))
      return { type: 'buildSettlement', id: definition.id, amount: 'max' };
    const neededCityCount = nextEra?.requirements.find(
      (c) => c.type === 'settlementsAtLeast' && c.minimumTier === 3,
    );
    const needCities =
      neededCityCount?.type === 'settlementsAtLeast' &&
      settlementCount(state, 3).lt(neededCityCount.value);
    if (
      (definition.tier <= 2 ||
        populationCapacity(state).lt(state.population.mul(1.4)) ||
        (definition.tier === 3 && needCities)) &&
      maxSettlementAction(state, definition).gt(0)
    )
      return { type: 'upgradeSettlement', id: definition.id, amount: 'max' };
  }
  if (
    !state.unlockedFeatures.includes('autoPopulationGrowth') &&
    state.population.lt(populationCapacity(state)) &&
    state.unlockedFeatures.includes('population') &&
    state.resources.food.gte(populationCost(state))
  )
    return { type: 'grow' };
  const visibleMilitary = militaryUnits.filter((u) =>
    militaryUnlocked(state, u),
  );
  for (const unit of visibleMilitary)
    if (canUpgradeMilitary(state, unit))
      return { type: 'upgradeMilitary', id: unit.id };
  const best = visibleMilitary[0];
  const frontier = frontierOptions(state).find((t) => t.difficulty === 0)!;
  const territoryRequirement = nextEra?.requirements.find(
    (c) => c.type === 'territoriesAtLeast',
  );
  const needTerritory =
    territoryRequirement?.type === 'territoriesAtLeast' &&
    ownedTerritories(state).lt(territoryRequirement.value);
  const militaryRequirement = nextEra?.requirements.find(
    (c) => c.type === 'militaryPowerAtLeast',
  );
  let neededPower =
    militaryRequirement?.type === 'militaryPowerAtLeast'
      ? D(militaryRequirement.value)
      : D();
  if (needTerritory) neededPower = neededPower.max(frontier.defense.mul(1.3));
  const average = visibleMilitary
    .reduce((n, u) => n.add(powerPerMilitaryUnit(state, u)), D())
    .div(Math.max(1, visibleMilitary.length));
  let desiredArmy = best
    ? neededPower.div(average.mul(state.militaryReadiness)).ceil()
    : D();
  if (desiredArmy.gt(state.population.sub(state.population.mul(0.2).max(10))))
    desiredArmy = D();
  const desiredPerRole = desiredArmy
    .div(Math.max(1, visibleMilitary.length))
    .ceil();
  desiredArmy = desiredPerRole.mul(visibleMilitary.length);
  if (state.activeCampaign) desiredArmy = militaryPopulation(state);
  if (!state.activeCampaign) {
    for (const unit of militaryUnits) {
      const desired = visibleMilitary.includes(unit) ? desiredPerRole : D();
      if (state.militaryUnits[unit.id].gt(desired))
        return {
          type: 'demobilize',
          id: unit.id,
          amount: state.militaryUnits[unit.id].sub(desired),
        };
    }
    if (
      needTerritory &&
      campaignPreview(state, frontier.id).minimumPower.gte(
        frontier.defense.mul(1.15),
      )
    )
      return { type: 'launchCampaign', targetId: frontier.id };
    for (const unit of visibleMilitary) {
      const missing = desiredPerRole.sub(state.militaryUnits[unit.id]);
      if (missing.gt(0) && maxMilitaryRecruit(state, unit).gt(0))
        return {
          type: 'recruitMilitary',
          id: unit.id,
          amount: missing.min(maxMilitaryRecruit(state, unit)),
        };
    }
  }
  const groups = populationDistribution(state);
  const groupValue = (id: string) =>
    groups.find((g) => g.id === id)?.value ?? D();
  const economy = state.population.sub(desiredArmy);
  const target: Record<string, ReturnType<typeof D>> = {
    food: D(),
    materials: economy.mul(0.35).floor().max(1),
    research: economy.mul(0.3).floor().max(1),
  };
  target.food = economy.sub(target.materials).sub(target.research);
  if (!state.unlockedFeatures.includes('research')) {
    target.food = economy;
    target.materials = D();
    target.research = D();
  }
  const bases = [
    ['research', 'thinker'],
    ['materials', 'woodcutter'],
    ['food', 'gatherer'],
  ] as const;
  for (const [resource, id] of bases) {
    const base = units.find((u) => u.id === id)!;
    if (!isUnitUnlocked(state, base)) continue;
    // Early Food and both other resources must always retain a route forward.
    if (state.population.gte(5)) target[resource] = target[resource].max(1);
    const excess = groupValue(resource).sub(target[resource]);
    if (excess.gte(1)) {
      if (state.productionUnits[id].gt(0))
        return {
          type: 'release',
          unitId: id,
          amount: excess.floor().min(state.productionUnits[id]),
        };
      const higher = units
        .filter(
          (u) =>
            u.category === resource &&
            u.upgradeFrom &&
            state.productionUnits[u.id].gt(0),
        )
        .sort((a, b) => a.tier - b.tier)[0];
      if (higher)
        return {
          type: 'dismantle',
          unitId: higher.id,
          amount: excess
            .div(getPopulationFootprint(higher.id))
            .ceil()
            .min(state.productionUnits[higher.id]),
        };
    }
  }
  for (const [resource, id] of bases) {
    const base = units.find((u) => u.id === id)!;
    if (!isUnitUnlocked(state, base)) continue;
    const need = target[resource]
      .sub(groupValue(resource))
      .floor()
      .min(idlePopulation(state));
    if (need.gt(0)) return { type: 'recruit', unitId: id, amount: need };
  }
  // Leave the planned army share idle until its equipment is affordable.
  if (!best || desiredArmy.eq(0)) {
    if (
      idlePopulation(state).gt(0) &&
      isUnitUnlocked(
        state,
        units.find((u) => u.id === 'gatherer')!,
      )
    )
      return { type: 'recruit', unitId: 'gatherer', amount: 'max' };
  } else if (
    !state.activeCampaign &&
    visibleMilitary.some((u) => state.militaryUnits[u.id].lt(desiredPerRole)) &&
    idlePopulation(state).lte(0) &&
    canAfford(state, militaryQuote(state, best))
  ) {
    for (const [resource, id] of bases)
      if (groupValue(resource).gt(1) && state.productionUnits[id].gt(0))
        return { type: 'release', unitId: id, amount: 1 };
  }
  // Upgrade only full groups; the planner dismantles again only when reallocation is needed.
  for (const unit of units.filter((u) => u.upgradeFrom)) {
    const source = units.find((u) => u.id === unit.upgradeFrom!.unitId)!;
    const quantity = maxCreatable(state, unit);
    if (
      isUnitUnlocked(state, unit) &&
      quantity.gt(0) &&
      getPopulationFootprint(source.id)
        .mul(unit.upgradeFrom!.amount)
        .lte(groupValue(unit.category))
    )
      return { type: 'upgrade', unitId: unit.id, amount: 'max' };
  }
  return null;
}
