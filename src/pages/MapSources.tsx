import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { D, useData } from '@/lib/data';

const Markdown = lazy(() => import('@/components/Markdown'));

/** /map/sources — the data dictionary (KICKOFF §4d): all layers, NOTES.md as written, the raw files and checks. */
export default function MapSources() {
  const layers = useData(D.layers);
  const methods = useData(D.methods);
  const locs = useData(D.locations);
  const base = import.meta.env.BASE_URL;
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-3xl sm:text-4xl">Map sources</h1>
      <p className="mt-2 max-w-3xl text-[15px]">Every map layer, where it came from and what to watch for. Values are shown exactly as published; the only computations on the maps are the quantile class breaks, an area's position in the ordered list, and for a survey tract value the interval estimate ± margin of error, each labelled where it appears.</p>
      {!layers ? <p className="bx-muted mt-6" role="status">Loading…</p> : (
        <div className="overflow-x-auto mt-6">
          <table className="w-full text-sm border-collapse" data-testid="layers-table">
            <caption className="text-left font-semibold mb-1">All {layers.length} layers</caption>
            <thead><tr className="bx-th text-left">{['Layer', 'Geography', 'Unit', 'Source', 'Vintage', 'Caveats'].map((h) => <th key={h} className="p-2 border" style={{ borderColor: 'var(--bx-line-soft)' }}>{h}</th>)}</tr></thead>
            <tbody>
              {layers.map((l) => (
                <tr key={l.key} className="align-top" data-testid="layer-row">
                  <td className="p-2 border" style={{ borderColor: 'var(--bx-line-soft)' }}><span className="font-semibold">{l.label}</span><span className="block text-xs bx-muted font-mono">{l.id}</span>
                    <span className="block text-xs">{l.panel_only ? 'shown in the tract panel only' : l.geography[0] === 'county' ? <Link to={`/map/region?layer=${l.id}`}>Region map</Link> : <Link to={`/map/tracts?layer=${l.id}`}>Tract map</Link>}</span></td>
                  <td className="p-2 border" style={{ borderColor: 'var(--bx-line-soft)' }}>{l.geography[0]}{l.family !== 'county' && <span className="block text-xs font-semibold">{l.family === 'survey' ? 'survey estimate with margin of error' : 'modeled estimate'}</span>}<span className="block text-xs bx-muted">{l.group}</span></td>
                  <td className="p-2 border" style={{ borderColor: 'var(--bx-line-soft)' }}>{l.unit}</td>
                  <td className="p-2 border" style={{ borderColor: 'var(--bx-line-soft)' }}><a href={l.url} target="_blank" rel="noreferrer">{l.source_title}</a><span className="block text-xs">{l.publisher} <button type="button" className="bx-cite" data-cite={l.ref} aria-label={`Source ${l.ref}`}>[{l.ref}]</button></span></td>
                  <td className="p-2 border" style={{ borderColor: 'var(--bx-line-soft)' }}>{l.vintage}<span className="block text-xs bx-muted">retrieved {l.retrieved}</span></td>
                  <td className="p-2 border text-xs leading-5" style={{ borderColor: 'var(--bx-line-soft)' }}>{l.caveats}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <section className="mt-10 max-w-4xl" aria-labelledby="files-h">
        <h2 id="files-h" className="text-2xl">The files</h2>
        <p className="mt-2 text-[15px]">The tables the maps draw on, the layer definitions and the overlay file, and every raw file as retrieved, with the checks that matched each retrieval against the publisher's data (<a href={`${base}data/geo/raw/checks.md`}>checks.md</a>).</p>
        <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
          {['ring_counties.csv', 'alabama_benchmark.csv', 'tracts.csv', 'tracts_moe.csv', 'benchmarks.csv', 'layers.json', 'overlays.json', 'NOTES.md', 'tracts-madison-cullman.topo.json'].map((f) => <li key={f}><a href={`${base}data/geo/${f}`} download>{f}</a></li>)}
        </ul>
        {methods && (
          <div className="bx-panel p-3 mt-3 text-sm" data-testid="geometry-record">
            <p className="font-semibold">Tract boundaries</p>
            <p>The Census Bureau's {methods.tractGeometry.vintage}, <a href={methods.tractGeometry.url}>{methods.tractGeometry.url}</a>, downloaded {methods.tractGeometry.downloaded} ({methods.tractGeometry.bytes.toLocaleString('en-US')} bytes{methods.tractGeometry.last_modified ? `; dated ${methods.tractGeometry.last_modified} on the Bureau's server` : ''}). SHA-256 <code className="break-all">{methods.tractGeometry.sha256}</code>. The 117 tracts of counties 089 and 043 were kept, checked against <code>tracts.csv</code> as a set, lightly simplified and committed; the site never fetches them. County outlines come from the <code>us-atlas</code> package. Record: <a href={`${base}data/geo/raw/tract_geometry.json`}>tract_geometry.json</a>.</p>
          </div>
        )}
        <h3 className="text-lg mt-4">Raw files</h3>
        <ul className="mt-1 grid gap-1 text-sm sm:grid-cols-2" data-testid="raw-files">
          {(methods?.rawFiles ?? []).map((f) => <li key={f.name}><a href={`${base}data/geo/raw/${f.name}`} download>{f.name}</a> <span className="bx-muted text-xs">{(f.bytes / 1024).toFixed(1)} KB</span></li>)}
        </ul>
      </section>
      <section className="mt-10" aria-labelledby="locs-h">
        <h2 id="locs-h" className="text-2xl">Service locations</h2>
        <p className="mt-2 max-w-3xl text-[15px]">The {locs?.locations.length ?? 54} places the report names with a street address in a cited source, with how each was placed. <code>precision</code>: address (matched by a geocoder), approximate (drawn hollow on the maps), ambiguous or none (not drawn).</p>
        {!locs ? <p className="bx-muted" role="status">Loading…</p> : (
          <div className="overflow-x-auto mt-3"><table className="w-full text-sm border-collapse" data-testid="locations-table">
            <thead><tr className="bx-th text-left">{['Place', 'Type', 'Address as printed', 'County', 'Precision', 'Placed by', 'Note'].map((h) => <th key={h} className="p-2 border" style={{ borderColor: 'var(--bx-line-soft)' }}>{h}</th>)}</tr></thead>
            <tbody>{locs.locations.map((p) => (
              <tr key={p.id} className="align-top">
                <td className="p-2 border" style={{ borderColor: 'var(--bx-line-soft)' }}><span className="font-semibold">{p.name}</span> <button type="button" className="bx-cite" data-cite={p.ref} aria-label={`Source ${p.ref}`}>[{p.ref}]</button></td>
                <td className="p-2 border" style={{ borderColor: 'var(--bx-line-soft)' }}>{locs.types[p.type] ?? p.type}</td>
                <td className="p-2 border" style={{ borderColor: 'var(--bx-line-soft)' }}>{p.address}, {p.city}</td>
                <td className="p-2 border" style={{ borderColor: 'var(--bx-line-soft)' }}>{p.county}{p.in_core ? ' (core)' : ''}</td>
                <td className="p-2 border font-semibold" style={{ borderColor: 'var(--bx-line-soft)' }}>{p.precision}</td>
                <td className="p-2 border" style={{ borderColor: 'var(--bx-line-soft)' }}>{p.coord_source ?? '—'}</td>
                <td className="p-2 border text-xs leading-5" style={{ borderColor: 'var(--bx-line-soft)' }}>{p.note}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
      <section className="mt-10 max-w-4xl" aria-labelledby="notes-h">
        <h2 id="notes-h" className="text-2xl">Notes on the map data, as written</h2>
        <div className="mt-3 bx-prose text-[15px] [&_h1]:text-2xl [&_h2]:text-xl [&_h2]:mt-6 [&_h3]:mt-4 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:my-1 [&_table]:text-sm [&_td]:border [&_th]:border [&_td]:p-1.5 [&_th]:p-1.5 [&_code]:font-mono [&_code]:text-[13px] overflow-x-auto">
          {methods ? <Suspense fallback={<p className="bx-muted">Loading…</p>}><Markdown md={methods.geoNotes} /></Suspense> : <p className="bx-muted" role="status">Loading…</p>}
        </div>
      </section>
    </div>
  );
}
