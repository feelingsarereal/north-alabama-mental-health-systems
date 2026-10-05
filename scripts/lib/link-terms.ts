/**
 * Term linking over a block's hast (KICKOFF §3.3): first occurrence per section (a shared `seen` set), longest match
 * first, on rendered text so italic case names match; skips headings, the table header row, links, code, citation
 * buttons and terms already linked. Each match is wrapped in an atomic `x-term` element.
 */
import type { Element } from 'hast';
import { atomicRanges, textOf, wrapRange } from './hast-ops';
import { findTerms, type Matcher } from './terms';

const BLOCKISH = new Set(['p', 'ul', 'ol', 'table', 'thead', 'tbody', 'tr', 'li', 'td', 'th', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

/** The elements whose text is matched as one run: paragraphs, list items without block children, table body cells. */
export function textContainers(el: Element): Element[] {
  const out: Element[] = [];
  const walk = (n: Element) => {
    if (/^h[1-6]$/.test(n.tagName) || n.tagName === 'th' || n.tagName === 'thead' || n.tagName === 'a' || n.tagName === 'code') return;
    const kids = n.children.filter((c): c is Element => c.type === 'element');
    const hasBlockKid = kids.some((k) => BLOCKISH.has(k.tagName));
    if (!hasBlockKid && ['p', 'li', 'td'].includes(n.tagName)) { out.push(n); return; }
    for (const k of kids) walk(k);
  };
  walk(el);
  return out;
}

/** Link terms in `el`; `onMatch(id, linked)` is called for every whole-word occurrence. Returns ids newly linked. */
export function linkTerms(el: Element, m: Matcher, seen: Set<string>, every = false, onMatch?: (id: string, linked: boolean) => void): string[] {
  const linked: string[] = [];
  for (const c of textContainers(el)) {
    const text = textOf(c);
    const atoms = atomicRanges(c);
    for (const t of findTerms(text, m)) {
      if (atoms.some((a) => a.start < t.end && t.start < a.end)) continue;
      if (seen.has(t.id) && !every) { onMatch?.(t.id, false); continue; }
      const r = wrapRange(c, t.start, t.end, (children) => ({ type: 'element', tagName: 'x-term', properties: { id: t.id }, children }));
      if (!r) { onMatch?.(t.id, false); continue; }
      if (!seen.has(t.id)) linked.push(t.id);
      seen.add(t.id);
      onMatch?.(t.id, true);
    }
  }
  return linked;
}
