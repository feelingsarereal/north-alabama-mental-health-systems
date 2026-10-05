/**
 * The notepad (APP-SPEC §3.1), ported from ptsd-inflammation-critique at afb9dab. Pure state + serialisation, so it
 * is unit-tested and survives content rebuilds: notes are keyed to stable ids and an anchor that disappears from the
 * pack is kept and reported as orphaned — never dropped.
 *
 * Adapted for this app's objects (KICKOFF §4): a note hangs on a report section, a block (B0123), a term, a
 * reference, a figure, an open item (OI-001), a map selection (region|tracts : layer : FIPS or tract id), a service
 * location, a graph node (d1…s13), a primer, or nothing. Every note is typed by the reader.
 */

export type AnchorType = 'section' | 'block' | 'term' | 'ref' | 'figure' | 'open-item' | 'map' | 'location' | 'node' | 'unit' | 'free';
export const ANCHOR_TYPES: AnchorType[] = ['section', 'block', 'term', 'ref', 'figure', 'open-item', 'map', 'location', 'node', 'unit', 'free'];
export interface Anchor { type: AnchorType; id: string }
export interface Note { id: string; anchor: Anchor; quote?: string; body: string; created: string; updated: string }
export interface NotepadState { version: 2; notes: Note[] }

export const emptyNotepad = (): NotepadState => ({ version: 2, notes: [] });

export type NotepadAction =
  | { type: 'add'; note: Omit<Note, 'id' | 'created' | 'updated'> & { id?: string; created?: string } }
  | { type: 'update'; id: string; body?: string; anchor?: Anchor; quote?: string }
  | { type: 'remove'; id: string }
  | { type: 'replace'; state: NotepadState }
  | { type: 'merge'; notes: Note[] }
  | { type: 'clear' };

let counter = 0;
export function newId(now = Date.now()): string {
  counter = (counter + 1) % 1e6;
  return `n-${now.toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function reducer(state: NotepadState, action: NotepadAction, now: () => string = () => new Date().toISOString()): NotepadState {
  switch (action.type) {
    case 'add': {
      const t = now();
      const note: Note = { id: action.note.id ?? newId(), anchor: action.note.anchor, quote: action.note.quote, body: action.note.body, created: action.note.created ?? t, updated: t };
      return { ...state, notes: [...state.notes, note] };
    }
    case 'update':
      return { ...state, notes: state.notes.map((n) => (n.id === action.id ? { ...n, body: action.body ?? n.body, anchor: action.anchor ?? n.anchor, quote: action.quote ?? n.quote, updated: now() } : n)) };
    case 'remove':
      return { ...state, notes: state.notes.filter((n) => n.id !== action.id) };
    case 'replace':
      return normalise(action.state);
    case 'merge': {
      const byId = new Map(state.notes.map((n) => [n.id, n]));
      for (const n of action.notes) {
        const prev = byId.get(n.id);
        if (!prev || prev.updated < n.updated) byId.set(n.id, n);
      }
      return { ...state, notes: [...byId.values()] };
    }
    case 'clear':
      return emptyNotepad();
  }
}

/** Accept anything that looks like a saved state (v2), or a v1 single-text notepad, and return a valid v2 state. */
export function normalise(raw: unknown): NotepadState {
  if (!raw || typeof raw !== 'object') return emptyNotepad();
  const r = raw as { version?: number; notes?: unknown; text?: unknown };
  if (Array.isArray(r.notes)) {
    const notes = r.notes.filter((n): n is Note => !!n && typeof n === 'object' && typeof (n as Note).id === 'string' && typeof (n as Note).body === 'string' && !!(n as Note).anchor)
      .map((n) => ({ ...n, anchor: { type: (ANCHOR_TYPES.includes(n.anchor.type) ? n.anchor.type : 'free') as AnchorType, id: String(n.anchor.id ?? '') } }));
    return { version: 2, notes };
  }
  if (typeof r.text === 'string' && r.text.trim()) {
    const t = new Date().toISOString();
    return { version: 2, notes: [{ id: newId(), anchor: { type: 'free', id: '' }, body: r.text, created: t, updated: t }] };
  }
  return emptyNotepad();
}

// ------------------------------------------------------------------------------------------ resolving anchors
export interface AnchorIndex {
  sections: { id: string; title: string; number: string | null }[];   // reading order
  blocks: Map<string, { section: string }>;
  terms: Map<string, { term: string; sections: string[] }>;
  refs: Map<number, { citation: string; sections: string[] }>;
  figures: Map<string, { title: string; sections: string[] }>;
  openItems: Map<string, { what: string; sections: string[] }>;
  layers: Map<string, string>;           // "county:pct_poverty" | "tract:pct_poverty" → label
  areas: Map<string, string>;            // "region:01089" | "tracts:01089010630" → name
  locations: Map<string, { name: string }>;
  nodes: Map<string, { title: string; section: string }>;
  units: Map<string, { title: string; sections: string[] }>;
}

export interface ResolvedAnchor { ok: boolean; label: string; section: string | null; to: string }

const blockDom = (id: string) => `b-${id}`;

export function resolveAnchor(a: Anchor, idx: AnchorIndex): ResolvedAnchor {
  const inPack = (secs: string[]) => secs.find((s) => idx.sections.some((x) => x.id === s)) ?? null;
  switch (a.type) {
    case 'section': {
      const s = idx.sections.find((x) => x.id === a.id);
      return { ok: !!s, label: s ? `section: ${s.title}` : `section ${a.id}`, section: s ? s.id : null, to: `/read#${a.id}` };
    }
    case 'block': {
      const b = idx.blocks.get(a.id);
      return { ok: !!b, label: `passage ${a.id}`, section: b?.section ?? null, to: `/read#${blockDom(a.id)}` };
    }
    case 'term': {
      const t = idx.terms.get(a.id);
      return { ok: !!t, label: t ? `term: ${t.term}` : `term ${a.id}`, section: null, to: `/glossary#term-${a.id}` };
    }
    case 'ref': {
      const r = idx.refs.get(Number(a.id));
      return { ok: !!r, label: `reference [${a.id}]`, section: null, to: `/references#ref-${a.id}` };
    }
    case 'figure': {
      const f = idx.figures.get(a.id);
      return { ok: !!f, label: f ? `figure: ${f.title}` : `figure ${a.id}`, section: f ? inPack(f.sections) : null, to: `/figures/${a.id}` };
    }
    case 'open-item': {
      const o = idx.openItems.get(a.id);
      return { ok: !!o, label: `open item ${a.id}`, section: o ? inPack(o.sections) : null, to: `/open-items#${a.id}` };
    }
    case 'map': {
      const [geo, layer, area_id] = a.id.split(':');
      const l = idx.layers.get(`${geo === 'region' ? 'county' : 'tract'}:${layer}`);
      const area = idx.areas.get(`${geo}:${area_id}`);
      const ok = (geo === 'region' || geo === 'tracts') && !!l && (!area_id || !!area);
      return { ok, label: `${geo === 'region' ? 'region map' : 'tract map'}: ${l ?? layer}${area ? ` · ${area}` : ''}`, section: null, to: `/map/${geo}?layer=${layer}${area_id ? `&geo=${area_id}` : ''}` };
    }
    case 'location': {
      const p = idx.locations.get(a.id);
      return { ok: !!p, label: p ? `service location: ${p.name}` : `location ${a.id}`, section: null, to: `/map/region?overlay=locations&place=${a.id}` };
    }
    case 'node': {
      const n = idx.nodes.get(a.id);
      return { ok: !!n, label: n ? `systems graph: ${n.title}` : `node ${a.id}`, section: n?.section ?? null, to: `/systems?node=${a.id}` };
    }
    case 'unit': {
      const u = idx.units.get(a.id);
      return { ok: !!u, label: u ? `primer: ${u.title}` : `primer ${a.id}`, section: u ? inPack(u.sections) : null, to: `/concepts/${a.id}` };
    }
    default:
      return { ok: true, label: 'unanchored', section: null, to: '/notes' };
  }
}

export interface NoteGroup { key: string; title: string; notes: (Note & { resolved: ResolvedAnchor })[] }

/** Notes grouped in reading order, then terms/references/maps/primers, then unanchored, then orphaned anchors. */
export function groupBySection(state: NotepadState, idx: AnchorIndex): NoteGroup[] {
  const groups = new Map<string, NoteGroup>();
  for (const s of idx.sections) groups.set(s.id, { key: s.id, title: s.title, notes: [] });
  const extra = { lib: { key: '_library', title: 'Terms, references, maps and primers (not tied to a section)', notes: [] as NoteGroup['notes'] }, free: { key: '_free', title: 'Unanchored', notes: [] as NoteGroup['notes'] }, orphan: { key: '_orphan', title: 'Anchors no longer in the pack (re-anchor these)', notes: [] as NoteGroup['notes'] } };
  const sorted = [...state.notes].sort((a, b) => (a.created < b.created ? -1 : a.created > b.created ? 1 : 0));
  for (const n of sorted) {
    const r = resolveAnchor(n.anchor, idx);
    const item = { ...n, resolved: r };
    if (!r.ok) extra.orphan.notes.push(item);
    else if (r.section && groups.has(r.section)) groups.get(r.section)!.notes.push(item);
    else if (n.anchor.type === 'free') extra.free.notes.push(item);
    else extra.lib.notes.push(item);
  }
  return [...groups.values(), extra.lib, extra.free, extra.orphan].filter((g) => g.notes.length);
}

// ------------------------------------------------------------------------------------------ Markdown export / import
const MARK = 'bx-note';

export function toMarkdown(state: NotepadState, idx: AnchorIndex, meta: { title: string; slug: string; date?: string }): string {
  const out: string[] = [
    `# Notes — ${meta.title}`,
    '',
    `_Exported ${meta.date ?? new Date().toISOString().slice(0, 10)} from the North Alabama Mental Health Explorer (${meta.slug}). Organised by report section in reading order; each note keeps its anchor and the quote it hangs on. Every note below was written by you._`,
    '',
  ];
  for (const g of groupBySection(state, idx)) {
    out.push(`## ${g.title}`, '');
    for (const n of g.notes) {
      out.push(`### ${n.resolved.label}`, '');
      if (n.quote) { out.push(...n.quote.split('\n').map((l) => `> ${l}`), ''); }
      out.push(n.body.trim() || '_(empty note)_', '');
      const metaJson = JSON.stringify({ id: n.id, anchor: n.anchor, quote: n.quote, created: n.created, updated: n.updated });
      out.push(`<!-- ${MARK} ${metaJson.replace(/--/g, '\\u002d\\u002d')} -->`, '');
    }
  }
  return out.join('\n');
}

/** Parse an exported file back into notes. A Markdown file without note markers becomes one unanchored note. */
export function fromMarkdown(md: string): Note[] {
  const re = new RegExp(`^### [^\\n]*\\n([\\s\\S]*?)<!-- ${MARK} (\\{[\\s\\S]*?\\}) -->`, 'gm');
  const notes: Note[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(md))) {
    let meta: Partial<Note>;
    try { meta = JSON.parse(m[2]) as Partial<Note>; } catch { continue; }
    const lines = m[1].split('\n');
    let i = 0;
    while (i < lines.length && (lines[i].startsWith('>') || !lines[i].trim())) i++;
    let body = lines.slice(i).join('\n').trim();
    if (body === '_(empty note)_') body = '';
    if (!meta.id || !meta.anchor) continue;
    const t = new Date().toISOString();
    notes.push({ id: meta.id, anchor: meta.anchor, quote: meta.quote, body, created: meta.created ?? t, updated: meta.updated ?? t });
  }
  if (!notes.length && md.trim()) {
    const t = new Date().toISOString();
    notes.push({ id: newId(), anchor: { type: 'free', id: '' }, body: md.trim(), created: t, updated: t });
  }
  return notes;
}
