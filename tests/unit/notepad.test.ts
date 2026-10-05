import { describe, expect, it } from 'vitest';
import { emptyNotepad, fromMarkdown, groupBySection, normalise, reducer, resolveAnchor, toMarkdown, type AnchorIndex } from '../../src/lib/notepad';

const idx: AnchorIndex = {
  sections: [{ id: 'front', title: 'About this report', number: null }, { id: 'd3', title: 'Domain 3', number: null }],
  blocks: new Map([['B0141', { section: 'd3' }], ['B0001', { section: 'front' }]]),
  terms: new Map([['988', { term: '988', sections: ['d3'] }]]),
  refs: new Map([[30, { citation: 'ADMH', sections: ['d3'] }]]),
  figures: new Map(), openItems: new Map([['OI-010', { what: 'x', sections: ['d3'] }]]),
  layers: new Map([['county:pct_poverty', 'Persons in poverty'], ['tract:pct_poverty', 'People below the poverty level']]),
  areas: new Map([['region:01089', 'Madison County'], ['tracts:01089010630', 'Census Tract 106.30, Madison County']]),
  locations: new Map([['wes', { name: 'WellStone Emergency Services' }]]),
  nodes: new Map([['d3', { title: 'Domain 3', section: 'd3' }]]), units: new Map(),
};
const t = () => '2026-10-04T00:00:00.000Z';

describe('notepad reducer', () => {
  it('adds, updates, removes and merges', () => {
    let s = reducer(emptyNotepad(), { type: 'add', note: { id: 'a', anchor: { type: 'block', id: 'B0141' }, body: 'one' } }, t);
    s = reducer(s, { type: 'update', id: 'a', body: 'one, edited' }, t);
    expect(s.notes[0].body).toBe('one, edited');
    s = reducer(s, { type: 'merge', notes: [{ id: 'b', anchor: { type: 'free', id: '' }, body: 'two', created: t(), updated: t() }] }, t);
    expect(s.notes).toHaveLength(2);
    s = reducer(s, { type: 'remove', id: 'a' }, t);
    expect(s.notes.map((n) => n.id)).toEqual(['b']);
  });
  it('resolves this app\'s anchors and keeps orphans', () => {
    expect(resolveAnchor({ type: 'block', id: 'B0141' }, idx)).toMatchObject({ ok: true, section: 'd3', to: '/read#b-B0141' });
    expect(resolveAnchor({ type: 'map', id: 'region:pct_poverty:01089' }, idx)).toMatchObject({ ok: true, to: '/map/region?layer=pct_poverty&geo=01089' });
    expect(resolveAnchor({ type: 'map', id: 'tracts:pct_poverty:01089010630' }, idx)).toMatchObject({ ok: true, to: '/map/tracts?layer=pct_poverty&geo=01089010630' });
    expect(resolveAnchor({ type: 'map', id: 'tracts:pct_poverty:01089999999' }, idx).ok).toBe(false);
    expect(resolveAnchor({ type: 'location', id: 'wes' }, idx).ok).toBe(true);
    expect(resolveAnchor({ type: 'open-item', id: 'OI-010' }, idx).ok).toBe(true);
    expect(resolveAnchor({ type: 'block', id: 'B9999' }, idx).ok).toBe(false);
  });
  it('exports Markdown in reading order and imports it back', () => {
    let s = emptyNotepad();
    s = reducer(s, { type: 'add', note: { id: 'n2', anchor: { type: 'block', id: 'B0141' }, quote: '771 beds', body: 'check this' } }, t);
    s = reducer(s, { type: 'add', note: { id: 'n1', anchor: { type: 'block', id: 'B0001' }, body: 'agree' } }, t);
    const md = toMarkdown(s, idx, { title: 'Report', slug: 'x', date: '2026-10-04' });
    expect(md.indexOf('## About this report')).toBeLessThan(md.indexOf('## Domain 3'));
    expect(md).toContain('> 771 beds');
    const back = fromMarkdown(md);
    expect(back.map((n) => n.id).sort()).toEqual(['n1', 'n2']);
    expect(groupBySection(normalise({ version: 2, notes: back }), idx).map((g) => g.key)).toEqual(['front', 'd3']);
  });
});
