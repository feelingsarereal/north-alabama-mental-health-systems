import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';
import { locate, norm } from '../../src/lib/anchor';
import { findAnchor, wrapClaim, statusGroup } from '../../scripts/lib/claims';
import { compactChildren, textOf } from '../../scripts/lib/hast-ops';
import { block, readPack, realReview } from './helpers';

describe('claim anchorer', () => {
  it('is emphasis-insensitive', () => {
    expect(norm('**771 involuntary** _beds_')).toBe('771 involuntary beds');
    const [b] = block('Alabama counts **771 involuntary (civil-commitment) beds** in January [30]. <!-- b: B0031 -->');
    const a = findAnchor(b.el, b.kind, '771 involuntary (civil-commitment) beds');
    expect(a.ok).toBe(true);
  });
  it('matches quotes containing [n] tokens exactly as the block writes them', () => {
    const [b] = block('Six crisis centers now operate [12] [9] [13]; the first opened in 2021 [14]. <!-- b: B0028 -->');
    expect(locate(b.text, 'Six crisis centers now operate [12] [9] [13]')).toHaveLength(1);
    const a = findAnchor(b.el, b.kind, 'Six crisis centers now operate [12] [9] [13]');
    expect(a.ok).toBe(true);
    if (a.ok) { wrapClaim(a.targets, 'B0028.a', 'verified'); expect(textOf(b.el)).toBe(b.text); }
  });
  it('anchors table fragments joined with " | " (and the bare "|" row form) in the one row holding them all', () => {
    const [t] = block('<!-- b: B0098 -->\n\n|**Line**|**FY2026**|**FY2027**|\n|---|---|---|\n|988 call centers|$500,000 [20]|$0 [18]|\n|CIT training|$1.0 million [20]|$1.0 million [18]|');
    const a = findAnchor(t.el, 'table', '988 call centers | $500,000 [20] | $0 [18]');
    expect(a.ok).toBe(true);
    const b = findAnchor(t.el, 'table', 'CIT training|$1.0 million [20]|$1.0 million [18]');
    expect(b.ok).toBe(true);
    const c = findAnchor(t.el, 'table', '988 call centers | $1.0 million [20]');
    expect(c.ok).toBe(false);
  });
  it('fails, never re-points, when a quote is missing or ambiguous', () => {
    const [b] = block('One beds. Two beds. <!-- b: B0001 -->');
    expect(findAnchor(b.el, b.kind, 'beds').ok).toBe(false);
    expect(findAnchor(b.el, b.kind, 'Three beds').ok).toBe(false);
  });
  it('wraps a claim without changing a character of the text', () => {
    const [b] = block('The FY2027 budget, as _reported_, withholds the last two installments [17] [18]. <!-- b: B0028 -->');
    const before = b.text;
    const a = findAnchor(b.el, b.kind, 'as reported, withholds the last two installments [17]');
    expect(a.ok).toBe(true);
    if (a.ok) wrapClaim(a.targets, 'B0028.x', statusGroup('absence')!);
    expect(textOf(b.el)).toBe(before);
    expect(JSON.stringify(compactChildren(b.el))).toContain('"x-claim",{"id":"B0028.x","g":"notfound"}');
  });
  it('maps the four statuses to the three groups', () => {
    expect(['verified', 'analysis', 'self', 'absence'].map(statusGroup)).toEqual(['verified', 'own', 'own', 'notfound']);
  });
});

describe('the real pack', () => {
  it('anchors every ledger entry exactly once (1,497 of 1,497)', () => {
    const r = realReview();
    const byId = new Map(r.blocks.map((b) => [b.id, b]));
    const ledger = yaml.load(readPack('claims-ledger.yaml')) as { id: string; block: string; status: string; quote: string; anchor_ok: boolean }[];
    const failures: string[] = [];
    let ok = 0;
    for (const l of ledger) {
      const b = byId.get(l.block);
      const a = b ? findAnchor(b.el, b.kind, l.quote) : { ok: false as const, reason: 'unknown block' };
      if (a.ok) ok++; else failures.push(l.id);
    }
    expect(failures).toEqual([]);
    expect(ok).toBe(1497);
    expect(ledger).toHaveLength(1497);
  });
});
