/**
 * Search (KICKOFF §4g): one MiniSearch index built at content-build time and loaded in the browser with the same
 * options. Numbers are searchable as written: "13,700", "589", "9641" and "106.30" stay single tokens (and a
 * hyphenated or dotted token is also indexed by its parts). Prefix matching is on; fuzzy matching is on for words
 * and off for anything containing a digit, so "771" never fuzzily matches "71".
 */
import type { Options, SearchOptions } from 'minisearch';

export type DocKind = 'block' | 'reference' | 'term' | 'primer' | 'figure' | 'open-item' | 'layer' | 'county' | 'tract' | 'location' | 'node' | 'edge';

export interface SearchDoc {
  id: string;            // kind:key
  kind: DocKind;
  title: string;
  text: string;
  to: string;            // route the result opens
  section?: string;      // section title, for blocks
}

export const KIND_LABEL: Record<DocKind, string> = {
  block: 'In the report', reference: 'References', term: 'Glossary', primer: 'Primers', figure: 'Figures',
  'open-item': 'Open items', layer: 'Map layers', county: 'Counties', tract: 'Census tracts', location: 'Service locations', node: 'Systems graph: parts', edge: 'Systems graph: links',
};
export const KIND_ORDER: DocKind[] = ['block', 'term', 'reference', 'open-item', 'county', 'tract', 'location', 'layer', 'node', 'edge', 'primer', 'figure'];

export function tokenize(text: string): string[] {
  const out: string[] = [];
  const re = /[$]?[\p{L}\p{N}]+(?:[.,'’\-–/][\p{L}\p{N}]+)*%?/gu;
  for (const m of text.match(re) ?? []) {
    const t = m.replace(/^\$/, '').replace(/%$/, '');
    out.push(t);
    if (/[.,'’\-–/]/.test(t)) for (const part of t.split(/[.,'’\-–/]/)) if (part) out.push(part);
    if (/^\d{1,3}(,\d{3})+$/.test(t)) out.push(t.replace(/,/g, ''));
  }
  return out;
}

export const processTerm = (t: string) => t.toLowerCase().replace(/’/g, "'");

export const MINISEARCH_OPTIONS: Options<SearchDoc> = {
  idField: 'id',
  fields: ['title', 'text', 'section'],
  storeFields: ['kind', 'title', 'text', 'to', 'section'],
  tokenize,
  processTerm,
};

export const SEARCH_OPTIONS: SearchOptions = {
  prefix: (term: string) => term.length > 2,
  fuzzy: (term: string) => (/\d/.test(term) || term.length < 5 ? false : 0.2),
  boost: { title: 2 },
  combineWith: 'AND',
};
