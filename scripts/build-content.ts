/**
 * Content build (KICKOFF §3): validate the content pack, parse review.md into blocks, link citations and terms,
 * anchor the claim ledger, index the open items, build the two maps and the systems graph, build the search index, and emit src/data/*.json + public/provenance.json. Fails loudly: every error is listed, written to
 * content-pack/BUILD-ERRORS.md and the process exits non-zero, but whatever validated is still emitted so the app
 * can show the errors on /methods. Idempotent: the same pack gives byte-identical output.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import Papa from 'papaparse';
import MiniSearch from 'minisearch';
import type { Element, Root as HRoot } from "hast";
import { toHast } from 'mdast-util-to-hast';
import {
  ManifestSchema, BrandSchema, GlossarySchema, ConceptFrontmatterSchema, FiguresSchema, ReferencesSchema, ScopeSchema,
  LedgerSchema, OpenItemsSchema, LayersSchema, OverlaysSchema, SystemsGraphSchema, IndicatorsSchema, zodLines,
  type Layer, type Overlays,
} from './lib/schemas';
import { parseReview, parseMarkdown, inlineHast, claimWords, type Block } from './lib/review';
import { buildMatcher, findAmbiguousVariants, type Matcher } from './lib/terms';
import { compactChildren, linkCitations, type CNode } from './lib/hast-ops';
import { linkTerms } from './lib/link-terms';
import { findAnchor, wrapClaim, statusGroup } from './lib/claims';
import { regionGeometry, tractGeometry, clusterMarkers, type PointIn } from './lib/geo';
import { cellNumber, quantileBreaks } from '../src/lib/stats';
import { MINISEARCH_OPTIONS, type SearchDoc } from '../src/lib/search-config';
import type {
  RBlock, RChunk, RSection, SectionMeta, TopMeta, Reference as RefT, LedgerItem, OpenItemT, GlossaryItem, ConceptT, FigureT,
  LayerT, GeoStat, RegionMap, TractMap, CountyInfo, LocationsData, SystemsData,
} from '../src/types';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACK = process.env.BX_PACK ? path.resolve(process.env.BX_PACK) : path.join(ROOT, 'content-pack');
const OUT = process.env.BX_OUT ? path.resolve(process.env.BX_OUT) : path.join(ROOT, 'src', 'data');
const PUB = process.env.BX_PUBLIC ? path.resolve(process.env.BX_PUBLIC) : path.join(ROOT, 'public');

const errors: string[] = [];
const warnings: string[] = [];
const E = (m: string) => errors.push(m);
const P = (...a: string[]) => path.join(PACK, ...a);
const read = (f: string) => fs.readFileSync(P(f), 'utf8');
const exists = (f: string) => fs.existsSync(P(f));

function loadYaml<T>(file: string, schema: { safeParse: (x: unknown) => { success: true; data: T } | { success: false; error: import('zod').ZodError } }, fallback: T): T {
  if (!exists(file)) { E(`${file}: missing`); return fallback; }
  let raw: unknown;
  try { raw = file.endsWith('.json') ? JSON.parse(read(file)) : yaml.load(read(file)); } catch (e) { E(`${file}: does not parse: ${(e as Error).message}`); return fallback; }
  const r = schema.safeParse(raw);
  if (!r.success) { errors.push(...zodLines(file, r.error).slice(0, 40)); return fallback; }
  return r.data;
}

function csv(file: string): { fields: string[]; rows: Record<string, string>[] } {
  if (!exists(file)) { E(`${file}: missing data file`); return { fields: [], rows: [] }; }
  const r = Papa.parse<Record<string, string>>(read(file), { header: true, skipEmptyLines: true, dynamicTyping: false });
  if (r.errors.length) for (const e of r.errors.slice(0, 5)) E(`${file}: CSV row ${e.row}: ${e.message}`);
  return { fields: r.meta.fields ?? [], rows: r.data };
}

const sortKeys = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
const count = <T>(xs: T[], f: (x: T) => string | string[]) => {
  const out: Record<string, number> = {};
  for (const x of xs) for (const k of ([] as string[]).concat(f(x))) out[k] = (out[k] ?? 0) + 1;
  return sortKeys(out);
};

// ============================================================================================ 1. load + validate
const manifest = loadYaml('manifest.yaml', ManifestSchema, null as never);
if (!manifest) { console.error(errors.join('\n')); process.exit(1); }
const brand = loadYaml(manifest.brand.file, BrandSchema, null as never);
const glossary = loadYaml('glossary.yaml', GlossarySchema, []);
const figures = loadYaml('figures.yaml', FiguresSchema, []);
const references = loadYaml('references.yaml', ReferencesSchema, []);
const scope = loadYaml('scope.yaml', ScopeSchema, null as never);
const ledger = loadYaml('claims-ledger.yaml', LedgerSchema, []);
const openItems = loadYaml('open-items.yaml', OpenItemsSchema, []);
const layers = loadYaml('geo/layers.json', LayersSchema, [] as Layer[]);
const overlays = loadYaml('geo/overlays.json', OverlaysSchema, null as unknown as Overlays);
const vstats = manifest.verification;
const graph = loadYaml('figures/data/systems-graph.json', SystemsGraphSchema, null as never);
const indicators = loadYaml('systems/indicators.json', IndicatorsSchema, null as never);

const refByN = new Map(references.map((r) => [r.n, r]));
{
  const ns = references.map((r) => r.n);
  const dup = ns.filter((n, i) => ns.indexOf(n) !== i);
  if (dup.length) E(`references.yaml: duplicate n ${dup.join(', ')}`);
}
const checkRef = (n: number, where: string) => { if (!refByN.has(n)) E(`${where}: reference [${n}] is not in references.yaml`); };

// ============================================================================================ 2. review.md
const parsed = parseReview(read('review.md'));
errors.push(...parsed.errors);
const sectionIds = new Set(parsed.sections.map((s) => s.id));
const blockById = new Map(parsed.blocks.map((b) => [b.id, b]));
const figIds = new Set(figures.map((f) => f.id));
for (const f of parsed.figureMarkers) if (!figIds.has(f)) E(`review.md: figure marker ${f} is not in figures.yaml`);
for (const f of figures) if (!parsed.figureMarkers.includes(f.id)) warnings.push(`figures.yaml: ${f.id} has no <!-- figure --> marker in review.md`);

// section tree: part (depth 1 ancestor) and top (the strip/filter unit)
const sectionMeta: SectionMeta[] = [];
{
  let part = ''; let depth2 = '';
  for (const s of parsed.sections) {
    if (s.depth === 1) { part = s.id; depth2 = ''; }
    if (s.depth === 2) depth2 = s.id;
    const top = s.depth === 1 ? s.id : part === 'part-i' ? 'part-i' : depth2 || part;
    const words = s.chunks.reduce((n, c) => n + (c.k === 'b' ? claimWords(c.b.text) : c.k === 'list' ? c.items.reduce((m, b) => m + claimWords(b.text), 0) : 0), 0);
    sectionMeta.push({ id: s.id, title: s.title, depth: s.depth, top, part, words });
  }
}
const secMeta = new Map(sectionMeta.map((s) => [s.id, s]));
const topOf = (sid: string) => secMeta.get(sid)?.top ?? sid;

// citation coverage (APP-SPEC §6.1 rule 5) — counted per block as tools/validate_pack.py does
const uncited = parsed.blocks.filter((b) => b.kind !== 'table' && b.words >= 25 && b.cites.length === 0 && b.marker !== 'framing');
for (const b of uncited) E(`review.md ${b.id}: uncited block of ${b.words} words (cite it in the pack or mark it <!-- framing -->): ${b.text.slice(0, 80)}`);
for (const b of parsed.blocks) for (const n of b.cites) checkRef(n, `review.md ${b.id}`);

// ============================================================================================ 3. term linking
{
  const amb = findAmbiguousVariants(glossary);
  for (const a of amb) E(`glossary.yaml: variant "${a.variant}" is claimed by ${a.ids.join(', ')}`);
}
const matcher = buildMatcher(glossary);
const termOccurrences: Record<string, number> = {};
const termAppears: Record<string, Set<string>> = {};

function linkTermsIn(el: Element, m: Matcher, seen: Set<string>, sectionId: string | null, every = false): string[] {
  return linkTerms(el, m, seen, every, (id, linked) => {
    if (sectionId) termOccurrences[id] = (termOccurrences[id] ?? 0) + 1;
    if (linked && sectionId) (termAppears[id] ??= new Set()).add(sectionId);
  });
}

for (const s of parsed.sections) {
  const seen = new Set<string>();
  for (const c of s.chunks) {
    const bs = c.k === 'b' ? [c.b] : c.k === 'list' ? c.items : [];
    for (const b of bs) linkTermsIn(b.el, matcher, seen, s.id, manifest.link_every_occurrence);
  }
}

// ============================================================================================ 4. claim layer
const ledgerById = new Map(ledger.map((l) => [l.id, l]));
{
  const ids = ledger.map((l) => l.id);
  const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  if (dup.length) E(`claims-ledger.yaml: duplicate ids ${[...new Set(dup)].join(', ')}`);
}
const anchored = new Set<string>();
const anchorErrors: { id: string; block: string; reason: string; quote: string }[] = [];
const unanchoredByDesign: { id: string; block: string; status: string; quote: string; note: string; block_exists: boolean }[] = [];
for (const l of ledger) {
  for (const s of l.sources) checkRef(s.n, `claims-ledger.yaml ${l.id}`);
  if (!sectionIds.has(l.section)) E(`claims-ledger.yaml ${l.id}: unknown section ${l.section}`);
  else if (blockById.has(l.block) && blockById.get(l.block)!.section !== l.section) E(`claims-ledger.yaml ${l.id}: section ${l.section} is not the section of block ${l.block} (${blockById.get(l.block)!.section})`);
  if (!l.anchor_ok) { unanchoredByDesign.push({ id: l.id, block: l.block, status: l.status, quote: l.quote, note: l.note, block_exists: blockById.has(l.block) }); continue; }
  const b = blockById.get(l.block);
  if (!b) { E(`claims-ledger.yaml ${l.id}: block ${l.block} is not in review.md`); anchorErrors.push({ id: l.id, block: l.block, reason: 'unknown block', quote: l.quote }); continue; }
  const a = findAnchor(b.el, b.kind, l.quote);
  if (!a.ok) {
    E(`claims-ledger.yaml ${l.id}: anchor fails in ${l.block} — ${a.reason}: "${l.quote.slice(0, 90)}"`);
    anchorErrors.push({ id: l.id, block: l.block, reason: a.reason, quote: l.quote });
    continue;
  }
  if (wrapClaim(a.targets, l.id, statusGroup(l.status)!)) anchored.add(l.id);
}

// ============================================================================================ 5. open items
for (const o of openItems) {
  for (const b of o.blocks) if (!blockById.has(b)) E(`open-items.yaml ${o.id}: block ${b} is not in review.md`);
  for (const sid of o.sections) if (!sectionIds.has(sid)) E(`open-items.yaml ${o.id}: unknown section ${sid}`);
  for (const m of `${o.what} ${o.why} ${o.how_to_close}`.matchAll(/\[(\d+)\]/g)) checkRef(Number(m[1]), `open-items.yaml ${o.id}`);
}
{
  const ids = openItems.map((o) => o.id);
  const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  if (dup.length) E(`open-items.yaml: duplicate ids ${dup.join(', ')}`);
}

const inlineCN = (md: string, opts: { terms?: boolean; seen?: Set<string> } = {}): { nodes: CNode[]; cites: number[] } => {
  const { root, cites } = inlineHast(md);
  if (opts.terms) linkTermsIn(root as unknown as Element, matcher, opts.seen ?? new Set(), null);
  // unwrap a single paragraph
  const kids = root.children.filter((c) => !(c.type === 'text' && !c.value.trim()));
  if (kids.length === 1 && kids[0].type === 'element' && kids[0].tagName === 'p') return { nodes: compactChildren(kids[0] as Element), cites };
  return { nodes: compactChildren(root as unknown as Element), cites };
};

// Appendix C prints the first 22 open items, item for item, as three list blocks (KICKOFF §4c). Each list item is
// matched to the open item of its group in order; a count that does not match is an error, never a guess.
const appendixC = new Map<string, string>();   // OI id → "B0280" (the block that prints it)
const appendixCLinks = new Map<string, string[]>();   // block id → OI ids, one per list item
for (const b of parsed.blocks) {
  if (b.kind !== 'list' || !b.section.startsWith('appendix-c-')) continue;
  const lis = (b.el.children as Element[]).filter((c) => c.type === 'element' && c.tagName === 'li');
  const ois = openItems.filter((o) => o.blocks[0] === b.id && o.sections.includes(b.section));
  if (ois.length !== lis.length) { E(`review.md ${b.id}: Appendix C list has ${lis.length} items but ${ois.length} open items name it first`); continue; }
  appendixCLinks.set(b.id, ois.map((o) => o.id));
  ois.forEach((o, k) => { appendixC.set(o.id, b.id); lis[k].children.push({ type: 'element', tagName: 'x-oi', properties: { id: o.id }, children: [] }); });
}
if (appendixC.size !== 22) E(`review.md: Appendix C links ${appendixC.size} open items, expected 22`);

const PINNED = ['OI-128', 'OI-010'];
for (const id of PINNED) if (!openItems.some((o) => o.id === id)) E(`open-items.yaml: pinned item ${id} is missing`);
const openItemsOut: OpenItemT[] = openItems.map((o) => ({
  id: o.id, group: o.group, what: inlineCN(o.what).nodes, what_text: o.what, why: inlineCN(o.why).nodes, why_text: o.why, blocks: o.blocks, sections: o.sections,
  tops: [...new Set(o.sections.map(topOf))], looked: o.looked, who: o.who, how_to_close: inlineCN(o.how_to_close).nodes, how_text: o.how_to_close,
  pinned: PINNED.includes(o.id), appendix_c: appendixC.get(o.id) ?? null,
  block_refs: o.blocks.map((b) => ({ id: b, section: blockById.get(b)?.section ?? '', top: topOf(blockById.get(b)?.section ?? ''), exists: blockById.has(b) })),
}));

// ============================================================================================ 6. glossary, concepts, figures
const glossIds = new Set(glossary.map((g) => g.id));
const conceptFiles = exists('concepts') ? fs.readdirSync(P('concepts')).filter((f) => f.endsWith('.md')).sort() : [];
const conceptIdsOnDisk = new Set(conceptFiles.map((f) => f.replace(/\.md$/, '')));
for (const g of glossary) {
  if (g.concept && !conceptIdsOnDisk.has(g.concept)) E(`glossary.yaml ${g.id}: concept ${g.concept} has no concepts/${g.concept}.md`);
  for (const s of g.see) if (!glossIds.has(s)) E(`glossary.yaml ${g.id}: see → unknown term ${s}`);
  for (const n of g.refs) checkRef(n, `glossary.yaml ${g.id}`);
  // the uncited-prose gate holds for definitions too, except the two terms about the site itself (no citation by design)
  if (!g.self_description && claimWords(g.definition) >= 25 && !/\[\d+\]/.test(g.definition)) E(`glossary.yaml ${g.id}: definition of ${claimWords(g.definition)} words has no citation`);
}
const glossaryOut: GlossaryItem[] = glossary.map((g) => {
  const d = inlineCN(g.definition);
  for (const n of d.cites) checkRef(n, `glossary.yaml ${g.id} (definition)`);
  return {
    id: g.id, term: g.term, kind: g.kind, category: g.category, variants: g.variants, short: g.short, def: d.nodes, concept: g.concept,
    see: g.see, refs: g.refs, sources: g.sources, appears: parsed.sections.map((s) => s.id).filter((sid) => termAppears[g.id]?.has(sid)),
    self_description: g.self_description, in_text: !!termOccurrences[g.id],
  };
}).sort((a, b) => a.term.localeCompare(b.term, 'en', { sensitivity: 'base' }));

const conceptsOut: ConceptT[] = [];
const conceptCites = new Set<number>();
for (const f of conceptFiles) {
  const raw = read(`concepts/${f}`);
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
  if (!m) { E(`concepts/${f}: no YAML front matter`); continue; }
  const fm = ConceptFrontmatterSchema.safeParse(yaml.load(m[1]));
  if (!fm.success) { errors.push(...zodLines(`concepts/${f}`, fm.error)); continue; }
  const c = fm.data;
  if (`${c.id}.md` !== f) E(`concepts/${f}: id ${c.id} does not match the file name`);
  for (const p of c.prerequisites) if (!conceptIdsOnDisk.has(p)) E(`concepts/${f}: prerequisite ${p} unknown`);
  for (const t of c.terms) if (!glossIds.has(t)) E(`concepts/${f}: term ${t} is not in glossary.yaml`);
  for (const fig of c.figures) if (!figIds.has(fig)) E(`concepts/${f}: figure ${fig} unknown`);
  // a primer paragraph may open with its marker ("<!-- framing --> Domain 1 describes…"); CommonMark would read such a
  // line as an HTML block, so the marker is moved to the end of its paragraph before parsing (text unchanged)
  const body = m[2].split(/\n{2,}/).map((p) => { const mm = /^<!--\s*(framing|synthesis)\s*-->\s*/.exec(p); return mm ? `${p.slice(mm[0].length)} <!-- ${mm[1]} -->` : p; }).join('\n\n');
  const tree = parseMarkdown(body);
  // the citation-coverage gate applies to primer prose too (tools/validate_pack.py)
  for (const node of tree.children) {
    if (node.type !== 'paragraph') continue;
    const t = JSON.stringify(node);
    const words = claimWords(node.children.map((x) => ('value' in x ? x.value : '')).join(' '));
    if (words >= 25 && !/\[\d+\]/.test(t) && !/framing/.test(t)) E(`concepts/${f}: a paragraph of ${words} words has no citation`);
  }
  const h = toHast(tree as never) as unknown as HRoot;
  for (const n of linkCitations(h)) { checkRef(n, `concepts/${f}`); conceptCites.add(n); }
  linkTermsIn(h as unknown as Element, matcher, new Set(), null);
  conceptsOut.push({ ...c, body: compactChildren(h as unknown as Element) });
}
const conceptIds = new Set(conceptsOut.map((c) => c.id));
for (const g of glossary) if (g.concept && !conceptIds.has(g.concept)) E(`glossary.yaml ${g.id}: concept ${g.concept} did not load`);

const figuresOut: FigureT[] = [];
for (const f of figures) {
  for (const n of f.refs) checkRef(n, `figures.yaml ${f.id}`);
  for (const s of f.discussed_in) if (!sectionIds.has(s)) E(`figures.yaml ${f.id}: discussed_in ${s} is not a section`);
  for (const c of f.concepts) if (!conceptIds.has(c)) E(`figures.yaml ${f.id}: concept ${c} unknown`);
  for (const x of f.explain) { if (x.term && !glossIds.has(x.term)) E(`figures.yaml ${f.id}: explain term ${x.term} unknown`); if (x.concept && !conceptIds.has(x.concept)) E(`figures.yaml ${f.id}: explain concept ${x.concept} unknown`); }
  let rows: Record<string, string>[] = [];
  if (f.data.endsWith('.csv')) {
    const d = csv(f.data);
    rows = d.rows;
    const need = [f.chart?.x.field, f.chart?.y.field, f.chart?.series, ...(f.columns ?? []).map((c) => c.field)].filter(Boolean) as string[];
    for (const k of need) if (!d.fields.includes(k)) E(`figures.yaml ${f.id}: column ${k} is not in ${f.data}`);
    for (const r of rows) for (const n of String(r.ref ?? '').split(';').filter(Boolean)) checkRef(Number(n), `${f.data}`);
  } else if (!exists(f.data)) E(`figures.yaml ${f.id}: data file ${f.data} missing`);
  figuresOut.push({ ...f, rows });
}

// ============================================================================================ 7. maps
// The only computations (KICKOFF §4d): quantile class breaks and positions in the ordered list (in the app), and the
// survey interval estimate ± margin (in the app). Everything else is a cell of the pack's CSVs.
const ring = csv('geo/ring_counties.csv');
const alBench = csv('geo/alabama_benchmark.csv');
const tracts = csv('geo/tracts.csv');
const tractsMoe = csv('geo/tracts_moe.csv');
const tBench = csv('geo/benchmarks.csv');
// a layer id is unique within its geography (nine ids exist at both county and tract level); key = "<geo>:<id>"
const layerKey = (l: { id: string; geography: string[] }) => `${l.geography[0]}:${l.id}`;
const layerByKey = new Map(layers.map((l) => [layerKey(l), l]));
const layerExists = (id: string) => layerByKey.has(`county:${id}`) || layerByKey.has(`tract:${id}`);
for (const l of layers) checkRef(l.ref, `geo/layers.json ${l.id}`);
{
  const ids = layers.map(layerKey);
  const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  if (dup.length) E(`geo/layers.json: duplicate layer ids within one geography ${dup.join(', ')}`);
}
const countyLayers = layers.filter((l) => l.geography[0] === 'county');
const tractLayers = layers.filter((l) => l.geography[0] === 'tract');
const surveyLayers = tractLayers.filter((l) => l.moe_column);
const RING_FIXED = ['fips', 'county', 'role', 'cmhc'];
const BENCH_FIXED = ['fips', 'area'];
const TRACT_FIXED = ['geoid', 'county_fips', 'county', 'tract_name'];
for (const f of ring.fields) if (!RING_FIXED.includes(f) && !layerByKey.has(`county:${f}`)) E(`geo/ring_counties.csv: column ${f} has no county layer in layers.json`);
for (const f of alBench.fields) if (!BENCH_FIXED.includes(f) && !layerByKey.has(`county:${f}`)) E(`geo/alabama_benchmark.csv: column ${f} has no county layer in layers.json`);
for (const f of tracts.fields) if (!TRACT_FIXED.includes(f) && !layerByKey.has(`tract:${f}`)) E(`geo/tracts.csv: column ${f} has no tract layer in layers.json`);
for (const l of countyLayers) {
  if (!ring.fields.includes(l.id)) E(`geo/layers.json ${l.id}: no column in geo/ring_counties.csv`);
  if (!alBench.fields.includes(l.id)) warnings.push(`geo/layers.json ${l.id}: no Alabama value in geo/alabama_benchmark.csv (the panel says so)`);
}
for (const l of tractLayers) if (!tracts.fields.includes(l.id)) E(`geo/layers.json ${l.id}: no column in geo/tracts.csv`);
for (const l of surveyLayers) {
  if (l.moe_file !== 'geo/tracts_moe.csv') E(`geo/layers.json ${l.id}: moe_file ${l.moe_file} is not geo/tracts_moe.csv`);
  if (l.benchmarks !== 'geo/benchmarks.csv') E(`geo/layers.json ${l.id}: benchmarks ${l.benchmarks} is not geo/benchmarks.csv`);
  if (!tractsMoe.fields.includes(l.moe_column!)) E(`geo/layers.json ${l.id}: margin column ${l.moe_column} is not in geo/tracts_moe.csv`);
  if (!tBench.fields.includes(l.id) || !tBench.fields.includes(l.moe_column!)) E(`geo/layers.json ${l.id}: no estimate or margin column in geo/benchmarks.csv`);
}
for (const f of tractsMoe.fields) if (f !== 'geoid' && !surveyLayers.some((l) => l.moe_column === f)) E(`geo/tracts_moe.csv: column ${f} is no layer's moe_column`);
if (ring.rows.length !== 15) E(`geo/ring_counties.csv: ${ring.rows.length} rows, expected 15`);
if (tracts.rows.length !== 117) E(`geo/tracts.csv: ${tracts.rows.length} rows, expected 117`);
if (alBench.rows.length !== 1 || alBench.rows[0]?.fips !== '01') E('geo/alabama_benchmark.csv: expected one row, Alabama (01)');
for (const r of tracts.rows) {
  if (!/^01(043|089)\d{6}$/.test(r.geoid ?? '')) E(`geo/tracts.csv: tract id ${r.geoid} is not an 11-digit Madison or Cullman tract`);
  if ((r.geoid ?? '').slice(0, 5) !== r.county_fips) E(`geo/tracts.csv: tract ${r.geoid} is not in county ${r.county_fips}`);
}
{
  const a = new Set(tracts.rows.map((r) => r.geoid)); const b = new Set(tractsMoe.rows.map((r) => r.geoid));
  for (const g of a) if (!b.has(g)) E(`geo/tracts_moe.csv: no row for tract ${g}`);
  for (const g of b) if (!a.has(g)) E(`geo/tracts_moe.csv: tract ${g} is not in geo/tracts.csv`);
}
for (const id of ['01', '01089', '01043']) if (!tBench.rows.some((r) => r.geoid === id)) E(`geo/benchmarks.csv: no row for ${id}`);

const layerType = (l: Layer): LayerT['type'] => (l.unit.startsWith('category') ? 'categorical' : 'numeric');
const family = (l: Layer): LayerT['family'] => (l.geography[0] === 'county' ? 'county' : l.moe_column ? 'survey' : 'modeled');
function geoStat(l: Layer, rows: Record<string, string>[], key: string): GeoStat {
  const vals = rows.map((r) => r[l.id] ?? '');
  const missing = rows.filter((r) => (r[l.id] ?? '') === '').map((r) => r[key]);
  if (layerType(l) === 'numeric') {
    const nums = vals.map(cellNumber);
    vals.forEach((v, i) => { if (v !== '' && nums[i] === null) E(`${l.id}: non-numeric value "${v}" for ${rows[i][key]}`); });
    return { breaks: quantileBreaks(nums), published: nums.filter((x) => x !== null).length, missing };
  }
  const cats = count(vals.filter((v) => v !== ''), (v) => v);
  return { breaks: [], published: vals.filter((v) => v !== '').length, missing, categories: Object.entries(cats).map(([value, n]) => ({ value, count: n })) };
}
// margins: a numeric cell or empty; an empty margin beside a present tract estimate is an error (KICKOFF §4d: a
// tract estimate is never shown without its margin); in benchmarks.csv it means "no margin applies".
const moeByTract = new Map(tractsMoe.rows.map((r) => [r.geoid, r]));
for (const l of surveyLayers) for (const r of tracts.rows) {
  const est = r[l.id] ?? ''; const m = moeByTract.get(r.geoid)?.[l.moe_column!] ?? '';
  if (est !== '' && m === '') E(`geo/tracts_moe.csv: tract ${r.geoid} has a ${l.id} estimate but no margin of error`);
  if (m !== '' && cellNumber(m) === null) E(`geo/tracts_moe.csv: tract ${r.geoid} ${l.moe_column} is not a number`);
}

for (const r of ring.rows) if (!/^01\d{3}$/.test(r.fips ?? '')) E(`geo/ring_counties.csv: row "${r.county ?? '?'}" has no valid five-digit FIPS code ("${r.fips ?? ''}")`);
const ringRows = ring.rows.filter((r) => /^01\d{3}$/.test(r.fips ?? '')).sort((a, b) => a.fips.localeCompare(b.fips));
const ringNames = new Map(ringRows.map((r) => [r.fips, r.county]));
const regionGeo = regionGeometry(ringNames, errors);
const tractRows = tracts.rows.filter((r) => /^01\d{9}$/.test(r.geoid ?? '')).sort((a, b) => a.geoid.localeCompare(b.geoid));
const tractMeta = new Map(tractRows.map((r) => [r.geoid, { name: r.tract_name, county_fips: r.county_fips, county: r.county }]));
const GEOMETRY_FILE = path.join(PUB, 'data', 'geo', 'tracts-madison-cullman.topo.json');
const tractGeo = tractGeometry(GEOMETRY_FILE, [{ fips: '01089', name: 'Madison' }, { fips: '01043', name: 'Cullman' }], tractMeta, errors);
const geomRecordFile = path.join(PUB, 'data', 'geo', 'raw', 'tract_geometry.json');
const geomRecord = fs.existsSync(geomRecordFile) ? JSON.parse(fs.readFileSync(geomRecordFile, 'utf8')) : null;
if (!geomRecord) E('public/data/geo/raw/tract_geometry.json: missing — run npm run build:geometry once');

const layersOut: LayerT[] = layers.map((l) => ({
  ...l, key: layerKey(l), type: layerType(l), family: family(l),
  stat: l.geography[0] === 'county' ? geoStat(l, ringRows, 'fips') : geoStat(l, tractRows, 'geoid'),
}));

// overlays
const ov = overlays;
const ringSet = new Set(ringNames.keys());
const inRing = (fips: string[], where: string) => { for (const f of fips) if (!ringSet.has(f)) E(`geo/overlays.json ${where}: FIPS ${f} is not one of the fifteen counties`); };
for (const n of [ov.core.ref, ov.crisis_catchment.ref, ov.community_mental_health_centers.ref, ov.two_one_one.ref]) checkRef(n, 'geo/overlays.json');
inRing(ov.core.county_fips, 'core');
inRing(ov.crisis_catchment.county_fips, 'crisis_catchment');
if (ov.crisis_catchment.county_fips.length !== 15) E(`geo/overlays.json crisis_catchment: ${ov.crisis_catchment.county_fips.length} counties, expected 15`);
for (const r of ringRows) if ((r.role === 'core') !== ov.core.county_fips.includes(r.fips)) E(`geo/ring_counties.csv ${r.county}: role ${r.role} disagrees with overlays.json core`);
const countyInfo: Record<string, CountyInfo> = Object.fromEntries(ringRows.map((r) => [r.fips, { cmhc: null, two_one_one: null, in_catchment: ov.crisis_catchment.county_fips.includes(r.fips) }]));
const centerGroups = ov.community_mental_health_centers.centers.map((c, i) => {
  inRing(c.county_fips, `community_mental_health_centers ${c.center}`);
  if (c.ccbhc_ref) checkRef(c.ccbhc_ref, `geo/overlays.json ${c.center}`);
  for (const f of c.county_fips) {
    if (countyInfo[f]?.cmhc) E(`geo/overlays.json: county ${f} is in two center service areas`);
    if (countyInfo[f]) countyInfo[f].cmhc = { center: c.center, ccbhc: c.ccbhc, ccbhc_date: c.ccbhc_date, ccbhc_ref: c.ccbhc_ref };
    const row = ringRows.find((r) => r.fips === f);
    if (row && row.cmhc !== c.center && !c.center.startsWith(row.cmhc)) E(`geo/ring_counties.csv ${row.county}: cmhc "${row.cmhc}" disagrees with overlays.json "${c.center}"`);
  }
  return { id: `cmhc-${i + 1}`, label: c.center, fips: c.county_fips, d: regionGeo.mergeOf(c.county_fips), ccbhc: c.ccbhc, ccbhc_date: c.ccbhc_date, ccbhc_ref: c.ccbhc_ref };
});
for (const r of ringRows) if (!countyInfo[r.fips].cmhc) E(`geo/overlays.json: county ${r.county} has no community mental health center`);
const twoGroups = ov.two_one_one.centers.map((c, i) => {
  inRing(c.county_fips, `two_one_one ${c.center}`);
  for (const f of c.county_fips) if (countyInfo[f]) countyInfo[f].two_one_one = c.center;
  return { id: `211-${i + 1}`, label: c.center, fips: c.county_fips, d: regionGeo.mergeOf(c.county_fips), also_serves: c.also_serves ?? [] };
});

// service locations
const tractIdSet = new Set(tractRows.map((r) => r.geoid));
const locTypes = ov.location_types;
const locIds = new Set<string>();
for (const p of ov.service_locations) {
  if (locIds.has(p.id)) E(`geo/overlays.json service_locations: duplicate id ${p.id}`);
  locIds.add(p.id);
  if (!locTypes[p.type]) E(`geo/overlays.json service_locations ${p.id}: type ${p.type} is not in location_types`);
  if (!ringSet.has(p.county_fips)) E(`geo/overlays.json service_locations ${p.id}: county ${p.county_fips} is not one of the fifteen`);
  if (p.tract && p.in_core && !tractIdSet.has(p.tract)) E(`geo/overlays.json service_locations ${p.id}: tract ${p.tract} is not in geo/tracts.csv`);
  if (p.tract && p.tract.slice(0, 5) !== p.county_fips) E(`geo/overlays.json service_locations ${p.id}: tract ${p.tract} is not in county ${p.county_fips}`);
  if (p.in_core !== ov.core.county_fips.includes(p.county_fips)) E(`geo/overlays.json service_locations ${p.id}: in_core disagrees with its county`);
  checkRef(p.ref, `geo/overlays.json service_locations ${p.id}`);
  for (const b of p.blocks) if (!blockById.has(b)) E(`geo/overlays.json service_locations ${p.id}: block ${b} is not in review.md`);
}
const placedPts = (filter: (p: Overlays['service_locations'][number]) => boolean): PointIn[] => ov.service_locations
  .filter((p) => (p.precision === 'address' || p.precision === 'approximate') && p.lon !== null && p.lat !== null && filter(p))
  .map((p) => ({ id: p.id, lon: p.lon!, lat: p.lat!, type: p.type, approximate: p.precision === 'approximate' }));
for (const m of clusterMarkers(placedPts(() => true), regionGeo.proj)) {
  const ps = m.ids.map((id) => ov.service_locations.find((p) => p.id === id)!);
  if (new Set(ps.map((p) => p.type)).size > 1) warnings.push(`service locations ${m.ids.join(', ')} share a point but differ in type; the marker uses ${m.type}`);
}

const regionMap: RegionMap = {
  width: regionGeo.width, height: regionGeo.height,
  areas: regionGeo.areas.map((a) => { const r = ringRows.find((x) => x.fips === a.id)!; return { ...a, role: r.role as 'core' | 'ring', cmhc: r.cmhc }; }),
  backdrop: regionGeo.backdrop, core: regionGeo.mergeOf(ov.core.county_fips), catchment: regionGeo.mergeOf(ov.crisis_catchment.county_fips),
  values: Object.fromEntries(countyLayers.map((l) => [l.id, regionGeo.areas.map((a) => ringRows.find((r) => r.fips === a.id)?.[l.id] ?? '')])),
  alabama: Object.fromEntries(countyLayers.map((l) => [l.id, alBench.rows[0]?.[l.id] ?? ''])),
  centers: { ref: ov.community_mental_health_centers.ref, source_url: ov.community_mental_health_centers.source_url, note: ov.community_mental_health_centers.note, groups: centerGroups },
  crisis: { label: ov.crisis_catchment.label, ref: ov.crisis_catchment.ref, source_url: ov.crisis_catchment.source_url, as_of: ov.crisis_catchment.as_of, counties: ov.crisis_catchment.counties },
  two_one_one: { ref: ov.two_one_one.ref, note: ov.two_one_one.note, groups: twoGroups, unassigned: ringRows.filter((r) => !countyInfo[r.fips].two_one_one).map((r) => r.fips) },
  countyInfo,
  markers: clusterMarkers(placedPts(() => true), regionGeo.proj),
};

const benchRow = (id: string) => tBench.rows.find((r) => r.geoid === id) ?? {};
const tractMap: TractMap = {
  frames: (tractGeo?.frames ?? []).map((f) => ({
    fips: f.fips, name: f.name, width: f.width, height: f.height, outline: f.outline, areas: f.areas,
    markers: clusterMarkers(placedPts((p) => p.county_fips === f.fips && !!p.tract), f.proj),
  })),
  ids: tractRows.map((r) => r.geoid),
  values: Object.fromEntries(tractLayers.map((l) => [l.id, tractRows.map((r) => r[l.id] ?? '')])),
  moe: Object.fromEntries(surveyLayers.map((l) => [l.id, tractRows.map((r) => moeByTract.get(r.geoid)?.[l.moe_column!] ?? '')])),
  benchmarks: Object.fromEntries(surveyLayers.map((l) => {
    const b = (id: string) => ({ est: benchRow(id)[l.id] ?? '', moe: benchRow(id)[l.moe_column!] ?? '' });
    return [l.id, { alabama: b('01'), madison: b('01089'), cullman: b('01043') }];
  })),
  geometry: { url: geomRecord?.url ?? '', downloaded: geomRecord?.downloaded ?? '', bytes: geomRecord?.bytes ?? 0, sha256: geomRecord?.sha256 ?? '', last_modified: geomRecord?.last_modified ?? null, vintage: geomRecord?.vintage ?? '' },
};
const locationsOut: LocationsData = { types: locTypes, locations: ov.service_locations, retrieved: ov.retrieved, note: ov.note };

// raw files for download
const GEO_FILES = ['ring_counties.csv', 'alabama_benchmark.csv', 'tracts.csv', 'tracts_moe.csv', 'benchmarks.csv', 'layers.json', 'overlays.json', 'NOTES.md'];
const rawSrc = P('geo', 'raw');
const rawDst = path.join(PUB, 'data', 'geo', 'raw');
const rawFiles: { name: string; bytes: number }[] = [];
if (fs.existsSync(rawSrc)) {
  fs.mkdirSync(rawDst, { recursive: true });
  for (const f of fs.readdirSync(rawSrc).sort()) {
    const src = path.join(rawSrc, f);
    if (!fs.statSync(src).isFile()) continue;
    fs.copyFileSync(src, path.join(rawDst, f));
  }
  for (const f of fs.readdirSync(rawDst).sort()) rawFiles.push({ name: f, bytes: fs.statSync(path.join(rawDst, f)).size });
  for (const f of GEO_FILES) fs.copyFileSync(P('geo', f), path.join(PUB, 'data', 'geo', f));
} else E('geo/raw/: missing');
const geoNotes = exists('geo/NOTES.md') ? read('geo/NOTES.md') : '';

// ============================================================================================ 8. systems graph
const nodeIds = new Set(graph.nodes.map((n) => n.id));
for (const n of graph.nodes) {
  if (!sectionIds.has(n.section)) E(`systems-graph.json node ${n.id}: section ${n.section} unknown`);
  if (!blockById.has(n.scope_block)) E(`systems-graph.json node ${n.id}: scope_block ${n.scope_block} unknown`);
  for (const m of n.scope.matchAll(/\[(\d+)\]/g)) checkRef(Number(m[1]), `systems-graph.json node ${n.id}`);
}
if (!blockById.has(graph.reading_block)) E(`systems-graph.json: reading_block ${graph.reading_block} unknown`);
for (const e of graph.edges) {
  if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) E(`systems-graph.json edge ${e.id}: unknown node`);
  if (!blockById.has(e.block)) E(`systems-graph.json edge ${e.id}: block ${e.block} unknown`);
  for (const n of e.refs) checkRef(n, `systems-graph.json ${e.id}`);
  for (const m of e.evidence.matchAll(/\[(\d+)\]/g)) checkRef(Number(m[1]), `systems-graph.json ${e.id} (evidence)`);
}
{
  const ids = graph.edges.map((e) => e.id);
  const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  if (dup.length) E(`systems-graph.json: duplicate edge ids ${dup.join(', ')}`);
  const fan = graph.edges.filter((e) => e.fan_out);
  if (new Set(fan.map((e) => e.row)).size > 1) E('systems-graph.json: fan_out edges span more than one row');
  if (fan.length && fan.some((e) => e.from !== fan[0].from)) E('systems-graph.json: fan_out edges have more than one source node');
}
for (const h of indicators.headline) {
  for (const n of h.nodes) if (!nodeIds.has(n)) E(`systems/indicators.json headline "${h.label}": node ${n} unknown`);
  if (h.block && !blockById.has(h.block)) E(`systems/indicators.json headline "${h.label}": block ${h.block} unknown`);
  if (h.layer && !layerExists(h.layer)) E(`systems/indicators.json headline "${h.label}": layer ${h.layer} not in layers.json`);
  for (const n of h.refs) checkRef(n, `systems/indicators.json "${h.label}"`);
}
for (const [node, list] of Object.entries(indicators.all_figures_by_node)) {
  if (!nodeIds.has(node)) E(`systems/indicators.json all_figures_by_node: node ${node} unknown`);
  for (const f of list) {
    if (!ledgerById.has(f.claim)) E(`systems/indicators.json ${node}: claim ${f.claim} not in the ledger`);
    if (!blockById.has(f.block)) E(`systems/indicators.json ${node}: block ${f.block} unknown`);
    for (const n of f.refs) checkRef(n, `systems/indicators.json ${f.claim}`);
  }
}
for (const [node, ls] of Object.entries(indicators.map_layers_by_node)) {
  if (!nodeIds.has(node)) E(`systems/indicators.json map_layers_by_node: node ${node} unknown`);
  for (const l of ls) if (!layerExists(l)) E(`systems/indicators.json map_layers_by_node ${node}: layer ${l} not in layers.json`);
}
const systems: SystemsData = {
  nodes: graph.nodes.map((n) => ({ ...n, scope: inlineCN(n.scope, { terms: true, seen: new Set() }).nodes })),
  edges: graph.edges.map((e) => ({ ...e, evidence: inlineCN(e.evidence, { terms: true, seen: new Set() }).nodes, evidence_text: e.evidence })),
  reading: inlineCN(graph.reading).nodes, reading_block: graph.reading_block,
  headline: indicators.headline, figures: indicators.all_figures_by_node, layers: indicators.map_layers_by_node,
};
const nodeBySection = new Map(graph.nodes.map((n) => [n.section, n.id]));

// ============================================================================================ 9. reader output
const toRBlock = (b: Block, synIndex: Map<string, string>): RBlock => {
  const out: RBlock = { id: b.id, kind: b.kind, marker: b.marker, h: compactChildren(b.el) };
  if (b.marker === 'synthesis') out.syn = synIndex.get(b.id);
  return out;
};
const synthesis: { id: string; block: string; section: string; excerpt: string }[] = [];
const synIndex = new Map<string, string>();
for (const b of parsed.blocks) if (b.marker === 'synthesis') { const id = `analysis-${b.id}`; synIndex.set(b.id, id); synthesis.push({ id, block: b.id, section: b.section, excerpt: b.text.replace(/\s+/g, ' ').slice(0, 200) }); }
const reader: RSection[] = parsed.sections.map((s) => ({
  id: s.id, title: s.title, depth: s.depth, top: topOf(s.id),
  chunks: s.chunks.map((c): RChunk => c.k === 'b' ? { k: 'b', b: toRBlock(c.b, synIndex) } : c.k === 'list' ? { k: 'list', ordered: c.ordered, start: c.start, items: c.items.map((b) => toRBlock(b, synIndex)) } : c),
}));

const ledgerOut: LedgerItem[] = ledger.map((l) => ({
  id: l.id, block: l.block, section: l.section, kind: l.kind, status: l.status, quote: l.quote,
  sources: l.sources, looked: l.looked, note: l.note, checked: l.checked, pass: l.pass, anchored: anchored.has(l.id),
}));

// top-level strips
const tops: TopMeta[] = [];
for (const s of sectionMeta) {
  if (s.top !== s.id) continue;
  const inTop = (sid: string) => topOf(sid) === s.id;
  const node = nodeBySection.get(s.id) ?? null;
  tops.push({
    id: s.id, title: s.title,
    claims: ledger.filter((l) => inTop(l.section)).length,
    notfound: ledger.filter((l) => inTop(l.section) && l.status === 'absence').length,
    open: openItems.filter((o) => o.sections.some(inTop)).length,
    node, layers: node ? indicators.map_layers_by_node[node] ?? [] : [],
  });
}

// references: which are cited by the report body or its ledger, and which only by maps / glossary / primers
const bodyCites = new Set(parsed.blocks.flatMap((b) => b.cites));
const ledgerCites = new Set(ledger.flatMap((l) => l.sources.map((s) => s.n)));
const auxCites = new Set<number>([...layers.map((l) => l.ref), ...glossary.flatMap((g) => g.refs), ...conceptCites]);
for (const g of glossary) for (const m of g.definition.matchAll(/\[(\d+)\]/g)) auxCites.add(Number(m[1]));
const otherCites = new Set<number>([...figures.flatMap((f) => f.refs), ...graph.edges.flatMap((e) => e.refs), ...indicators.headline.flatMap((h) => h.refs), ...ov.service_locations.map((p) => p.ref)]);
const refsOut: RefT[] = references.map((r) => {
  for (const s of r.cited_in) if (!sectionIds.has(s)) E(`references.yaml [${r.n}]: cited_in ${s} is not a section`);
  const inBody = bodyCites.has(r.n);
  const inLedger = ledgerCites.has(r.n);
  // cited only by the maps, glossary or primers — or by nothing at all (a warning), which KICKOFF's 297–329 group also holds
  const aux = !inBody && !inLedger && !otherCites.has(r.n);
  if (!inBody && !inLedger && !auxCites.has(r.n) && !otherCites.has(r.n)) warnings.push(`references.yaml [${r.n}]: cited nowhere`);
  return {
    n: r.n, tier: r.tier as RefT['tier'], citation: r.citation, title: r.title, publisher: r.publisher, published: r.published, year_basis: r.year_basis, url: r.url, year: r.year,
    summary: r.summary, why_it_mattered: r.why_it_mattered, role_here: r.role_here, cited_in: r.cited_in, verified: r.verified,
    read: r.read, read_note: r.read_note, accessed: r.accessed, doc_type: r.doc_type, aux, ledger_only: !inBody && inLedger,
  };
});
const unverifiedCited = refsOut.filter((r) => !r.verified && bodyCites.has(r.n)).map((r) => r.n);
for (const n of unverifiedCited) E(`review.md cites [${n}], which is verified: false (APP-SPEC §6.1 rule 7)`);

// ============================================================================================ 10. search index
const docs: SearchDoc[] = [];
const secTitle = (sid: string) => secMeta.get(sid)?.title ?? sid;
for (const b of parsed.blocks) docs.push({ id: `block:${b.id}`, kind: 'block', title: `${secTitle(b.section)} · ${b.id}`, text: b.text.replace(/\s+/g, ' ').trim(), to: `/read#b-${b.id}`, section: secTitle(b.section) });
for (const r of references) docs.push({ id: `ref:${r.n}`, kind: 'reference', title: `[${r.n}] ${r.title}`, text: `${r.publisher}. ${r.summary}`, to: `/references#ref-${r.n}` });
for (const g of glossary) docs.push({ id: `term:${g.id}`, kind: 'term', title: g.term, text: `${g.variants.join(' · ')} — ${g.short}`, to: `/glossary#term-${g.id}` });
for (const c of conceptsOut) docs.push({ id: `primer:${c.id}`, kind: 'primer', title: c.title, text: `${c.one_liner} ${cnText(c.body)}`, to: `/concepts/${c.id}` });
for (const f of figures) docs.push({ id: `figure:${f.id}`, kind: 'figure', title: `${f.label}. ${f.title}`, text: f.caption, to: `/figures/${f.id}` });
for (const o of openItems) docs.push({ id: `oi:${o.id}`, kind: 'open-item', title: `${o.id} · ${o.group}`, text: `${o.what} ${o.why}`, to: `/open-items#${o.id}` });
for (const l of layers) docs.push({ id: `layer:${layerKey(l)}`, kind: 'layer', title: l.label, text: `${l.group}. ${l.definition}`, to: l.panel_only ? '/map/sources' : l.geography[0] === 'county' ? `/map/region?layer=${l.id}` : `/map/tracts?layer=${l.id}` });
for (const r of ringRows) docs.push({ id: `county:${r.fips}`, kind: 'county', title: `${r.county} County`, text: `${r.county} County, Alabama · ${r.role === 'core' ? 'the core' : 'the ring'} · ${r.cmhc}`, to: `/map/region?layer=pop_est&geo=${r.fips}` });
for (const r of tractRows) docs.push({ id: `tract:${r.geoid}`, kind: 'tract', title: `${r.tract_name}, ${r.county} County`, text: `${r.tract_name} ${r.geoid} ${r.tract_name.replace('Census Tract ', '')}`, to: `/map/tracts?layer=pct_poverty&geo=${r.geoid}` });
for (const p of ov.service_locations) docs.push({ id: `place:${p.id}`, kind: 'location', title: p.name, text: `${p.address}, ${p.city} · ${locTypes[p.type] ?? p.type}`, to: p.tract ? `/map/tracts?overlay=locations&geo=${p.tract}&layer=pct_poverty&place=${p.id}` : `/map/region?overlay=locations&geo=${p.county_fips}&place=${p.id}` });
for (const n of graph.nodes) docs.push({ id: `node:${n.id}`, kind: 'node', title: n.title, text: `${n.label}. ${n.scope}`, to: `/systems?node=${n.id}` });
for (const e of graph.edges) docs.push({ id: `edge:${e.id}`, kind: 'edge', title: `${e.pair}: ${e.link}`, text: e.evidence, to: `/systems?edge=${e.id}` });
const mini = new MiniSearch<SearchDoc>(MINISEARCH_OPTIONS);
mini.addAll(docs);

function cnText(nodes: CNode[]): string {
  return nodes.map((n) => (typeof n === 'string' ? n : cnText(n.slice(2) as CNode[]))).join(' ');
}

// ============================================================================================ 11. provenance + emit
const linkedTerms = Object.keys(termAppears);
const occurringTerms = Object.keys(termOccurrences).filter((k) => termOccurrences[k] > 0);
const termsNotInText = glossary.filter((g) => !termOccurrences[g.id]).map((g) => g.id);
const conceptReach = conceptsOut.map((c) => ({ id: c.id, from_terms: glossary.filter((g) => g.concept === c.id).length, from_figures: figures.filter((f) => f.concepts.includes(c.id)).length }));
for (const c of conceptReach) if (!c.from_terms && !c.from_figures) warnings.push(`concepts/${c.id}: not reachable from any term or figure`);

const anchoredCount = anchored.size;
const emptyByLayer = (l: LayerT) => l.stat.missing;
const provenance = {
  generated_by: `${manifest.builder.name} ${manifest.builder.version}`,
  mode: manifest.mode,
  as_of: manifest.as_of,
  report_version: manifest.report.version,
  words: parsed.blocks.reduce((n, b) => n + claimWords(b.text), 0),
  sections: parsed.sections.length,
  blocks: { total: parsed.blocks.length, by_kind: count(parsed.blocks, (b) => b.kind), cited: parsed.blocks.filter((b) => b.cites.length).length, framing: parsed.blocks.filter((b) => b.marker === 'framing').length, synthesis: synthesis.length, uncited: uncited.length },
  terms: { glossary: glossary.length, occurring_in_text: occurringTerms.length, linked: linkedTerms.length, linked_pct: occurringTerms.length ? Math.round((1000 * linkedTerms.length) / occurringTerms.length) / 10 : 100, not_in_text: termsNotInText, by_category: count(glossary, (g) => g.category) },
  references: {
    total: references.length, with_summary: references.filter((r) => r.summary.trim()).length,
    by_tier: count(references, (r) => r.tier), by_read: count(references, (r) => r.read), by_doc_type: count(references, (r) => r.doc_type),
    undated: references.filter((r) => r.year_basis).length,
    cited_in_body: bodyCites.size, ledger_only: refsOut.filter((r) => r.ledger_only).map((r) => r.n), maps_glossary_primers_only: refsOut.filter((r) => r.aux).map((r) => r.n),
  },
  ledger: {
    entries: ledger.length, by_status: count(ledger, (l) => l.status), by_kind: count(ledger, (l) => l.kind), by_pass: count(ledger, (l) => l.pass),
    anchored: anchoredCount, unanchored: ledger.length - anchoredCount, unanchored_by_design: unanchoredByDesign.length, anchor_errors: anchorErrors.length,
    sources: ledger.reduce((n, l) => n + l.sources.length, 0),
  },
  open_items: { total: openItems.length, by_group: count(openItems, (o) => o.group), by_who: count(openItems, (o) => o.who), printed_in_appendix_c: appendixC.size },
  figures: { total: figures.length, by_kind: count(figures, (f) => f.kind), by_synthesis: count(figures, (f) => f.synthesis) },
  concepts: conceptsOut.length,
  maps: {
    layers: layers.length, by_geography: count(layers, (l) => l.geography[0]), by_group: count(layers, (l) => l.group), panel_only: layers.filter((l) => l.panel_only).map((l) => l.id),
    counties: ringRows.length, tracts: tractRows.length, tract_geometry: tractMap.frames.reduce((n, f) => n + f.areas.length, 0),
    empty_cells_by_layer: Object.fromEntries(layersOut.filter((l) => emptyByLayer(l).length).map((l) => [l.id, emptyByLayer(l)])),
    areas_with_an_empty_cell: {
      counties: ringRows.filter((r) => countyLayers.some((l) => (r[l.id] ?? '') === '')).length,
      tracts: tractRows.filter((r) => tractLayers.some((l) => (r[l.id] ?? '') === '')).length,
    },
    service_locations: { total: ov.service_locations.length, by_type: count(ov.service_locations, (p) => p.type), by_precision: count(ov.service_locations, (p) => p.precision), markers_region: regionMap.markers.length, markers_tracts: tractMap.frames.reduce((n, f) => n + f.markers.length, 0) },
    raw_files: rawFiles.length,
  },
  systems: { nodes: graph.nodes.length, edges: graph.edges.length, rows: new Set(graph.edges.map((e) => e.row)).size, fan_out_edges: graph.edges.filter((e) => e.fan_out).length, headline_indicators: indicators.headline.length },
  search_documents: docs.length,
  build_errors: errors.length,
};

const methods = {
  scope, synthesis, framing: provenance.blocks.framing, unanchoredByDesign, anchorErrors, errors: [...errors], warnings,
  termsNotInText, conceptReach, verification: vstats, geoNotes, rawFiles, provenance,
  findings: ledger.flatMap((l) => l.sources.filter((x) => x.finding).map((x) => ({ claim: l.id, n: x.n, finding: x.finding }))),
  tractGeometry: tractMap.geometry,
};

const browserOpen = openItems.filter((o) => o.who === 'anyone-with-a-browser').length;
const core = {
  manifest: {
    slug: manifest.slug, title: manifest.title, short_title: manifest.short_title, subtitle: manifest.subtitle, question: manifest.question,
    as_of: manifest.as_of, authors: manifest.authors, venue: manifest.venue, year: manifest.year, report: manifest.report, plain_abstract: manifest.plain_abstract,
    reading_minutes: manifest.reading_minutes, audience: manifest.audience, palette: manifest.palette, permissions: manifest.permissions,
    github_account: manifest.github_account, notes_storage: manifest.notes_storage, builder: manifest.builder, banner: manifest.banner, draft: manifest.draft,
  },
  brand, stats: vstats, sections: sectionMeta, tops,
  counts: {
    references: references.length, glossary: glossary.length, primers: conceptsOut.length, figures: figures.length, layers: layers.length,
    county_layers: countyLayers.length, tract_layers: tractLayers.filter((l) => !l.panel_only).length,
    counties: ringRows.length, tracts: tractRows.length, nodes: graph.nodes.length, edges: graph.edges.length, rows: provenance.systems.rows,
    open_items: openItems.length, open_browser: browserOpen, ledger: ledger.length, verified: ledger.filter((l) => l.status === 'verified').length,
    locations: ov.service_locations.length, build_errors: errors.length,
  },
  companion: refByN.get(397) ? { url: refByN.get(397)!.url, n: 397 } : null,
  concepts: conceptsOut.map((c) => ({ id: c.id, title: c.title, one_liner: c.one_liner })),
  figures: figures.map((f) => ({ id: f.id, label: f.label, title: f.title, kind: f.kind })),
  layersBrief: layers.map((l) => ({ id: l.id, label: l.label, geography: l.geography, panel_only: l.panel_only })),
};
if (!core.companion) E('references.yaml: reference 397 (the statewide report) is missing');

const glossaryShort = Object.fromEntries(glossary.map((g) => [g.id, { term: g.term, short: g.short, concept: g.concept }]));

fs.mkdirSync(OUT, { recursive: true });
const emit = (name: string, data: unknown) => fs.writeFileSync(path.join(OUT, name), JSON.stringify(data) + '\n');
emit('core.json', core);
// the reader in two chunks: the opening sections paint first, the rest arrives right after (KICKOFF §5 Lighthouse bar)
{
  let size = 0; let cut = 0;
  for (; cut < reader.length; cut++) { size += JSON.stringify(reader[cut]).length; if (size > 30_000 && (reader[cut + 1]?.depth ?? 9) <= 2) { cut++; break; } }
  emit('reader-1.json', reader.slice(0, cut));
  emit('reader-2.json', reader.slice(cut));
}
emit('ledger.json', ledgerOut);
emit('references.json', refsOut);
emit('glossary.json', glossaryOut);
emit('glossary-short.json', glossaryShort);
emit('concepts.json', conceptsOut);
emit('figures.json', figuresOut);
emit('open-items.json', openItemsOut);
emit('layers.json', layersOut);
emit('map-region.json', regionMap);
emit('map-tracts.json', tractMap);
emit('locations.json', locationsOut);
emit('systems.json', systems);
emit('search.json', mini.toJSON());
emit('methods.json', methods);
for (const stale of ['changes.json', 'map-al.json', 'map-us.json', 'reader.json']) if (fs.existsSync(path.join(OUT, stale))) fs.unlinkSync(path.join(OUT, stale));
fs.mkdirSync(PUB, { recursive: true });
fs.writeFileSync(path.join(PUB, 'provenance.json'), JSON.stringify(provenance, null, 2) + '\n');

const errFile = P('BUILD-ERRORS.md');
// --accept-known (CI): the build still lists every error, but exits 0 when each one is already recorded in the
// committed BUILD-ERRORS.md — a ratchet: any new error fails the build, and fixing one updates the file.
const known = new Set(fs.existsSync(errFile) ? fs.readFileSync(errFile, 'utf8').split('\n').filter((l) => l.startsWith('- ')).map((l) => l.slice(2)) : []);
const acceptKnown = process.argv.includes('--accept-known');
if (errors.length) {
  fs.writeFileSync(errFile, `# BUILD-ERRORS — content build of ${manifest.slug}\n\nWritten by \`npm run build:content\`. ${errors.length} error(s); the app was built from whatever validated, and lists these on /methods.\n\n${errors.map((e) => `- ${e}`).join('\n')}\n`);
} else if (fs.existsSync(errFile)) fs.unlinkSync(errFile);

// ---------------------------------------------------------------------------------------- summary
const table: [string, string | number][] = [
  ['sections', parsed.sections.length], ['blocks (p / li / list / table)', `${parsed.blocks.length} (${provenance.blocks.by_kind.p ?? 0} / ${provenance.blocks.by_kind.li ?? 0} / ${provenance.blocks.by_kind.list ?? 0} / ${provenance.blocks.by_kind.table ?? 0})`],
  ['words', provenance.words], ['cited / framing / analysis blocks', `${provenance.blocks.cited} / ${provenance.blocks.framing} / ${provenance.blocks.synthesis}`],
  ['uncited blocks', uncited.length], ['references', references.length], ['glossary terms linked / occurring', `${linkedTerms.length} / ${occurringTerms.length}`],
  ['ledger entries / anchored', `${ledger.length} / ${anchoredCount}`], ['anchor errors', anchorErrors.length],
  ['open items (Appendix C linked)', `${openItems.length} (${appendixC.size})`], ['primers', conceptsOut.length], ['figures', figures.length],
  ['layers (county / tract)', `${layers.length} (${countyLayers.length} / ${tractLayers.length})`], ['counties / tracts / tract shapes', `${ringRows.length} / ${tractRows.length} / ${provenance.maps.tract_geometry}`],
  ['service locations / region markers', `${ov.service_locations.length} / ${regionMap.markers.length}`], ['graph nodes / edges', `${graph.nodes.length} / ${graph.edges.length}`],
  ['search documents', docs.length], ['warnings', warnings.length], ['ERRORS', errors.length],
];
console.log('\ncontent build — summary');
for (const [k, v] of table) console.log(`  ${k.padEnd(42)} ${v}`);
if (errors.length) {
  console.error(`\n${errors.length} error(s) — written to content-pack/BUILD-ERRORS.md:`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  const fresh = errors.filter((e) => !known.has(e));
  if (acceptKnown && fresh.length === 0) {
    console.error(`\n--accept-known: all ${errors.length} error(s) are the known pack errors recorded in BUILD-ERRORS.md; exiting 0.`);
    process.exit(0);
  }
  if (acceptKnown) console.error(`\n--accept-known: ${fresh.length} error(s) are new:\n${fresh.map((e) => `  ✗ ${e}`).join('\n')}`);
  process.exit(1);
}
