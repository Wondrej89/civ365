import { productionPerSecond } from './production';
import { armyUpkeep } from './military';
import type { GameState } from '../types';
import { D } from '../utils/numbers';
export function netProductionPerSecond(state: GameState) {
  const gross = productionPerSecond(state),
    upkeep = armyUpkeep(state);
  return Object.fromEntries(
    Object.entries(gross).map(([id, amount]) => [
      id,
      amount.sub(upkeep[id as keyof typeof upkeep] ?? D()),
    ]),
  );
}
