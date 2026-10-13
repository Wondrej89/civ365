import { describe, expect, it } from 'vitest';
import { formatNumber } from '../utils/numbers';

describe('compact numbers keep their magnitude at zero precision', () => {
  it.each([
    [10_000, '10k'],
    [11_000, '11k'],
    [40_000, '40k'],
    [41_000, '41k'],
    [100_000, '100k'],
    [400_000, '400k'],
    [10_000_000, '10M'],
    [40_000_000_000, '40B'],
    [-40_000, '-40k'],
    ['9.99e24', '10e24'],
  ] as const)(
    'formats %s as %s with integer precision in either locale',
    (amount, expected) => {
      expect(formatNumber(amount, 0, 'en')).toBe(expected);
      expect(formatNumber(amount, 0, 'cs')).toBe(expected);
    },
  );
  it('only trims fractional zeros and preserves decimal separators, rounding and small-number grouping', () => {
    expect(formatNumber(40_000, 2)).toBe('40k');
    expect(formatNumber(41_250, 2)).toBe('41.25k');
    expect(formatNumber(41_250, 2, 'cs')).toBe('41,25k');
    expect(formatNumber(40_100, 2)).toBe('40.1k');
    expect(formatNumber(39_999, 0)).toBe('40k');
    expect(formatNumber(2000, 0)).toBe('2 000');
    expect(formatNumber(0, 0)).toBe('0');
    expect(formatNumber('1e24', 2)).toBe('1e24');
  });
});
