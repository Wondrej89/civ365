import { balance } from '../content/config';
import { resources } from '../content/resources';
import { activeEffects } from './effects';
import { isFeatureUnlocked } from './conditions';
import { D, formatNumber } from '../utils/numbers';
import { logEvent } from '../systems/progression';
import { message } from '../../i18n/core';
import type { Amount, GameAction, GameState } from '../types';

export function tradeResources(state: GameState) {
  return resources.filter(
    (r) =>
      !r.meta &&
      Object.hasOwn(balance.trade.resourceValues, r.id) &&
      (r.initiallyVisible || isFeatureUnlocked(state, r.feature)),
  );
}
/** A common value basis and an efficiency below one prevent profitable cycles. */
export function tradeEfficiency(state: GameState) {
  return activeEffects(state)
    .reduce(
      (sum, effect) =>
        effect.type === 'tradeEfficiencyBonus' ? sum.add(effect.value) : sum,
      D(balance.trade.baseEfficiency),
    )
    .max(0)
    .min(balance.trade.maximumEfficiency);
}
export const tradeDiscoveryId = (state: GameState) =>
  `trade:exchange:${tradeEfficiency(state).mul(100).round().toString()}`;

export function tradeRate(state: GameState, sell: string, buy: string) {
  const allowed = tradeResources(state).map((r) => r.id);
  if (sell === buy || !allowed.includes(sell) || !allowed.includes(buy))
    return D();
  return D(balance.trade.resourceValues[sell])
    .div(balance.trade.resourceValues[buy])
    .mul(tradeEfficiency(state));
}
export function tradeQuote(
  state: GameState,
  sell: string,
  buy: string,
  requested: Amount | 'max',
) {
  const rate = tradeRate(state, sell, buy);
  const none = {
    sold: D(),
    received: D(),
    rate,
    reason: 'Enter a positive whole amount.',
  };
  if (!isFeatureUnlocked(state, 'trade'))
    return { ...none, reason: 'International Trade has not been discovered.' };
  if (rate.lte(0))
    return { ...none, reason: 'Choose two different available resources.' };
  let amount;
  try {
    amount = requested === 'max' ? state.resources[sell].floor() : D(requested);
  } catch {
    return none;
  }
  if (
    !Number.isFinite(amount.mantissa) ||
    !Number.isFinite(amount.exponent) ||
    Math.abs(amount.exponent) > 1e9 ||
    amount.lte(0) ||
    !amount.eq(amount.floor())
  )
    return none;
  if (amount.gt(state.resources[sell]))
    return { ...none, reason: 'Not enough resources to sell.' };
  const received = amount.mul(rate).floor();
  if (received.lt(1))
    return { ...none, reason: 'Sell more to receive at least one resource.' };
  return { sold: amount, received, rate, reason: null };
}
export function executeTrade(
  state: GameState,
  action: Extract<GameAction, { type: 'trade' }>,
) {
  const quote = tradeQuote(state, action.sell, action.buy, action.amount);
  if (quote.reason) return false;
  state.resources[action.sell] = state.resources[action.sell].sub(quote.sold);
  state.resources[action.buy] = state.resources[action.buy].add(quote.received);
  state.statistics.tradesCompleted = state.statistics.tradesCompleted.add(1);
  state.statistics.tradeValueExchanged =
    state.statistics.tradeValueExchanged.add(
      quote.sold.mul(balance.trade.resourceValues[action.sell]),
    );
  const stat = `${action.sell}TradedAway`;
  state.statistics[stat] = state.statistics[stat].add(quote.sold);
  // Imported goods are exchange receipts, not worker production.
  logEvent(
    state,
    message('Traded {sold} {source} for {received} {destination}.', {
      sold: formatNumber(quote.sold),
      source: resources.find((r) => r.id === action.sell)!.name,
      received: formatNumber(quote.received),
      destination: resources.find((r) => r.id === action.buy)!.name,
    }),
    'system',
    false,
  );
  return true;
}
