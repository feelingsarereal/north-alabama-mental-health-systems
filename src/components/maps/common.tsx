/**
 * Pieces both maps share (KICKOFF §4d): the hatch for empty cells, the legend (quantile classes with their printed
 * breaks, or categories with counts), the layer picker, "About this layer", and the service-location markers with
 * their legend and panel. Markers have a shape per type as well as a colour; approximate points are hollow; points
 * that could not be placed are listed under the legend, never drawn.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { blockHref } from '@/lib/data';
import { CiteCard } from '@/components/cards';
import { CAT_COLORS, MISSING, RAMP, fmtBreak, higherLine, retrievalWords, unitWords } from './format';
import type { LayerT, LocationsData, MapMarker, ServiceLocation } from '@/types';

export function useNarrow(q = '(max-width: 639px)') {
  const [n, setN] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => { const mq = window.matchMedia(q); const on = () => setN(mq.matches); mq.addEventListener('change', on); return () => mq.removeEventListener('change', on); }, [q]);
  return n;
}

export function HatchDefs({ id = 'hatch' }: { id?: string }) {
  return (
    <defs>
      <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="6" height="6" fill="var(--bx-bg)" /><line x1="0" y1="0" x2="0" y2="6" stroke="var(--bx-muted)" strokeWidth="1.6" />
      </pattern>
    </defs>
  );
}

function HatchSwatch({ id }: { id: string }) {
  return <svg width="16" height="12" aria-hidden="true"><defs><pattern id={id} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="var(--bx-muted)" strokeWidth="1.4" /></pattern></defs><rect width="16" height="12" fill={`url(#${id})`} stroke="var(--bx-line)" /></svg>;
}

/** Fill for one cell: a ramp class, a category colour, or the hatch for an empty cell (never zero). */
export function fillFor(raw: string | undefined, num: number | null, layer: LayerT, cat: Map<string, number>, classOf: (v: number | null, b: number[]) => number | null): string {
  if (raw === '' || raw === undefined) return 'url(#hatch)';
  if (layer.type === 'categorical') return CAT_COLORS[(cat.get(raw) ?? 0) % CAT_COLORS.length];
  const k = classOf(num, layer.stat.breaks);
  return k === null ? 'url(#hatch)' : RAMP[k];
}

export function Legend({ layer, of }: { layer: LayerT; of: string }) {
  const stat = layer.stat;
  const hl = higherLine(layer);
  return (
    <div className="text-xs mb-2" data-testid="map-legend" data-layer={layer.key}>
      {layer.type === 'numeric' ? (
        <>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 items-center">
            {RAMP.map((c, k) => {
              const b = stat.breaks;
              const label = !b.length ? '' : k === 0 ? `under ${fmtBreak(b[0])}` : k === RAMP.length - 1 ? `${fmtBreak(b[b.length - 1])} and over` : `${fmtBreak(b[k - 1])} to under ${fmtBreak(b[k])}`;
              return <li key={k} className="flex items-center gap-1" data-testid="legend-class"><span aria-hidden="true" className="inline-block w-4 h-3 border" style={{ background: c, borderColor: 'var(--bx-line)' }} />{label}</li>;
            })}
            <li className="flex items-center gap-1"><HatchSwatch id="hatch-legend" />{MISSING} ({stat.missing.length})</li>
          </ul>
          <p className="mt-1 bx-muted">Five classes, each about a fifth of the {stat.published} published values of {of}; class breaks computed from the published values. {hl && <strong className="font-semibold" style={{ color: 'var(--bx-ink)' }} data-testid="higher-line">{hl}.</strong>} {unitWords(layer) && <>Unit: {layer.unit}.</>}</p>
        </>
      ) : (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 items-center">
          {(stat.categories ?? []).map((c, i) => <li key={c.value} className="flex items-center gap-1" data-testid="legend-class"><span aria-hidden="true" className="inline-block w-4 h-3" style={{ background: CAT_COLORS[i % CAT_COLORS.length] }} />{c.value.replace(/_/g, ' ')} ({c.count})</li>)}
          {stat.missing.length > 0 && <li className="flex items-center gap-1"><HatchSwatch id="hatch-legend2" />{MISSING} ({stat.missing.length})</li>}
        </ul>
      )}
      {stat.missing.length > 0 && layer.suppressed_note && (
        <details className="mt-1"><summary className="cursor-pointer">Why some cells are empty</summary><p className="mt-1">{layer.suppressed_note}</p></details>
      )}
    </div>
  );
}

export function LayerPicker({ layers, groups, value, onChange, narrow, label = 'Layer' }: { layers: LayerT[]; groups: { title: string; layers: LayerT[] }[]; value: string; onChange: (id: string) => void; narrow: boolean; label?: string }) {
  const [q, setQ] = useState('');
  const match = (l: LayerT) => !q || `${l.label} ${l.group} ${l.definition}`.toLowerCase().includes(q.toLowerCase());
  return (
    <div>
      <label className="block text-sm font-semibold" htmlFor="layer-search">{label}</label>
      <input id="layer-search" className="bx-input mt-1" type="search" placeholder="Search layers…" value={q} onChange={(e) => setQ(e.target.value)} />
      <label className="sr-only" htmlFor="layer-select">Choose a layer</label>
      <select id="layer-select" className="bx-input mt-2" size={narrow ? 1 : 16} value={value} onChange={(e) => onChange(e.target.value)} data-testid="layer-select">
        {groups.map((g) => {
          const xs = g.layers.filter((l) => match(l) || l.id === value);
          if (!xs.length) return null;
          return <optgroup key={g.title} label={g.title}>{xs.map((l) => <option key={l.key} value={l.id}>{l.label}</option>)}</optgroup>;
        })}
      </select>
      <p className="sr-only">{layers.length} layers</p>
    </div>
  );
}

export function AboutLayer({ layer, children }: { layer: LayerT; children?: ReactNode }) {
  return (
    <section className="mt-8" aria-labelledby="about-layer">
      <h2 id="about-layer" className="text-xl">About this layer</h2>
      <dl className="mt-2 grid gap-1.5 text-sm sm:grid-cols-[9rem_minmax(0,1fr)]">
        <dt className="font-semibold">Definition</dt><dd>{layer.definition}</dd>
        <dt className="font-semibold">Source</dt><dd>{layer.source_title}</dd>
        <dt className="font-semibold">Publisher</dt><dd>{layer.publisher}</dd>
        <dt className="font-semibold">Vintage</dt><dd>{layer.vintage}</dd>
        <dt className="font-semibold">How it was got</dt><dd>{retrievalWords(layer)}. <a href={layer.url} target="_blank" rel="noreferrer">Publisher's page ↗</a></dd>
        {layer.caveats && <><dt className="font-semibold">Caveats</dt><dd data-testid="layer-caveats">{layer.caveats}</dd></>}
        {layer.suppressed_note && <><dt className="font-semibold">Empty cells</dt><dd>{layer.suppressed_note}</dd></>}
      </dl>
      {children}
      <div className="bx-card p-3 mt-3" data-block=""><CiteCard n={layer.ref} /></div>
      <p className="text-sm mt-2"><Link to="/map/sources">All layers and their sources →</Link></p>
    </section>
  );
}

// ------------------------------------------------------------------------------------------ service locations
const TYPE_ORDER = ['crisis', 'clinic', 'hospital', 'substance-use', 'peer-recovery', 'primary-care', 'veterans', 'children', 'justice', 'housing', 'social-services', 'office'];
const TYPE_COLOR: Record<string, string> = {
  crisis: '#b3261e', clinic: '#a84f17', hospital: '#222222', 'substance-use': '#7a4a8f', 'peer-recovery': '#2e7d5b', 'primary-care': '#3f6f8f',
  veterans: '#5b6b2e', children: '#c2185b', justice: '#4a4a8f', housing: '#8a6100', 'social-services': '#00796b', office: '#6b6b6b',
};

function polygon(n: number, r: number, x: number, y: number, rot = -Math.PI / 2, inner = 0): string {
  const pts: string[] = [];
  const k = inner ? n * 2 : n;
  for (let i = 0; i < k; i++) {
    const rr = inner && i % 2 ? inner : r;
    const a = rot + (2 * Math.PI * i) / k;
    pts.push(`${(x + rr * Math.cos(a)).toFixed(1)},${(y + rr * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

/** One symbol per location type: shape and colour both carry the type. */
export function MarkerShape({ type, x, y, s = 6, hollow = false }: { type: string; x: number; y: number; s?: number; hollow?: boolean }) {
  const c = TYPE_COLOR[type] ?? '#222';
  const p = hollow ? { fill: 'var(--bx-bg)', stroke: c, strokeWidth: 2.2 } : { fill: c, stroke: '#ffffff', strokeWidth: 1.2 };
  switch (type) {
    case 'crisis': return <polygon points={polygon(4, s * 1.25, x, y)} {...p} />;
    case 'clinic': return <circle cx={x} cy={y} r={s} {...p} />;
    case 'hospital': return <rect x={x - s * 0.85} y={y - s * 0.85} width={s * 1.7} height={s * 1.7} {...p} />;
    case 'substance-use': return <polygon points={polygon(3, s * 1.2, x, y)} {...p} />;
    case 'peer-recovery': return <polygon points={polygon(3, s * 1.2, x, y, Math.PI / 2)} {...p} />;
    case 'primary-care': return <path d={`M${x - s * 0.35},${y - s} h${s * 0.7} v${s * 0.65} h${s * 0.65} v${s * 0.7} h${-s * 0.65} v${s * 0.65} h${-s * 0.7} v${-s * 0.65} h${-s * 0.65} v${-s * 0.7} h${s * 0.65} z`} {...p} />;
    case 'veterans': return <polygon points={polygon(5, s * 1.25, x, y, -Math.PI / 2, s * 0.55)} {...p} />;
    case 'children': return <polygon points={polygon(5, s * 1.05, x, y)} {...p} />;
    case 'justice': return <polygon points={polygon(6, s * 1.05, x, y, 0)} {...p} />;
    case 'housing': return <path d={`M${x},${y - s * 1.1} L${x + s},${y - s * 0.1} V${y + s * 0.9} H${x - s} V${y - s * 0.1} Z`} {...p} />;
    case 'social-services': return <rect x={x - s * 1.1} y={y - s * 0.6} width={s * 2.2} height={s * 1.2} rx={s * 0.3} {...p} />;
    default: return <polygon points={polygon(8, s, x, y, Math.PI / 8)} {...p} />;
  }
}

export function MarkerLayer({ markers, byId, selected, onSelect, onHover, scale = 1 }: {
  markers: MapMarker[]; byId: Map<string, ServiceLocation>; selected: string | null; onSelect: (id: string) => void; onHover: (m: MapMarker | null) => void; scale?: number;
}) {
  return (
    <g data-testid="location-markers">
      {/* clusters and the selected marker are drawn last, so a neighbour never covers them */}
      {[...markers].sort((a, b) => (a.ids.length - b.ids.length) || (Number(selected !== null && a.ids.includes(selected)) - Number(selected !== null && b.ids.includes(selected)))).map((m) => {
        const names = m.ids.map((id) => byId.get(id)?.name ?? id);
        const on = selected !== null && m.ids.includes(selected);
        const s = 6 * scale;
        return (
          <g key={m.ids.join('+')} role="button" tabIndex={0} className="cursor-pointer outline-none" data-testid="location-marker" data-ids={m.ids.join(' ')} data-approximate={m.approximate ? 'true' : 'false'}
            aria-label={`${names.join('; ')}${m.approximate ? ' (approximate position)' : ''}`}
            onClick={(e) => { e.stopPropagation(); onSelect(m.ids[0]); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onSelect(m.ids[0]); } }}
            onMouseEnter={() => onHover(m)} onMouseLeave={() => onHover(null)} onFocus={() => onHover(m)} onBlur={() => onHover(null)}>
            {on && <circle cx={m.x} cy={m.y} r={s * 2.1} fill="none" stroke="var(--bx-ink)" strokeWidth={1.6} />}
            <MarkerShape type={m.type} x={m.x} y={m.y} s={s} hollow={m.approximate} />
            {m.ids.length > 1 && <text x={m.x + s * 1.2} y={m.y - s * 0.9} fontSize={11 * scale} fontWeight={700} fill="var(--bx-ink)" stroke="var(--bx-bg)" strokeWidth={3} paintOrder="stroke">{m.ids.length}</text>}
          </g>
        );
      })}
    </g>
  );
}

export function MarkerTooltip({ m, byId, types }: { m: MapMarker; byId: Map<string, ServiceLocation>; types: Record<string, string> }) {
  const ps = m.ids.map((id) => byId.get(id)!).filter(Boolean);
  return (
    <div className="text-sm" data-testid="marker-tooltip">
      {ps.map((p) => <p key={p.id}><span className="font-bold">{p.name}</span> <span className="bx-muted">· {types[p.type] ?? p.type}</span></p>)}
      {ps.length > 1 && <p className="text-xs bx-muted mt-0.5">{ps.length} places share this point.</p>}
      {m.approximate && <p className="text-xs font-semibold mt-0.5" data-testid="approximate-label">approximate position</p>}
    </div>
  );
}

export const LOCATION_SENTENCES = 'Markers are the places this report names with a street address. They are not a directory of services, and a tract with no marker is not a tract with no services. Positions come from address matching and are not surveyed.';

export function LocationLegend({ data, present }: { data: LocationsData; present: Set<string> }) {
  const unplaced = data.locations.filter((p) => p.precision === 'ambiguous' || p.precision === 'none');
  return (
    <div className="mt-3 text-[13px]" data-testid="location-legend">
      <p className="font-semibold">Service locations</p>
      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
        {TYPE_ORDER.filter((t) => data.types[t] && present.has(t)).map((t) => (
          <li key={t} className="flex items-center gap-1.5"><svg width="18" height="18" aria-hidden="true"><MarkerShape type={t} x={9} y={9} s={6} /></svg>{data.types[t]}</li>
        ))}
        <li className="flex items-center gap-1.5"><svg width="18" height="18" aria-hidden="true"><MarkerShape type="clinic" x={9} y={9} s={6} hollow /></svg>hollow: approximate position</li>
      </ul>
      <p className="mt-2" data-testid="location-sentences">{LOCATION_SENTENCES}</p>
      {unplaced.length > 0 && (
        <div className="mt-2" data-testid="unplaced">
          <p className="font-semibold">Named in the report, not placed on the map</p>
          <ul className="mt-1 grid gap-1">
            {unplaced.map((p) => <li key={p.id} data-testid="unplaced-item"><span className="font-semibold">{p.name}</span>, {p.address}, {p.city} <span className="bx-muted">· {data.types[p.type] ?? p.type}</span><span className="block bx-muted">{p.note}</span></li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

export function LocationPanel({ ids, byId, types, onClose, extra }: { ids: string[]; byId: Map<string, ServiceLocation>; types: Record<string, string>; onClose: () => void; extra?: (p: ServiceLocation) => ReactNode }) {
  const ps = ids.map((id) => byId.get(id)).filter((p): p is ServiceLocation => !!p);
  return (
    <div className="bx-card p-3 text-sm" data-testid="location-panel">
      <div className="flex items-start gap-2">
        <h2 className="text-xl flex-1">{ps.length > 1 ? `${ps.length} places at one point` : ps[0]?.name}</h2>
        <button type="button" className="bx-btn !py-0.5" onClick={onClose} aria-label="Close panel">×</button>
      </div>
      {ps.map((p) => (
        <div key={p.id} className="mt-3 border-t pt-2" style={{ borderColor: 'var(--bx-line-soft)' }}>
          {ps.length > 1 && <p className="font-bold">{p.name}</p>}
          <p>{p.address}, {p.city} <span className="bx-muted">(as printed in the source)</span></p>
          <p className="bx-muted">{types[p.type] ?? p.type} · {p.county} County{p.precision === 'approximate' ? ' · approximate position' : ''}</p>
          {p.note && <p className="mt-1" data-testid="location-note">{p.note}</p>}
          <p className="mt-1">Source <button type="button" className="bx-cite" data-cite={p.ref} aria-label={`Source ${p.ref}`}>[{p.ref}]</button></p>
          {p.blocks.length > 0 && <p className="mt-1 flex flex-wrap gap-x-2">In the report: {p.blocks.map((b) => <Link key={b} to={blockHref(b)}>{b}</Link>)}</p>}
          {extra?.(p)}
        </div>
      ))}
    </div>
  );
}
