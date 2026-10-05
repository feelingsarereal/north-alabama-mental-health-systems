import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type MiniSearch from 'minisearch';
import { grouped, loadIndex, runSearch, snippet } from '@/lib/search';
import { KIND_LABEL, type DocKind, type SearchDoc } from '@/lib/search-config';

export default function Search() {
  const [sp, setSp] = useSearchParams();
  const q = sp.get('q') ?? '';
  const kinds = new Set((sp.get('kind') ?? '').split(',').filter(Boolean) as DocKind[]);
  const [mini, setMini] = useState<MiniSearch<SearchDoc>>();
  const [draft, setDraft] = useState(q);
  useEffect(() => { void loadIndex().then(setMini); }, []);
  useEffect(() => setDraft(q), [q]);
  const hits = useMemo(() => (mini ? runSearch(mini, q) : []), [mini, q]);
  const groups = grouped(hits);
  const toggle = (k: DocKind) => { const n = new Set(kinds); if (n.has(k)) n.delete(k); else n.add(k); const p = new URLSearchParams(sp); if (n.size) p.set('kind', [...n].join(',')); else p.delete('kind'); setSp(p, { replace: true }); };
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl sm:text-4xl">Search</h1>
      <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); const p = new URLSearchParams(sp); if (draft.trim()) p.set('q', draft.trim()); else p.delete('q'); setSp(p); }} role="search">
        <label className="sr-only" htmlFor="search-q">Search</label>
        <input id="search-q" className="bx-input !text-base" type="search" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Words, numbers as written (15.1, 771, 2026-383), names…" />
        <button type="submit" className="bx-btn-primary">Search</button>
      </form>
      {q && (
        <div className="mt-3 flex flex-wrap gap-1.5 text-sm" role="group" aria-label="Filter by kind">
          {grouped(hits).map((g) => (
            <button key={g.kind} type="button" className={`bx-btn !py-0.5 ${kinds.has(g.kind) ? 'bx-btn-on' : ''}`} aria-pressed={kinds.has(g.kind)} onClick={() => toggle(g.kind)}>{KIND_LABEL[g.kind]} ({g.hits.length})</button>
          ))}
        </div>
      )}
      {!mini ? <p className="bx-muted mt-6" role="status">Loading the index…</p> : q && !hits.length ? <p className="mt-6">Nothing found for “{q}”.</p> : (
        <div className="mt-6 grid gap-8" data-testid="search-results">
          {groups.filter((g) => !kinds.size || kinds.has(g.kind)).map((g) => (
            <section key={g.kind} aria-labelledby={`k-${g.kind}`}>
              <h2 id={`k-${g.kind}`} className="text-xl">{KIND_LABEL[g.kind]} <span className="bx-muted text-base font-normal">({g.hits.length})</span></h2>
              <ul className="mt-2 grid gap-2">
                {g.hits.slice(0, 50).map((h) => (
                  <li key={h.id} className="bx-card p-3" data-testid="search-result">
                    <Link to={h.to} className="font-semibold">{h.title}</Link>
                    <p className="text-sm mt-0.5">{snippet(h.text, h.terms).map((p, i) => (p.hl ? <mark key={i} className="bg-[color:var(--bx-fill)] text-inherit font-semibold">{p.t}</mark> : <span key={i}>{p.t}</span>))}</p>
                  </li>
                ))}
                {g.hits.length > 50 && <li className="text-sm bx-muted">and {g.hits.length - 50} more — narrow the search</li>}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
