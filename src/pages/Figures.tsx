import { Link } from 'react-router-dom';
import { D, useData } from '@/lib/data';

export default function Figures() {
  const figs = useData(D.figures);
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl sm:text-4xl">Figures</h1>
      <p className="bx-prose mt-2">Six figures, each built for this site from cited public data or drawn from the report's own dependency table. None is a reproduced image.</p>
      {!figs ? <p className="bx-muted mt-6" role="status">Loading…</p> : (
        <ul className="mt-6 grid gap-4">
          {figs.map((f) => (
            <li key={f.id} className="bx-card p-4">
              <Link to={`/figures/${f.id}`} className="font-bold text-lg">{f.label}. {f.title}</Link>
              <p className="text-xs bx-muted mt-0.5">{f.kind} · {f.synthesis === 'data' ? 'synthesised from data across cited works' : 'a conceptual diagram'}</p>
              <p className="mt-1 text-[15px]">{f.caption}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
