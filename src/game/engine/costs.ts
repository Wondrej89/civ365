import type { Amount, GameState, ResourceCost } from '../types';
import { D } from '../utils/numbers';

/** The same geometric bill is used for bulk quotes and payment. */
export function geometricCosts(
  costs: ResourceCost[],
  growth: number,
  offset: Amount,
  quantity: Amount = 1,
): ResourceCost[] {
  const n = D(quantity);
  const factor = D(growth)
    .pow(D(offset))
    .mul(
      n.eq(1)
        ? 1
        : growth === 1
          ? n
          : D(growth)
              .pow(n)
              .sub(1)
              .div(growth - 1),
    );
  return costs.map((c) => ({
    resource: c.resource,
    amount: D(c.amount).mul(factor),
  }));
}
export function affordableQuantity(
  state: GameState,
  costs: ResourceCost[],
  growth: number,
  offset: Amount,
  limit: Amount,
) {
  let maximum = D(limit).floor().max(0);
  for (const c of geometricCosts(costs, growth, offset)) {
    if (D(c.amount).lte(0)) continue;
    const budget = state.resources[c.resource].div(c.amount);
    const count =
      growth === 1
        ? budget.floor()
        : D(
            Math.floor(
              budget
                .mul(growth - 1)
                .add(1)
                .log10() / Math.log10(growth),
            ),
          );
    maximum = maximum.min(count);
  }
  // Correct floating-point rounding at a purchase boundary without iterating over units.
  const fits = (n: ReturnType<typeof D>) =>
    geometricCosts(costs, growth, offset, n).every((c) =>
      state.resources[c.resource].gte(c.amount),
    );
  for (let i = 0; i < 2 && maximum.gt(0) && !fits(maximum); i++)
    maximum = maximum.sub(1);
  for (
    let i = 0;
    i < 2 && maximum.add(1).lte(limit) && fits(maximum.add(1));
    i++
  )
    maximum = maximum.add(1);
  return maximum.max(0);
}
export function wholeQuantity(amount: Amount | 'max', maximum: Amount) {
  try {
    const n = amount === 'max' ? D(maximum) : D(amount);
    return Number.isFinite(n.mantissa) &&
      Number.isFinite(n.exponent) &&
      n.gt(0) &&
      n.eq(n.floor()) &&
      n.lte(maximum)
      ? n
      : null;
  } catch {
    return null;
  }
}
