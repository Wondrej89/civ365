import Decimal from 'break_infinity.js';
import type { Amount } from '../types';
import type { Language } from '../../i18n/types';
import { translate } from '../../i18n/core';
export const D = (value: Amount = 0) => new Decimal(value);
export const sum = (values: Decimal[]) =>
  values.reduce((total, value) => total.add(value), D());

const suffixes = ['', 'k', 'M', 'B', 'T', 'Qa', 'Qi'];
export function formatNumber(
  value: Amount,
  digits = 2,
  language: Language = 'en',
): string {
  const n = D(value);
  if (!Number.isFinite(n.mantissa) || !Number.isFinite(n.exponent)) return '—';
  if (n.eq(0)) return '0';
  if (n.abs().lt(10_000))
    return n
      .toNumber()
      .toLocaleString(language === 'cs' ? 'cs-CZ' : 'en-US', {
        maximumFractionDigits: digits,
      })
      .replaceAll(language === 'cs' ? '\u00a0' : ',', ' ');
  const group = Math.floor(n.exponent / 3);
  if (group < suffixes.length && group >= 0)
    return `${n
      .div(D(10).pow(group * 3))
      .toNumber()
      .toFixed(digits)
      .replace(/\.?0+$/, '')
      .replace('.', language === 'cs' ? ',' : '.')}${suffixes[group]}`;
  return `${n.mantissa
    .toFixed(digits)
    .replace(/\.?0+$/, '')
    .replace('.', language === 'cs' ? ',' : '.')}e${n.exponent}`;
}
export function formatDuration(
  seconds: number,
  language: Language = 'en',
): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600),
    m = Math.floor((total % 3600) / 60),
    s = total % 60;
  return h
    ? translate(language, '{hours}h {minutes}m', { hours: h, minutes: m })
    : m
      ? translate(language, '{minutes}m {seconds}s', { minutes: m, seconds: s })
      : translate(language, '{seconds}s', { seconds: s });
}
