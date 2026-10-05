/**
 * /read — the report, rendered as written (KICKOFF §4b). Every [n] is a button (the HoverLayer opens its card; a
 * click also folds the card out under the paragraph); terms open their definition; "Show what was checked" draws
 * the claim layer; each top-level section carries its counts strip and, where the systems graph maps it, its "On
 * the maps" links. Blocks keep their ids as anchors (#b-B0133). Appendix C's list items link to their open items.
 */
import { lazy, memo, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { AS_OF_TEXT, blockDomId, counts, D, layersBrief, manifest, sectionsIndex, SLUG, topById, useData } from '@/lib/data';
import { renderNodes } from '@/components/Rich';
import { CiteCard, GROUP_GLOSS, GROUP_LABEL } from '@/components/cards';
import { claimFilter, foldouts, showChecked } from '@/lib/reader-state';
import { useNotepad } from '@/lib/notepad-context';
import { useWide } from '@/components/Layout';
import type { RBlock, RSection } from '@/types';

const NotepadPanel = lazy(() => import('@/components/notepad/NotepadPanel'));
const FigureBody = lazy(() => import('@/components/figures/FigureBody'));

const BANNER_KEY = `bx-read-banner:${SLUG}`;

function useLoadAfterPaint() {
  // the claim layer, change markers and citation cards need these; fetch them right after the text paints
  useEffect(() => {
    const t = window.setTimeout(() => { void D.ledger.load(); void D.references.load(); void D.glossaryShort.load(); }, 50);
    return () => window.clearTimeout(t);
  }, []);
}

// ------------------------------------------------------------------------------------------ one block
interface BlockProps { b: RBlock; checked: boolean }

function FoldOut({ id }: { id: string }) {
  const n = foldouts.use(id);
  if (n === null) return null;
  return (
    <div className="bx-foldout not-prose" data-testid="foldout">
      <div className="flex justify-end -mt-1"><button type="button" className="bx-btn !py-0 !px-1.5 text-xs" onClick={() => foldouts.set(id, null)} aria-label={`Close source ${n}`}>×</button></div>
      <CiteCard n={n} block={id} />
    </div>
  );
}

const Block = memo(function Block({ b, checked }: BlockProps) {
  const domId = blockDomId(b.id);
  const inner = renderNodes(b.kind === 'list' ? b.h.filter((k) => typeof k !== 'string' || k.trim()) : b.h, { checked, key: b.id });
  let el: ReactNode;
  if (b.kind === 'li') {
    const syn = b.marker === 'synthesis';
    return (
      <li id={domId} className={`bx-block ${syn ? 'bx-synthesis !my-2' : ''}`} data-block={b.id} data-foldable="" data-testid={syn ? 'analysis' : undefined}>
        {syn && <span id={b.syn} className="bx-synthesis-label">analysis</span>}
        {inner}<FoldOut id={b.id} />
      </li>
    );
  }
  else if (b.kind === 'list') el = <div id={domId} className="bx-block" data-block={b.id} data-foldable=""><ul className="bx-list">{inner}</ul><FoldOut id={b.id} /></div>;
  else if (b.kind === 'table') el = <div id={domId} className="bx-block" data-block={b.id} data-foldable=""><div className="bx-table-wrap" tabIndex={0} role="region" aria-label={`Table ${b.id}`}><table>{inner}</table></div><FoldOut id={b.id} /></div>;
  else el = <div className="bx-block" id={domId} data-block={b.id} data-foldable=""><p>{inner}</p><FoldOut id={b.id} /></div>;
  if (b.marker === 'synthesis') return <div className="bx-synthesis" id={b.syn} data-testid="analysis"><span className="bx-synthesis-label">analysis</span>{el}</div>;
  return el;
});

// ------------------------------------------------------------------------------------------ section strips
function TopStrip({ id }: { id: string }) {
  const t = topById.get(id);
  if (!t || (!t.claims && !t.open)) return null;
  return (
    <p className="bx-section-strip no-print" data-testid="section-strip">
      <Link to={`/read?claims=all#${id}`}>{t.claims.toLocaleString()} claims checked</Link>
      <span aria-hidden="true">·</span>
      <Link to={`/read?claims=notfound#${id}`}>of which {t.notfound} not found</Link>
      <span aria-hidden="true">·</span>
      <Link to={`/open-items?section=${id}`}>{t.open} open {t.open === 1 ? 'item' : 'items'}</Link>
      {id === 'appendix-c' && <><span aria-hidden="true">·</span><Link to="/open-items">The full list on the Open items page, with where each was looked for →</Link></>}
    </p>
  );
}

function MapsStrip({ id }: { id: string }) {
  const t = topById.get(id);
  if (!t?.node || !t.layers.length) return null;
  // a layer id is unique within a geography only: the same id may sit on both maps
  const label = (lid: string) => {
    const ls = layersBrief.filter((l) => l.id === lid && !l.panel_only);
    if (!ls.length) return null;
    return { label: ls[0].label, county: ls.some((l) => l.geography[0] === 'county'), tract: ls.some((l) => l.geography[0] === 'tract') };
  };
  return (
    <p className="text-[13px] -mt-2 mb-4 no-print" data-testid="maps-strip">
      <span className="font-semibold">On the maps: </span>
      {t.layers.map((lid, i) => {
        const l = label(lid);
        if (!l) return null;
        return (
          <span key={lid}>{i ? ' · ' : ''}{l.label}{' '}
            {l.county && <Link to={`/map/region?layer=${lid}`}>region map</Link>}
            {l.county && l.tract && ' / '}
            {l.tract && <Link to={`/map/tracts?layer=${lid}`}>tract map</Link>}
          </span>
        );
      })}
    </p>
  );
}

function ReaderFigure({ id }: { id: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect(); } }, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <figure ref={ref} className="my-6 bx-card p-3 font-body" data-testid="reader-figure" style={{ minHeight: seen ? undefined : 320 }}>
      {seen ? <Suspense fallback={<p className="bx-muted text-sm" role="status">Loading figure…</p>}><FigureBody id={id} compact /></Suspense> : <p className="bx-muted text-sm">Figure {id}</p>}
      <p className="mt-2 text-sm"><Link to={`/figures/${id}`}>Open the figure page →</Link></p>
    </figure>
  );
}

const Section = memo(function Section({ s, checked }: { s: RSection; checked: boolean }) {
  const H = (`h${Math.min(s.depth + 1, 4)}`) as 'h2' | 'h3' | 'h4';
  const size = s.depth === 1 ? 'text-3xl mt-14' : s.depth === 2 ? 'text-2xl mt-10' : 'text-xl mt-8';
  const isTop = topById.has(s.id);
  return (
    <section aria-labelledby={`h-${s.id}`} className="bx-sec" data-section={s.id}>
      <H id={s.id} className={`bx-section-h ${size} mb-3`}><span id={`h-${s.id}`}>{s.title}</span></H>
      {isTop && <TopStrip id={s.id} />}
      {isTop && <MapsStrip id={s.id} />}
      {s.chunks.map((c, i) => {
        if (c.k === 'fig') return <ReaderFigure key={`f-${c.id}`} id={c.id} />;
        if (c.k === 'b') return <Block key={c.b.id} b={c.b} checked={checked} />;
        const ListTag = c.ordered ? 'ol' : 'ul';
        return (
          <ListTag key={`l-${i}`} className="bx-list" start={c.start ?? undefined}>
            {c.items.map((b) => <Block key={b.id} b={b} checked={checked} />)}
          </ListTag>
        );
      })}
    </section>
  );
});

// ------------------------------------------------------------------------------------------ toolbar
function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] mt-2 bx-checked" aria-label="What the underlines mean" data-testid="claim-legend">
      {Object.entries(GROUP_LABEL).map(([g, label]) => (
        <li key={g} className="flex items-center gap-1.5"><span className={`bx-claim g-${g} bx-legend-swatch`} aria-hidden="true">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span><span><em className="font-semibold">{label}</em>: {GROUP_GLOSS[g]}</span></li>
      ))}
    </ul>
  );
}

function Toolbar() {
  const checked = showChecked.use();
  const only = claimFilter.use();
  return (
    <div className="bx-panel px-3 py-2 mb-6 text-sm no-print" data-testid="reader-toolbar">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="inline-flex items-center gap-2 font-semibold cursor-pointer">
          <input type="checkbox" checked={checked} onChange={(e) => showChecked.set(e.target.checked)} data-testid="show-checked" />
          Show what was checked
        </label>
        {checked && (
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={only} onChange={(e) => claimFilter.set(e.target.checked)} data-testid="notfound-only" />
            Only what was not found
          </label>
        )}
        <span className="bx-asof ml-auto">Current as of {AS_OF_TEXT}</span>
      </div>
      {checked && <Legend />}
    </div>
  );
}

function ReadBanner() {
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(BANNER_KEY) === '1'; } catch { return false; } });
  if (hidden) return null;
  return (
    <div className="bx-banner no-print" role="note" data-testid="read-banner">
      <div className="flex gap-3 items-start">
        <p className="flex-1">Researched and written with Claude for Little Orange Fish from public sources. Every sentence was read back against its source on 4 October 2026; hover a bracketed number for the source and the passage that supports the sentence. Passages marked <em>analysis</em> are the report's own reading.</p>
        <button type="button" className="bx-btn !py-0.5" onClick={() => { setHidden(true); try { localStorage.setItem(BANNER_KEY, '1'); } catch { /* ignore */ } }} aria-label="Dismiss this note">×</button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------ rail
const RAIL = sectionsIndex.filter((s) => s.depth <= 2);

function Rail({ current }: { current: string | null }) {
  const curTop = sectionsIndex.find((s) => s.id === current);
  const active = curTop ? (curTop.depth <= 2 ? curTop.id : [...RAIL].reverse().find((r) => sectionsIndex.indexOf(r) <= sectionsIndex.indexOf(curTop))?.id) : null;
  return (
    <nav aria-label="Sections" className="text-[13px] leading-5">
      <ol className="grid gap-0.5">
        {RAIL.map((s) => (
          <li key={s.id} className={s.depth === 1 ? 'mt-2 font-bold' : 'pl-2'}>
            <a href={`#${s.id}`} className={`block rounded px-1.5 py-0.5 no-underline hover:underline ${active === s.id ? 'font-bold' : ''}`} style={{ color: active === s.id ? 'var(--bx-accent)' : 'var(--bx-ink)' }} aria-current={active === s.id ? 'location' : undefined}>{s.title}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

// ------------------------------------------------------------------------------------------ selection → note
function SelectionNote() {
  const np = useNotepad();
  const [pos, setPos] = useState<{ x: number; y: number; quote: string; block: string | null; section: string | null } | null>(null);
  useEffect(() => {
    const onUp = () => {
      window.setTimeout(() => {
        const sel = window.getSelection();
        const text = sel?.toString().trim() ?? '';
        if (!sel || !text || sel.rangeCount === 0) { setPos(null); return; }
        const node = sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode?.parentElement;
        const blockEl = node?.closest('[data-block]') as HTMLElement | null;
        const secEl = node?.closest('[data-section]') as HTMLElement | null;
        if (!secEl) { setPos(null); return; }
        const r = sel.getRangeAt(0).getBoundingClientRect();
        setPos({ x: r.left + r.width / 2, y: r.top + window.scrollY - 8, quote: text.slice(0, 1200), block: blockEl?.dataset.block ?? null, section: secEl.dataset.section ?? null });
      }, 10);
    };
    document.addEventListener('mouseup', onUp);
    document.addEventListener('keyup', onUp);
    return () => { document.removeEventListener('mouseup', onUp); document.removeEventListener('keyup', onUp); };
  }, []);
  if (!pos) return null;
  return (
    <button type="button" className="bx-btn-primary absolute z-50 -translate-x-1/2 -translate-y-full shadow-lg no-print" style={{ left: pos.x, top: pos.y }}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => { np.addNote(pos.block ? { type: 'block', id: pos.block } : { type: 'section', id: pos.section ?? '' }, pos.quote); np.setDock(true); if (!window.matchMedia('(min-width: 1280px)').matches) np.setOpen(true); setPos(null); window.getSelection()?.removeAllRanges(); }}
      data-testid="add-note-selection">✎ Add note</button>
  );
}

// ------------------------------------------------------------------------------------------ page
export default function Read() {
  const r1 = useData(D.reader1);
  const r2 = useData(D.reader2);
  const reader = useMemo(() => (r1 && r2 ? [...r1, ...r2] : undefined), [r1, r2]);
  const checked = showChecked.use();
  const only = claimFilter.use();
  const np = useNotepad();
  const wide = useWide();
  const loc = useLocation();
  const [sp, setSp] = useSearchParams();
  const [current, setCurrent] = useState<string | null>(null);
  useLoadAfterPaint();

  // ?claims=all|notfound (the section strips' links): turn the claim layer on, optionally filtered to "not found"
  useEffect(() => {
    const c = sp.get('claims');
    if (!c) return;
    showChecked.set(true);
    claimFilter.set(c === 'notfound');
    const n = new URLSearchParams(sp); n.delete('claims');
    setSp(n, { replace: true, preventScrollReset: true });
  }, [sp, setSp]);

  // deep links: #b-B0133 scrolls to the block and highlights it briefly; #section-id as usual. Figures above the
  // target load lazily and change height, so for a short while the target is re-centred whenever the reader resizes,
  // until the reader scrolls, presses a key or touches the page.
  useEffect(() => {
    if (!reader || !loc.hash) return;
    const id = decodeURIComponent(loc.hash.slice(1));
    const go = () => { const el = document.getElementById(id); if (el) el.scrollIntoView({ block: id.startsWith('b-') ? 'center' : 'start' }); };
    let held = true;
    const release = () => { held = false; };
    const body = document.querySelector('[data-testid="reader-body"]');
    const ro = new ResizeObserver(() => { if (held) go(); });
    const t = window.setTimeout(() => {
      go();
      const el = document.getElementById(id);
      if (el && (id.startsWith('b-') || id.startsWith('analysis-'))) { el.classList.remove('bx-flash'); void el.offsetWidth; el.classList.add('bx-flash'); }
      if (body) ro.observe(body);
    }, 30);
    const stop = window.setTimeout(() => { held = false; ro.disconnect(); }, 2500);
    window.addEventListener('wheel', release, { passive: true });
    window.addEventListener('touchstart', release, { passive: true });
    window.addEventListener('keydown', release);
    return () => {
      window.clearTimeout(t); window.clearTimeout(stop); ro.disconnect();
      window.removeEventListener('wheel', release); window.removeEventListener('touchstart', release); window.removeEventListener('keydown', release);
    };
  }, [reader, loc.hash]);

  // the section in view, for the rail and the notepad's "This section"
  useEffect(() => {
    if (!reader) return;
    const hs = [...document.querySelectorAll<HTMLElement>('.bx-section-h')];
    const io = new IntersectionObserver((es) => {
      const vis = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (vis[0]) { const id = vis[0].target.id; setCurrent(id); document.body.dataset.section = id; }
    }, { rootMargin: '-15% 0px -70% 0px' });
    hs.forEach((h) => io.observe(h));
    return () => { io.disconnect(); delete document.body.dataset.section; };
  }, [reader]);

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6">
      <div className={`grid gap-8 ${wide ? (np.dock ? 'grid-cols-[220px_minmax(0,1fr)_360px]' : 'grid-cols-[220px_minmax(0,1fr)]') : 'grid-cols-1'}`}>
        {wide && (
          <aside className="sticky top-[calc(var(--hdr,8rem)+1rem)] h-[calc(100vh-var(--hdr,8rem)-2rem)] overflow-y-auto pr-2 no-print">
            <Rail current={current} />
          </aside>
        )}
        <article className="min-w-0">
          <header className="mb-4">
            <h1 className="text-3xl sm:text-4xl">North Alabama Mental Health Systems Report</h1>
            <p className="bx-muted mt-1">{manifest.authors.join(', ')} · draft {manifest.report.version} · {counts.ledger.toLocaleString()} claims, {counts.verified.toLocaleString()} verified against a quoted passage</p>
          </header>
          {!wide && (
            <label className="block mb-4 no-print">
              <span className="text-sm font-semibold">Jump to a section</span>
              <select className="bx-input mt-1" value="" onChange={(e) => { if (e.target.value) { location.hash = e.target.value; } }} data-testid="section-select">
                <option value="">Choose…</option>
                {RAIL.map((s) => <option key={s.id} value={s.id}>{s.depth === 2 ? '  ' : ''}{s.title}</option>)}
              </select>
            </label>
          )}
          <Toolbar />
          <ReadBanner />
          {!r1 ? <p className="bx-muted" role="status">Loading the report…</p> : (
            <div className={`bx-reader mx-auto pl-0 md:pl-10 ${checked ? 'bx-checked' : ''} ${checked && only ? 'bx-only-notfound' : ''}`} data-testid="reader-body">
              {r1.map((s) => <Section key={s.id} s={s} checked={checked} />)}
              {r2 ? r2.map((s) => <Section key={s.id} s={s} checked={checked} />) : <p className="bx-muted" role="status">Loading the rest of the report…</p>}
            </div>
          )}
        </article>
        {wide && np.dock && (
          <aside className="sticky top-[calc(var(--hdr,8rem)+1rem)] h-[calc(100vh-var(--hdr,8rem)-2rem)] no-print" aria-label="Notepad">
            <Suspense fallback={<p className="bx-muted">Loading…</p>}><NotepadPanel section={current} onClose={() => np.setDock(false)} /></Suspense>
          </aside>
        )}
      </div>
      <SelectionNote />
    </div>
  );
}
