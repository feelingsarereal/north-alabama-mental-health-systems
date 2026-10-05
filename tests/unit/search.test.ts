import { describe, expect, it } from 'vitest';
import MiniSearch from 'minisearch';
import fs from 'node:fs';
import path from 'node:path';
import { MINISEARCH_OPTIONS, SEARCH_OPTIONS, tokenize, type SearchDoc } from '../../src/lib/search-config';
import { ROOT } from './helpers';

const mini = MiniSearch.loadJS<SearchDoc>(JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/search.json'), 'utf8')), MINISEARCH_OPTIONS);
const search = (q: string) => mini.search(q, SEARCH_OPTIONS) as unknown as (SearchDoc & { id: string })[];

describe('search index', () => {
  it('keeps numbers as written', () => {
    expect(tokenize('13,700 people; Census Tract 106.30; 589 commitments; Tract 9641')).toEqual(expect.arrayContaining(['13,700', '13700', '106.30', '106', '30', '589', '9641']));
  });
  it('"13,700" finds the block that prints it', () => {
    expect(search('13,700').some((h) => h.kind === 'block' && h.text.includes('13,700'))).toBe(true);
  });
  it('"Stepping Up" finds the report, the glossary and an open item', () => {
    const kinds = new Set(search('Stepping Up').map((h) => h.kind));
    for (const k of ['block', 'term', 'open-item']) expect(kinds.has(k as SearchDoc['kind'])).toBe(true);
  });
  it('"106.30" finds the tract, and so does its 11-digit id', () => {
    expect(search('106.30').some((h) => h.id === 'tract:01089010630')).toBe(true);
    expect(search('01089010630').some((h) => h.id === 'tract:01089010630')).toBe(true);
    expect(search('Census Tract 106.30').some((h) => h.id === 'tract:01089010630')).toBe(true);
  });
  it('finds a county, a service location, "589" and "9641"', () => {
    expect(search('Cullman').some((h) => h.kind === 'county')).toBe(true);
    expect(search('Memorial Parkway').some((h) => h.kind === 'location')).toBe(true);
    expect(search('589').length).toBeGreaterThan(0);
    expect(search('9641').some((h) => h.kind === 'tract')).toBe(true);
  });
});
