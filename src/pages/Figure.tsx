import { Link, useParams } from 'react-router-dom';
import { D, sectionTitle, useData, conceptsIndex } from '@/lib/data';
import FigureBody from '@/components/figures/FigureBody';
import { AddNoteButton } from '@/components/AddNoteButton';

export default function Figure() {
  const { id = '' } = useParams();
  const figs = useData(D.figures);
  const f = figs?.find((x) => x.id === id);
  if (figs && !f) return <div className="mx-auto max-w-3xl px-4 py-8"><h1 className="text-3xl">Figure not found</h1><p className="mt-2"><Link to="/figures">All figures →</Link></p></div>;
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <p className="text-sm"><Link to="/figures">← Figures</Link></p>
      {!f ? <p className="bx-muted" role="status">Loading…</p> : (
        <>
          <h1 className="text-3xl sm:text-4xl mt-2">{f.label}. {f.title}</h1>
          <p className="mt-2 text-sm flex flex-wrap gap-2 items-center">
            <span className="bx-chip-line">{f.synthesis === 'data' ? 'Synthesised from data across cited works' : 'A conceptual diagram: the drawing is the builder’s, the links and their wording are the report’s'}</span>
            <span>Built from: {f.refs.map((n) => <button key={n} type="button" className="bx-cite" data-cite={n} aria-label={`Source ${n}`}>[{n}]</button>)}</span>
            <AddNoteButton anchor={{ type: 'figure', id: f.id }} />
          </p>
          <div className="bx-card p-4 mt-4"><FigureBody id={f.id} /></div>
          <section className="mt-6 max-w-3xl">
            <h2 className="text-xl">How to read this figure</h2>
            <p className="bx-prose mt-1">{f.how_to_read}</p>
            <p className="text-sm bx-muted mt-3">{f.source}</p>
          </section>
          <section className="mt-6 grid gap-4 sm:grid-cols-2 max-w-3xl text-sm">
            <div>
              <h2 className="text-xl">Concepts in this figure</h2>
              <ul className="mt-1 grid gap-2">{f.concepts.map((c) => <li key={c}><Link to={`/concepts/${c}`}>{conceptsIndex.find((x) => x.id === c)?.title ?? c}</Link></li>)}</ul>
            </div>
            <div>
              <h2 className="text-xl">Where it is discussed</h2>
              <ul className="mt-1 grid gap-2">{f.discussed_in.map((s) => <li key={s}><Link to={`/read#${s}`}>{sectionTitle(s)}</Link></li>)}</ul>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
