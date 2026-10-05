import { describe, expect, it } from 'vitest';
import { walk } from '../../src/lib/graph-walk';
import { readPack } from './helpers';

const g = JSON.parse(readPack('figures/data/systems-graph.json')) as { nodes: { id: string; kind: string }[]; edges: { id: string; from: string; to: string; row: number; fan_out: boolean }[] };

describe('systems graph walk on the real edges', () => {
  it('has thirteen parts, eleven rows and 25 edges, the Data row fanning out to the other eleven statewide parts', () => {
    expect(g.nodes).toHaveLength(13);
    expect(g.nodes.filter((n) => n.kind === 'region').map((n) => n.id)).toEqual(['s13']);
    expect(new Set(g.edges.map((e) => e.row)).size).toBe(11);
    expect(g.edges).toHaveLength(25);
    const fan = g.edges.filter((e) => e.fan_out);
    expect(fan).toHaveLength(11);
    expect(new Set(fan.map((e) => e.from))).toEqual(new Set(['d6']));
    expect(new Set(fan.map((e) => e.to)).size).toBe(11);
    expect(fan.some((e) => e.to === 's13')).toBe(false);
  });
  it('walks upstream: Service continuum (d3) depends on every part but the ring', () => {
    const up = walk('d3', g.edges, 'upstream');
    expect(up.nodes.has('s12')).toBe(true);
    expect(up.nodes.has('d6')).toBe(true);
    expect(up.nodes.has('s13')).toBe(false);
  });
  it('walks downstream from Governance (d1) to the ring', () => {
    const down = walk('d1', g.edges, 'downstream');
    expect(down.nodes.has('s13')).toBe(true);
    expect(down.nodes.has('d7')).toBe(true);
    expect(down.nodes.has('d1')).toBe(false);
  });
  it('the ring (s13) depends only on what reaches it', () => {
    expect(walk('s13', g.edges, 'downstream').nodes.size).toBe(0);
    expect(walk('s13', g.edges, 'upstream').nodes.has('d1')).toBe(true);
  });
});
