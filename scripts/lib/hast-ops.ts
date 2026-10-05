/**
 * Range operations on a hast tree, used by the content build to wrap terms and claims around *rendered text*
 * offsets — so a term written `_Hunter_ consent decree` is matched as "Hunter consent decree" and wrapped with its
 * italics inside, and a claim's characters are wrapped without a character of the text changing.
 *
 * `x-cite` (a citation button whose text is "[n]") and `x-term` are atomic: a boundary that falls inside one snaps
 * outward rather than splitting it. Any other element is split into two clones at a boundary.
 */
import type { Element, ElementContent, Root, Text } from 'hast';

export type Parent = Root | Element;
export const ATOMIC = new Set(['x-cite', 'x-term']);

export function textOf(node: Root | ElementContent): string {
  if (node.type === 'text') return node.value;
  if (node.type === 'element' || node.type === 'root') return (node.children as ElementContent[]).map(textOf).join('');
  return '';
}

const len = (n: ElementContent) => textOf(n).length;
const isAtomic = (n: ElementContent) => n.type === 'element' && ATOMIC.has(n.tagName);

function clone(el: Element, children: ElementContent[]): Element {
  return { ...el, properties: { ...el.properties }, children };
}

/**
 * Make sure `parent.children` has a boundary at text offset `off` (splitting text nodes and cloning non-atomic
 * elements). Returns the offset actually achieved: `off`, or the edge of an atomic element it fell inside
 * (`dir` 'down' snaps to its start, 'up' to its end).
 */
export function boundaryAt(parent: Parent, off: number, dir: 'down' | 'up'): number {
  const ch = parent.children as ElementContent[];
  let pos = 0;
  for (let i = 0; i < ch.length; i++) {
    const c = ch[i];
    const L = len(c);
    if (off <= pos) return pos;
    if (off < pos + L) {
      if (c.type === 'text') {
        const k = off - pos;
        const a: Text = { type: 'text', value: c.value.slice(0, k) };
        const b: Text = { type: 'text', value: c.value.slice(k) };
        ch.splice(i, 1, a, b);
        return off;
      }
      if (c.type !== 'element' || isAtomic(c)) return dir === 'down' ? pos : pos + L;
      const inner = boundaryAt(c, off - pos, dir);
      if (inner <= 0) return pos;
      if (inner >= L) return pos + L;
      let acc = 0; let k = 0;
      while (k < c.children.length && acc < inner) { acc += len(c.children[k] as ElementContent); k++; }
      ch.splice(i, 1, clone(c, c.children.slice(0, k) as ElementContent[]), clone(c, c.children.slice(k) as ElementContent[]));
      return pos + inner;
    }
    pos += L;
  }
  return pos;
}

/**
 * Wrap the characters [start, end) of `parent`'s rendered text in a new element made by `make`. Descends into a
 * single non-atomic child that holds the whole range, so the wrapper sits as deep as possible. Returns the range
 * actually wrapped (after snapping around atomic elements), or null for an empty range.
 */
export function wrapRange(parent: Parent, start: number, end: number, make: (children: ElementContent[]) => Element): { start: number; end: number } | null {
  if (end <= start) return null;
  const ch = parent.children as ElementContent[];
  let pos = 0;
  for (const c of ch) {
    const L = len(c);
    if (c.type === 'element' && !isAtomic(c) && pos <= start && end <= pos + L && !(pos === start && end === pos + L && ch.length === 1)) {
      const r = wrapRange(c, start - pos, end - pos, make);
      return r ? { start: r.start + pos, end: r.end + pos } : null;
    }
    pos += L;
  }
  const s = boundaryAt(parent, start, 'down');
  const e = boundaryAt(parent, end, 'up');
  if (e <= s) return null;
  const kids = parent.children as ElementContent[];
  let p = 0; let i0 = -1; let i1 = -1;
  for (let i = 0; i < kids.length; i++) {
    if (p === s && i0 === -1) i0 = i;
    p += len(kids[i]);
    if (p === e) { i1 = i; break; }
  }
  if (i0 === -1 || i1 === -1 || i1 < i0) return null;
  const wrapped = make(kids.slice(i0, i1 + 1));
  kids.splice(i0, i1 - i0 + 1, wrapped);
  return { start: s, end: e };
}

/** Ranges [start, end) of the atomic elements under `parent`, in rendered-text offsets. */
export function atomicRanges(parent: Parent): { start: number; end: number; tag: string }[] {
  const out: { start: number; end: number; tag: string }[] = [];
  let pos = 0;
  const walk = (n: ElementContent) => {
    if (n.type === 'text') { pos += n.value.length; return; }
    if (n.type !== 'element') return;
    if (ATOMIC.has(n.tagName)) { const L = len(n); out.push({ start: pos, end: pos + L, tag: n.tagName }); pos += L; return; }
    for (const c of n.children as ElementContent[]) walk(c);
  };
  for (const c of parent.children as ElementContent[]) walk(c);
  return out;
}

/** Replace `[n]` tokens in text nodes with atomic `x-cite` elements. Returns the reference numbers found. */
export function linkCitations(parent: Parent): number[] {
  const found: number[] = [];
  const walk = (node: Parent) => {
    const next: ElementContent[] = [];
    for (const c of node.children as ElementContent[]) {
      if (c.type === 'text') {
        const re = /\[(\d+)\]/g;
        let last = 0; let m: RegExpExecArray | null;
        while ((m = re.exec(c.value))) {
          if (m.index > last) next.push({ type: 'text', value: c.value.slice(last, m.index) });
          const n = Number(m[1]);
          found.push(n);
          next.push({ type: 'element', tagName: 'x-cite', properties: { n }, children: [{ type: 'text', value: m[0] }] });
          last = m.index + m[0].length;
        }
        if (last < c.value.length) next.push(last === 0 ? c : { type: 'text', value: c.value.slice(last) });
      } else {
        if (c.type === 'element' && c.tagName !== 'a' && c.tagName !== 'code') walk(c);
        next.push(c);
      }
    }
    (node as Element).children = next;
  };
  walk(parent);
  return found;
}

// ------------------------------------------------------------------------------------------ compact JSON form
/** Compact node: a string, or [tag, props | 0, ...children]. What the reader renders. */
export type CNode = string | [string, Record<string, unknown> | 0, ...CNode[]];

const KEEP_PROPS: Record<string, string[]> = { ol: ['start'], td: ['align'], th: ['align'], 'x-cite': ['n'], 'x-term': ['id'], 'x-claim': ['id', 'g'], 'x-oi': ['id'], a: ['href'] };

export function compact(node: ElementContent): CNode | null {
  if (node.type === 'text') return node.value;
  if (node.type !== 'element') return null;
  const keep = KEEP_PROPS[node.tagName] ?? [];
  const props: Record<string, unknown> = {};
  for (const k of keep) if (node.properties?.[k] !== undefined && node.properties[k] !== null) props[k] = node.properties[k];
  const kids = (node.children as ElementContent[]).map(compact).filter((x): x is CNode => x !== null && x !== '');
  // merge adjacent strings
  const merged: CNode[] = [];
  for (const k of kids) { if (typeof k === 'string' && typeof merged[merged.length - 1] === 'string') merged[merged.length - 1] += k; else merged.push(k); }
  return [node.tagName, Object.keys(props).length ? props : 0, ...merged];
}

export function compactChildren(parent: Parent): CNode[] {
  const out: CNode[] = [];
  for (const c of parent.children as ElementContent[]) {
    const k = compact(c);
    if (k === null || k === '') continue;
    if (typeof k === 'string' && typeof out[out.length - 1] === 'string') out[out.length - 1] += k; else out.push(k);
  }
  return out;
}
