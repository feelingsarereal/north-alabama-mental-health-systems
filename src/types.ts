/** Shapes of the generated data in src/data/*.json (written by scripts/build-content.ts). */

/** Compact hast: a string, or [tag, props | 0, ...children]. Custom tags: x-cite {n}, x-term {id}, x-claim {id, g}. */
export type CNode = string | [string, Record<string, unknown> | 0, ...CNode[]];

export type Marker = 'framing' | 'synthesis' | null;
export type StatusGroup = 'verified' | 'own' | 'notfound';

export interface RBlock { id: string; kind: 'p' | 'li' | 'table' | 'list'; marker: Marker; h: CNode[]; syn?: string }
export type RChunk = { k: 'b'; b: RBlock } | { k: 'list'; ordered: boolean; start: number | null; items: RBlock[] } | { k: 'fig'; id: string };
export interface RSection { id: string; title: string; depth: number; top: string; chunks: RChunk[] }

export interface SectionMeta { id: string; title: string; depth: number; top: string; part: string; words: number }
export interface TopMeta {
  id: string; title: string; claims: number; notfound: number; open: number;
  node: string | null; layers: string[];
}

export interface Reference {
  n: number; tier: 'seminal' | 'current' | 'background'; citation: string; title: string; publisher: string; published: string; year_basis: string;
  url: string; year: number; summary: string; why_it_mattered: string; role_here: string; cited_in: string[];
  verified: boolean; read: 'full' | 'partial' | 'not-read'; read_note: string; accessed: string; doc_type: string;
  /** cited only by the maps, the glossary or the primers (not by the report or its ledger) */
  aux: boolean; ledger_only: boolean;
}

export interface LedgerSource { n: number; quote: string; locator: string; finding: string }
export interface LedgerItem {
  id: string; block: string; section: string; kind: string; status: string; quote: string;
  sources: LedgerSource[]; looked: string; note: string; checked: string; pass: string; anchored: boolean;
}

export interface OpenItemT {
  id: string; group: string; what: CNode[]; what_text: string; why: CNode[]; why_text: string; blocks: string[]; sections: string[]; tops: string[];
  looked: string; who: 'author' | 'anyone-with-a-browser' | 'next-review'; how_to_close: CNode[]; how_text: string; pinned: boolean;
  /** the Appendix C list item that prints this entry, when it is one of the first 22 */
  appendix_c: string | null;
  block_refs: { id: string; section: string; top: string; exists: boolean }[];
}

export interface GlossaryItem {
  id: string; term: string; kind: string; category: string; variants: string[]; short: string; def: CNode[];
  concept?: string; see: string[]; refs: number[]; sources: string[]; appears: string[]; self_description: boolean; in_text: boolean;
}
export interface GlossaryShort { id: string; term: string; short: string; concept?: string }

export interface ConceptT {
  id: string; title: string; one_liner: string; why_here: string; prerequisites: string[]; terms: string[]; figures: string[];
  further_reading: { title: string; url: string; kind?: string }[];
  self_check: { q: string; options: string[]; answer: number; explanation: string }[];
  body: CNode[];
}

export interface FigureT {
  id: string; label: string; title: string; kind: 'chart' | 'table' | 'network'; synthesis: 'data' | 'conceptual'; refs: number[];
  chart?: { type: 'bar' | 'grouped-bar' | 'line'; x: { field: string; label?: string; unit?: string }; y: { field: string; label?: string; unit?: string }; series?: string };
  columns?: { field: string; label: string }[]; data: string; caption: string; how_to_read: string;
  explain: { on: string; text: string; term?: string; concept?: string }[]; concepts: string[]; discussed_in: string[]; source: string;
  rows: Record<string, string>[];
}

export interface GeoStat { breaks: number[]; published: number; missing: string[]; categories?: { value: string; count: number }[] }
export interface LayerT {
  id: string; label: string; unit: string; geography: ['county' | 'tract']; definition: string; higher_is: 'better' | 'worse' | 'neutral';
  source_title: string; publisher: string; vintage: string; url: string; data_url: string; retrieved: string; retrieval: string;
  suppressed_note: string; caveats: string; ref: number; group: string; moe_column?: string; moe_file?: string; benchmarks?: string; panel_only: boolean;
  /** "<geography>:<id>" — ids are unique only within a geography */
  key: string; type: 'numeric' | 'categorical'; family: 'county' | 'survey' | 'modeled'; stat: GeoStat;
}

export interface MapArea { id: string; name: string; d: string; cx: number; cy: number }
export interface CountyArea extends MapArea { role: 'core' | 'ring'; cmhc: string }
export interface TractArea extends MapArea { county_fips: string; county: string }

export interface ServiceLocation {
  id: string; name: string; type: string; address: string; city: string; county_fips: string; county: string; in_core: boolean;
  lon: number | null; lat: number | null; tract: string | null; coord_source: string | null; precision: 'address' | 'approximate' | 'ambiguous' | 'none';
  note: string; ref: number; blocks: string[];
}
/** A drawn marker: one or more locations at one projected point (WellStone's Huntsville campus is three). */
export interface MapMarker { x: number; y: number; ids: string[]; type: string; approximate: boolean }

export interface CenterGroup { id: string; label: string; fips: string[]; d: string; ccbhc: boolean; ccbhc_date: string | null; ccbhc_ref: number | null }
export interface TwoOneOne { id: string; label: string; fips: string[]; d: string; also_serves: string[] }
export interface CountyInfo {
  cmhc: { center: string; ccbhc: boolean; ccbhc_date: string | null; ccbhc_ref: number | null } | null;
  two_one_one: string | null;
  in_catchment: boolean;
}

export interface RegionMap {
  width: number; height: number; areas: CountyArea[]; backdrop: string; core: string; catchment: string;
  values: Record<string, string[]>; alabama: Record<string, string>;
  centers: { ref: number; source_url: string; note: string; groups: CenterGroup[] };
  crisis: { label: string; ref: number; source_url: string; as_of: string; counties: string[] };
  two_one_one: { ref: number; note: string; groups: TwoOneOne[]; unassigned: string[] };
  countyInfo: Record<string, CountyInfo>;
  markers: MapMarker[];
}

export interface TractFrame { fips: string; name: string; width: number; height: number; outline: string; areas: TractArea[]; markers: MapMarker[] }
export interface Benchmark { est: string; moe: string }
export interface TractMap {
  frames: TractFrame[];
  /** tract ids in table order; values[layer][i] belongs to ids[i] */
  ids: string[];
  values: Record<string, string[]>; moe: Record<string, string[]>;
  benchmarks: Record<string, { alabama: Benchmark; madison: Benchmark; cullman: Benchmark }>;
  geometry: { url: string; downloaded: string; bytes: number; sha256: string; last_modified: string | null; vintage: string };
}

export interface LocationsData {
  types: Record<string, string>; locations: ServiceLocation[]; retrieved: string; note: string;
}

export interface GraphNode { id: string; label: string; title: string; kind: 'domain' | 'cross-sector' | 'region'; number: number; section: string; scope: CNode[]; scope_block: string }
export interface GraphEdge { id: string; from: string; to: string; row: number; pair: string; link: string; evidence: CNode[]; evidence_text: string; refs: number[]; block: string; fan_out: boolean }
export interface Headline { label: string; madison: string; cullman: string; alabama: string; note: string; layer: string | null; refs: number[]; nodes: string[]; block: string | null; source: string }
export interface NodeFigure { claim: string; text: string; status: string; refs: number[]; section: string; block: string }
export interface SystemsData { nodes: GraphNode[]; edges: GraphEdge[]; reading: CNode[]; reading_block: string; headline: Headline[]; figures: Record<string, NodeFigure[]>; layers: Record<string, string[]> }
