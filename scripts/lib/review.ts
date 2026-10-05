/**
 * review.md parser (KICKOFF §3.2): `<!-- section: id -->` before every heading; `<!-- figure: id -->` slots;
 * block ids — a trailing `<!-- b: B0123 -->` on every paragraph and list item (markers, when present, sit just
 * before it: `… [12] <!-- synthesis --> <!-- b: B0084 -->`) and, for a table, a comment on the line above it as
 * its own block. Each block becomes a hast tree with `[n]` turned into atomic `x-cite` elements; the comments are
 * stripped from the rendered text and the id is kept as the block's anchor.
 *
 * The parse runs on the mdast of the whole file (remark-parse + remark-gfm), so the rendered text that terms and
 * claims are matched against is exactly what the reader shows.
 */
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { toHast } from 'mdast-util-to-hast';
import type { Root as MRoot, RootContent, Paragraph, List, ListItem, Table, Html, PhrasingContent, Parent as MParent } from 'mdast';
import type { Element, Root as HRoot } from 'hast';
import { linkCitations, textOf } from './hast-ops';
import { BLOCK_ID } from './schemas';

export type Marker = 'framing' | 'synthesis' | null;

export interface Block {
  id: string;
  kind: 'p' | 'li' | 'table' | 'list';
  marker: Marker;
  section: string;
  el: Element;          // hast element (p | li | table), citations already linked
  text: string;         // rendered text
  words: number;        // alphabetic words, for the citation-coverage gate
  cites: number[];
}

export type Chunk =
  | { k: 'b'; b: Block }
  | { k: 'list'; ordered: boolean; start: number | null; items: Block[] }
  | { k: 'fig'; id: string };

export interface Section { id: string; title: string; depth: number; chunks: Chunk[] }

export interface ParsedReview { sections: Section[]; blocks: Block[]; errors: string[]; figureMarkers: string[] }

const parser = unified().use(remarkParse).use(remarkGfm);

export function parseMarkdown(md: string): MRoot {
  return parser.runSync(parser.parse(md)) as MRoot;
}

/** Alphabetic words, comments stripped (mirrors tools/validate_pack.py's gate count). */
export function claimWords(text: string): number {
  return (text.replace(/<!--[\s\S]*?-->/g, '').match(/[A-Za-z][A-Za-z'’-]+/g) ?? []).length;
}

const COMMENT_RE = /<!--\s*([\s\S]*?)\s*-->/g;

interface Comments { id: string | null; marker: Marker; section: string | null; figure: string | null; unknown: string[] }

export function readComments(html: string): Comments {
  const out: Comments = { id: null, marker: null, section: null, figure: null, unknown: [] };
  const rest = html.replace(COMMENT_RE, (_all, inner: string) => {
    const s = inner.trim();
    let m: RegExpExecArray | null;
    if ((m = /^b:\s*(\S+)$/.exec(s))) out.id = m[1];
    else if (s === 'framing' || s === 'synthesis') out.marker = s;
    else if ((m = /^section:\s*([a-z0-9-]+)$/.exec(s))) out.section = m[1];
    else if ((m = /^figure:\s*([a-z0-9-]+)$/.exec(s))) out.figure = m[1];
    else out.unknown.push(s);
    return '';
  });
  if (rest.trim()) out.unknown.push(rest.trim());
  return out;
}

/** Remove inline html comment nodes from a paragraph (recursively), returning what they said. */
function stripInline(node: MParent): Comments {
  const acc: Comments = { id: null, marker: null, section: null, figure: null, unknown: [] };
  const walk = (p: MParent) => {
    const kids = p.children as PhrasingContent[];
    for (let i = kids.length - 1; i >= 0; i--) {
      const c = kids[i];
      if (c.type === 'html') {
        const r = readComments((c as Html).value);
        if (r.id) acc.id = acc.id ?? r.id;
        if (r.marker) acc.marker = r.marker;
        acc.unknown.push(...r.unknown);
        kids.splice(i, 1);
      } else if ('children' in c) walk(c as MParent);
    }
    // trim the whitespace the comments leave behind
    const last = kids[kids.length - 1];
    if (last && last.type === 'text') { last.value = last.value.replace(/\s+$/, ''); if (!last.value) kids.pop(); }
  };
  walk(node);
  return acc;
}

function toEl(node: Paragraph | ListItem | Table | List): Element {
  const h = toHast(node as never) as unknown as Element | HRoot;
  if (h.type === 'root') {
    const el = h.children.find((c) => c.type === 'element') as Element | undefined;
    if (!el) throw new Error('empty hast');
    return el;
  }
  return h;
}

function makeBlock(id: string, kind: Block['kind'], marker: Marker, section: string, el: Element): Block {
  const cites = linkCitations(el);
  const text = textOf(el);
  return { id, kind, marker, section, el, text, words: claimWords(text), cites };
}

export function parseReview(md: string): ParsedReview {
  const tree = parseMarkdown(md);
  const sections: Section[] = [];
  const blocks: Block[] = [];
  const errors: string[] = [];
  const figureMarkers: string[] = [];
  let cur: Section | null = null;
  let pendingSection: string | null = null;
  let pendingTable: { id: string; marker: Marker } | null = null;
  const where = (n: RootContent) => `review.md:${n.position?.start.line ?? '?'}`;
  const checkId = (id: string | null, n: RootContent): id is string => {
    if (!id) { errors.push(`${where(n)}: block has no <!-- b: … --> id`); return false; }
    if (!BLOCK_ID.test(id)) { errors.push(`${where(n)}: malformed block id ${id}`); return false; }
    return true;
  };

  for (const node of tree.children) {
    if (node.type === 'html') {
      const c = readComments(node.value);
      if (c.unknown.length) errors.push(`${where(node)}: unknown comment(s) ${JSON.stringify(c.unknown)}`);
      if (c.section) { pendingSection = c.section; continue; }
      if (c.figure) {
        if (!cur) errors.push(`${where(node)}: figure marker before any section`);
        else { cur.chunks.push({ k: 'fig', id: c.figure }); figureMarkers.push(c.figure); }
        continue;
      }
      if (c.id) { pendingTable = { id: c.id, marker: c.marker }; continue; }
      if (c.marker) errors.push(`${where(node)}: a ${c.marker} marker on a line of its own (markers sit before a block id)`);
      continue;
    }
    if (node.type === 'heading') {
      if (!pendingSection) { errors.push(`${where(node)}: heading with no <!-- section: id --> before it`); continue; }
      const title = node.children.map((c) => ('value' in c ? c.value : 'children' in c ? (c.children as PhrasingContent[]).map((x) => ('value' in x ? x.value : '')).join('') : '')).join('');
      cur = { id: pendingSection, title: title.trim(), depth: node.depth, chunks: [] };
      sections.push(cur);
      pendingSection = null;
      continue;
    }
    if (!cur) { errors.push(`${where(node)}: content before the first section`); continue; }
    if (pendingSection) errors.push(`${where(node)}: section marker ${pendingSection} not followed by a heading`);
    if (node.type === 'paragraph') {
      const c = stripInline(node);
      if (c.unknown.length) errors.push(`${where(node)}: unknown comment(s) ${JSON.stringify(c.unknown)}`);
      if (!checkId(c.id, node)) continue;
      const b = makeBlock(c.id, 'p', c.marker, cur.id, toEl(node));
      blocks.push(b); cur.chunks.push({ k: 'b', b });
      continue;
    }
    if (node.type === 'list') {
      const list = node as List;
      const cs = list.children.map((li) => stripInline(li as unknown as MParent));
      for (const c of cs) if (c.unknown.length) errors.push(`${where(node)}: unknown comment(s) ${JSON.stringify(c.unknown)}`);
      const withId = cs.filter((c) => c.id).length;
      // Appendix C prints each of its three lists as ONE block: the id sits on the last item only (KICKOFF §4c's
      // 22 items in three lists, B0280–B0282). Such a list is a single block of kind 'list'.
      if (withId === 1 && cs[cs.length - 1].id && cs.length > 1) {
        const c = cs[cs.length - 1];
        if (!checkId(c.id, node)) continue;
        const markers = new Set(cs.map((x) => x.marker));
        if (markers.size > 1) errors.push(`${where(node)}: list block ${c.id} mixes markers ${[...markers].join(', ')}`);
        const b = makeBlock(c.id, 'list', c.marker, cur.id, toEl(list));
        blocks.push(b); cur.chunks.push({ k: 'b', b });
        continue;
      }
      const items: Block[] = [];
      list.children.forEach((li, k) => {
        const c = cs[k];
        if (!checkId(c.id, li as unknown as RootContent)) return;
        const b = makeBlock(c.id, 'li', c.marker, cur!.id, toEl(li));
        blocks.push(b); items.push(b);
      });
      cur.chunks.push({ k: 'list', ordered: !!list.ordered, start: list.ordered ? (list.start ?? 1) : null, items });
      continue;
    }
    if (node.type === 'table') {
      if (!pendingTable) { errors.push(`${where(node)}: table with no block id on the line above`); continue; }
      const b = makeBlock(pendingTable.id, 'table', pendingTable.marker, cur.id, toEl(node));
      pendingTable = null;
      blocks.push(b); cur.chunks.push({ k: 'b', b });
      continue;
    }
    if (node.type === 'thematicBreak') continue;
    errors.push(`${where(node)}: unsupported markdown node "${node.type}"`);
  }
  if (pendingTable) errors.push(`review.md: block id ${pendingTable.id} is not followed by a table`);
  const seen = new Set<string>();
  for (const b of blocks) { if (seen.has(b.id)) errors.push(`review.md: duplicate block id ${b.id}`); seen.add(b.id); }
  const sids = new Set<string>();
  for (const s of sections) { if (sids.has(s.id)) errors.push(`review.md: duplicate section id ${s.id}`); sids.add(s.id); }
  return { sections, blocks, errors, figureMarkers };
}

/** Render a fragment of pack markdown (a definition, an evidence paragraph, a reason) to hast, citations linked. */
export function inlineHast(md: string): { root: HRoot; cites: number[] } {
  const tree = parseMarkdown(md);
  const h = toHast(tree as never) as unknown as HRoot;
  const cites = linkCitations(h);
  return { root: h, cites };
}
