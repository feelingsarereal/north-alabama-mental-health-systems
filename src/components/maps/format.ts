/** Value formatting for the maps: published values as written, with their unit; empty cells never as zero. */
import type { LayerT } from '@/types';

export const MISSING = 'not published or suppressed';
export const NO_MOE = 'no margin of error published';

export const isPercent = (l: Pick<LayerT, 'unit'>) => /^(percent|%)/.test(l.unit);
export const isDollar = (l: Pick<LayerT, 'unit'>) => /^(dollars|\$)/.test(l.unit);

export function fmtNumber(raw: string, dec?: number): string {
  const n = Number(String(raw).replace(/,/g, ''));
  if (!Number.isFinite(n)) return raw;
  const d = dec ?? (String(raw).split('.')[1] ?? '').length;
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

/** A value with its symbol ("17.8%", "$53,557", "6,437"); categorical values with spaces for underscores. */
export function fmtValue(raw: string | undefined, l: LayerT): string {
  if (raw === undefined || raw === '') return MISSING;
  if (l.type === 'categorical') return raw.replace(/_/g, ' ');
  const s = fmtNumber(raw);
  if (isPercent(l)) return `${s}%`;
  if (isDollar(l)) return `$${s}`;
  return s;
}

/** A margin of error in the value's own terms: "6.5" for a percentage (points), "$10,800", "695". */
export function fmtMoe(raw: string, l: LayerT): string {
  const s = fmtNumber(raw);
  return isDollar(l) ? `$${s}` : s;
}

export function fmtNum(n: number, l: LayerT, dec: number): string {
  const s = n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  if (isPercent(l)) return `${s}%`;
  if (isDollar(l)) return `$${s}`;
  return s;
}

/** The unit in words, where the formatted value does not already carry it ("of households", "deaths per 100,000"). */
export function unitWords(l: LayerT): string {
  if (l.type !== 'numeric') return '';
  if (isPercent(l)) return l.unit.replace(/^(percent|%)\s*/, '');
  if (isDollar(l)) return l.unit.replace(/^(dollars|\$)\s*/, '');
  return l.unit;
}

export function fmtBreak(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/** The sentence(s) of a layer's caveats that name this area. */
export function caveatFor(l: LayerT, name: string): string {
  const sentences = l.caveats.split(/(?<=\.)\s+(?=[A-Z])/);
  return sentences.filter((s) => s.includes(name)).join(' ');
}

export function higherLine(l: LayerT): string {
  if (l.type !== 'numeric') return '';
  return l.higher_is === 'worse' ? 'Higher is worse' : l.higher_is === 'better' ? 'Higher is better' : '';
}

export function retrievalWords(l: LayerT): string {
  const d = new Date(`${l.retrieved}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  if (l.retrieval === 'browser-js') return `retrieved in a browser from the publisher's own data service on ${d}, and checked against the publisher's values`;
  return `retrieved (${l.retrieval}) on ${d}`;
}

/** One sequential ramp built from the brand orange (KICKOFF §4d): never diverging, never flipped by higher_is. */
export const RAMP = ['#fde9db', '#f8c39b', '#f09a5e', '#d4692a', '#8f4212'];
export const CAT_COLORS = ['#a84f17', '#3f6f8f', '#2e7d5b', '#b38600', '#7a4a8f', '#7a8791', '#c2185b'];
export const CENTER_COLORS = ['#3f6f8f', '#2e7d5b', '#7a4a8f', '#b38600', '#c2185b'];

export const FAMILY_LABEL: Record<string, string> = {
  survey: 'Survey estimates (American Community Survey, 2020–2024)',
  modeled: 'Modeled estimates (CDC PLACES, 2025 release)',
  county: 'County data',
};
