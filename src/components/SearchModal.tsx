import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type MiniSearch from 'minisearch';
import { grouped, loadIndex, runSearch, snippet } from '@/lib/search';
import { KIND_LABEL, type SearchDoc } from '@/lib/search-config';

/** ⌘K palette (KICKOFF §4g): grouped results as you type; Enter goes to the first. */
export default function SearchModal({ onClose }: { onClose: () => void }) {
  const [mini, setMini] = useState<MiniSearch<SearchDoc>>();
  const [q, setQ] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const nav = useNavigate();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    opener.current = document.activeElement as HTMLElement;
    input.current?.focus();
    void loadIndex().then(setMini);
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('keydown', k); opener.current?.focus?.(); };
  }, []);
  const hits = useMemo(() => (mini ? runSearch(mini, q) : []), [mini, q]);
  const groups = useMemo(() => grouped(hits).map((g) => ({ ...g, hits: g.hits.slice(0, 5) })), [hits]);
  const go = (to: string) => { onClose(); nav(to); };
  return (
    <div className="fixed inset-0 z-[75] flex items-start justify-center bg-black/40 p-3 sm:p-10" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Search" className="bx-card w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl" data-testid="search-modal">
        <form className="p-3 border-b" style={{ borderColor: 'var(--bx-line-soft)' }} onSubmit={(e) => { e.preventDefault(); if (hits[0]) go(hits[0].to); else if (q.trim()) go(`/search?q=${encodeURIComponent(q)}`); }}>
          <label className="sr-only" htmlFor="palette-q">Search the report, sources, glossary, maps and graph</label>
          <input id="palette-q" ref={input} className="bx-input !text-base" type="search" autoComplete="off" placeholder="Search: a county, a term, a number, a source…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="palette-input" />
        </form>
        <div className="overflow-y-auto p-2 text-sm" aria-live="polite">
          {!mini && <p className="bx-muted p-2" role="status">Loading the index…</p>}
          {mini && q && !hits.length && <p className="bx-muted p-2">Nothing found for “{q}”.</p>}
          {groups.map((g) => (
            <section key={g.kind} className="mb-2">
              <h2 className="px-2 text-xs uppercase tracking-wide bx-muted" style={{ color: 'var(--bx-muted)' }}>{KIND_LABEL[g.kind]}</h2>
              <ul>
                {g.hits.map((h) => (
                  <li key={h.id}>
                    <button type="button" className="w-full text-left rounded px-2 py-1.5 hover:bg-paper-2 dark:hover:bg-night focus-visible:bg-paper-2" onClick={() => go(h.to)} data-testid="palette-result">
                      <span className="font-semibold block">{h.title}</span>
                      <span className="block text-xs bx-muted line-clamp-2">{snippet(h.text, h.terms, 160).map((p, i) => (p.hl ? <mark key={i} className="bg-[color:var(--bx-fill)] text-inherit">{p.t}</mark> : <span key={i}>{p.t}</span>))}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {q && hits.length > 0 && <p className="p-2"><button type="button" className="underline font-semibold" onClick={() => go(`/search?q=${encodeURIComponent(q)}`)}>All {hits.length} results →</button></p>}
        </div>
      </div>
    </div>
  );
}
