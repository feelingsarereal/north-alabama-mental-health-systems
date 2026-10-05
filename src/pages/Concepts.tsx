import { Link } from 'react-router-dom';
import { conceptsIndex } from '@/lib/data';

export default function Concepts() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl sm:text-4xl">Primers</h1>
      <p className="bx-prose mt-2">Twelve short introductions to the ideas the report assumes, written for a reader with no background in health policy, each from the report's sources and with a self-check at the end. Start with “One service area, three maps”.</p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {[...conceptsIndex].sort((a, b) => (a.id === 'three-maps' ? -1 : b.id === 'three-maps' ? 1 : 0)).map((c) => (
          <li key={c.id} className="bx-card p-4">
            <Link to={`/concepts/${c.id}`} className="font-bold text-lg">{c.title}</Link>
            <p className="mt-1 text-[15px]">{c.one_liner}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
