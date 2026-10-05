/**
 * The systems graph (KICKOFF §4e): the statewide report's twelve parts plus the ring (13), and the links of this
 * report's dependency table. Fixed, deterministic layout — the eight domains on a ring in numeric order, the four
 * cross-sector sections on an outer arc beside the domains they connect to, and the ring node set apart at the edge
 * as a hexagon. No force simulation. The Data row's fan-out (fan_out: true) is drawn as one halo on its source node
 * until that node or one of its edges is selected. Nothing is added: nodes and edges are exactly
 * figures/data/systems-graph.json.
 */
import { useMemo, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { Rich } from '@/components/Rich';
import { blockHref, layersBrief } from '@/lib/data';
import { walk } from '@/lib/graph-walk';
import type { GraphEdge, GraphNode, SystemsData } from '@/types';

export interface GraphState { node: string | null; edge: string | null; mode: 'upstream' | 'downstream' | null; view: 'graph' | 'table' }

const W = 900; const H = 720; const CX = 450; const CY = 360; const R1 = 205; const R2 = 315; const NR = 44;
const STATUS_LABEL: Record<string, string> = { verified: 'verified', analysis: 'analysis', self: 'self', absence: 'not found' };

function hexagon(r: number): string {
  return Array.from({ length: 6 }, (_, k) => { const a = (Math.PI / 3) * k; return `${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a) * 0.86).toFixed(1)}`; }).join(' ');
}

export function layout(nodes: GraphNode[], edges: GraphEdge[]): Map<string, { x: number; y: number; angle: number }> {
  const pos = new Map<string, { x: number; y: number; angle: number }>();
  const domains = nodes.filter((n) => n.kind === 'domain').sort((a, b) => a.number - b.number);
  domains.forEach((n, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / domains.length;
    pos.set(n.id, { x: CX + R1 * Math.cos(a), y: CY + R1 * Math.sin(a), angle: a });
  });
  const cross = nodes.filter((n) => n.kind === 'cross-sector').sort((a, b) => a.number - b.number);
  const want = cross.map((n) => {
    const nb = edges.flatMap((e) => (e.from === n.id ? [e.to] : e.to === n.id ? [e.from] : [])).filter((id) => pos.has(id));
    let sx = 0; let sy = 0;
    for (const id of nb) { const p = pos.get(id)!; sx += Math.cos(p.angle); sy += Math.sin(p.angle); }
    return { id: n.id, a: nb.length ? Math.atan2(sy, sx) : 0 };
  }).sort((p, q) => p.a - q.a);
  // keep the outer nodes at least 34° apart, nudging deterministically
  const MIN = (34 * Math.PI) / 180;
  for (let pass = 0; pass < 20; pass++) {
    for (let i = 0; i < want.length; i++) {
      const j = (i + 1) % want.length;
      let d = want[j].a - want[i].a; if (j === 0) d += 2 * Math.PI;
      if (d < MIN) { const push = (MIN - d) / 2; want[i].a -= push; want[j].a += push; }
    }
  }
  for (const w of want) pos.set(w.id, { x: CX + R2 * Math.cos(w.a), y: CY + R2 * Math.sin(w.a), angle: w.a });
  // the ring (Section 13) has no counterpart in the statewide frame: set apart in the bottom-right corner
  nodes.filter((n) => n.kind === 'region').forEach((n, i) => pos.set(n.id, { x: W - NR - 20 - i * 120, y: H - NR - 16, angle: Math.PI / 4 }));
  return pos;
}

function edgePath(a: { x: number; y: number }, b: { x: number; y: number }, bend: number) {
  const dx = b.x - a.x; const dy = b.y - a.y; const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len; const uy = dy / len;
  const s = { x: a.x + ux * (NR + 2), y: a.y + uy * (NR + 2) };
  const t = { x: b.x - ux * (NR + 8), y: b.y - uy * (NR + 8) };
  const mx = (s.x + t.x) / 2 - uy * bend; const my = (s.y + t.y) / 2 + ux * bend;
  return { d: `M${s.x.toFixed(1)},${s.y.toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${t.x.toFixed(1)},${t.y.toFixed(1)}`, mx: (s.x + 2 * mx + t.x) / 4, my: (s.y + 2 * my + t.y) / 4 };
}

function wrapLabel(s: string, max = 12): string[] {
  const words = s.split(/\s+/); const lines: string[] = []; let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

export default function SystemsGraph({ data, state, set }: { data: SystemsData; state: GraphState; set: (p: Partial<GraphState>) => void }) {
  const pos = useMemo(() => layout(data.nodes, data.edges), [data]);
  const nodeById = useMemo(() => new Map(data.nodes.map((n) => [n.id, n])), [data]);
  const sel = state.node ? nodeById.get(state.node) ?? null : null;
  const selEdge = state.edge ? data.edges.find((e) => e.id === state.edge) ?? null : null;
  const fanFrom = data.edges.find((e) => e.fan_out)?.from ?? null;
  // the fan-out row shows as eleven arrows only while its source node (or one of its edges) is selected
  const fanOpen = !!fanFrom && (state.node === fanFrom || !!selEdge?.fan_out);
  const drawn = data.edges.filter((e) => !e.fan_out || fanOpen);

  const hl = useMemo(() => {
    const nodes = new Set<string>(); const edges = new Set<string>();
    if (selEdge) {
      nodes.add(selEdge.from); nodes.add(selEdge.to);
      for (const e of data.edges) if (e.row === selEdge.row) { edges.add(e.id); nodes.add(e.from); nodes.add(e.to); }
    } else if (sel) {
      nodes.add(sel.id);
      if (state.mode) { const w = walk(sel.id, data.edges, state.mode); w.nodes.forEach((n) => nodes.add(n)); w.edges.forEach((e) => edges.add(e)); }
      else for (const e of data.edges) if (e.from === sel.id || e.to === sel.id) { edges.add(e.id); nodes.add(e.from); nodes.add(e.to); }
    }
    return { nodes, edges, any: !!(sel || selEdge) };
  }, [sel, selEdge, state.mode, data.edges]);

  // bend edges that share a node pair in both directions so they do not overlap
  const bends = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of data.edges) m.set(e.id, data.edges.some((f) => f.from === e.to && f.to === e.from) ? 28 : 12);
    return m;
  }, [data.edges]);

  const key = (e: KeyboardEvent, f: () => void) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); f(); } };
  const color = (n: GraphNode) => (n.kind === 'domain' ? 'var(--bx-rule)' : '#3f6f8f');

  const svg = (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-[78vh]" role="group" aria-label="Systems graph: the statewide report's twelve parts and the ring, and this report's links between them" data-testid="systems-svg">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--bx-muted)" /></marker>
        <marker id="arrow-hl" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--bx-accent)" /></marker>
      </defs>
      {fanFrom && !fanOpen && (() => {
        const p = pos.get(fanFrom)!;
        return (
          <g data-testid="fan-halo" pointerEvents="none">
            <circle cx={p.x} cy={p.y} r={NR + 12} fill="none" stroke="var(--bx-accent)" strokeWidth={2} strokeDasharray="3 4" />
            <circle cx={p.x} cy={p.y} r={NR + 20} fill="none" stroke="var(--bx-accent)" strokeWidth={1} strokeOpacity={0.5} strokeDasharray="3 4" />
            <text x={p.x} y={p.y + NR + 36} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--bx-ink)" stroke="var(--bx-bg)" strokeWidth={4} paintOrder="stroke">points to every other part</text>
          </g>
        );
      })()}
      <g>
        {drawn.map((e) => {
          const a = pos.get(e.from)!; const b = pos.get(e.to)!;
          const p = edgePath(a, b, bends.get(e.id) ?? 12);
          const on = hl.edges.has(e.id);
          const dim = hl.any && !on;
          const from = nodeById.get(e.from)!; const to = nodeById.get(e.to)!;
          return (
            <g key={e.id} data-testid="graph-edge" data-edge={e.id} role="button" tabIndex={0} aria-pressed={state.edge === e.id}
              aria-label={`Link: ${from.label} to ${to.label}: ${e.link}`}
              onClick={() => set({ edge: e.id, node: null })} onKeyDown={(ev) => key(ev, () => set({ edge: e.id, node: null }))} className="cursor-pointer outline-none group">
              <path d={p.d} fill="none" stroke="transparent" strokeWidth={14} />
              <path d={p.d} fill="none" stroke={on ? 'var(--bx-accent)' : 'var(--bx-muted)'} strokeOpacity={dim ? 0.18 : on ? 1 : 0.6} strokeWidth={on ? 2.6 : 1.4} markerEnd={on ? 'url(#arrow-hl)' : 'url(#arrow)'} className="group-focus-visible:stroke-[3]" />
              {on && (
                <text x={p.mx} y={p.my} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--bx-ink)" stroke="var(--bx-bg)" strokeWidth={4} paintOrder="stroke" pointerEvents="none">{e.link}</text>
              )}
            </g>
          );
        })}
      </g>
      <g>
        {data.nodes.map((n) => {
          const p = pos.get(n.id)!;
          const on = hl.nodes.has(n.id);
          const dim = hl.any && !on;
          const isSel = state.node === n.id;
          const lines = wrapLabel(n.label);
          return (
            <g key={n.id} transform={`translate(${p.x.toFixed(1)},${p.y.toFixed(1)})`} data-testid="graph-node" data-node={n.id} role="button" tabIndex={0} aria-pressed={isSel}
              aria-label={`${n.kind === 'domain' ? 'Domain' : n.kind === 'region' ? 'The ring, section' : 'Cross-sector section'} ${n.number}: ${n.title}`}
              onClick={() => set({ node: n.id, edge: null })} onKeyDown={(ev) => key(ev, () => set({ node: n.id, edge: null }))} className="cursor-pointer outline-none" opacity={dim ? 0.35 : 1}>
              {n.kind === 'domain'
                ? <circle r={NR} fill="var(--bx-bg)" stroke={color(n)} strokeWidth={isSel ? 5 : 3} />
                : n.kind === 'region'
                ? <polygon points={hexagon(NR + 4)} fill="var(--bx-bg)" stroke="var(--bx-ink)" strokeWidth={isSel ? 5 : 3} />
                : <rect x={-NR} y={-NR * 0.78} width={NR * 2} height={NR * 1.56} rx={10} fill="var(--bx-bg)" stroke={color(n)} strokeWidth={isSel ? 5 : 3} strokeDasharray={isSel ? undefined : '6 3'} />}
              <text y={-NR * 0.38} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--bx-muted)">{n.kind === 'domain' ? `D${n.number}` : `S${n.number}`}</text>
              {n.id === fanFrom && <title>{fanOpen ? 'Data: its eleven links are shown' : 'Data points to every other part; select it to show the eleven links'}</title>}
              {lines.map((l, i) => <text key={i} y={-NR * 0.05 + i * 13} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--bx-ink)">{l}</text>)}
            </g>
          );
        })}
      </g>
    </svg>
  );

  const table = (
    <div className="overflow-x-auto" data-testid="systems-table">
      <table className="w-full text-sm border-collapse">
        <caption className="sr-only">The report's cross-domain dependency table, one row per link</caption>
        <thead><tr className="bx-th text-left"><th className="p-2 border" style={{ borderColor: 'var(--bx-line-soft)' }}>Row</th><th className="p-2 border" style={{ borderColor: 'var(--bx-line-soft)' }}>From</th><th className="p-2 border" style={{ borderColor: 'var(--bx-line-soft)' }}>To</th><th className="p-2 border" style={{ borderColor: 'var(--bx-line-soft)' }}>Link</th><th className="p-2 border" style={{ borderColor: 'var(--bx-line-soft)' }}>Evidence</th></tr></thead>
        <tbody>
          {data.edges.map((e) => (
            <tr key={e.id} className="align-top" data-block={e.block}>
              <td className="p-2 border" style={{ borderColor: 'var(--bx-line-soft)' }}>{e.row}</td>
              <td className="p-2 border" style={{ borderColor: 'var(--bx-line-soft)' }}><button type="button" className="underline font-semibold text-left" onClick={() => set({ node: e.from, edge: null })}>{nodeById.get(e.from)?.label}</button></td>
              <td className="p-2 border" style={{ borderColor: 'var(--bx-line-soft)' }}><button type="button" className="underline font-semibold text-left" onClick={() => set({ node: e.to, edge: null })}>{nodeById.get(e.to)?.label}</button></td>
              <td className="p-2 border font-semibold" style={{ borderColor: 'var(--bx-line-soft)' }}>{e.link}</td>
              <td className="p-2 border leading-6" style={{ borderColor: 'var(--bx-line-soft)' }}><Rich nodes={e.evidence} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0">
        <div className="flex flex-wrap gap-2 items-center mb-3 text-sm no-print">
          <div role="group" aria-label="View" className="flex gap-1">
            <button type="button" className={`bx-btn ${state.view === 'graph' ? 'bx-btn-on' : ''}`} aria-pressed={state.view === 'graph'} onClick={() => set({ view: 'graph' })}>Graph</button>
            <button type="button" className={`bx-btn ${state.view === 'table' ? 'bx-btn-on' : ''}`} aria-pressed={state.view === 'table'} onClick={() => set({ view: 'table' })} data-testid="table-view">Table</button>
          </div>
          <div role="group" aria-label="Highlight" className="flex gap-1">
            <button type="button" className={`bx-btn ${state.mode === 'upstream' ? 'bx-btn-on' : ''}`} aria-pressed={state.mode === 'upstream'} disabled={!sel} onClick={() => set({ mode: state.mode === 'upstream' ? null : 'upstream' })}>Depends on</button>
            <button type="button" className={`bx-btn ${state.mode === 'downstream' ? 'bx-btn-on' : ''}`} aria-pressed={state.mode === 'downstream'} disabled={!sel} onClick={() => set({ mode: state.mode === 'downstream' ? null : 'downstream' })}>Is depended on by</button>
          </div>
          {state.mode && sel && <span className="text-xs bx-muted">following the report's eleven links</span>}
          {(sel || selEdge) && <button type="button" className="bx-btn ml-auto" onClick={() => set({ node: null, edge: null, mode: null })}>Clear selection</button>}
        </div>
        {state.view === 'graph' ? (
          <>
            {svg}
            <p className="text-xs bx-muted mt-2 flex flex-wrap gap-4">
              <span><svg width="18" height="12" aria-hidden="true"><circle cx="9" cy="6" r="5" fill="none" stroke="var(--bx-rule)" strokeWidth="2" /></svg> domain (circle)</span>
              <span><svg width="18" height="12" aria-hidden="true"><rect x="2" y="1" width="14" height="10" rx="3" fill="none" stroke="#3f6f8f" strokeWidth="2" strokeDasharray="4 2" /></svg> cross-sector section (rounded square, dashed)</span>
              <span><svg width="18" height="14" aria-hidden="true"><polygon points="9,1 16,4.5 16,10.5 9,14 2,10.5 2,4.5" fill="none" stroke="var(--bx-ink)" strokeWidth="2" /></svg> the ring, thirteen surrounding counties (hexagon)</span>
              <span>dashed halo on Data: points to every other part (select Data to show its eleven links)</span>
              <span>arrow: the part at the tail conditions the part at the head</span>
            </p>
          </>
        ) : table}
      </div>
      <aside className="min-w-0" aria-live="polite">
        {selEdge ? <EdgePanel e={selEdge} nodeById={nodeById} /> : sel ? <NodePanel n={sel} data={data} nodeById={nodeById} set={set} /> : (
          <div className="bx-panel p-4 text-sm"><p>Select a part of the system to see its scope, its links and the Madison, Cullman and Alabama figures behind it, or select an arrow to read the evidence the report gives for that link.</p></div>
        )}
      </aside>
    </div>
  );
}

function EdgePanel({ e, nodeById }: { e: GraphEdge; nodeById: Map<string, GraphNode> }) {
  return (
    <div className="bx-card p-4 text-sm" data-testid="edge-panel" data-block={e.block}>
      <p className="text-xs bx-muted">Row {e.row} of the dependency table · {e.pair}</p>
      <h2 className="text-xl mt-1">{e.link}</h2>
      <p className="mt-1"><span className="font-semibold">{nodeById.get(e.from)?.title}</span> → <span className="font-semibold">{nodeById.get(e.to)?.title}</span></p>
      <p className="mt-3 leading-6" data-testid="edge-evidence"><Rich nodes={e.evidence} /></p>
      <p className="mt-3"><Link to={blockHref(e.block)}>The dependency table in the report →</Link></p>
    </div>
  );
}

function NodePanel({ n, data, nodeById, set }: { n: GraphNode; data: SystemsData; nodeById: Map<string, GraphNode>; set: (p: Partial<GraphState>) => void }) {
  const out = data.edges.filter((e) => e.from === n.id);
  const inc = data.edges.filter((e) => e.to === n.id);
  const heads = data.headline.filter((h) => h.nodes.includes(n.id));
  const figs = data.figures[n.id] ?? [];
  const layers = data.layers[n.id] ?? [];
  return (
    <div className="bx-card p-4 text-sm grid gap-3" data-testid="node-panel">
      <div>
        <p className="text-xs bx-muted">{n.kind === 'domain' ? `Domain ${n.number}` : n.kind === 'region' ? `Section ${n.number} · the ring` : `Section ${n.number} · beyond the Department`}</p>
        <h2 className="text-xl mt-0.5">{n.title}</h2>
        <p className="mt-2 leading-6"><Rich nodes={n.scope} /></p>
        <p className="mt-2"><Link to={`/read#${n.section}`} className="font-semibold">Read this section →</Link></p>
      </div>
      <div>
        <h3 className="text-base">Links</h3>
        <ul className="mt-1 grid gap-1">
          {inc.map((e) => <li key={e.id}><button type="button" className="text-left underline" onClick={() => set({ edge: e.id, node: null })}>← from {nodeById.get(e.from)?.label}: {e.link}</button></li>)}
          {out.map((e) => <li key={e.id}><button type="button" className="text-left underline" onClick={() => set({ edge: e.id, node: null })}>→ to {nodeById.get(e.to)?.label}: {e.link}</button></li>)}
          {!inc.length && !out.length && <li className="bx-muted">No link in the dependency table.</li>}
        </ul>
      </div>
      {n.kind === 'region' ? (
        <div data-testid="ring-headline">
          <h3 className="text-base">Headline indicators</h3>
          <p className="mt-1">The ring has no headline rows of its own. Its figures are the fifteen-county table: <Link to="/map/region" className="font-semibold">the region map and its table →</Link></p>
        </div>
      ) : heads.length > 0 && (
        <div>
          <h3 className="text-base">Headline indicators</h3>
          <div className="overflow-x-auto mt-1">
            <table className="w-full text-[13px] border-collapse" data-testid="headline-table">
              <thead><tr className="bx-th text-left"><th className="p-1.5">Indicator</th><th className="p-1.5">Madison</th><th className="p-1.5">Cullman</th><th className="p-1.5">Alabama</th></tr></thead>
              <tbody>
                {heads.map((h) => (
                  <tr key={h.label} className="align-top border-t" style={{ borderColor: 'var(--bx-line-soft)' }} data-block={h.block ?? undefined}>
                    <td className="p-1.5">{h.label}{h.note && <span className="block text-xs bx-muted">{h.note}</span>}<span className="block">{h.refs.map((r) => <button key={r} type="button" className="bx-cite" data-cite={r} aria-label={`Source ${r}`}>[{r}]</button>)} {h.block && <Link to={blockHref(h.block)} className="text-xs">in the report</Link>}</span></td>
                    <td className="p-1.5 font-semibold">{h.madison || <span className="italic font-normal bx-muted">not published</span>}</td>
                    <td className="p-1.5 font-semibold">{h.cullman || <span className="italic font-normal bx-muted">not published</span>}</td>
                    <td className="p-1.5">{h.alabama || <span className="italic bx-muted">not published</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <details>
        <summary className="cursor-pointer font-semibold">All sourced figures in this part of the report ({figs.length})</summary>
        <ul className="mt-2 grid gap-1.5">
          {figs.map((f) => (
            <li key={f.claim} className="leading-5" data-block={f.block}>
              <Link to={blockHref(f.block)}>{f.text}</Link>{' '}
              <span className="bx-chip-line !text-[11px]">{STATUS_LABEL[f.status] ?? f.status}</span>{' '}
              {f.refs.map((r) => <button key={r} type="button" className="bx-cite" data-cite={r} aria-label={`Source ${r}`}>[{r}]</button>)}
            </li>
          ))}
        </ul>
      </details>
      {layers.length > 0 && (
        <div>
          <h3 className="text-base">On the maps</h3>
          <ul className="mt-1 grid gap-0.5">
            {layers.map((lid) => {
              const ls = layersBrief.filter((x) => x.id === lid && !x.panel_only);
              if (!ls.length) return null;
              const county = ls.some((x) => x.geography[0] === 'county'); const tract = ls.some((x) => x.geography[0] === 'tract');
              return <li key={lid}>{ls[0].label}: {county && <Link to={`/map/region?layer=${lid}`}>region map</Link>}{county && tract && ' · '}{tract && <Link to={`/map/tracts?layer=${lid}`}>tract map</Link>}</li>;
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
