import { describe, expect, it } from 'vitest';
import { parseReview } from '../../scripts/lib/review';
import { block, realReview } from './helpers';

describe('review parser: sections, blocks, markers', () => {
  it('reads a trailing block comment and strips it from the rendered text', () => {
    const [b] = block('Alabama has 771 beds [30]. <!-- b: B0031 -->');
    expect(b.id).toBe('B0031');
    expect(b.kind).toBe('p');
    expect(b.text).toBe('Alabama has 771 beds [30].');
    expect(b.cites).toEqual([30]);
  });
  it('reads a marker that sits just before the block id', () => {
    const [b] = block('This is the report reading the evidence [12] <!-- synthesis --> <!-- b: B0084 -->');
    expect(b.marker).toBe('synthesis');
    expect(b.id).toBe('B0084');
    expect(b.text).not.toContain('<!--');
  });
  it('reads a block id on each list item', () => {
    const bs = block('- First item [3] <!-- b: B0100 -->\n- Second item [4] <!-- synthesis --> <!-- b: B0101 -->');
    expect(bs.map((b) => [b.id, b.kind, b.marker])).toEqual([['B0100', 'li', null], ['B0101', 'li', 'synthesis']]);
  });
  it('reads a list whose only id sits on its last item as one block (Appendix C)', () => {
    const bs = block('- **One.** First. <!-- framing -->\n- **Two.** Second. <!-- framing -->\n- **Three.** Third. <!-- framing --> <!-- b: B0280 -->');
    expect(bs).toHaveLength(1);
    expect(bs[0]).toMatchObject({ id: 'B0280', kind: 'list', marker: 'framing' });
    expect(bs[0].text).not.toContain('<!--');
  });
  it('treats a figure marker as a slot, not a block', () => {
    const r = parseReview('<!-- section: s -->\n# S\n\nText [1]. <!-- b: B0014 -->\n\n<!-- figure: fig-two-counties -->\n\nMore [2]. <!-- b: B0015 -->\n');
    expect(r.errors).toEqual([]);
    expect(r.blocks.map((b) => b.id)).toEqual(['B0014', 'B0015']);
    expect(r.figureMarkers).toEqual(['fig-two-counties']);
    expect(r.sections[0].chunks.map((c) => c.k)).toEqual(['b', 'fig', 'b']);
  });
  it('takes a table block id from the comment on the line above the table, with an optional marker', () => {
    const bs = block('<!-- b: B0098 --> <!-- framing -->\n\n|**A**|**B**|\n|---|---|\n|x [20]|y [18]|');
    expect(bs).toHaveLength(1);
    expect(bs[0]).toMatchObject({ id: 'B0098', kind: 'table', marker: 'framing' });
    expect(bs[0].cites).toEqual([20, 18]);
  });
  it('fails loudly on a block without an id and on a heading without a section marker', () => {
    const r = parseReview('<!-- section: s -->\n# S\n\nNo id here.\n\n## Orphan heading\n');
    expect(r.errors.join('\n')).toMatch(/block has no <!-- b: … --> id/);
    expect(r.errors.join('\n')).toMatch(/heading with no <!-- section: id -->/);
  });
  it('parses the real report: 126 sections, 283 blocks B0001–B0283, six figure slots, no uncited prose', () => {
    const r = realReview();
    expect(r.errors).toEqual([]);
    expect(r.sections).toHaveLength(126);
    expect(r.blocks).toHaveLength(283);
    expect(r.blocks.map((b) => b.id)).toEqual(Array.from({ length: 283 }, (_, i) => `B${String(i + 1).padStart(4, '0')}`));
    expect(r.figureMarkers).toHaveLength(6);
    expect(r.blocks.filter((b) => b.marker === 'synthesis')).toHaveLength(59);
    const uncited = r.blocks.filter((b) => b.kind !== 'table' && b.words >= 25 && !b.cites.length && b.marker !== 'framing');
    expect(uncited).toEqual([]);
  });
});
