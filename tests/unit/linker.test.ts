import { describe, expect, it } from 'vitest';
import type { Element } from 'hast';
import { buildMatcher, findTerms } from '../../scripts/lib/terms';
import { linkTerms } from '../../scripts/lib/link-terms';
import { compactChildren } from '../../scripts/lib/hast-ops';
import { block } from './helpers';

const terms = [
  { id: 'hunter-consent-decree', term: 'Hunter v. Boswell (the Hunter consent decree)', variants: ['Hunter consent decree', 'Hunter decree', 'Hunter v. Boswell'] },
  { id: 'consent', term: 'Consent', variants: ['consent'] },
  { id: 'act', term: 'Assertive Community Treatment (ACT)', variants: ['ACT'] },
  { id: 'braggs', term: 'Braggs v. Commissioner', variants: ['Braggs'] },
];
const m = buildMatcher(terms);

describe('term matcher', () => {
  it('prefers the longest of nested variants', () => {
    expect(findTerms('under the Hunter consent decree today', m).map((t) => t.id)).toEqual(['hunter-consent-decree']);
    expect(findTerms('the Hunter decree', m).map((t) => t.id)).toEqual(['hunter-consent-decree']);
  });
  it('matches capitals-only variants case-sensitively', () => {
    expect(findTerms('an ACT team', m).map((t) => t.id)).toEqual(['act']);
    expect(findTerms('an act of the legislature', m)).toEqual([]);
  });
  it('links an italic case name on rendered text, with the italics inside the term', () => {
    const [b] = block('The _Hunter_ consent decree governs waits [11]. <!-- b: B0001 -->');
    const seen = new Set<string>();
    linkTerms(b.el, m, seen);
    const out = JSON.stringify(compactChildren(b.el as Element));
    expect(out).toContain('["x-term",{"id":"hunter-consent-decree"},["em",0,"Hunter"]," consent decree"]');
    expect(b.el && JSON.stringify(b.el)).not.toContain('"consent"}'); // the shorter term inside is not linked separately
  });
  it('links the first occurrence per section only, and never inside a citation', () => {
    const [b1, b2] = block('_Braggs_ and Braggs again [11]. <!-- b: B0001 -->\n\nBraggs once more. <!-- b: B0002 -->');
    const seen = new Set<string>();
    linkTerms(b1.el, m, seen); linkTerms(b2.el, m, seen);
    const s1 = JSON.stringify(compactChildren(b1.el)); const s2 = JSON.stringify(compactChildren(b2.el));
    expect(s1.match(/x-term/g)).toHaveLength(1);
    expect(s2).not.toContain('x-term');
  });
  it('skips the table header row', () => {
    const [t] = block('<!-- b: B0010 -->\n\n|Braggs|Note|\n|---|---|\n|Braggs [11]|x|');
    linkTerms(t.el, m, new Set());
    const s = JSON.stringify(compactChildren(t.el));
    expect(s).toContain('["th",0,"Braggs"]');
    expect(s).toContain('["td",0,["x-term",{"id":"braggs"},"Braggs"]');
  });
});
