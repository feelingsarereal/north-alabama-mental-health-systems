import { Link } from 'react-router-dom';
import { AS_OF_TEXT, companion, conceptsIndex, counts, manifest, stats } from '@/lib/data';
import { Logo } from '@/components/Layout';

const fmt = (n: number) => n.toLocaleString('en-US');

/** The front door (KICKOFF §4): mark, title, draft status in words, abstract, as_of, five entry cards, the primers. */
export default function Home() {
  const primers = [...conceptsIndex].sort((a, b) => (a.id === 'three-maps' ? -1 : b.id === 'three-maps' ? 1 : 0));
  const cards = [
    { to: '/read', title: 'Read the report', text: 'The report, with the source of every sentence one hover away: a summary of the source and the passage that supports the sentence.', nums: `${fmt(stats.ledger_entries)} claims · ${fmt(stats.ledger_by_status.verified)} verified against a quoted passage` },
    { to: '/open-items', title: 'See what could not be settled', text: 'Everything that could not be read, confirmed or found, each with where it was looked for and what would close it.', nums: `${fmt(stats.open_items)} open items · ${fmt(counts.open_browser)} that anyone with a browser can close` },
    { to: '/map/region', title: 'Explore the region on two maps', text: 'The fifteen counties of the Huntsville crisis catchment, and the census tracts of Madison and Cullman with the service locations the report names.', nums: `${fmt(counts.counties)} counties · ${fmt(counts.tracts)} census tracts · ${fmt(counts.layers)} layers`, extra: { to: '/map/tracts', label: 'The tract map' } },
    { to: '/systems', title: 'Explore the system as a graph', text: "The statewide report's twelve parts plus the ring, the dependencies this report draws between them, and the Madison, Cullman and Alabama figures behind each.", nums: `${fmt(counts.nodes)} parts · ${fmt(counts.rows)} dependencies` },
    { to: '/concepts', title: 'Learn the ideas', text: 'Short primers and a glossary written for a reader with no background in health policy.', nums: `${fmt(counts.primers)} primers · ${fmt(counts.glossary)} glossary terms`, extra: { to: '/glossary', label: 'The glossary' } },
  ];
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Logo height={72} />
      <h1 className="mt-6 text-4xl sm:text-5xl leading-tight">{manifest.title}</h1>
      <p className="mt-2 text-xl bx-muted">{manifest.subtitle}</p>
      <p className="mt-4 text-[15px] font-semibold" data-testid="venue">{manifest.venue}</p>
      <p className="mt-1 flex flex-wrap gap-2 items-center text-sm">
        <span className="bx-asof" data-testid="as-of">Current as of {AS_OF_TEXT}</span>
        <span className="bx-chip-line">Version {manifest.report.version}</span>
        <span className="bx-chip-line">{manifest.authors.join(', ')}</span>
      </p>
      <p className="bx-prose mt-6 max-w-3xl text-[17px] leading-8">{manifest.plain_abstract}</p>
      <p className="mt-6 flex flex-wrap gap-4 items-center">
        <Link to="/read" className="bx-btn-primary !text-base !px-4 !py-2 no-underline">Start reading <span aria-hidden="true">→</span></Link>
        {companion && <a href={companion.url} target="_blank" rel="noreferrer" className="font-semibold" data-testid="companion-link">The statewide report <span aria-hidden="true">↗</span></a>}
      </p>

      <h2 className="mt-12 text-2xl">Five ways in</h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <li key={c.to} className="bx-card p-4 flex flex-col">
            <h3 className="text-xl" style={{ color: 'var(--bx-head)' }}><Link to={c.to} className="no-underline hover:underline" style={{ color: 'inherit' }}>{c.title}</Link></h3>
            <p className="mt-1 text-[15px] leading-6 flex-1">{c.text}</p>
            <p className="mt-3 text-sm font-semibold" data-testid="card-numbers">{c.nums}</p>
            {c.extra && <p className="mt-1 text-sm"><Link to={c.extra.to}>{c.extra.label} →</Link></p>}
          </li>
        ))}
      </ul>

      <h2 className="mt-12 text-2xl">Start with a primer</h2>
      <p className="bx-muted mt-1 text-[15px]">Twelve short introductions to the ideas the report assumes, each with a self-check.</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {primers.map((c) => (
          <li key={c.id} className="bx-card p-3">
            <Link to={`/concepts/${c.id}`} className="font-bold">{c.title}</Link>
            <p className="text-sm mt-0.5">{c.one_liner}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
