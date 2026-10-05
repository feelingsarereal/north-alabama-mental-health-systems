import { D, sectionsIndex, conceptsIndex, figuresIndex } from '@/lib/data';
import type { AnchorIndex } from '@/lib/notepad';

let cached: Promise<AnchorIndex> | null = null;
/** The ids notes can anchor to, from the current build. Built lazily (each source is its own chunk). */
export function loadAnchorIndex(): Promise<AnchorIndex> {
  if (!cached) cached = Promise.all([D.reader.load(), D.glossary.load(), D.references.load(), D.openItems.load(), D.layers.load(), D.mapRegion.load(), D.mapTracts.load(), D.locations.load(), D.systems.load(), D.figures.load(), D.concepts.load()])
    .then(([reader, glossary, refs, ois, layers, region, tracts, locs, systems, figures, concepts]) => {
      const blocks = new Map<string, { section: string }>();
      for (const s of reader) for (const c of s.chunks) {
        if (c.k === 'b') blocks.set(c.b.id, { section: s.id });
        if (c.k === 'list') for (const b of c.items) blocks.set(b.id, { section: s.id });
      }
      return {
        sections: sectionsIndex.map((s) => ({ id: s.id, title: s.title, number: null })),
        blocks,
        terms: new Map(glossary.map((g) => [g.id, { term: g.term, sections: g.appears }])),
        refs: new Map(refs.map((r) => [r.n, { citation: r.citation, sections: r.cited_in }])),
        figures: new Map(figures.map((f) => [f.id, { title: `${f.label}. ${f.title}`, sections: f.discussed_in }])),
        openItems: new Map(ois.map((o) => [o.id, { what: o.what_text, sections: o.sections }])),
        layers: new Map(layers.map((l) => [l.key, l.label])),
        areas: new Map([...region.areas.map((a) => [`region:${a.id}`, `${a.name} County`] as [string, string]), ...tracts.frames.flatMap((f) => f.areas.map((a) => [`tracts:${a.id}`, `${a.name}, ${a.county} County`] as [string, string]))]),
        locations: new Map(locs.locations.map((p) => [p.id, { name: p.name }])),
        nodes: new Map(systems.nodes.map((n) => [n.id, { title: n.title, section: n.section }])),
        units: new Map(concepts.map((c) => [c.id, { title: c.title, sections: [] as string[] }])),
      };
    });
  void conceptsIndex; void figuresIndex;
  return cached;
}
