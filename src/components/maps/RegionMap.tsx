/**
 * /map/region (KICKOFF §4d): the fifteen counties of the Huntsville crisis catchment, with the rest of Alabama as a
 * muted, non-interactive backdrop and Madison and Cullman outlined in the brand orange at all times. Numeric layers:
 * five-class quantile scale over the fifteen published values, breaks printed. Categorical layers: categories with
 * counts. Empty cells are hatched and labelled "not published or suppressed" — never zero. The only computations
 * shown are the class breaks and a county's position among the fifteen, each labelled.
 */
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AS_OF_TEXT } from '@/lib/data';
import { cellNumber, classOf, positionOf, positionText } from '@/lib/stats';
import { downloadText, toCsv } from '@/lib/download';
import { AddNoteButton } from '@/components/AddNoteButton';
import { AboutLayer, HatchDefs, Legend, LayerPicker, LocationLegend, LocationPanel, MarkerLayer, MarkerTooltip, fillFor, useNarrow } from './common';
import { CENTER_COLORS, MISSING, caveatFor, fmtValue, unitWords } from './format';
import type { LayerT, LocationsData, MapMarker, RegionMap as RegionMapT } from '@/types';

const GROUPS = ['People and place', 'Health and community', 'Workforce and shortage', 'Deaths', 'Coverage'];
const OVERLAYS = [
  { id: 'centers', label: 'Community mental health center service areas' },
  { id: 'catchment', label: 'The crisis catchment (all fifteen)' },
  { id: '211', label: '2-1-1 areas' },
  { id: 'locations', label: 'Service locations' },
] as const;
const DASH_211 = ['8 4', '2 3'];

interface Props { layers: LayerT[]; map: RegionMapT; locations: LocationsData; defaultLayer: string }

export default function RegionMap({ layers, map, locations, defaultLayer }: Props) {
  const [sp, setSp] = useSearchParams();
  const narrow = useNarrow();
  const avail = useMemo(() => layers.filter((l) => l.geography[0] === 'county'), [layers]);
  const layerId = sp.get('layer') && avail.some((l) => l.id === sp.get('layer')) ? sp.get('layer')! : defaultLayer;
  const layer = avail.find((l) => l.id === layerId)!;
  const sel = sp.get('geo');
  const place = sp.get('place');
  const overlays = new Set((sp.get('overlay') ?? '').split(',').filter(Boolean));
  const view = sp.get('view') ?? (narrow ? 'both' : 'map');
  const [hover, setHover] = useState<string | null>(null);
  const [mHover, setMHover] = useState<MapMarker | null>(null);
  const [focusIdx, setFocusIdx] = useState<number>(-1);
  const [live, setLive] = useState('');
  const hideT = useRef<number>();
  const set = (p: Record<string, string | null>) => {
    const n = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(p)) { if (v === null || v === '') n.delete(k); else n.set(k, v); }
    setSp(n, { replace: true });
  };

  const byId = useMemo(() => new Map(locations.locations.map((p) => [p.id, p])), [locations]);
  const raw = map.values[layer.id] ?? [];
  const nums = useMemo(() => raw.map(cellNumber), [raw]);
  const catIndex = useMemo(() => new Map((layer.stat.categories ?? []).map((c, i) => [c.value, i])), [layer]);
  const order = useMemo(() => {
    const idx = map.areas.map((_, i) => i);
    if (layer.type === 'numeric') return idx.sort((a, b) => (nums[b] ?? -Infinity) - (nums[a] ?? -Infinity) || map.areas[a].name.localeCompare(map.areas[b].name));
    return idx.sort((a, b) => map.areas[a].name.localeCompare(map.areas[b].name));
  }, [map.areas, nums, layer.type]);
  const areaIdx = useMemo(() => new Map(map.areas.map((a, i) => [a.id, i])), [map.areas]);
  const al = map.alabama[layer.id];
  const valueWithUnit = (v: string | undefined) => `${fmtValue(v, layer)}${v && unitWords(layer) ? ` ${unitWords(layer)}` : ''}`;
  const describe = (i: number) => {
    const a = map.areas[i];
    const pos = layer.type === 'numeric' ? positionText(positionOf(nums[i], nums)) : '';
    return `${a.name} County: ${valueWithUnit(raw[i])}${pos ? `, ${pos}` : ''}${al ? `; Alabama ${fmtValue(al, layer)}` : ''}`;
  };

  const shown = hover ?? (focusIdx >= 0 ? map.areas[order[focusIdx]]?.id : null);
  const shownIdx = shown ? areaIdx.get(shown) ?? -1 : -1;

  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Enter', 'Home', 'End', 'Escape'].includes(e.key)) return;
    e.preventDefault();
    let k = focusIdx;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') k = Math.min(order.length - 1, k + 1);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') k = Math.max(0, k - 1);
    if (e.key === 'Home') k = 0;
    if (e.key === 'End') k = order.length - 1;
    if (e.key === 'Escape') { setFocusIdx(-1); return; }
    if (e.key === 'Enter') { if (k >= 0) set({ geo: map.areas[order[k]].id, place: null }); return; }
    if (k < 0) k = 0;
    setFocusIdx(k);
    setLive(describe(order[k]));
  };

  const csv = () => {
    const rows: (string | number)[][] = [['fips', 'county', 'role', layer.id, 'alabama', 'position among the fifteen (computed from the published values)']];
    for (const i of order) {
      const p = layer.type === 'numeric' ? positionOf(nums[i], nums) : null;
      rows.push([map.areas[i].id, map.areas[i].name, map.areas[i].role, raw[i], al ?? '', p ? positionText(p) : '']);
    }
    rows.push([]);
    rows.push(['source', `${layer.source_title}. ${layer.publisher}. ${layer.vintage}. ${layer.url} (retrieved ${layer.retrieved}). Reference [${layer.ref}]. Empty cells are missing values, not zero.`]);
    downloadText(toCsv(rows), `region-counties-${layer.id}.csv`, 'text/csv;charset=utf-8');
  };

  const tooltip = shownIdx >= 0 ? (() => {
    const a = map.areas[shownIdx];
    const v = raw[shownIdx];
    const pos = layer.type === 'numeric' ? positionOf(nums[shownIdx], nums) : null;
    const cav = v === '' ? caveatFor(layer, a.name) : '';
    return (
      <div className="absolute z-20 bx-card p-2.5 text-sm w-64 shadow-lg" style={{ left: `${(a.cx / map.width) * 100}%`, top: `${(a.cy / map.height) * 100}%`, transform: `translate(${a.cx / map.width > 0.55 ? '-105%' : '12px'}, -50%)` }}
        role="status" data-testid="map-tooltip" onMouseEnter={() => window.clearTimeout(hideT.current)} onMouseLeave={() => setHover(null)}>
        <p className="font-bold">{a.name} County <span className="font-normal bx-muted">· {a.role === 'core' ? 'the core' : 'the ring'}</span></p>
        <p className="text-xs bx-muted">Center: {a.cmhc}</p>
        <p className="mt-0.5"><span className="font-semibold" data-testid="tooltip-value">{fmtValue(v, layer)}</span>{v && unitWords(layer) ? <span className="bx-muted"> {unitWords(layer)}</span> : null}</p>
        {cav && <p className="text-xs mt-1" data-testid="tooltip-caveat">{cav}</p>}
        {!v && !cav && layer.suppressed_note && <p className="text-xs mt-1 bx-muted">{layer.suppressed_note}</p>}
        {pos && <p className="text-xs bx-muted mt-0.5">{positionText(pos)} (computed from the published values)</p>}
        <p className="text-xs mt-0.5" data-testid="tooltip-alabama">Alabama: {al ? fmtValue(al, layer) : 'no Alabama value in the source'}</p>
        <p className="text-xs bx-muted mt-0.5">{layer.vintage} <button type="button" className="bx-cite" data-cite={layer.ref} aria-label={`Source ${layer.ref}`} data-testid="tooltip-cite">[{layer.ref}]</button></p>
      </div>
    );
  })() : mHover ? (
    <div className="absolute z-20 bx-card p-2.5 w-64 shadow-lg pointer-events-none" style={{ left: `${(mHover.x / map.width) * 100}%`, top: `${(mHover.y / map.height) * 100}%`, transform: `translate(${mHover.x / map.width > 0.55 ? '-105%' : '12px'}, -50%)` }} role="status">
      <MarkerTooltip m={mHover} byId={byId} types={locations.types} />
    </div>
  ) : null;

  const placed = map.markers;
  const presentTypes = new Set(placed.map((m) => m.type));

  const mapSvg = (
    <div className="relative" onMouseLeave={() => { hideT.current = window.setTimeout(() => setHover(null), 250); }}>
      <svg viewBox={`0 0 ${map.width} ${map.height}`} className="bx-map w-full h-auto max-h-[80vh] overflow-hidden" tabIndex={0}
        role="application" aria-roledescription="map" aria-label={`The fifteen counties coloured by ${layer.label}. Use the arrow keys to move between counties in order of value and Enter to open one.`}
        onKeyDown={onKey} onBlur={() => setFocusIdx(-1)} data-testid="map-svg">
        <HatchDefs />
        <path d={map.backdrop} fill="var(--bx-bg-2)" stroke="var(--bx-line)" strokeWidth={0.5} pointerEvents="none" data-testid="backdrop" aria-hidden="true" />
        <g>
          {map.areas.map((a, i) => (
            <path key={a.id} d={a.d} className={`area ${sel === a.id ? 'is-selected' : ''} ${shown === a.id ? 'is-focus' : ''}`} fill={fillFor(raw[i], nums[i], layer, catIndex, classOf)} data-fips={a.id} data-name={a.name} data-testid="map-area"
              onMouseEnter={() => { window.clearTimeout(hideT.current); setHover(a.id); }} onClick={() => set({ geo: a.id, place: null })}>
              <title>{describe(i)}</title>
            </path>
          ))}
        </g>
        <g pointerEvents="none">
          {overlays.has('centers') && map.centers.groups.map((g, i) => <path key={g.id} d={g.d} fill="none" stroke={CENTER_COLORS[i % CENTER_COLORS.length]} strokeWidth={3} strokeDasharray={i % 2 ? '7 3' : undefined} data-testid="overlay-outline" />)}
          {overlays.has('211') && map.two_one_one.groups.map((g, i) => <path key={g.id} d={g.d} fill="none" stroke="var(--bx-ink)" strokeWidth={2.4} strokeDasharray={DASH_211[i % DASH_211.length]} data-testid="overlay-211" />)}
          {overlays.has('catchment') && <path d={map.catchment} fill="none" stroke="var(--bx-ink)" strokeWidth={4} strokeDasharray="12 5" data-testid="overlay-catchment" />}
          <path d={map.core} fill="none" stroke="#e8762b" strokeWidth={3.5} data-testid="core-outline" />
          {map.areas.map((a) => <text key={a.id} x={a.cx} y={a.cy} textAnchor="middle" fontSize={a.role === 'core' ? 12 : 10} fontWeight={a.role === 'core' ? 700 : 400} fill="var(--bx-ink)" stroke="var(--bx-bg)" strokeWidth={3} paintOrder="stroke" opacity={0.85}>{a.name}</text>)}
        </g>
        {overlays.has('locations') && <MarkerLayer markers={placed} byId={byId} selected={place} onSelect={(id) => set({ place: id, geo: null })} onHover={setMHover} />}
      </svg>
      {tooltip}
    </div>
  );

  const table = (
    <div className="overflow-x-auto mt-4" data-testid="map-table">
      <table className="w-full text-sm border-collapse">
        <caption className="text-left text-sm font-semibold mb-1">{layer.label}, by county ({layer.stat.published} published of {map.areas.length})</caption>
        <thead><tr className="bx-th text-left"><th className="p-1.5">County</th><th className="p-1.5">Value</th><th className="p-1.5">Alabama</th>{layer.type === 'numeric' && <th className="p-1.5">Position (computed from the published values)</th>}</tr></thead>
        <tbody>
          {order.map((i) => {
            const a = map.areas[i];
            return (
              <tr key={a.id} className="border-t" style={{ borderColor: 'var(--bx-line-soft)' }} data-testid="map-table-row">
                <td className="p-1.5"><button type="button" className="underline text-left" onClick={() => set({ geo: a.id, place: null })}>{a.name}</button>{a.role === 'core' && <span className="bx-muted text-xs"> · core</span>}</td>
                <td className="p-1.5">{raw[i] === '' ? <span className="italic bx-muted">{MISSING}</span> : fmtValue(raw[i], layer)}</td>
                <td className="p-1.5 bx-muted">{al ? fmtValue(al, layer) : '—'}</td>
                {layer.type === 'numeric' && <td className="p-1.5">{positionText(positionOf(nums[i], nums))}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const toggle = (id: string) => { const n = new Set(overlays); if (n.has(id)) n.delete(id); else n.add(id); set({ overlay: [...n].join(',') || null }); };
  const groups = GROUPS.map((g) => ({ title: g, layers: avail.filter((l) => l.group === g) })).filter((g) => g.layers.length);

  return (
    <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)_22rem]">
      <div className="no-print">
        <LayerPicker layers={avail} groups={groups} value={layer.id} onChange={(id) => set({ layer: id })} narrow={narrow} />
        <fieldset className="mt-5">
          <legend className="text-sm font-semibold">Overlays</legend>
          <ul className="mt-1 grid gap-2 text-[13px]">
            {OVERLAYS.map((o) => (
              <li key={o.id}>
                <label className="flex gap-2 items-start cursor-pointer font-semibold">
                  <input type="checkbox" className="mt-1" checked={overlays.has(o.id)} onChange={() => toggle(o.id)} data-testid={`toggle-${o.id}`} />
                  <span>{o.label}</span>
                </label>
                {overlays.has(o.id) && <OverlayKey id={o.id} map={map} />}
              </li>
            ))}
          </ul>
          <p className="text-xs mt-2"><span className="inline-block w-5 align-middle border-t-[3px]" style={{ borderColor: '#e8762b' }} aria-hidden="true" /> Madison and Cullman, the core, are always outlined.</p>
        </fieldset>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-sm mb-2">
          <h2 className="text-xl mr-auto" data-testid="layer-title">{layer.label}</h2>
          <span className="bx-asof" data-testid="map-asof">Current as of {AS_OF_TEXT}</span>
          <div role="group" aria-label="View" className="flex gap-1">
            <button type="button" className={`bx-btn !py-0.5 ${view !== 'table' ? 'bx-btn-on' : ''}`} aria-pressed={view !== 'table'} onClick={() => set({ view: null })}>Map</button>
            <button type="button" className={`bx-btn !py-0.5 ${view === 'table' ? 'bx-btn-on' : ''}`} aria-pressed={view === 'table'} onClick={() => set({ view: 'table' })} data-testid="map-table-button">Table</button>
          </div>
          <button type="button" className="bx-btn !py-0.5" onClick={csv} data-testid="map-csv">Download CSV</button>
        </div>
        <Legend layer={layer} of="the fifteen counties" />
        {view !== 'table' && mapSvg}
        <p className="sr-only" aria-live="polite" data-testid="map-live">{live}</p>
        {overlays.has('locations') && <LocationLegend data={locations} present={presentTypes} />}
        {(view === 'table' || view === 'both') && table}
        <AboutLayer layer={layer} />
      </div>

      <aside aria-live="polite" className="min-w-0">
        {place && byId.has(place)
          ? <LocationPanel ids={placed.find((m) => m.ids.includes(place))?.ids ?? [place]} byId={byId} types={locations.types} onClose={() => set({ place: null })}
              extra={(p) => <p className="mt-1"><AddNoteButton anchor={{ type: 'location', id: p.id }} label="Add note on this place" />{p.tract && <> · <Link to={`/map/tracts?overlay=locations&geo=${p.tract}&place=${p.id}`}>On the tract map →</Link></>}</p>} />
          : sel && areaIdx.has(sel)
          ? <CountyPanel fips={sel} layers={avail} map={map} onClose={() => set({ geo: null })} current={layer.id} />
          : <div className="bx-panel p-4 text-sm">Select a county on the map or in the table to see every layer for it, beside Alabama, and the service areas it belongs to.</div>}
      </aside>
    </div>
  );
}

function OverlayKey({ id, map }: { id: string; map: RegionMapT }) {
  if (id === 'centers') return (
    <div className="ml-6 mt-1 grid gap-1">
      <p className="bx-muted">{map.centers.note} <button type="button" className="bx-cite" data-cite={map.centers.ref} aria-label={`Source ${map.centers.ref}`}>[{map.centers.ref}]</button></p>
      <ul className="grid gap-0.5">
        {map.centers.groups.map((g, i) => (
          <li key={g.id} className="flex gap-1.5 items-start">
            <svg width="18" height="10" aria-hidden="true" className="shrink-0 mt-1"><line x1="0" y1="5" x2="18" y2="5" stroke={CENTER_COLORS[i % CENTER_COLORS.length]} strokeWidth="3" strokeDasharray={i % 2 ? '5 2' : undefined} /></svg>
            <span>{g.label} <span className="bx-muted">({g.fips.length})</span>{g.ccbhc && <> · certified clinic{g.ccbhc_date ? ` since ${g.ccbhc_date}` : ''}{g.ccbhc_ref && <> <button type="button" className="bx-cite" data-cite={g.ccbhc_ref} aria-label={`Source ${g.ccbhc_ref}`}>[{g.ccbhc_ref}]</button></>}</>}</span>
          </li>
        ))}
      </ul>
    </div>
  );
  if (id === 'catchment') return (
    <p className="ml-6 mt-1" data-testid="catchment-note">{map.crisis.label}. Source: the Department of Mental Health's Crisis Centers page (<a href={map.crisis.source_url} target="_blank" rel="noreferrer">source ↗</a>), {map.crisis.as_of}. <button type="button" className="bx-cite" data-cite={map.crisis.ref} aria-label={`Source ${map.crisis.ref}`}>[{map.crisis.ref}]</button></p>
  );
  if (id === '211') return (
    <div className="ml-6 mt-1 grid gap-1">
      <p className="bx-muted">{map.two_one_one.note} <button type="button" className="bx-cite" data-cite={map.two_one_one.ref} aria-label={`Source ${map.two_one_one.ref}`}>[{map.two_one_one.ref}]</button></p>
      <ul className="grid gap-0.5">
        {map.two_one_one.groups.map((g, i) => (
          <li key={g.id} className="flex gap-1.5 items-start">
            <svg width="18" height="10" aria-hidden="true" className="shrink-0 mt-1"><line x1="0" y1="5" x2="18" y2="5" stroke="var(--bx-ink)" strokeWidth="2.4" strokeDasharray={DASH_211[i % DASH_211.length]} /></svg>
            <span>{g.label} <span className="bx-muted">({g.fips.length} of the fifteen{g.also_serves.length ? `; also serves ${g.also_serves.join(', ')}` : ''})</span></span>
          </li>
        ))}
        <li className="bx-muted">Not listed by either center: {map.two_one_one.unassigned.length} counties</li>
      </ul>
    </div>
  );
  return <p className="ml-6 mt-1 bx-muted">All service locations the report names with an address, in the core and the ring.</p>;
}

function CountyPanel({ fips, layers, map, onClose, current }: { fips: string; layers: LayerT[]; map: RegionMapT; onClose: () => void; current: string }) {
  const i = map.areas.findIndex((a) => a.id === fips);
  const a = map.areas[i];
  const info = map.countyInfo[fips];
  const two = info?.two_one_one;
  return (
    <div className="bx-card p-3 text-sm" data-testid="area-panel">
      <div className="flex items-start gap-2">
        <h2 className="text-xl flex-1">{a.name} County</h2>
        <button type="button" className="bx-btn !py-0.5" onClick={onClose} aria-label="Close panel">×</button>
      </div>
      <p className="bx-muted">{a.role === 'core' ? 'The core: WellStone is its community mental health center' : 'The ring: its crises route to the Huntsville crisis center'}</p>
      <p className="mt-1"><AddNoteButton anchor={{ type: 'map', id: `region:${current}:${fips}` }} label="Add note on this county" /></p>
      <div className="mt-2 bx-panel p-2.5 grid gap-1 text-[13px]" data-testid="county-overlays">
        <p><strong>Community mental health center: </strong>{info?.cmhc ? <>{info.cmhc.center}{info.cmhc.ccbhc ? <> · a certified clinic{info.cmhc.ccbhc_date ? ` since ${info.cmhc.ccbhc_date}` : ''}{info.cmhc.ccbhc_ref && <> <button type="button" className="bx-cite" data-cite={info.cmhc.ccbhc_ref} aria-label={`Source ${info.cmhc.ccbhc_ref}`}>[{info.cmhc.ccbhc_ref}]</button></>}</> : ' · not a certified clinic in the source'}</> : 'not listed'}</p>
        <p><strong>2-1-1: </strong>{two ?? 'not listed by either center'}</p>
        <p><strong>Crisis center: </strong>{info?.in_catchment ? 'WellStone Emergency Services and Pediatric Crisis Care, Huntsville' : 'not in the catchment'}</p>
      </div>
      {GROUPS.map((g) => {
        const xs = layers.filter((l) => l.group === g);
        if (!xs.length) return null;
        return (
          <details key={g} open className="mt-3">
            <summary className="cursor-pointer font-semibold">{g}</summary>
            <table className="w-full mt-1 text-[13px] border-collapse">
              <thead><tr className="text-left bx-th"><th className="p-1">Layer</th><th className="p-1">County</th><th className="p-1">Alabama</th><th className="p-1">Position of 15</th></tr></thead>
              <tbody>
                {xs.map((l) => {
                  const vals = map.values[l.id] ?? [];
                  const v = vals[i] ?? '';
                  const nums = vals.map(cellNumber);
                  const pos = l.type === 'numeric' ? positionOf(nums[i], nums) : null;
                  const alv = map.alabama[l.id];
                  return (
                    <tr key={l.id} className="border-t align-top" style={{ borderColor: 'var(--bx-line-soft)' }}>
                      <td className="p-1">{l.label} <button type="button" className="bx-cite" data-cite={l.ref} aria-label={`Source ${l.ref}`}>[{l.ref}]</button></td>
                      <td className="p-1 font-semibold">{v === '' ? <span className="italic font-normal bx-muted">{MISSING}</span> : fmtValue(v, l)}</td>
                      <td className="p-1">{alv ? fmtValue(alv, l) : '—'}</td>
                      <td className="p-1 bx-muted">{pos ? positionText(pos) : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </details>
        );
      })}
      <p className="text-xs bx-muted mt-2">Positions are computed from the published values (highest first; ties share a position; empty cells are left out). “—” means the source gives no Alabama value for that layer.</p>
    </div>
  );
}
