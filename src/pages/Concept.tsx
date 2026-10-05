import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { D, useData, conceptsIndex, figuresIndex } from '@/lib/data';
import { renderNodes } from '@/components/Rich';
import { AddNoteButton } from '@/components/AddNoteButton';
import type { ConceptT } from '@/types';

function Quiz({ c }: { c: ConceptT }) {
  const [picked, setPicked] = useState<Record<number, number>>({});
  return (
    <section className="mt-10" aria-labelledby="sc-h">
      <h2 id="sc-h" className="text-2xl">Self-check</h2>
      <ol className="mt-3 grid gap-5">
        {c.self_check.map((q, qi) => (
          <li key={qi} className="bx-card p-4">
            <fieldset>
              <legend className="font-semibold">{qi + 1}. {q.q}</legend>
              <div className="mt-2 grid gap-1.5">
                {q.options.map((o, oi) => (
                  <label key={oi} className="flex gap-2 items-start text-[15px] cursor-pointer">
                    <input type="radio" name={`q${qi}`} className="mt-1.5" checked={picked[qi] === oi} onChange={() => setPicked((p) => ({ ...p, [qi]: oi }))} />
                    <span>{o}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {picked[qi] !== undefined && (
              <p className="mt-2 text-[15px]" role="status"><strong>{picked[qi] === q.answer ? 'Right.' : `Not quite — the answer is: ${q.options[q.answer]}`}</strong> {q.explanation}</p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function Concept() {
  const { id = '' } = useParams();
  const all = useData(D.concepts);
  const g = useData(D.glossaryShort);
  const c = all?.find((x) => x.id === id);
  if (all && !c) return <div className="mx-auto max-w-3xl px-4 py-8"><h1 className="text-3xl">Primer not found</h1><p className="mt-2"><Link to="/concepts">All primers →</Link></p></div>;
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <p className="text-sm"><Link to="/concepts">← Primers</Link></p>
      {!c ? <p className="bx-muted" role="status">Loading…</p> : (
        <article>
          <h1 className="text-3xl sm:text-4xl mt-2">{c.title}</h1>
          <p className="text-lg mt-2">{c.one_liner}</p>
          <p className="mt-3 bx-panel p-3 text-[15px]"><strong>Why the report needs it: </strong>{c.why_here}</p>
          <p className="mt-2"><AddNoteButton anchor={{ type: 'unit', id: c.id }} /></p>
          {c.prerequisites.length > 0 && <p className="mt-3 text-sm">Read first: {c.prerequisites.map((p, i) => <span key={p}>{i ? ', ' : ''}<Link to={`/concepts/${p}`}>{conceptsIndex.find((x) => x.id === p)?.title ?? p}</Link></span>)}</p>}
          <div className="bx-reader mt-6 [&_h2]:text-2xl [&_h2]:mt-8 [&_h2]:mb-2 [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6" data-testid="concept-body">{renderNodes(c.body, { key: c.id })}</div>
          {c.terms.length > 0 && (
            <section className="mt-8"><h2 className="text-xl">Terms in this primer</h2>
              <p className="mt-2 flex flex-wrap gap-2 text-sm">{c.terms.map((t) => <Link key={t} to={`/glossary#term-${t}`} className="bx-chip-line no-underline">{g?.[t]?.term ?? t}</Link>)}</p>
            </section>
          )}
          {c.figures.length > 0 && <p className="mt-4 text-sm">Figures: {c.figures.map((f) => <Link key={f} to={`/figures/${f}`} className="mr-2">{figuresIndex.find((x) => x.id === f)?.title ?? f}</Link>)}</p>}
          <section className="mt-8"><h2 className="text-xl">Further reading</h2>
            <ul className="mt-2 grid gap-1 text-[15px]">{c.further_reading.map((r) => <li key={r.url}><a href={r.url} target="_blank" rel="noreferrer">{r.title} ↗</a>{r.kind && <span className="bx-muted text-xs"> · {r.kind}</span>}</li>)}</ul>
          </section>
          <Quiz c={c} />
        </article>
      )}
    </div>
  );
}
