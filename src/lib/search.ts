import MiniSearch, { type SearchResult } from 'minisearch';
import { MINISEARCH_OPTIONS, SEARCH_OPTIONS, KIND_ORDER, type DocKind, type SearchDoc } from '@/lib/search-config';

let index: Promise<MiniSearch<SearchDoc>> | null = null;
export function loadIndex(): Promise<MiniSearch<SearchDoc>> {
  return (index ??= import('@/data/search.json').then((m) => MiniSearch.loadJS<SearchDoc>(m.default as never, MINISEARCH_OPTIONS)));
}

export type Hit = SearchResult & SearchDoc;

export function runSearch(mini: MiniSearch<SearchDoc>, q: string): Hit[] {
  if (!q.trim()) return [];
  let res = mini.search(q, SEARCH_OPTIONS) as Hit[];
  if (!res.length) res = mini.search(q, { ...SEARCH_OPTIONS, combineWith: 'OR' }) as Hit[];
  return res;
}

export function grouped(hits: Hit[]): { kind: DocKind; hits: Hit[] }[] {
  return KIND_ORDER.map((k) => ({ kind: k, hits: hits.filter((h) => h.kind === k) })).filter((g) => g.hits.length);
}

/** A window of the text around the first matched term, split into plain and highlighted runs. */
export function snippet(text: string, terms: string[], width = 220): { t: string; hl: boolean }[] {
  const lower = text.toLowerCase();
  const ts = [...new Set(terms.map((t) => t.toLowerCase()))].filter(Boolean).sort((a, b) => b.length - a.length);
  let first = -1;
  for (const t of ts) { const i = lower.indexOf(t); if (i >= 0 && (first < 0 || i < first)) first = i; }
  const start = Math.max(0, first - 70);
  const slice = (start > 0 ? '…' : '') + text.slice(start, start + width) + (start + width < text.length ? '…' : '');
  if (!ts.length) return [{ t: slice, hl: false }];
  const re = new RegExp(`(${ts.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return slice.split(re).filter(Boolean).map((p) => ({ t: p, hl: ts.includes(p.toLowerCase()) }));
}
