import { useSyncExternalStore } from 'react';
import { gameStore } from '../game/store';
export function useGame() {
  return useSyncExternalStore(gameStore.subscribe, gameStore.getSnapshot);
}
