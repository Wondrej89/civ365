import { createInitialState } from '../../state';
import { eras } from '../../content/eras';
import { technologies } from '../../content/technologies';
import { D } from '../../utils/numbers';
import { settleProgression } from '../../systems/progression';
import { seedDiscoveries } from '../../systems/discoveries';

/** The reported ~20k late-game bottleneck, reconstructed without granting recovery resources. */
export function reportedAtomicState() {
  const state = createInitialState(1000);
  state.currentEra = 'atomic';
  state.reachedEras = eras.map((e) => e.id);
  state.researchedTechnologies = technologies
    .filter((t) => t.era !== 'atomic')
    .map((t) => t.id);
  state.population = D(20000);
  state.statistics.totalPopulationCreated = D(20231);
  state.statistics.maxPopulation = D(20000);
  state.statistics.totalFoodProduced = D('1e10');
  state.statistics.totalMaterialsProduced = D('1e10');
  state.statistics.totalResearchProduced = D('1e10');
  state.statistics.totalPlayTime = D(20500);
  state.statistics.militaryCasualties = D(231);
  state.statistics.totalSettlementsBuilt = D(24);
  state.statistics.territoriesConquered = D(23);
  state.ownedTerritories.farmland = D(6);
  state.ownedTerritories.highlands = D(7);
  state.ownedTerritories.scholarlands = D(10);
  state.settlements.camp = D();
  state.settlements.town = D(4);
  state.settlements.city = D(14);
  state.settlements.metropolis = D(6);
  state.settlementInvestments = {
    camp: D(1),
    settlement: D(24),
    town: D(24),
    city: D(20),
    metropolis: D(6),
  };
  state.productionUnits.industrialFarm = D(60);
  state.productionUnits.factory = D(65);
  state.productionUnits.laboratory = D(60);
  state.militaryUnits = { infantry: D(352), cavalry: D(352), ranged: D(350) };
  state.militaryTiers = { infantry: 6, cavalry: 5, ranged: 5 };
  state.territoryProductionBonuses = {
    food: D(0.3),
    materials: D(0.35),
    research: D(0.45),
  };
  state.resources.food = D(726959026);
  state.resources.materials = D(5839051007);
  state.resources.research = D(9908054390);
  state.resources.civilizationPoints = D(8);
  settleProgression(state);
  state.discoveryProgress = seedDiscoveries(state);
  return state;
}
