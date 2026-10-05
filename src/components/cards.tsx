/**
 * The three cards a reader opens from the text (KICKOFF §4b): the citation card (the reference, its summary, and
 * what in the ledger supports this sentence), the term card, and the claim card. Every word comes from the pack:
 * the reference summary, the ledger's quotes and locators, the glossary entry. Where the ledger has no source for a
 * reference number in the block, the card shows the reference summary alone and never synthesises a passage.
 */
import { Link } from 'react-router-dom';
import { D, fmtDate, useData, blockHref } from '@/lib/data';
import { useLedgerIndex } from '@/lib/indexes';
import type { LedgerItem, Reference } from '@/types';

export const READ_LABEL: Record<string, string> = { full: 'read in full', partial: 'read in part', 'not-read': 'could not be opened' };

/** The date line of a reference: its published date, or for an undated page the day it was read. */
export function refDate(r: Pick<Reference, 'published' | 'year_basis' | 'accessed'>): string {
  if (r.published) return /^\d{4}-\d{2}-\d{2}$/.test(r.published) ? fmtDate(r.published) : r.published;
  return `undated page, read ${fmtDate(r.accessed)}`;
}

export function firstWords(s: string, n: number): string {
  const w = s.trim().split(/\s+/);
  return w.length <= n ? s.trim() : `${w.slice(0, n).join(' ')}…`;
}

function RefHead({ r }: { r: Reference }) {
  return (
    <div>
      <p className="font-bold leading-snug">[{r.n}] {r.title}</p>
      <p className="text-xs bx-muted mt-0.5">
        {r.publisher} · {refDate(r)}{' '}
        <span className="bx-chip-line ml-1" data-testid="read-chip">{READ_LABEL[r.read]}</span>
      </p>
    </div>
  );
}

export function Supports({ n, block, limit }: { n: number; block?: string | null; limit?: number }) {
  const idx = useLedgerIndex();
  if (!block || !idx) return null;
  const entries = (idx.byBlock.get(block) ?? []).filter((l) => l.sources.some((s) => s.n === n));
  if (!entries.length) return null;
  const shown = limit ? entries.slice(0, limit) : entries;
  return (
    <div className="mt-2" data-testid="supports">
      <p className="text-xs font-bold uppercase tracking-wide bx-muted">What supports this sentence</p>
      <ul className="mt-1 grid gap-1.5">
        {shown.map((l) => l.sources.filter((s) => s.n === n).map((s, i) => (
          <li key={`${l.id}-${i}`} className="text-[13px] leading-5">
            <span className="bx-muted">{firstWords(l.quote, 18)}</span>
            <span aria-hidden="true"> → </span>
            <span className="sr-only">supported by </span>
            <q className="italic">{s.quote.replace(/\*\*/g, "")}</q>
            {s.locator && <span className="bx-muted text-xs"> ({s.locator})</span>}
          </li>
        )))}
      </ul>
      {limit && entries.length > limit && <p className="text-xs bx-muted mt-1">and {entries.length - limit} more in this block</p>}
    </div>
  );
}

export function CiteCard({ n, block, limit }: { n: number; block?: string | null; limit?: number }) {
  const refs = useData(D.references);
  if (!refs) return <p className="bx-muted text-sm" role="status">Loading source…</p>;
  const r = refs.find((x) => x.n === n);
  if (!r) return <p className="bx-todo">Reference [{n}] is not in the pack</p>;
  return (
    <div className="text-sm" data-testid="cite-card">
      <RefHead r={r} />
      {r.summary ? <p className="mt-2 leading-6" data-testid="ref-summary">{r.summary}</p> : <p className="mt-2 bx-todo">TODO(author): summary pending</p>}
      {r.read === 'not-read' && r.read_note && <p className="mt-1 text-[13px] italic">{r.read_note}</p>}
      <Supports n={n} block={block} limit={limit} />
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-semibold">
        <a href={r.url} target="_blank" rel="noreferrer">Open the source <span aria-hidden="true">↗</span><span className="sr-only">(opens in a new tab)</span></a>
        <Link to={`/references#ref-${r.n}`}>Full reference <span aria-hidden="true">→</span></Link>
      </p>
    </div>
  );
}

export function TermCard({ id }: { id: string }) {
  const g = useData(D.glossaryShort);
  if (!g) return <p className="bx-muted text-sm" role="status">Loading…</p>;
  const t = g[id];
  if (!t) return <p className="bx-todo">Unknown term {id}</p>;
  return (
    <div className="text-sm" data-testid="term-card">
      <p className="font-bold">{t.term}</p>
      <p className="mt-1 leading-6">{t.short}</p>
      <p className="mt-2 flex flex-wrap gap-x-4 text-[13px] font-semibold">
        <Link to={`/glossary#term-${id}`}>Full entry <span aria-hidden="true">→</span></Link>
        {t.concept && <Link to={`/concepts/${t.concept}`}>Learn the concept <span aria-hidden="true">→</span> Primer</Link>}
      </p>
    </div>
  );
}

export function statusWords(l: LedgerItem): string {
  const d = fmtDate(l.checked);
  switch (l.status) {
    case 'verified': return `Verified: matched to a quoted passage (${d})`;
    case 'analysis': return `The report's own analysis or arithmetic (${d})`;
    case 'self': return `The report's statement about itself (${d})`;
    case 'absence': return `Not found: looked for and not found in the sources read (${d})`;
    default: return l.status;
  }
}

/** KICKOFF §4b: three status groups, each with a shape or pattern as well as a colour. */
export const GROUP_LABEL: Record<string, string> = { verified: 'verified', own: "the report's own", notfound: 'not found' };
export const GROUP_GLOSS: Record<string, string> = {
  verified: 'matched to a quoted passage',
  own: "the report's analysis, arithmetic or statement about itself",
  notfound: 'looked for and not found in the sources read',
};

/** "settled in the second check"; the writer's own settlements say so (KICKOFF §4b). */
export function passWords(pass: string): string {
  if (pass.startsWith('settled')) return pass;
  return `settled in the ${pass}`;
}
export function settledByWriter(pass: string): boolean {
  return pass.startsWith('consistency pass') || pass === 'settled after the third check';
}

export function ClaimCard({ id }: { id: string }) {
  const idx = useLedgerIndex();
  const refs = useData(D.references);
  if (!idx) return <p className="bx-muted text-sm" role="status">Loading…</p>;
  const l = idx.byId.get(id);
  if (!l) return <p className="bx-todo">Claim {id} is not in the ledger</p>;
  return (
    <div className="text-sm" data-testid="claim-card">
      <p className="text-xs bx-muted font-mono">{l.id} · {l.kind}</p>
      <p className="font-bold mt-0.5" data-testid="claim-status">{statusWords(l)}</p>
      {l.sources.length > 0 && (
        <ul className="mt-2 grid gap-1.5">
          {l.sources.map((s, i) => {
            const r = refs?.find((x) => x.n === s.n);
            return (
              <li key={i} className="text-[13px] leading-5" data-testid="claim-source">
                <Link to={`/references#ref-${s.n}`} className="font-semibold">[{s.n}]{r ? ` ${firstWords(r.title, 10)}` : ''}</Link>
                {s.quote && <> — <q className="italic">{s.quote.replace(/\*\*/g, "")}</q></>}
                {s.locator && <span className="bx-muted text-xs"> ({s.locator})</span>}
              </li>
            );
          })}
        </ul>
      )}
      {l.looked && <p className="mt-2 text-[13px]"><span className="font-semibold">Looked for in:</span> {l.looked}</p>}
      {l.note && <p className="mt-2 text-[13px]"><span className="font-semibold">Note:</span> {l.note}</p>}
      <p className="mt-2 text-xs bx-muted" data-testid="claim-pass">{passWords(l.pass)}{settledByWriter(l.pass) && <span className="block">Settled by the writer after the last independent check.</span>}</p>
      <p className="mt-2 flex flex-wrap gap-x-4 text-[13px] font-semibold">
        <Link to={blockHref(l.block)}>Passage {l.block} <span aria-hidden="true">→</span></Link>
      </p>
    </div>
  );
}
