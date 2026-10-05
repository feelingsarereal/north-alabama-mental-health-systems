import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AS_OF_TEXT, D, useData } from '@/lib/data';
import { Rich } from '@/components/Rich';
import SystemsGraph, { type GraphState } from '@/components/systems/SystemsGraph';
import { AddNoteButton } from '@/components/AddNoteButton';

/** /systems (KICKOFF §4e): the graph with URL-addressable selection; the table view is the default below 768 px. */
export default function Systems() {
  const data = useData(D.systems);
  const [sp, setSp] = useSearchParams();
  const narrow = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
  const state: GraphState = useMemo(() => ({
    node: sp.get('node'), edge: sp.get('edge'),
    mode: (sp.get('mode') as GraphState['mode']) ?? null,
    view: (sp.get('view') as GraphState['view']) ?? (narrow ? 'table' : 'graph'),
  }), [sp, narrow]);
  const set = useCallback((p: Partial<GraphState>) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(p)) { if (v === null || v === undefined) next.delete(k); else next.set(k, String(v)); }
    if ('node' in p && p.node === null && !('mode' in p)) next.delete('mode');
    setSp(next, { replace: true });
  }, [sp, setSp]);
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-3xl sm:text-4xl">How the parts of the system depend on one another</h1>
      <p className="mt-2 text-[15px]">The links are the report's analysis; the evidence on each link is sourced.</p>
      <p className="mt-1 flex flex-wrap gap-2 items-center text-sm"><span className="bx-asof">Current as of {AS_OF_TEXT}</span>{state.node && <AddNoteButton anchor={{ type: 'node', id: state.node }} label="Add note on this part" />}</p>
      {!data ? <p className="bx-muted mt-6" role="status">Loading…</p> : (
        <>
          <div className="mt-6"><SystemsGraph data={data} state={state} set={set} /></div>
          <section className="mt-10 max-w-3xl" aria-labelledby="reading-h">
            <h2 id="reading-h" className="text-xl">The report's reading of the map</h2>
            <div className="bx-synthesis mt-2"><span className="bx-synthesis-label">analysis</span><p className="leading-7"><Rich nodes={data.reading} /></p></div>
          </section>
        </>
      )}
    </div>
  );
}
