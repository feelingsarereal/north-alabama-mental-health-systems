import { useState } from 'react';
import { Link } from 'react-router-dom';
import { D, blockHref, sectionTitle, useData, AS_OF_TEXT } from '@/lib/data';
import { passWords, settledByWriter } from '@/components/cards';

const n = (x: number | undefined) => (x ?? 0).toLocaleString('en-US');
const STATUS_WORDS: Record<string, string> = {
  verified: 'verified: matched to a quoted passage in a cited source', analysis: "the report's own analysis or arithmetic",
  absence: 'dated "not found" statements: looked for and not found in the sources read', self: 'statements about the report itself',
};
const ROUND_WORDS: Record<string, string> = {
  first_check: 'first check (all 283 blocks)', second_check: 'second check (blocks changed after the first)', third_check: 'third check (blocks changed after the second)',
  consistency_pass: 'consistency pass against the open-items list', second_consistency_pass: 'second consistency pass, after the glossary and primers were written',
};

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return <section id={id} className="mt-10 scroll-mt-40" aria-labelledby={`${id}-h`}><h2 id={`${id}-h`} className="text-2xl">{title}</h2><div className="mt-2 bx-prose grid gap-2">{children}</div></section>;
}

function Findings({ rows }: { rows: { claim: string; n: number; finding: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <details onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer">The research finding behind each supporting passage ({n(rows.length)})</summary>
      {open && (
        <div className="overflow-x-auto max-h-[28rem] overflow-y-auto mt-2"><table className="w-full text-sm border-collapse">
          <thead><tr className="bx-th text-left"><th className="p-1.5">Claim</th><th className="p-1.5">Reference</th><th className="p-1.5">Finding</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i} className="border-t" style={{ borderColor: 'var(--bx-line-soft)' }}><td className="p-1.5 font-mono"><Link to={blockHref(r.claim.split('.')[0])}>{r.claim}</Link></td><td className="p-1.5"><Link to={`/references#ref-${r.n}`}>[{r.n}]</Link></td><td className="p-1.5 font-mono">{r.finding}</td></tr>)}</tbody>
        </table></div>
      )}
    </details>
  );
}

export default function Methods() {
  const m = useData(D.methods);
  const ois = useData(D.openItems);
  if (!m) return <div className="mx-auto max-w-4xl px-4 py-8"><h1 className="text-3xl sm:text-4xl">Methods</h1><p className="bx-muted mt-4" role="status">Loading…</p></div>;
  const s = m.scope; const v = m.verification; const p = m.provenance;
  const passes = Object.entries(v.ledger_by_pass as Record<string, number>);
  const writerPasses = passes.filter(([k]) => settledByWriter(k));
  const authorItems = (ois ?? []).filter((o) => o.who === 'author');
  const base = import.meta.env.BASE_URL;
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl sm:text-4xl">Methods and provenance</h1>
      <p className="bx-prose mt-3 font-semibold" data-testid="methods-sentence">This is a scope-bounded description built from public sources, not a systematic review and not an evaluation of any organization.</p>
      <p className="bx-prose mt-2">The report was researched and written with Claude for Little Orange Fish from public sources, and read back against its sources on {AS_OF_TEXT}. This site renders it as written. The source summaries, glossary, primers, open items and map data were prepared for this site. Everything here comes from the content pack; where the pack has a gap, it is listed below rather than filled.</p>
      <nav aria-label="On this page" className="mt-4 text-sm flex flex-wrap gap-x-4 gap-y-1">
        {[['scope', 'Scope'], ['interview', 'Interview'], ['strategy', 'How sources were found'], ['check', 'The check'], ['aids', 'Glossary and primers'], ['mapdata', 'Map data'], ['partial', 'Read in part'], ['corpus', 'Corpus'], ['gaps', 'Known gaps'], ['analysis', 'Analysis passages'], ['coverage', 'Coverage counts'], ['todo', 'TODO(author)'], ['errors', 'Build errors']].map(([id, t]) => <a key={id} href={`#${id}`}>{t}</a>)}
      </nav>

      <Section id="scope" title="Scope">
        <p><strong>The question:</strong> {s.question}</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><h3 className="text-lg">In scope</h3><ul className="list-disc pl-5">{s.boundary.in.map((x) => <li key={x}>{x}</li>)}</ul></div>
          <div><h3 className="text-lg">Out of scope</h3><ul className="list-disc pl-5">{s.boundary.out.map((x) => <li key={x}>{x}</li>)}</ul></div>
        </div>
        <p><strong>Why:</strong> {s.boundary.rationale}</p>
        {s.excluded.length > 0 && <><h3 className="text-lg">Left out, with reasons</h3><ul className="list-disc pl-5">{s.excluded.map((x) => <li key={x.what}><strong>{x.what}</strong> — {x.why}</li>)}</ul></>}
        {s.anchors.length > 0 && <><h3 className="text-lg">Anchor source</h3><ul className="list-disc pl-5">{s.anchors.map((x) => <li key={x.citation}><strong>{x.citation}</strong> — {x.why}</li>)}</ul></>}
        <p className="text-sm">Level: {s.level} · stance: {s.stance} · depth: {s.depth}{s.frame ? ` · frame: ${s.frame}` : ''}{s.target_words ? ` · target ${n(s.target_words)} words, written ${n(s.words)}` : ''}</p>
        <p className="text-sm">Time window: {Object.entries(s.time_window).map(([k, x]) => `${k.replace(/_/g, ' ')}: ${x}`).join('; ')}</p>
      </Section>

      <Section id="interview" title="The interview, as asked and answered">
        <dl className="grid gap-2">{s.interview.map((x, i) => <div key={i} className="bx-card p-3"><dt className="font-semibold">{x.q}</dt><dd>{x.answer} <span className="bx-muted text-sm">({x.asked})</span></dd></div>)}</dl>
      </Section>

      <Section id="strategy" title="How sources were found">
        <p>Run on {s.search_strategy.run_on}{s.search_strategy.status ? ` (${s.search_strategy.status})` : ''}. Sources: {s.search_strategy.sources.join('; ')}.</p>
        <p className="bx-panel p-3 text-[15px]">The {n(s.search_strategy.queries.length)} queries below are as written, each with the phase of the research it served. <strong>Hit counts are blank because the search tool returns none</strong>; nothing has been estimated in their place.</p>
        <details open><summary className="cursor-pointer font-semibold">All {n(s.search_strategy.queries.length)} queries</summary>
          <div className="overflow-x-auto max-h-[32rem] overflow-y-auto mt-2"><table className="w-full text-sm border-collapse" data-testid="queries-table">
            <thead><tr className="bx-th text-left"><th className="p-2">#</th><th className="p-2">Query</th><th className="p-2">What it was for</th><th className="p-2">Source</th><th className="p-2">Hits</th></tr></thead>
            <tbody>{s.search_strategy.queries.map((q, i) => <tr key={i} className="border-t align-top" style={{ borderColor: 'var(--bx-line-soft)' }}><td className="p-2 bx-muted">{i + 1}</td><td className="p-2">{q.q}</td><td className="p-2">{q.phase}</td><td className="p-2">{q.source}</td><td className="p-2 bx-muted">{q.hits === null ? 'none returned' : n(q.hits)}</td></tr>)}</tbody>
          </table></div>
        </details>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><h3 className="text-lg">Included</h3><ul className="list-disc pl-5">{s.search_strategy.inclusion.map((x) => <li key={x}>{x}</li>)}</ul></div>
          <div><h3 className="text-lg">Excluded</h3><ul className="list-disc pl-5">{s.search_strategy.exclusion.map((x) => <li key={x}>{x}</li>)}</ul></div>
        </div>
        {s.search_strategy.snowball.length > 0 && <><h3 className="text-lg">Followed from each source</h3><ul className="list-disc pl-5">{s.search_strategy.snowball.map((x) => <li key={x}>{x}</li>)}</ul></>}
      </Section>

      <Section id="check" title="The check, in plain numbers">
        <p>{v.method}</p>
        <h3 className="text-lg">Problems found and fixed, by round</h3>
        <ul className="list-disc pl-5">{Object.entries(v.problems_found_and_fixed as Record<string, number>).map(([k, x]) => <li key={k}>{ROUND_WORDS[k] ?? k.replace(/_/g, ' ')}: <strong>{n(x)}</strong></li>)}</ul>
        <h3 className="text-lg">The ledger, by status</h3>
        <p>The report carries a ledger of <strong>{n(v.ledger_entries)}</strong> entries, one per claim it makes, over {n(v.blocks)} blocks of text:</p>
        <ul className="list-disc pl-5">{Object.entries(v.ledger_by_status as Record<string, number>).sort((a, b) => b[1] - a[1]).map(([k, x]) => <li key={k}>{n(x)} {STATUS_WORDS[k] ?? k}</li>)}</ul>
        <h3 className="text-lg">The ledger, by the round that settled each entry</h3>
        <ul className="list-disc pl-5">{passes.map(([k, x]) => <li key={k}>{n(x)} {passWords(k)}</li>)}</ul>
        <p className="bx-panel p-3 text-[15px]" data-testid="writer-settled"><strong>{writerPasses.map(([, x]) => n(x)).join(' + ')} entries were settled by the writer after the last independent round</strong>: {writerPasses.map(([k, x]) => `${n(x)} ${passWords(k)}`).join('; ')}. The reader marks each of them “Settled by the writer after the last independent check.”</p>
        <p>What could not be settled is on the <Link to="/open-items">Open items</Link> page: {n(v.open_items)} items ({Object.entries(v.open_items_by_group as Record<string, number>).map(([k, x]) => `${n(x)} ${k.toLowerCase()}`).join('; ')}).</p>
        <p className="bx-panel p-3 text-[15px]" data-testid="reader-note">Sources were read through an automated page reader that returns extracts. The supporting passages shown in the reader are as the page reader returned them, and locators are approximate.</p>
        <Findings rows={m.findings} />
      </Section>

      <Section id="aids" title="The glossary and primers">
        <p>{n(v.reader_aids.glossary_terms)} glossary terms and {n(v.reader_aids.primers)} primers were written for this site. Check: {v.reader_aids.check}. Problems found and fixed: <strong>{n(v.reader_aids.problems_found_and_fixed)}</strong>.</p>
      </Section>

      <Section id="mapdata" title="The map data">
        <p>{n(v.map_data.counties)} counties ({n(v.map_data.county_layers)} layers) and {n(v.map_data.tracts)} census tracts ({n(v.map_data.tract_layers)} map layers), with {n(v.map_data.service_locations)} service locations, of which {n(v.map_data.service_locations_placed)} are placed on the map. Every retrieval was checked against the publisher's data: <a href={`${base}data/geo/raw/checks.md`}>checks.md</a>. Tract boundaries are the Census Bureau's 2023 cartographic boundary file, downloaded once at build time ({m.tractGeometry.downloaded}, {n(m.tractGeometry.bytes)} bytes, SHA-256 <code className="break-all">{m.tractGeometry.sha256}</code>). <Link to="/map/sources">All layers and their sources →</Link></p>
      </Section>

      <Section id="partial" title="What “read in part” means">
        <p>A source marked <em>read in part</em> could not be read in full: the page reader returned only part of the document, or only some of its pages could be reached. The claims that rest on it were checked against what could be read. <strong>{n(p.references?.by_read?.partial)}</strong> of {n(p.references?.total)} references were read in part, and {n(p.references?.by_read?.['not-read'])} could not be opened and is cited only for that fact. <Link to="/references?read=partial">See them →</Link></p>
      </Section>

      <Section id="corpus" title="The corpus">
        <p>{n(s.corpus_profile.documents_recorded)} documents recorded; {n(s.corpus_profile.references_cited)} cited. {n(s.corpus_profile.findings_recorded)} findings recorded, {n(s.corpus_profile.findings_used)} used; {n(s.corpus_profile.conflicts_logged)} conflicts logged; {n(s.corpus_profile.not_found_logged)} “not found” findings; {n(s.corpus_profile.could_not_read)} addresses that could not be read; {n(s.corpus_profile.rechecks)} rechecks.</p>
        <p>By tier: {Object.entries(s.corpus_profile.by_tier).map(([k, x]) => `${n(x)} ${k}`).join(' · ')}. By kind: {Object.entries(s.corpus_profile.by_kind).map(([k, x]) => `${n(x)} ${k}`).join(' · ')}. Published {s.corpus_profile.year_range[0]}–{s.corpus_profile.year_range[1]}; {n(s.corpus_profile.undated)} undated pages, dated by the day they were read.</p>
        <p>{s.corpus_profile.concentration}</p>
        <p>Dissent represented: {s.corpus_profile.dissent_represented ? 'yes' : 'no'}.</p>
      </Section>

      <Section id="gaps" title="Known gaps in the search">
        <ul className="list-disc pl-5">{s.search_strategy.known_gaps.map((x) => <li key={x}>{x}</li>)}</ul>
      </Section>

      <Section id="analysis" title={`Every analysis passage (${m.synthesis.length})`}>
        <p>Passages marked <em>analysis</em> are the report's own reading of the evidence, chiefly its “Gaps and opportunities” lists, and are marked in the reader with a quiet rule. <strong>{n(m.framing)}</strong> further passages are marked as framing (introductions, transitions and the report's statements about itself), which carry no claim of fact.</p>
        <ol className="grid gap-1 text-sm list-decimal pl-6">{m.synthesis.map((x) => <li key={x.id}><Link to={`/read#${x.id}`}>{sectionTitle(x.section)} · {x.block}</Link> — <span className="bx-muted">{x.excerpt}</span></li>)}</ol>
      </Section>

      <Section id="coverage" title="Coverage counts">
        <ul className="list-disc pl-5 text-[15px]">
          <li>{n(p.blocks?.total)} blocks of text ({n(p.blocks?.cited)} cited, {n(p.blocks?.framing)} framing, {n(p.blocks?.synthesis)} analysis); {n(p.blocks?.uncited)} uncited blocks of 25 words or more.</li>
          <li>{n(p.ledger?.anchored)} of {n(p.ledger?.entries)} ledger entries anchored in the text; {n(p.ledger?.anchor_errors)} anchor errors.</li>
          <li>Glossary: {n(p.terms?.linked)} of {n(p.terms?.occurring_in_text)} terms that occur in the text are linked ({p.terms?.linked_pct}%).{p.terms?.not_in_text?.length ? ` Not in the report's text (they serve the maps and this site): ${p.terms.not_in_text.join(', ')}.` : ''}</li>
          <li>{n(p.references?.with_summary)} of {n(p.references?.total)} references have a summary.</li>
          <li>Figures: {Object.entries(p.figures?.by_synthesis ?? {}).map(([k, x]) => `${x} ${k === 'data' ? 'built from data' : 'conceptual'}`).join(', ')}.</li>
          <li>Maps: {n(p.maps?.layers)} layers over {n(p.maps?.counties)} counties and {n(p.maps?.tracts)} tracts; {n(p.maps?.raw_files)} raw files; <Link to="/map/sources">map sources →</Link></li>
          <li>Systems graph: {n(p.systems?.nodes)} parts, {n(p.systems?.edges)} drawn links from {n(p.systems?.rows)} rows of the report's dependency table.</li>
        </ul>
        <p className="text-sm">The full counts are in <a href={`${base}provenance.json`}>provenance.json</a>.</p>
      </Section>

      <Section id="todo" title={`TODO(author) — ${authorItems.length} open items for the author`}>
        <p>Gaps the pack records rather than fills: the open items only the author can close. The rest are on the <Link to="/open-items">Open items</Link> page.</p>
        {!ois ? <p className="bx-muted" role="status">Loading…</p> : (
          <ul className="grid gap-1 text-sm">{authorItems.map((o) => <li key={o.id}><span className="bx-todo mr-1">TODO(author)</span><Link to={`/open-items#${o.id}`} className="font-mono">{o.id}</Link> — {o.what_text}</li>)}</ul>
        )}
      </Section>

      <Section id="errors" title={`Build errors (${m.errors.length})`}>
        {m.errors.length === 0 ? <p>None: the content pack built without errors.</p> : (
          <>
            <p>The content build lists these and writes them to <code>content-pack/BUILD-ERRORS.md</code>. Each needs a decision in the pack; the site was built from everything that validated.</p>
            <ul className="grid gap-1 text-sm">{m.errors.map((e, i) => <li key={i} className="bx-card p-2 border-l-4 break-words" style={{ borderLeftColor: 'var(--bx-amber)' }}>{e}</li>)}</ul>
          </>
        )}
        {m.anchorErrors.length > 0 && <ul className="grid gap-1.5 text-sm">{m.anchorErrors.map((u) => <li key={u.id} className="bx-card p-2"><span className="font-mono font-semibold">{u.id}</span> · <Link to={blockHref(u.block)}>{u.block}</Link> · {u.reason}</li>)}</ul>}
        {m.warnings.length > 0 && <details><summary className="cursor-pointer">Warnings ({m.warnings.length})</summary><ul className="text-sm list-disc pl-5">{m.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></details>}
      </Section>
    </div>
  );
}
