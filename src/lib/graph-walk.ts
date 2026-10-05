/**
 * "Depends on" / "Is depended on by" (KICKOFF §4e): everything upstream or downstream of a node, found by walking
 * the drawn edges — following the report's own links, nothing inferred. An edge `from → to` means `from`
 * conditions `to`, so `to` depends on `from`.
 */
export interface WalkEdge { id: string; from: string; to: string }

export function walk(start: string, edges: WalkEdge[], mode: 'upstream' | 'downstream'): { nodes: Set<string>; edges: Set<string> } {
  const nodes = new Set<string>();
  const used = new Set<string>();
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const e of edges) {
      const next = mode === 'upstream' ? (e.to === cur ? e.from : null) : (e.from === cur ? e.to : null);
      if (next === null) continue;
      used.add(e.id);
      if (next !== start && !nodes.has(next)) { nodes.add(next); queue.push(next); }
    }
  }
  return { nodes, edges: used };
}
