/**
 * /map/tracts (KICKOFF §4d): the 117 census tracts of Madison and Cullman, each county fitted to its own frame and
 * shown side by side (a toggle shows one county at full width). Two visibly different families of layer: survey
 * estimates, never shown without their margin of error, and modeled estimates, always labelled modeled. The class
 * breaks are quantiles over the 117 published values; the only other computations are a tract's position in the
 * ordered list and, for a survey value, the interval estimate ± margin, each labelled. No averages, no sums, and no
 * claim that one tract is higher than another.
 */
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AS_OF_TEXT } from '@/lib/data';
import { cellNumber, classOf, intervalOf, positionOf, positionText } from '@/lib/stats';
import { downloadText, toCsv } from '@/lib/download';
import { AddNoteButton } from '@/components/AddNoteButton';
import { AboutLayer, HatchDefs, Legend, LayerPicker, LocationLegend, LocationPanel, MarkerLayer, MarkerTooltip, fillFor, useNarrow } from './common';
import { FAMILY_LABEL, MISSING, NO_MOE, fmtMoe, fmtNum, fmtValue, isPercent, unitWords } from './format';
import type { Benchmark, LayerT, LocationsData, MapMarker, TractArea, TractMap as TractMapT } from '@/types';

interface Props { layers: LayerT[]; map: TractMapT; locations: LocationsData; defaultLayer: string }

export const STANDING_LINE = 'Tract values are estimates. Survey estimates carry margins of error that are often wide; modeled estimates are predictions, not measurements. Do not rank neighbouring tracts on small differences.';

/** "17.8% ± 6.5" and "between 11.3% and 24.3%" (computed), or the words for an empty cell / margin. */
export function surveyWords(est: string, moe: string, l: LayerT): { value: string; between: string | null } {
  if (est === '') return { value: MISSING, between: null };
  if (moe === '') return { value: `${fmtValue(est, l)} (${NO_MOE})`, between: null };
  const iv = intervalOf(est, moe, isPercent(l));
  return { value: `${fmtValue(est, l)} ± ${fmtMoe(moe, l)}`, between: iv ? `between ${fmtNum(iv.lo, l, iv.dec)} and ${fmtNum(iv.hi, l, iv.dec)}` : null };
}

function BenchLine({ name, b, l }: { name: string; b: Benchmark; l: LayerT }) {
  const w = surveyWords(b.est, b.moe, l);
  return <span className="block">{name}: {w.value}</span>;
}

export default function TractMap({ layers, map, locations, defaultLayer }: Props) {
  const [sp, setSp] = useSearchParams();
  const narrow = useNarrow();
  const avail = useMemo(() => layers.filter((l) => l.geography[0] === 'tract' && !l.panel_only), [layers]);
  const layerId = sp.get('layer') && avail.some((l) => l.id === sp.get('layer')) ? sp.get('layer')! : defaultLayer;
  const layer = avail.find((l) => l.id === layerId)!;
  const survey = layer.family === 'survey';
  const sel = sp.get('geo');
  const place = sp.get('place');
  const only = sp.get('county');
  const overlays = new Set((sp.get('overlay') ?? '').split(',').filter(Boolean));
  const view = sp.get('view') ?? (narrow ? 'both' : 'map');
  const [hover, setHover] = useState<string | null>(null);
  const [mHover, setMHover] = useState<{ m: MapMarker; frame: string } | null>(null);
  const [focusIdx, setFocusIdx] = useState<number>(-1);
  const [live, setLive] = useState('');
  const hideT = useRef<number>();
  const set = (p: Record<string, string | null>) => {
    const n = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(p)) { if (v === null || v === '') n.delete(k); else n.set(k, v); }
    setSp(n, { replace: true });
  };

  const byId = useMemo(() => new Map(locations.locations.map((p) => [p.id, p])), [locations]);
  const idxOf = useMemo(() => new Map(map.ids.map((id, i) => [id, i])), [map.ids]);
  const areas = useMemo(() => new Map(map.frames.flatMap((f) => f.areas.map((a) => [a.id, a] as [string, TractArea]))), [map.frames]);
  const raw = map.values[layer.id] ?? [];
  const moe = map.moe[layer.id] ?? [];
  const nums = useMemo(() => raw.map(cellNumber), [raw]);
  const catIndex = useMemo(() => new Map((layer.stat.categories ?? []).map((c, i) => [c.value, i])), [layer]);
  const frames = only ? map.frames.filter((f) => f.fips === only) : map.frames;
  const order = useMemo(() => {
    const ids = map.ids.filter((id) => !only || id.startsWith(only)).map((id) => idxOf.get(id)!);
    return ids.sort((a, b) => (nums[b] ?? -Infinity) - (nums[a] ?? -Infinity) || map.ids[a].localeCompare(map.ids[b]));
  }, [map.ids, idxOf, nums, only]);
  const bench = map.benchmarks[layer.id];
  const valueText = (i: number) => {
    if (survey) { const w = surveyWords(raw[i], moe[i], layer); return `${w.value}${w.between ? `, ${w.between}` : ''}`; }
    return raw[i] === '' ? MISSING : `${fmtValue(raw[i], layer)}, modeled estimate`;
  };
  const describe = (i: number) => {
    const a = areas.get(map.ids[i])!;
    const pos = positionText(positionOf(nums[i], nums));
    return `${a.name}, ${a.county} County: ${valueText(i)}${pos ? `; ${pos} (computed)` : ''}`;
  };

  const shown = hover ?? (focusIdx >= 0 ? map.ids[order[focusIdx]] : null);
  const shownI = shown ? idxOf.get(shown) ?? -1 : -1;

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Enter', 'Home', 'End', 'Escape'].includes(e.key)) return;
    e.preventDefault();
    let k = focusIdx;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') k = Math.min(order.length - 1, k + 1);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') k = Math.max(0, k - 1);
    if (e.key === 'Home') k = 0;
    if (e.key === 'End') k = order.length - 1;
    if (e.key === 'Escape') { setFocusIdx(-1); return; }
    if (e.key === 'Enter') { if (k >= 0) set({ geo: map.ids[order[k]], place: null }); return; }
    if (k < 0) k = 0;
    setFocusIdx(k);
    setLive(describe(order[k]));
  };

  const csv = () => {
    const head = ['geoid', 'tract', 'county', layer.id, ...(survey ? [`${layer.id}_moe`, 'interval (computed from the published values)'] : ['kind']), 'position (computed from the published values)'];
    const rows: (string | number)[][] = [head];
    for (const i of order) {
      const a = areas.get(map.ids[i])!;
      const iv = survey ? intervalOf(raw[i], moe[i], isPercent(layer)) : null;
      rows.push([a.id, a.name, a.county, raw[i], ...(survey ? [moe[i], iv ? `${iv.lo} to ${iv.hi}` : ''] : ['modeled estimate']), positionText(positionOf(nums[i], nums))]);
    }
    rows.push([]);
    rows.push(['source', `${layer.source_title}. ${layer.publisher}. ${layer.vintage}. ${layer.url} (retrieved ${layer.retrieved}). Reference [${layer.ref}]. Empty cells are missing values, not zero.${survey ? ' Survey estimates: read each with its margin of error.' : ' Modeled estimates, not measurements.'}`]);
    downloadText(toCsv(rows), `tracts-${layer.id}${only ? `-${only}` : ''}.csv`, 'text/csv;charset=utf-8');
  };

  const tooltipFor = (fid: string) => {
    const f = map.frames.find((x) => x.fips === fid)!;
    if (shownI >= 0 && shown!.startsWith(fid)) {
      const a = areas.get(shown!)!;
      const v = raw[shownI];
      const sw = survey ? surveyWords(v, moe[shownI], layer) : null;
      const pos = positionOf(nums[shownI], nums);
      return (
        <div className="absolute z-20 bx-card p-2.5 text-sm w-64 shadow-lg" style={{ left: `${(a.cx / f.width) * 100}%`, top: `${(a.cy / f.height) * 100}%`, transform: `translate(${a.cx / f.width > 0.5 ? '-105%' : '12px'}, -50%)` }}
          role="status" data-testid="map-tooltip" onMouseEnter={() => window.clearTimeout(hideT.current)} onMouseLeave={() => setHover(null)}>
          <p className="font-bold">{a.name}</p>
          <p className="text-xs bx-muted">{a.county} County · {a.id}</p>
          {survey ? (
            <>
              <p className="mt-0.5"><span className="font-semibold" data-testid="tooltip-value">{sw!.value}</span>{v && unitWords(layer) ? <span className="bx-muted"> {unitWords(layer)}</span> : null}</p>
              {sw!.between && <p className="text-xs" data-testid="tooltip-between">{sw!.between} <span className="bx-muted">(estimate ± margin of error, computed from the published values)</span></p>}
              {!v && layer.suppressed_note && <p className="text-xs mt-1 bx-muted">{layer.suppressed_note}</p>}
              {bench && <p className="text-xs mt-1" data-testid="tooltip-benchmarks"><BenchLine name={`${a.county} County`} b={a.county_fips === '01089' ? bench.madison : bench.cullman} l={layer} /><BenchLine name="Alabama" b={bench.alabama} l={layer} /></p>}
            </>
          ) : (
            <>
              <p className="mt-0.5"><span className="font-semibold" data-testid="tooltip-value">{fmtValue(v, layer)}</span>{v && unitWords(layer) ? <span className="bx-muted"> {unitWords(layer)}</span> : null}</p>
              <p className="text-xs font-semibold" data-testid="tooltip-modeled">modeled estimate</p>
              <details className="text-xs mt-0.5"><summary className="cursor-pointer">What “modeled” means here</summary><p className="mt-1">{layer.caveats}</p></details>
            </>
          )}
          {pos && <p className="text-xs bx-muted mt-0.5">{positionText(pos)} (computed from the published values)</p>}
          <p className="text-xs bx-muted mt-0.5">{layer.vintage} <button type="button" className="bx-cite" data-cite={layer.ref} aria-label={`Source ${layer.ref}`} data-testid="tooltip-cite">[{layer.ref}]</button></p>
        </div>
      );
    }
    if (mHover && mHover.frame === fid) return (
      <div className="absolute z-20 bx-card p-2.5 w-64 shadow-lg pointer-events-none" style={{ left: `${(mHover.m.x / f.width) * 100}%`, top: `${(mHover.m.y / f.height) * 100}%`, transform: `translate(${mHover.m.x / f.width > 0.5 ? '-105%' : '12px'}, -50%)` }} role="status">
        <MarkerTooltip m={mHover.m} byId={byId} types={locations.types} />
      </div>
    );
    return null;
  };

  const presentTypes = new Set(map.frames.flatMap((f) => f.markers.map((m) => m.type)));

  const mapView = (
    <div role="application" aria-roledescription="map" tabIndex={0} onKeyDown={onKey} onBlur={() => setFocusIdx(-1)} className="bx-map-wrap rounded-md outline-offset-4"
      aria-label={`Census tracts of ${frames.map((f) => f.name).join(' and ')} coloured by ${layer.label}. Use the arrow keys to move between tracts in order of value and Enter to open one.`} data-testid="tract-map">
      <div className={`grid gap-4 ${frames.length > 1 ? 'sm:grid-cols-2' : ''}`}>
        {frames.map((f) => (
          <figure key={f.fips} className="relative min-w-0" onMouseLeave={() => { hideT.current = window.setTimeout(() => setHover(null), 250); }}>
            <figcaption className="text-sm font-semibold mb-1 flex items-center gap-2">{f.name} County <span className="bx-muted font-normal">({f.areas.length} tracts)</span>
              <button type="button" className="bx-btn !py-0 !px-1.5 text-xs ml-auto no-print" onClick={() => set({ county: only ? null : f.fips })} data-testid={`only-${f.fips}`}>{only ? 'Show both counties' : 'Full width'}</button></figcaption>
            <svg viewBox={`0 0 ${f.width} ${f.height}`} className="bx-map w-full h-auto max-h-[75vh]" data-testid="map-svg" aria-hidden="false">
              <HatchDefs />
              <g>
                {f.areas.map((a) => {
                  const i = idxOf.get(a.id)!;
                  return (
                    <path key={a.id} d={a.d} className={`area ${sel === a.id ? 'is-selected' : ''} ${shown === a.id ? 'is-focus' : ''}`} fill={fillFor(raw[i], nums[i], layer, catIndex, classOf)} data-geoid={a.id} data-testid="map-area"
                      onMouseEnter={() => { window.clearTimeout(hideT.current); setHover(a.id); }} onClick={() => set({ geo: a.id, place: null })}>
                      <title>{describe(i)}</title>
                    </path>
                  );
                })}
              </g>
              <path d={f.outline} fill="none" stroke="var(--bx-ink)" strokeWidth={1.4} pointerEvents="none" />
              {overlays.has('locations') && <MarkerLayer markers={f.markers} byId={byId} selected={place} onSelect={(id) => set({ place: id, geo: null })} onHover={(m) => setMHover(m ? { m, frame: f.fips } : null)} scale={f.width / 460} />}
            </svg>
            {tooltipFor(f.fips)}
          </figure>
        ))}
      </div>
    </div>
  );

  const table = (
    <div className="overflow-x-auto mt-4" data-testid="map-table">
      <table className="w-full text-sm border-collapse">
        <caption className="text-left text-sm font-semibold mb-1">{layer.label}, by tract ({order.filter((i) => raw[i] !== '').length} published of {order.length}){survey ? '' : ' · modeled estimates'}</caption>
        <thead><tr className="bx-th text-left"><th className="p-1.5">Tract</th><th className="p-1.5">County</th><th className="p-1.5">{survey ? 'Estimate' : 'Modeled estimate'}</th>{survey && <><th className="p-1.5">Margin of error</th><th className="p-1.5">Interval (computed)</th></>}<th className="p-1.5">Position (computed)</th></tr></thead>
        <tbody>
          {order.map((i) => {
            const a = areas.get(map.ids[i])!;
            const iv = survey ? intervalOf(raw[i], moe[i], isPercent(layer)) : null;
            return (
              <tr key={a.id} className="border-t" style={{ borderColor: 'var(--bx-line-soft)' }} data-testid="map-table-row" data-geoid={a.id}>
                <td className="p-1.5"><button type="button" className="underline text-left" onClick={() => set({ geo: a.id, place: null })}>{a.name.replace('Census Tract ', 'Tract ')}</button></td>
                <td className="p-1.5">{a.county}</td>
                <td className="p-1.5">{raw[i] === '' ? <span className="italic bx-muted">{MISSING}</span> : fmtValue(raw[i], layer)}</td>
                {survey && <><td className="p-1.5">{raw[i] === '' ? '' : moe[i] === '' ? <span className="italic bx-muted">{NO_MOE}</span> : `± ${fmtMoe(moe[i], layer)}`}</td><td className="p-1.5 bx-muted">{iv ? `${fmtNum(iv.lo, layer, iv.dec)} to ${fmtNum(iv.hi, layer, iv.dec)}` : ''}</td></>}
                <td className="p-1.5 bx-muted">{positionText(positionOf(nums[i], nums))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const groups = [
    { title: FAMILY_LABEL.survey, layers: avail.filter((l) => l.family === 'survey') },
    { title: FAMILY_LABEL.modeled, layers: avail.filter((l) => l.family === 'modeled') },
  ];
  const toggleLoc = () => set({ overlay: overlays.has('locations') ? null : 'locations' });

  return (
    <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)_22rem]">
      <div className="no-print">
        <LayerPicker layers={avail} groups={groups} value={layer.id} onChange={(id) => set({ layer: id })} narrow={narrow} />
        <fieldset className="mt-5">
          <legend className="text-sm font-semibold">Overlay</legend>
          <label className="flex gap-2 items-start cursor-pointer font-semibold text-[13px] mt-1">
            <input type="checkbox" className="mt-1" checked={overlays.has('locations')} onChange={toggleLoc} data-testid="toggle-locations" />
            <span>Service locations in Madison and Cullman</span>
          </label>
        </fieldset>
        <p className="text-xs mt-4"><Link to="/map/region">The fifteen counties →</Link></p>
      </div>

      <div className="min-w-0">
        <p className="bx-panel p-2.5 text-[14px] mb-3" data-testid="standing-line">{STANDING_LINE} <Link to="/concepts/reading-the-numbers" className="font-semibold whitespace-nowrap">How to read these numbers →</Link></p>
        <div className="flex flex-wrap items-center gap-2 text-sm mb-2">
          <h2 className="text-xl mr-auto" data-testid="layer-title">{layer.label}</h2>
          <span className={`bx-chip-line ${survey ? '' : 'italic'}`} data-testid="layer-family" style={survey ? undefined : { borderStyle: 'dashed' }}>{survey ? 'survey estimate, with margin of error' : 'modeled estimate'}</span>
          <span className="bx-asof" data-testid="map-asof">Current as of {AS_OF_TEXT}</span>
          <div role="group" aria-label="View" className="flex gap-1">
            <button type="button" className={`bx-btn !py-0.5 ${view !== 'table' ? 'bx-btn-on' : ''}`} aria-pressed={view !== 'table'} onClick={() => set({ view: null })}>Map</button>
            <button type="button" className={`bx-btn !py-0.5 ${view === 'table' ? 'bx-btn-on' : ''}`} aria-pressed={view === 'table'} onClick={() => set({ view: 'table' })} data-testid="map-table-button">Table</button>
          </div>
          <button type="button" className="bx-btn !py-0.5" onClick={csv} data-testid="map-csv">Download CSV</button>
        </div>
        <Legend layer={layer} of="the 117 tracts" />
        {view !== 'table' && mapView}
        <p className="sr-only" aria-live="polite" data-testid="map-live">{live}</p>
        {overlays.has('locations') && <LocationLegend data={locations} present={presentTypes} />}
        {(view === 'table' || view === 'both') && table}
        <AboutLayer layer={layer}>
          {bench && (
            <div className="mt-3 text-sm" data-testid="benchmarks">
              <p className="font-semibold">The same estimate for the counties and the state</p>
              <BenchLine name="Madison County" b={bench.madison} l={layer} /><BenchLine name="Cullman County" b={bench.cullman} l={layer} /><BenchLine name="Alabama" b={bench.alabama} l={layer} />
            </div>
          )}
          <p className="text-sm mt-2">Tract boundaries: the Census Bureau's 2023 cartographic boundary file (<a href={map.geometry.url}>{map.geometry.url.split('/').pop()}</a>), downloaded {map.geometry.downloaded}. <Link to="/map/sources">Details →</Link></p>
        </AboutLayer>
      </div>

      <aside aria-live="polite" className="min-w-0">
        {place && byId.has(place)
          ? <LocationPanel ids={map.frames.flatMap((f) => f.markers).find((m) => m.ids.includes(place))?.ids ?? [place]} byId={byId} types={locations.types} onClose={() => set({ place: null })}
              extra={(p) => <p className="mt-1"><AddNoteButton anchor={{ type: 'location', id: p.id }} label="Add note on this place" />{p.tract && <> · <button type="button" className="underline" onClick={() => set({ geo: p.tract, place: null })}>Its tract</button></>}</p>} />
          : sel && idxOf.has(sel)
          ? <TractPanel id={sel} layers={layers} map={map} locations={locations} onClose={() => set({ geo: null })} current={layer.id} onPlace={(id) => set({ place: id, geo: null, overlay: 'locations' })} />
          : <div className="bx-panel p-4 text-sm">Select a tract on the map or in the table to see every tract layer for it, with its margins of error, and the service locations inside it.</div>}
      </aside>
    </div>
  );
}

function TractPanel({ id, layers, map, locations, onClose, current, onPlace }: { id: string; layers: LayerT[]; map: TractMapT; locations: LocationsData; onClose: () => void; current: string; onPlace: (id: string) => void }) {
  const i = map.ids.indexOf(id);
  const a = map.frames.flatMap((f) => f.areas).find((x) => x.id === id)!;
  const tl = layers.filter((l) => l.geography[0] === 'tract');
  const inside = locations.locations.filter((p) => p.tract === id);
  const row = (l: LayerT) => {
    const v = map.values[l.id]?.[i] ?? '';
    if (l.family === 'survey') {
      const w = surveyWords(v, map.moe[l.id]?.[i] ?? '', l);
      return <><span className={v === '' ? 'italic bx-muted' : 'font-semibold'}>{w.value}</span>{w.between && <span className="block text-xs bx-muted">{w.between} (computed)</span>}</>;
    }
    return v === '' ? <span className="italic bx-muted">{MISSING}</span> : <><span className="font-semibold">{fmtValue(v, l)}</span>{!l.panel_only && <span className="block text-xs bx-muted">modeled estimate</span>}</>;
  };
  return (
    <div className="bx-card p-3 text-sm" data-testid="area-panel">
      <div className="flex items-start gap-2">
        <h2 className="text-xl flex-1">{a.name}</h2>
        <button type="button" className="bx-btn !py-0.5" onClick={onClose} aria-label="Close panel">×</button>
      </div>
      <p className="bx-muted">{a.county} County · {a.id}</p>
      <p className="mt-1 flex flex-wrap gap-x-3"><AddNoteButton anchor={{ type: 'map', id: `tracts:${current}:${id}` }} label="Add note on this tract" /><Link to={`/map/region?geo=${a.county_fips}`}>{a.county} County on the region map →</Link></p>
      <div className="mt-2 bx-panel p-2.5 text-[13px]" data-testid="tract-locations">
        <p className="font-semibold">Service locations in this tract ({inside.length})</p>
        {inside.length ? <ul className="mt-1 grid gap-0.5">{inside.map((p) => <li key={p.id}><button type="button" className="underline text-left" onClick={() => onPlace(p.id)}>{p.name}</button> <span className="bx-muted">· {locations.types[p.type] ?? p.type}{p.precision === 'approximate' ? ' · approximate position' : ''}</span></li>)}</ul>
          : <p className="bx-muted">None named in the report. That is not the same as no services.</p>}
      </div>
      {(['survey', 'modeled'] as const).map((fam) => (
        <details key={fam} open className="mt-3">
          <summary className="cursor-pointer font-semibold">{FAMILY_LABEL[fam]}</summary>
          <table className="w-full mt-1 text-[13px] border-collapse">
            <tbody>
              {tl.filter((l) => l.family === fam).map((l) => (
                <tr key={l.key} className="border-t align-top" style={{ borderColor: 'var(--bx-line-soft)' }} data-layer={l.id}>
                  <td className="p-1 w-1/2">{l.label} <button type="button" className="bx-cite" data-cite={l.ref} aria-label={`Source ${l.ref}`}>[{l.ref}]</button></td>
                  <td className="p-1">{row(l)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ))}
    </div>
  );
}
