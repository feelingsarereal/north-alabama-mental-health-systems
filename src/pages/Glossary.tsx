import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { D, sectionTitle, useData } from '@/lib/data';
import { Rich } from '@/components/Rich';
import { AddNoteButton } from '@/components/AddNoteButton';

const CATEGORY_LABEL: Record<string, string> = {
  organization: 'Organizations', program: 'Programs', facility: 'Facilities', law: 'Laws', funding: 'Funding', measure: 'Measures',
  'data-source': 'Data sources', place: 'Places', concept: 'Concepts', role: 'Roles',
};

export default function Glossary() {
  const g = useData(D.glossary);
  const loc = useLocation();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const list = useMemo(() => {
    if (!g) return [];
    const s = q.trim().toLowerCase();
    return g.filter((t) => (!cat || t.category === cat) && (!s || t.term.toLowerCase().includes(s) || t.variants.some((v) => v.toLowerCase().includes(s)) || t.short.toLowerCase().includes(s)));
  }, [g, q, cat]);
  const letters = useMemo(() => [...new Set(list.map((t) => t.term[0].toUpperCase().replace(/[^A-Z]/, '#')))], [list]);
  const byId = useMemo(() => new Map((g ?? []).map((t) => [t.id, t])), [g]);
  useEffect(() => {
    if (!g || !loc.hash) return;
    const el = document.getElementById(decodeURIComponent(loc.hash.slice(1)));
    if (el) { el.scrollIntoView(); el.classList.add('bx-flash'); }
  }, [g, loc.hash]);
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl sm:text-4xl">Glossary</h1>
      <p className="bx-prose mt-2">{g?.length ?? 189} terms, written for a reader with no background in health policy: organizations, programs, facilities, laws, funding, measures, data sources, places, concepts and roles. Each definition is cited, except the two terms that describe this site itself; “Appears in” links back to the sections of the report where the term is linked. Three terms do not occur in the report and serve the maps.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_14rem]">
        <label className="block"><span className="sr-only">Search the glossary</span><input className="bx-input" type="search" placeholder="Search terms…" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <label className="block"><span className="sr-only">Category</span>
          <select className="bx-input" value={cat} onChange={(e) => setCat(e.target.value)} data-testid="glossary-category">
            <option value="">All categories</option>
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
      </div>
      <nav aria-label="Letters" className="mt-3 flex flex-wrap gap-1 text-sm">
        {letters.map((l) => <a key={l} href={`#letter-${l}`} className="bx-btn !px-2 !py-0.5 no-underline">{l}</a>)}
      </nav>
      <p className="text-sm bx-muted mt-2" role="status">{list.length} {list.length === 1 ? 'term' : 'terms'}</p>
      {!g ? <p className="bx-muted mt-6" role="status">Loading…</p> : (
        <dl className="mt-4 grid gap-4">
          {list.map((t, i) => {
            const L = t.term[0].toUpperCase().replace(/[^A-Z]/, '#');
            const first = i === 0 || list[i - 1].term[0].toUpperCase().replace(/[^A-Z]/, '#') !== L;
            return (
              <div key={t.id} className="bx-card p-4 scroll-mt-40" id={`term-${t.id}`}>
                {first && <span id={`letter-${L}`} className="block -mt-40 pt-40" aria-hidden="true" />}
                <dt className="flex flex-wrap items-baseline gap-2">
                  <span className="text-lg font-bold">{t.term}</span>
                  <span className="bx-chip-line">{CATEGORY_LABEL[t.category] ?? t.category}</span>
                  <span className="bx-muted text-xs">{t.kind}</span>
                  {t.self_description && <span className="bx-chip-line" title="A term about this site itself: no citation by design">about this site</span>}
                  {!t.in_text && <span className="bx-chip-line">used on the maps, not in the report's text</span>}
                  <AddNoteButton anchor={{ type: 'term', id: t.id }} className="ml-auto" />
                </dt>
                <dd className="mt-1">
                  <p className="font-semibold text-[15px]">{t.short}</p>
                  <p className="mt-1 leading-7 text-[15px]"><Rich nodes={t.def} /></p>
                  {t.variants.length > 0 && <p className="text-xs bx-muted mt-1">Also written: {t.variants.join(' · ')}</p>}
                  <p className="text-sm mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {t.concept && <Link to={`/concepts/${t.concept}`}>Learn the concept → Primer</Link>}
                    {t.see.length > 0 && <span>See also: {t.see.map((s, j) => <span key={s}>{j ? ', ' : ''}<a href={`#term-${s}`}>{byId.get(s)?.term ?? s}</a></span>)}</span>}
                  </p>
                  {t.appears.length > 0 && (
                    <details className="text-sm mt-1"><summary className="cursor-pointer">Appears in {t.appears.length} {t.appears.length === 1 ? 'section' : 'sections'}</summary>
                      <ul className="mt-1 grid gap-0.5">{t.appears.map((s) => <li key={s}><Link to={`/read#${s}`}>{sectionTitle(s)}</Link></li>)}</ul>
                    </details>
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
    </div>
  );
}
