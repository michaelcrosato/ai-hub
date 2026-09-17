/** format.js — the handful of display conversions the UI needs. */

export function bytes(n) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  const mb = n / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

const DATE = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export function date(iso) {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? DATE.format(ms) : '';
}

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
