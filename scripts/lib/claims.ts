/**
 * The claim layer (KICKOFF §4b): resolve each anchored ledger entry to character offsets in its block's rendered
 * text and wrap those characters in an `x-claim` element. Zero or multiple matches is a content-build error — never
 * re-pointed at a similar sentence.
 *
 * Tables: a quote containing " | " lists fragments of one table row. Each fragment must be found in that table; the
 * entry anchors on the first fragment, in the one row whose cells hold every fragment. A plain quote inside a table
 * must sit inside exactly one cell (cells are matched separately so a match never runs across a cell boundary).
 */
import type { Element, ElementContent } from 'hast';
import { locate, tableFragments, type TextRange } from '../../src/lib/anchor';
import { textOf, wrapRange } from './hast-ops';

/** KICKOFF §4b's three status groups: verified · the report's own (analysis, self) · not found (absence). */
export type StatusGroup = 'verified' | 'own' | 'notfound';

export function statusGroup(status: string): StatusGroup | null {
  switch (status) {
    case 'verified': return 'verified';
    case 'analysis': case 'self': return 'own';
    case 'absence': return 'notfound';
    default: return null;
  }
}

export interface AnchorTarget { container: Element; range: TextRange }
export type AnchorResult = { ok: true; targets: AnchorTarget[] } | { ok: false; reason: string };

function elements(el: Element, tag: string): Element[] {
  const out: Element[] = [];
  const walk = (n: ElementContent) => {
    if (n.type !== 'element') return;
    if (n.tagName === tag) out.push(n);
    for (const c of n.children as ElementContent[]) walk(c);
  };
  for (const c of el.children as ElementContent[]) walk(c);
  return out;
}

/** A list item's quote may carry the markdown list marker ("1. ", "- ") that the rendered item does not show. */
export function stripListMarker(q: string): string {
  return q.replace(/^\s*(?:\d+\.|[-*+])\s+/, '');
}

/**
 * Where a quote anchors in a block (not yet wrapped). Beyond KICKOFF §4b, the pack also writes table-row quotes
 * with a bare "|" (the markdown row form), and uses " | " in a few paragraph quotes to list discontinuous fragments
 * of one sentence; in a paragraph each fragment must match exactly once and each is wrapped.
 */
export function findAnchor(block: Element, kind: 'p' | 'li' | 'table' | 'list', quote: string): AnchorResult {
  if (kind !== 'table') {
    const q = kind === 'li' ? stripListMarker(quote) : quote;
    const frags = tableFragments(q) ?? [q];
    const targets: AnchorTarget[] = [];
    for (const f of frags) {
      const hits = locate(textOf(block), kind === 'li' ? stripListMarker(f) : f);
      if (hits.length !== 1) return { ok: false, reason: `${frags.length > 1 ? `fragment "${f.slice(0, 50)}"` : 'quote'} matches ${hits.length} times in its block` };
      targets.push({ container: block, range: hits[0] });
    }
    return { ok: true, targets };
  }
  const rows = elements(block, 'tr');
  const cellsOf = (tr: Element) => (tr.children as ElementContent[]).filter((c): c is Element => c.type === 'element' && (c.tagName === 'td' || c.tagName === 'th'));
  const frags = quote.includes('|') ? quote.split(/\s*\|\s*/).map((f) => f.trim()).filter(Boolean) : null;
  if (!frags) {
    const hits: AnchorTarget[] = [];
    for (const tr of rows) for (const cell of cellsOf(tr)) for (const r of locate(textOf(cell), quote)) hits.push({ container: cell, range: r });
    if (hits.length !== 1) return { ok: false, reason: `quote matches ${hits.length} times in the table's cells` };
    return { ok: true, targets: hits };
  }
  for (const f of frags) {
    if (!rows.some((tr) => cellsOf(tr).some((c) => locate(textOf(c), f).length))) return { ok: false, reason: `table fragment not found in the table: "${f.slice(0, 60)}"` };
  }
  const candidates = rows.filter((tr) => frags.every((f) => cellsOf(tr).some((c) => locate(textOf(c), f).length)));
  if (candidates.length !== 1) return { ok: false, reason: `table fragments fit ${candidates.length} rows` };
  const cell = cellsOf(candidates[0]).find((c) => locate(textOf(c), frags[0]).length)!;
  return { ok: true, targets: [{ container: cell, range: locate(textOf(cell), frags[0])[0] }] };
}

export function wrapClaim(targets: AnchorTarget[], id: string, group: StatusGroup): boolean {
  let ok = true;
  for (const t of targets) {
    const r = wrapRange(t.container, t.range.start, t.range.end, (children) => ({ type: 'element', tagName: 'x-claim', properties: { id, g: group }, children }));
    ok = ok && !!r;
  }
  return ok;
}
