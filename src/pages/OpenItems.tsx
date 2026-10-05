/**
 * /open-items (KICKOFF §4c): the 129 open items grouped by group, filtered by who can close them and by part of the
 * report (filter state in the URL), with OI-128 and OI-010 pinned at the top and a CSV of the current filter. The
 * first 22 are Appendix C of the report, item for item.
 */
import { useEffect, useMemo } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { D, blockHref, sectionTitle, tops, useData } from '@/lib/data';
import { Rich } from '@/components/Rich';
import { AddNoteButton } from '@/components/AddNoteButton';
import { downloadText, toCsv } from '@/lib/download';
import type { OpenItemT } from '@/types';

const GROUPS = ['Could not be read', 'Needs a human eye', 'Could not be confirmed', 'Not published, as far as this review found'];
const WHO: Record<string, string> = { author: 'the author', 'anyone-with-a-browser': 'anyone with a browser', 'next-review': 'the next review' };
const PIN_ORDER = ['OI-128', 'OI-010'];

function Item({ o }: { o: OpenItemT }) {
  return (
    <li id={o.id} className="bx-card p-4 scroll-mt-40" data-testid="open-item" data-who={o.who}>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-mono font-bold">{o.id}</span>
        <span className="bx-chip-line">{o.group}</span>
        <span className="bx-chip-line">who can close it: {WHO[o.who]}</span>
        {o.appendix_c && <Link to={blockHref(o.appendix_c)} className="bx-chip-line no-underline" data-testid="appendix-c-chip">printed in Appendix C</Link>}
        <AddNoteButton anchor={{ type: 'open-item', id: o.id }} className="ml-auto" />
      </div>
      <p className="mt-2 text-[16px] font-semibold leading-7"><Rich nodes={o.what} /></p>
      <p className="mt-2 text-[15px] leading-7"><strong>Why it matters: </strong><Rich nodes={o.why} /></p>
      <p className="mt-2 text-[15px] leading-7"><strong>Where it was looked for: </strong>{o.looked}</p>
      <p className="mt-2 text-[15px] leading-7"><strong>How to close it: </strong><Rich nodes={o.how_to_close} /></p>
      <p className="mt-2 text-sm flex flex-wrap gap-x-3 gap-y-1">
        <span className="font-semibold">In the report:</span>
        {o.block_refs.map((b) => (b.exists
          ? <Link key={b.id} to={blockHref(b.id)}>{sectionTitle(b.section)} · {b.id} →</Link>
          : <span key={b.id} className="bx-todo">block {b.id} is not in the text</span>))}
        {!o.block_refs.length && o.sections.map((s) => <Link key={s} to={`/read#${s}`}>{sectionTitle(s)} →</Link>)}
      </p>
    </li>
  );
}

export default function OpenItems() {
  const all = useData(D.openItems);
  const loc = useLocation();
  const [sp, setSp] = useSearchParams();
  const who = sp.get('who') ?? '';
  const section = sp.get('section') ?? '';
  const setF = (k: string, v: string) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); setSp(n, { replace: true }); };
  const shown = useMemo(() => (all ?? []).filter((o) => (!who || o.who === who) && (!section || o.tops.includes(section) || o.block_refs.some((b) => b.top === section))), [all, who, section]);
  const pinned = PIN_ORDER.map((id) => shown.find((o) => o.id === id)).filter((o): o is OpenItemT => !!o);
  useEffect(() => {
    if (!all || !loc.hash) return;
    const el = document.getElementById(loc.hash.slice(1));
    if (el) { el.scrollIntoView(); el.classList.add('bx-flash'); }
  }, [all, loc.hash]);
  const csv = () => {
    const rows: string[][] = [['id', 'group', 'what', 'why', 'where it was looked for', 'who can close it', 'how to close it', 'printed in Appendix C', 'blocks', 'sections']];
    for (const o of shown) rows.push([o.id, o.group, o.what_text, o.why_text, o.looked, WHO[o.who], o.how_text, o.appendix_c ? 'yes' : 'no', o.blocks.join(' '), o.sections.join(' ')]);
    const filt = [who && `who=${who}`, section && `section=${section}`].filter(Boolean).join('-') || 'all';
    downloadText(toCsv(rows), `open-items-${filt}.csv`, 'text/csv;charset=utf-8');
  };
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl sm:text-4xl">What could not be settled</h1>
      <p className="bx-panel p-3 mt-3 text-[15px]" data-testid="oi-note">An open item says something was not found in the sources read; it does not say the thing does not exist.</p>
      <p className="bx-prose mt-3">{all?.length ?? 129} open items: sources that could not be read, figures that need a human eye, statements that could not be confirmed, and things not published as far as this review found. The first 22 are printed in the report as <Link to="/read#appendix-c">Appendix C</Link>; each item here says where it was looked for and what would close it.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto] items-end text-sm" role="group" aria-label="Filter open items">
        <label><span className="block text-xs mb-0.5">Who can close it</span>
          <select className="bx-input" value={who} onChange={(e) => setF('who', e.target.value)} data-testid="filter-who">
            <option value="">Anyone</option>{Object.entries(WHO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></label>
        <label><span className="block text-xs mb-0.5">Part of the report</span>
          <select className="bx-input" value={section} onChange={(e) => setF('section', e.target.value)} data-testid="filter-oi-section">
            <option value="">All parts</option>{tops.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select></label>
        <button type="button" className="bx-btn" onClick={csv} data-testid="oi-csv">Download CSV</button>
      </div>
      <p className="text-sm mt-2" role="status" data-testid="oi-shown">{shown.length} shown</p>
      {!all ? <p className="bx-muted mt-6" role="status">Loading…</p> : (
        <>
          {pinned.length > 0 && (
            <section className="mt-6" aria-labelledby="pinned-h" data-testid="pinned">
              <h2 id="pinned-h" className="text-2xl">Two things a person with a browser can settle in ten minutes</h2>
              <ul className="mt-3 grid gap-3">{pinned.map((o) => <Item key={o.id} o={o} />)}</ul>
            </section>
          )}
          {GROUPS.map((g, gi) => {
            const xs = shown.filter((o) => o.group === g && !o.pinned);
            const n = shown.filter((o) => o.group === g).length;
            if (!n) return null;
            return (
              <section key={g} className="mt-8" aria-labelledby={`g-${gi}`}>
                <h2 id={`g-${gi}`} className="text-2xl">{g} <span className="text-base bx-muted font-normal">({n}{n !== xs.length ? `, ${n - xs.length} pinned above` : ''})</span></h2>
                <ul className="mt-3 grid gap-3">{xs.map((o) => <Item key={o.id} o={o} />)}</ul>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
