import { memo, useEffect, useMemo } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { D, fmtDate, sectionTitle, useData } from '@/lib/data';
import { READ_LABEL, refDate } from '@/components/cards';
import { AddNoteButton } from '@/components/AddNoteButton';
import type { Reference } from '@/types';

const TIERS: { id: Reference['tier']; title: string; blurb: string }[] = [
  { id: 'seminal', title: 'Seminal', blurb: 'The frameworks, statutes and founding documents the report builds on, oldest first so the history reads forward.' },
  { id: 'current', title: 'Current', blurb: 'Sources that carry the report’s figures and events, newest first.' },
  { id: 'background', title: 'Background', blurb: 'Context: national frameworks, explainers and data documentation.' },
];
const DOC_TYPE: Record<string, string> = {
  'org-page': "organization's own page", press: 'press report', 'primary-document': 'primary document', 'official-data': 'official data',
  statute: 'statute', 'court-record': 'court record', other: 'other',
};
const READ_WORDS: Record<string, string> = {
  full: 'Read in full.', partial: 'Read in part: the automated reader returned only part of the document.', 'not-read': 'Could not be opened by the page reader.',
};

const RefCard = memo(function RefCard({ r }: { r: Reference }) {
  return (
    <li id={`ref-${r.n}`} className="bx-card p-4 scroll-mt-40" data-testid="ref-card">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-mono font-bold">[{r.n}]</span>
        <a href={r.url} target="_blank" rel="noreferrer" className="font-bold text-[16px]">{r.title} <span aria-hidden="true">↗</span></a>
      </div>
      <p className="text-sm mt-0.5">{r.publisher} · {refDate(r)} · <span className="bx-muted">{DOC_TYPE[r.doc_type] ?? r.doc_type}</span></p>
      <p className="mt-1 flex flex-wrap gap-1.5 text-xs">
        <span className="bx-tier">{r.tier}</span>
        <span className="bx-chip-line" data-testid="ref-read">{READ_LABEL[r.read]}</span>
        <span className="bx-chip-line">read {fmtDate(r.accessed)}</span>
        {r.ledger_only && <span className="bx-chip-line">cited only in the claims ledger</span>}
      </p>
      {r.summary ? <p className="mt-2 text-[15px] leading-7">{r.summary}</p> : <p className="mt-2 bx-todo">TODO(author): summary pending</p>}
      <p className="mt-1 text-sm"><strong>How fully it was read: </strong>{READ_WORDS[r.read]}{r.read_note && <> {r.read_note}</>}</p>
      {r.tier === 'seminal' && r.why_it_mattered && <p className="mt-2 text-[15px]"><strong>Why it mattered: </strong>{r.why_it_mattered}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {r.cited_in.length > 0 && <span>Cited in: {r.cited_in.map((s, i) => <span key={s}>{i ? ' · ' : ''}<Link to={`/read#${s}`}>{sectionTitle(s)}</Link></span>)}</span>}
        <AddNoteButton anchor={{ type: 'ref', id: String(r.n) }} className="ml-auto" />
      </div>
    </li>
  );
});

export default function References() {
  const refs = useData(D.references);
  const loc = useLocation();
  const [sp, setSp] = useSearchParams();
  const f = { tier: sp.get('tier') ?? '', type: sp.get('type') ?? '', read: sp.get('read') ?? '' };
  const setF = (k: string, v: string) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); setSp(n, { replace: true }); };
  const types = useMemo(() => [...new Set((refs ?? []).map((r) => r.doc_type))].sort(), [refs]);
  const shown = useMemo(() => (refs ?? []).filter((r) => (!f.tier || r.tier === f.tier) && (!f.type || r.doc_type === f.type) && (!f.read || r.read === f.read)), [refs, f.tier, f.type, f.read]);
  useEffect(() => {
    if (!refs || !loc.hash) return;
    const el = document.getElementById(loc.hash.slice(1));
    if (el) { el.scrollIntoView(); el.classList.add('bx-flash'); }
  }, [refs, loc.hash]);
  const main = shown.filter((r) => !r.aux);
  const aux = shown.filter((r) => r.aux);
  const sortTier = (t: Reference['tier'], xs: Reference[]) => [...xs].sort((a, b) => (t === 'seminal' ? a.year - b.year : b.year - a.year) || a.n - b.n);
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl sm:text-4xl">References</h1>
      <p className="bx-prose mt-2">All {refs?.length ?? 407} sources, read through an automated page reader on 4 October 2026: {refs ? refs.filter((r) => r.read === 'full').length : 336} in full, {refs ? refs.filter((r) => r.read === 'partial').length : 70} in part, and {refs ? refs.filter((r) => r.read === 'not-read').length : 1} that could not be opened and is cited only for that fact. Each card says how fully it was read, what it establishes and where it is cited.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3 text-sm" role="group" aria-label="Filter references">
        <label><span className="block text-xs mb-0.5">Tier</span><select className="bx-input" value={f.tier} onChange={(e) => setF('tier', e.target.value)}><option value="">All</option>{TIERS.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
        <label><span className="block text-xs mb-0.5">Document type</span><select className="bx-input" value={f.type} onChange={(e) => setF('type', e.target.value)}><option value="">All</option>{types.map((t) => <option key={t} value={t}>{DOC_TYPE[t] ?? t}</option>)}</select></label>
        <label><span className="block text-xs mb-0.5">How fully read</span><select className="bx-input" value={f.read} onChange={(e) => setF('read', e.target.value)}><option value="">All</option><option value="full">read in full</option><option value="partial">read in part</option><option value="not-read">could not be opened</option></select></label>
      </div>
      <p className="text-sm bx-muted mt-2" role="status">{shown.length} shown</p>
      {!refs ? <p className="bx-muted mt-6" role="status">Loading…</p> : (
        <>
          {TIERS.map((t) => {
            const xs = sortTier(t.id, main.filter((r) => r.tier === t.id));
            if (!xs.length) return null;
            return (
              <section key={t.id} className="mt-8" aria-labelledby={`tier-${t.id}`}>
                <h2 id={`tier-${t.id}`} className="text-2xl">{t.title} <span className="text-base bx-muted font-normal">({xs.length})</span></h2>
                <p className="text-sm bx-muted">{t.blurb}</p>
                <ul className="mt-3 grid gap-3">{xs.map((r) => <RefCard key={r.n} r={r} />)}</ul>
              </section>
            );
          })}
          {aux.length > 0 && (
            <section className="mt-10" aria-labelledby="tier-aux">
              <h2 id="tier-aux" className="text-2xl">Sources for the tract map <span className="text-base bx-muted font-normal">({aux.length})</span></h2>
              <p className="text-sm bx-muted">Cited only by the maps, the glossary and one primer — not by the report's text.</p>
              <ul className="mt-3 grid gap-3">{[...aux].sort((a, b) => a.n - b.n).map((r) => <RefCard key={r.n} r={r} />)}</ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
