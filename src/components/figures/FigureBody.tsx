/**
 * The six figures (APP-SPEC §4): a bar chart and a two-series line chart rebuilt from the pack's CSVs with exact-value
 * tooltips and legend toggles, three sortable tables, and the systems graph. Values are as published; nothing is
 * derived. Figure 4's bars carry their `as_printed` label (two are lower bounds, drawn at the bound); Figure 5 mixes
 * two units on one axis, so the sentence of its reading note that says so sits directly under the chart.
 */
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, LabelList, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { D, useData } from '@/lib/data';
import { downloadText, toCsv, downloadBlob } from '@/lib/download';
import Popover from '@/components/ui/Popover';
import SystemsGraph, { type GraphState } from '@/components/systems/SystemsGraph';
import type { FigureT } from '@/types';

const SERIES_COLORS = ['#a84f17', '#3f6f8f', '#7a8791', '#2e7d5b'];

function svgToPng(svg: SVGSVGElement, filename: string) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const r = svg.getBoundingClientRect();
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(r.width)); clone.setAttribute('height', String(r.height));
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', '100%'); bg.setAttribute('height', '100%'); bg.setAttribute('fill', getComputedStyle(document.body).backgroundColor || '#fff');
  clone.insertBefore(bg, clone.firstChild);
  const src = svg.querySelectorAll('*'); const dst = clone.querySelectorAll('*');
  src.forEach((el, i) => { const cs = getComputedStyle(el); const d = dst[i] as SVGElement; for (const p of ['fill', 'stroke', 'font-size', 'font-family', 'font-weight']) d.style.setProperty(p, cs.getPropertyValue(p)); });
  const data = new XMLSerializer().serializeToString(clone);
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = r.width * 2; c.height = r.height * 2;
    const ctx = c.getContext('2d')!; ctx.scale(2, 2); ctx.drawImage(img, 0, 0);
    c.toBlob((b) => { if (b) downloadBlob(b, filename); }, 'image/png');
  };
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(data)}`;
}

function Chart({ f }: { f: FigureT }) {
  const spec = f.chart!;
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const box = useRef<HTMLDivElement>(null);
  const { rows, series } = useMemo(() => {
    if ((spec.type === 'grouped-bar' || spec.type === 'line') && spec.series) {
      const ser = [...new Set(f.rows.map((r) => r[spec.series!]))];
      const byX = new Map<string, Record<string, string | number | null>>();
      for (const r of f.rows) {
        const k = r[spec.x.field];
        if (!byX.has(k)) byX.set(k, { [spec.x.field]: k });
        byX.get(k)![r[spec.series!]] = r[spec.y.field] === '' ? null : Number(r[spec.y.field]);
        if (r.ref) byX.get(k)![`${r[spec.series!]}__source`] = r.ref;
      }
      return { rows: [...byX.values()], series: ser };
    }
    // the CSV's `ref` column is renamed: Recharts spreads a data row into element props, where `ref` is reserved
    return { rows: f.rows.map(({ ref, ...r }) => ({ ...r, source_ref: ref, [spec.y.field]: r[spec.y.field] === '' ? null : Number(r[spec.y.field]) })), series: [spec.y.field] };
  }, [f, spec]);
  const horizontal = false;
  const unitsNote = spec.type === 'line' && spec.series ? f.how_to_read.split(/(?<=\.)\s+/).filter((x) => /units?\b/i.test(x)).join(' ') : '';
  const unit = spec.y.unit ? ` ${spec.y.unit}` : '';
  const yLabel = `${spec.y.label ?? spec.y.field}${spec.y.unit ? ` (${spec.y.unit})` : ''}`;
  const tip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number | null; payload: Record<string, string> }[]; label?: string }) => {
    if (!active || !payload?.length) return null;
    const row = payload[0].payload;
    return (
      <div className="bx-card p-2 text-xs max-w-xs">
        <p className="font-bold">{label}</p>
        {payload.map((p) => <p key={p.name}>{spec.series ? `${p.name}: ` : ''}{row.as_printed ? `${row.as_printed} (as printed)` : p.value === null ? 'no value' : `${p.value.toLocaleString('en-US')}${unit}`}{row[`${p.name}__source`] ? ` [${row[`${p.name}__source`]}]` : ''}</p>)}
        {row.source_kind && <p className="mt-1">{row.source_kind}</p>}
        {row.note && <p className="mt-1 bx-muted">{row.note}</p>}
        {(row.source_ref ?? row.ref) && <p className="mt-1 bx-muted">Source [{String(row.source_ref ?? row.ref).split(';').join('] [')}]</p>}
      </div>
    );
  };
  return (
    <div>
      <div ref={box} className="w-full" style={{ height: horizontal ? Math.max(320, rows.length * 34 + 60) : 380 }}>
        <ResponsiveContainer width="100%" height="100%">
          {horizontal ? <></> : spec.type === 'line' ? (
            <LineChart data={rows} margin={{ left: 8, right: 24, top: 8, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--bx-line-soft)" />
              <XAxis dataKey={spec.x.field} tick={{ fill: 'var(--bx-ink)', fontSize: 12 }} label={{ value: spec.x.label ?? spec.x.field, position: 'insideBottom', offset: -12, fill: 'var(--bx-ink)', fontSize: 12 }} />
              <YAxis tick={{ fill: 'var(--bx-ink)', fontSize: 12 }} label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: 'var(--bx-ink)', fontSize: 12 }} />
              <Tooltip content={tip as never} />
              <Legend verticalAlign="top" onClick={(e) => { const k = String((e as { dataKey?: string }).dataKey); setHidden((h) => { const n = new Set(h); if (n.has(k)) n.delete(k); else n.add(k); return n; }); }} wrapperStyle={{ cursor: 'pointer', fontSize: 13 }} />
              {series.map((s, i) => <Line key={s} dataKey={s} name={s} stroke={SERIES_COLORS[i % SERIES_COLORS.length]} strokeWidth={2.5} strokeDasharray={i ? '6 3' : undefined} dot={{ r: i ? 4 : 5, strokeWidth: 2 }} hide={hidden.has(s)} isAnimationActive={false} />)}
            </LineChart>
          ) : (
            <BarChart data={rows} margin={{ left: 8, right: 16, top: 8, bottom: 56 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--bx-line-soft)" />
              <XAxis dataKey={spec.x.field} interval={0} angle={-25} textAnchor="end" height={90} tick={{ fill: 'var(--bx-ink)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--bx-ink)', fontSize: 12 }} label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: 'var(--bx-ink)', fontSize: 12 }} />
              <Tooltip content={tip as never} />
              {spec.series && <Legend verticalAlign="top" onClick={(e) => { const k = String((e as { dataKey?: string }).dataKey); setHidden((h) => { const n = new Set(h); if (n.has(k)) n.delete(k); else n.add(k); return n; }); }} wrapperStyle={{ cursor: 'pointer', fontSize: 13 }} />}
              {series.map((s, i) => (
                <Bar key={s} dataKey={s} name={s} fill={SERIES_COLORS[i % SERIES_COLORS.length]} hide={hidden.has(s)} isAnimationActive={false}>
                  {f.rows.some((r) => r.as_printed) && <LabelList dataKey="as_printed" position="top" fill="var(--bx-ink)" fontSize={12} fontWeight={700} />}
                </Bar>
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      {unitsNote && <p className="text-[14px] leading-6 font-semibold mt-1" data-testid="units-note">{unitsNote}</p>}
      {spec.series && (
        <div className="flex flex-wrap gap-2 text-xs mt-1" role="group" aria-label="Show or hide a series">
          {series.map((s, i) => (
            <button key={s} type="button" className={`bx-btn !py-0.5 ${hidden.has(s) ? '' : 'bx-btn-on'}`} aria-pressed={!hidden.has(s)} onClick={() => setHidden((h) => { const n = new Set(h); if (n.has(s)) n.delete(s); else n.add(s); return n; })}>
              <span aria-hidden="true" style={{ display: 'inline-block', width: 10, height: 10, background: SERIES_COLORS[i % SERIES_COLORS.length] }} /> {s}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2 mt-2 text-xs no-print">
        <button type="button" className="bx-btn !py-0.5" onClick={() => { const svg = box.current?.querySelector('svg.recharts-surface') as SVGSVGElement | null; if (svg) svgToPng(svg, `${f.id}.png`); }}>Download PNG</button>
        <button type="button" className="bx-btn !py-0.5" onClick={() => downloadText(toCsv([Object.keys(f.rows[0] ?? {}), ...f.rows.map((r) => Object.values(r))]), `${f.id}.csv`, 'text/csv;charset=utf-8')}>Download CSV</button>
      </div>
    </div>
  );
}

function SortTable({ f }: { f: FigureT }) {
  const cols = f.columns ?? Object.keys(f.rows[0] ?? {}).map((k) => ({ field: k, label: k }));
  const [sort, setSort] = useState<{ k: string; dir: 1 | -1 } | null>(null);
  const rows = useMemo(() => {
    if (!sort) return f.rows;
    const num = (s: string) => { const m = /-?[\d,]*\.?\d+/.exec(s ?? ''); return m ? Number(m[0].replace(/,/g, '')) : NaN; };
    return [...f.rows].sort((a, b) => { const x = num(a[sort.k]); const y = num(b[sort.k]); if (!isNaN(x) && !isNaN(y)) return (x - y) * sort.dir; return String(a[sort.k]).localeCompare(String(b[sort.k])) * sort.dir; });
  }, [f.rows, sort]);
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse" data-testid="figure-table">
          <thead>
            <tr className="bx-th text-left">
              {cols.map((c) => (
                <th key={c.field} className="p-2 border" style={{ borderColor: 'var(--bx-line-soft)' }} aria-sort={sort?.k === c.field ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" className="font-bold text-left" onClick={() => setSort((s) => (s?.k === c.field ? { k: c.field, dir: (s.dir * -1) as 1 | -1 } : { k: c.field, dir: 1 }))}>{c.label} {sort?.k === c.field ? (sort.dir === 1 ? '▲' : '▼') : ''}</button>
                </th>
              ))}
              <th className="p-2 border" style={{ borderColor: 'var(--bx-line-soft)' }}>Sources</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="align-top">
                {cols.map((c) => <td key={c.field} className="p-2 border" style={{ borderColor: 'var(--bx-line-soft)' }}>{r[c.field]}</td>)}
                <td className="p-2 border" style={{ borderColor: 'var(--bx-line-soft)' }}>{String(r.ref ?? '').split(';').filter(Boolean).map((n) => <button key={n} type="button" className="bx-cite" data-cite={n} aria-label={`Source ${n}`}>[{n}]</button>)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="bx-btn !py-0.5 text-xs mt-2 no-print" onClick={() => downloadText(toCsv([Object.keys(f.rows[0] ?? {}), ...f.rows.map((r) => Object.values(r))]), `${f.id}.csv`, 'text/csv;charset=utf-8')}>Download CSV</button>
    </div>
  );
}

function GraphFigure() {
  const data = useData(D.systems);
  const [state, setState] = useState<GraphState>({ node: null, edge: null, mode: null, view: typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches ? 'table' : 'graph' });
  if (!data) return <p className="bx-muted" role="status">Loading…</p>;
  return <SystemsGraph data={data} state={state} set={(p) => setState((s) => ({ ...s, ...p, ...('node' in p && p.node === null && !('mode' in p) ? { mode: null } : {}) }))} />;
}

export function ExplainChips({ f }: { f: FigureT }) {
  if (!f.explain.length) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-2 text-xs">
      {f.explain.map((x) => (
        <Popover key={x.on} className="bx-chip-line" ariaLabel={`What “${x.on}” means`} content={
          <div className="text-sm">
            <p>{x.text}</p>
            <p className="mt-1 font-semibold">{x.term && <Link to={`/glossary#term-${x.term}`}>Glossary →</Link>} {x.concept && <Link to={`/concepts/${x.concept}`}>Primer →</Link>}</p>
          </div>
        }>ⓘ {x.on}</Popover>
      ))}
    </div>
  );
}

export default function FigureBody({ id, compact = false }: { id: string; compact?: boolean }) {
  const figs = useData(D.figures);
  if (!figs) return <p className="bx-muted text-sm" role="status">Loading figure…</p>;
  const f = figs.find((x) => x.id === id);
  if (!f) return <p className="bx-todo">Figure {id} is not in the pack</p>;
  return (
    <div data-testid="figure-body">
      <p className="text-sm font-bold" style={{ color: 'var(--bx-accent)' }}>{f.label}. {f.title}</p>
      <div className="mt-2">
        {f.kind === 'chart' && <Chart f={f} />}
        {f.kind === 'table' && <SortTable f={f} />}
        {f.kind === 'network' && (compact ? <p className="text-sm">The interactive graph is on <Link to="/systems">the Systems page</Link> and on <Link to={`/figures/${f.id}`}>this figure's page</Link>.</p> : <GraphFigure />)}
      </div>
      <figcaption className="mt-2 text-[14px] leading-6">{f.caption}</figcaption>
      {!compact && <ExplainChips f={f} />}
    </div>
  );
}
