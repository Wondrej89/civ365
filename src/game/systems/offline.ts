import { balance } from '../content/config';
import { simulate } from '../engine/simulation';
import { D } from '../utils/numbers';
import type { GameState } from '../types';
export interface OfflineReport {
  awaySeconds: number;
  simulatedSeconds: number;
  produced: Record<string, ReturnType<typeof D>>;
}
export function applyOfflineProgress(
  state: GameState,
  now = Date.now(),
): { state: GameState; report: OfflineReport | null } {
  const awaySeconds = Math.max(0, (now - state.lastSimulationTime) / 1000);
  const simulatedSeconds = Math.min(awaySeconds, balance.maxOfflineSeconds);
  const next = simulate(state, simulatedSeconds, now);
  next.lastSimulationTime = now;
  return {
    state: next,
    report:
      awaySeconds >= 30
        ? {
            awaySeconds,
            simulatedSeconds,
            produced: Object.fromEntries(
              Object.keys(state.resources).map((id) => [
                id,
                next.resources[id].sub(state.resources[id]),
              ]),
            ),
          }
        : null,
  };
}
