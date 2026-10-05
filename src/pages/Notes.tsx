import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { conceptsIndex, sectionsIndex } from '@/lib/data';
import { SaveLine } from '@/components/notepad/NotepadPanel';
import { useNotepad } from '@/lib/notepad-context';
import { fromMarkdown, groupBySection, type AnchorType } from '@/lib/notepad';
import { exportNotes, NoteEditor, useAnchorIndex } from '@/components/notepad/NotepadPanel';

/**
 * The notepad as a page (APP-SPEC §3.1 /notes), ported from ptsd-inflammation-critique: every note, what it hangs on,
 * in reading order; export is Markdown organised by section with anchors and quotes. Every word is the reader's.
 */
export default function Notes() {
  const np = useNotepad();
  const idx = useAnchorIndex();
  const fileRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<AnchorType>('section');
  const [anchorId, setAnchorId] = useState('');
  const groups = useMemo(() => (idx ? groupBySection(np.state, idx) : []), [np.state, idx]);
  const options = useMemo(() => {
    if (!idx) return [] as { id: string; label: string }[];
    if (type === 'section') return sectionsIndex.map((s) => ({ id: s.id, label: s.title }));
    if (type === 'block') return [...idx.blocks.entries()].map(([id, b]) => ({ id, label: `${id} — ${sectionsIndex.find((s) => s.id === b.section)?.title ?? b.section}` }));
    if (type === 'term') return [...idx.terms.entries()].map(([id, t]) => ({ id, label: t.term }));
    if (type === 'ref') return [...idx.refs.entries()].map(([n, r]) => ({ id: String(n), label: `[${n}] ${r.citation.slice(0, 70)}` }));
    if (type === 'figure') return [...idx.figures.entries()].map(([id, f]) => ({ id, label: f.title }));
    if (type === 'open-item') return [...idx.openItems.entries()].map(([id, o]) => ({ id, label: `${id} — ${o.what.slice(0, 70)}` }));
    if (type === 'node') return [...idx.nodes.entries()].map(([id, n]) => ({ id, label: n.title }));
    if (type === 'map') return [...idx.layers.entries()].map(([key, label]) => { const [g, id] = key.split(':'); return g === 'county' ? { id: `region:${id}`, label: `Region map: ${label}` } : { id: `tracts:${id}`, label: `Tract map: ${label}` }; });
    if (type === 'location') return [...idx.locations.entries()].map(([id, p]) => ({ id, label: p.name }));
    if (type === 'unit') return conceptsIndex.map((u) => ({ id: u.id, label: u.title }));
    return [];
  }, [idx, type]);
  const add = () => {
    if (type !== 'free' && !anchorId) return;
    np.addNote({ type, id: type === 'free' ? '' : anchorId });
  };
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl sm:text-4xl">Notes</h1>
      <p className="bx-prose mt-2">
        Your notes on the report, in reading order. Anchor a note to a section, a passage, a term, a reference, a figure, a change, an open item, a map layer or a part of the systems graph. Export them as Markdown any time; import reads the file back and merges it.
      </p>
      <div className="mt-1"><SaveLine /></div>
      <section className="bx-card p-3 mt-5 text-sm no-print" aria-labelledby="new-h">
        <h2 id="new-h" className="text-lg">New note</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)_auto] items-end">
          <label className="block"><span className="block text-xs mb-1">Anchor to</span>
            <select className="bx-input" value={type} onChange={(e) => { setType(e.target.value as AnchorType); setAnchorId(''); }} data-testid="anchor-type">
              <option value="section">a section</option><option value="block">a passage</option><option value="term">a term</option><option value="ref">a reference</option><option value="figure">a figure</option><option value="open-item">an open item</option><option value="map">a map layer</option><option value="location">a service location</option><option value="node">a part of the graph</option><option value="unit">a primer</option><option value="free">nothing</option>
            </select></label>
          {type !== 'free' ? (
            <label className="block min-w-0"><span className="block text-xs mb-1">Which</span>
              <select className="bx-input" value={anchorId} onChange={(e) => setAnchorId(e.target.value)} data-testid="anchor-id"><option value="">choose…</option>{options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
          ) : <span />}
          <button type="button" className="bx-btn-primary" onClick={add} disabled={type !== 'free' && !anchorId} data-testid="add-anchored-note">Add note</button>
        </div>
      </section>
      <div className="mt-4 flex flex-wrap gap-2 no-print">
        <button type="button" className="bx-btn" disabled={!idx || !np.state.notes.length} onClick={() => idx && exportNotes(np.state, idx)} data-testid="export-notes">Export Markdown (by section)</button>
        <button type="button" className="bx-btn" onClick={() => fileRef.current?.click()}>Import Markdown</button>
        <input ref={fileRef} type="file" accept=".md,text/markdown,text/plain" className="sr-only" aria-label="Import notes from a Markdown file" onChange={async (e) => { const f = e.target.files?.[0]; if (f) np.dispatch({ type: 'merge', notes: fromMarkdown(await f.text()) }); e.target.value = ''; }} />
        <span className="text-sm bx-muted self-center" role="status">{np.state.notes.length} note{np.state.notes.length === 1 ? '' : 's'}</span>
      </div>
      {!idx ? <p className="mt-6 bx-muted" role="status">Loading…</p> : groups.length === 0 ? <p className="mt-6 bx-muted">No notes yet. Select text on <Link className="underline" to="/read">Read</Link>, or add one above.</p> : (
        <div className="mt-6 grid gap-8">
          {groups.map((g) => (
            <section key={g.key} aria-labelledby={`ng-${g.key}`}>
              <h2 id={`ng-${g.key}`} className="text-xl">{g.title}</h2>
              <ul className="mt-2 grid gap-2">{g.notes.map((n) => <NoteEditor key={n.id} note={n} idx={idx} autoFocus={np.focusId === n.id} />)}</ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
