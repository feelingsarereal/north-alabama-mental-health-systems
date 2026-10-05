/**
 * Zod schemas for the content pack: the standard files mirror docs/CONTENT-PACK.md (topic mode) and
 * tools/validate_pack.py; the extension files (claims-ledger.yaml, open-items.yaml, geo/,
 * systems/indicators.json, figures/data/systems-graph.json, brand/) follow KICKOFF §4b–4g, which is their only spec. Anything the content build accepts is declared here.
 */
import { z } from 'zod';

export const kebab = z.string().regex(/^[a-z0-9-]+$/, 'must be kebab-case');
export const BLOCK_ID = /^B\d{4}$/;
export const blockId = z.string().regex(BLOCK_ID, 'block id must be B + four digits');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');

export const ManifestSchema = z
  .object({
    mode: z.literal('topic'),
    slug: kebab,
    title: z.string().min(1),
    short_title: z.string().min(1),
    subtitle: z.string().default(''),
    question: z.string().min(1),
    purpose: z.string().min(1),
    as_of: isoDate,
    authors: z.array(z.string().min(1)).min(1),
    venue: z.string().min(1),
    year: z.number().int(),
    report: z.object({ publisher: z.string(), version: z.string(), status: z.string(), companion: z.string(), independence: z.string() }),
    plain_abstract: z.string().min(1),
    reading_minutes: z.number().optional(),
    audience: z.string().optional(),
    palette: z.object({ groups: z.record(z.string().regex(/^#[0-9a-f]{6}$/i)) }),
    permissions: z.object({ text: z.string().min(1, 'permissions.text is REQUIRED'), figures: z.string().optional() }),
    delivery: z.enum(['local', 'pages']),
    github_account: z.string().min(1),
    notes_storage: z.enum(['file', 'browser']).default('file'),
    link_every_occurrence: z.boolean().default(false),
    builder: z.object({ name: z.string(), version: z.string(), date: z.string().optional() }),
    draft: z.boolean().default(false),
    banner: z.object({ text: z.string().min(1), links: z.array(z.object({ label: z.string(), to: z.string() })) }),
    brand: z.object({ file: z.string() }),
    extensions: z.record(z.unknown()),
    verification: z.object({
      method: z.string(), blocks: z.number(), references: z.number(), ledger_entries: z.number(),
      ledger_by_status: z.record(z.number()), ledger_by_pass: z.record(z.number()), problems_found_and_fixed: z.record(z.number()),
      reader_aids: z.object({ glossary_terms: z.number(), primers: z.number(), check: z.string(), problems_found_and_fixed: z.number() }),
      map_data: z.object({ tracts: z.number(), tract_layers: z.number(), county_layers: z.number(), counties: z.number(), service_locations: z.number(), service_locations_placed: z.number(), check: z.string() }),
      open_items: z.number(), open_items_by_group: z.record(z.number()), words: z.number(),
    }),
  })
  .superRefine((m, ctx) => {
    if (!/peer/i.test(m.venue)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['venue'], message: 'venue must carry the non-peer-reviewed statement' });
    if (m.delivery === 'pages' && !/25 words/i.test(m.permissions.text)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['permissions', 'text'], message: 'delivery: pages needs permissions.text to state the 25-word quotation rule' });
    }
    for (const k of ['verified', 'open', 'domain', 'cross_sector', 'core', 'ring']) {
      if (!m.palette.groups[k]) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['palette', 'groups', k], message: `palette.groups.${k} is required` });
    }
  });
export type Manifest = z.infer<typeof ManifestSchema>;

export const BrandSchema = z.object({
  organisation: z.string(), address: z.string(), email: z.string(), website: z.string(), tagline: z.string(),
  logo: z.string(), logo_note: z.string().optional(),
  colors: z.record(z.string().regex(/^#[0-9a-f]{6}$/i)), colors_source: z.string().optional(),
  type: z.object({ body: z.string(), headings: z.string(), note: z.string().optional() }),
});
export type Brand = z.infer<typeof BrandSchema>;

export const GLOSSARY_KINDS = ['science', 'methods', 'statistics', 'notation'] as const;
export const GLOSSARY_CATEGORIES = ['organization', 'program', 'facility', 'law', 'funding', 'measure', 'data-source', 'place', 'concept', 'role'] as const;
export const GlossaryEntrySchema = z.object({
  id: kebab,
  term: z.string().min(1),
  kind: z.enum(GLOSSARY_KINDS),
  category: z.enum(GLOSSARY_CATEGORIES),
  variants: z.array(z.string().min(1)).default([]),
  short: z.string().min(1).max(320, 'short > 320 chars'),
  definition: z.string().min(1),
  concept: kebab.optional(),
  see: z.array(kebab).default([]),
  refs: z.array(z.number().int().positive()).default([]),
  sources: z.array(z.string()).default([]),
  origin: z.string().min(1),
  self_description: z.boolean().default(false),
});
export const GlossarySchema = z.array(GlossaryEntrySchema);
export type GlossaryEntry = z.infer<typeof GlossaryEntrySchema>;

export const ConceptFrontmatterSchema = z.object({
  id: kebab,
  title: z.string().min(1),
  one_liner: z.string().min(1),
  why_here: z.string().min(1),
  prerequisites: z.array(kebab).default([]),
  terms: z.array(z.string()).default([]),
  figures: z.array(kebab).default([]),
  further_reading: z.array(z.object({ title: z.string().min(1), url: z.string().min(1), kind: z.string().optional() })).min(2, 'needs ≥2 further_reading'),
  self_check: z
    .array(z.object({ q: z.string().min(1), options: z.array(z.string()).min(2), answer: z.number().int(), explanation: z.string().default('') })
      .refine((q) => q.answer >= 0 && q.answer < q.options.length, { message: 'self_check answer index out of range' }))
    .min(1, 'needs ≥1 self_check'),
});
export type ConceptFrontmatter = z.infer<typeof ConceptFrontmatterSchema>;

const AxisSchema = z.object({ field: z.string(), label: z.string().optional(), unit: z.string().optional() });
export const FigureSchema = z.object({
  id: kebab,
  label: z.string().min(1),
  title: z.string().min(1),
  kind: z.enum(['chart', 'table', 'network']),
  synthesis: z.enum(['data', 'conceptual']),
  refs: z.array(z.number().int()).default([]),
  chart: z.object({ type: z.enum(['bar', 'grouped-bar', 'line']), x: AxisSchema, y: AxisSchema, series: z.string().optional() }).optional(),
  columns: z.array(z.object({ field: z.string(), label: z.string() })).optional(),
  data: z.string().min(1),
  caption: z.string().min(1),
  how_to_read: z.string().min(1),
  explain: z.array(z.object({ on: z.string().min(1), text: z.string().min(1), term: z.string().optional(), concept: kebab.optional() })).default([]),
  concepts: z.array(kebab).default([]),
  discussed_in: z.array(z.string()).default([]),
  source: z.string().min(1),
});
export const FiguresSchema = z.array(FigureSchema);
export type FigureDef = z.infer<typeof FigureSchema>;

export const REF_TIERS = ['seminal', 'classic', 'current', 'background'] as const;
export const ReferenceSchema = z
  .object({
    n: z.number().int().positive(),
    tier: z.enum(REF_TIERS),
    citation: z.string().min(1),
    title: z.string().min(1),
    publisher: z.string().min(1),
    published: z.union([z.string(), z.number()]).nullable().transform((v) => (v == null ? '' : String(v))),
    year_basis: z.string().default(''),
    url: z.string().min(1),
    year: z.number().int(),
    summary: z.string().default(''),
    why_it_mattered: z.string().default(''),
    role_here: z.enum(['support', 'data-source', 'background', 'guideline', 'method', 'contrast', 'prior-result', 'review', 'consensus']),
    cited_in: z.array(z.string()).default([]),
    verified: z.boolean(),
    read: z.enum(['full', 'partial', 'not-read']),
    read_note: z.string().default(''),
    accessed: z.string(),
    doc_type: z.enum(['org-page', 'press', 'primary-document', 'official-data', 'statute', 'court-record', 'other']),
  })
  .strict()
  .refine((r) => r.summary.trim().length > 0 || !r.verified, { message: 'no summary (allowed only with verified: false)' })
  .refine((r) => r.published !== '' || r.year_basis !== '', { message: 'published is empty and there is no year_basis' })
  .refine((r) => r.read !== 'not-read' || r.read_note.trim() !== '', { message: 'read: not-read needs a read_note' });
export const ReferencesSchema = z.array(ReferenceSchema);
export type Reference = z.infer<typeof ReferenceSchema>;

export const ScopeSchema = z.object({
  topic: z.string(),
  question: z.string(),
  purpose: z.string(),
  boundary: z.object({ in: z.array(z.string()), out: z.array(z.string()), rationale: z.string() }),
  level: z.string(),
  time_window: z.record(z.union([z.string(), z.number()])),
  stance: z.string(),
  depth: z.string(),
  target_words: z.number().optional(),
  frame: z.string().optional(),
  outline_approved: z.string().optional(),
  request: z.string().optional(),
  words: z.number().optional(),
  anchors: z.array(z.object({ citation: z.string(), why: z.string() })).default([]),
  excluded: z.array(z.object({ what: z.string(), why: z.string() })).default([]),
  assumed: z.boolean(),
  interview: z.array(z.object({ q: z.string(), answer: z.string(), asked: z.string() })),
  search_strategy: z.object({
    run_on: z.string(),
    status: z.string().default(''),
    sources: z.array(z.string()),
    queries: z.array(z.object({ q: z.string(), source: z.string(), phase: z.string().default(''), hits: z.number().nullable() })),
    snowball: z.array(z.string()).default([]),
    inclusion: z.array(z.string()).default([]),
    exclusion: z.array(z.string()).default([]),
    known_gaps: z.array(z.string()).default([]),
  }),
  corpus_profile: z.object({
    status: z.string(), documents_recorded: z.number(), references_cited: z.number(), findings_recorded: z.number(), findings_used: z.number(),
    conflicts_logged: z.number(), not_found_logged: z.number(), could_not_read: z.number(), rechecks: z.number(),
    by_kind: z.record(z.number()), by_tier: z.record(z.number()), by_read: z.record(z.number()), year_range: z.tuple([z.number(), z.number()]),
    undated: z.number(), concentration: z.string(), dissent_represented: z.boolean(),
  }),
});
export type Scope = z.infer<typeof ScopeSchema>;

// ---------------------------------------------------------------------------------------- extensions (KICKOFF §4b–4g)
export const LEDGER_STATUSES = ['verified', 'analysis', 'absence', 'self'] as const;
export const LEDGER_KINDS = ['figure', 'event', 'status', 'description', 'role', 'absence', 'analysis', 'self'] as const;
export const LedgerEntrySchema = z.object({
  id: z.string().regex(/^B\d{4}\.[a-z]{1,2}$/, 'ledger id must be <block>.<one or two letters>'),
  block: blockId,
  section: kebab,
  kind: z.enum(LEDGER_KINDS),
  status: z.enum(LEDGER_STATUSES),
  quote: z.string().min(1),
  anchor_ok: z.boolean(),
  sources: z.array(z.object({ n: z.number().int().positive(), quote: z.string(), locator: z.string().default(''), finding: z.string().nullable().transform((v) => v ?? '').default('') })).default([]),
  looked: z.string().nullable().transform((v) => v ?? '').default(''),
  note: z.string().default(''),
  checked: z.string(),
  pass: z.string().min(1),
}).strict().superRefine((l, ctx) => {
  if (!l.id.startsWith(`${l.block}.`)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['id'], message: `id ${l.id} does not start with its block ${l.block}` });
  if (l.status === 'verified' && l.sources.length === 0) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sources'], message: 'a verified entry needs at least one source passage' });
});
export const LedgerSchema = z.array(LedgerEntrySchema);
export type LedgerEntry = z.infer<typeof LedgerEntrySchema>;

export const OPEN_GROUPS = ['Could not be read', 'Needs a human eye', 'Could not be confirmed', 'Not published, as far as this review found'] as const;
export const OPEN_WHO = ['author', 'anyone-with-a-browser', 'next-review'] as const;
export const OpenItemSchema = z.object({
  id: z.string().regex(/^OI-\d{3}$/),
  group: z.enum(OPEN_GROUPS),
  what: z.string().min(1),
  why: z.string().min(1),
  blocks: z.array(blockId).default([]),
  sections: z.array(kebab).default([]),
  looked: z.string().min(1),
  who: z.enum(OPEN_WHO),
  how_to_close: z.string().min(1),
}).strict();
export const OpenItemsSchema = z.array(OpenItemSchema);
export type OpenItem = z.infer<typeof OpenItemSchema>;

export const LAYER_GROUPS = [
  'People and place', 'Health and community', 'Workforce and shortage', 'Deaths', 'Coverage', 'Income and work', 'Access and housing',
  'Health and social needs (modeled)',
] as const;
export const LayerSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  label: z.string().min(1),
  unit: z.string().min(1),
  geography: z.tuple([z.enum(['county', 'tract'])]),
  definition: z.string().min(1),
  higher_is: z.enum(['better', 'worse', 'neutral']),
  source_title: z.string().min(1),
  publisher: z.string().min(1),
  vintage: z.string().min(1),
  url: z.string().min(1),
  data_url: z.string().default(''),
  retrieved: isoDate,
  retrieval: z.string().min(1),
  suppressed_note: z.string().default(''),
  caveats: z.string().default(''),
  ref: z.number().int().positive(),
  group: z.enum(LAYER_GROUPS),
  moe_column: z.string().optional(),
  moe_file: z.string().optional(),
  benchmarks: z.string().optional(),
  panel_only: z.boolean().default(false),
}).strict().superRefine((l, ctx) => {
  const survey = !!(l.moe_column || l.moe_file || l.benchmarks);
  if (survey && !(l.moe_column && l.moe_file && l.benchmarks)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'a survey layer needs moe_column, moe_file and benchmarks together' });
  if (survey && l.geography[0] !== 'tract') ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'only tract layers carry margins of error' });
});
export const LayersSchema = z.array(LayerSchema);
export type Layer = z.infer<typeof LayerSchema>;

const fips5 = z.string().regex(/^01\d{3}$/, 'must be a five-digit Alabama county FIPS code');
export const ServiceLocationSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/), name: z.string().min(1), type: z.string().min(1), address: z.string().min(1), city: z.string().min(1),
  county_fips: fips5, county: z.string().min(1), in_core: z.boolean(), lon: z.number().nullable(), lat: z.number().nullable(),
  tract: z.string().regex(/^01\d{9}$/).nullable(), coord_source: z.string().nullable(), precision: z.enum(['address', 'approximate', 'ambiguous', 'none']),
  note: z.string().default(''), ref: z.number().int().positive(), blocks: z.array(blockId).default([]),
}).strict().superRefine((p, ctx) => {
  const placed = p.precision === 'address' || p.precision === 'approximate';
  if (placed && (p.lon === null || p.lat === null)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${p.id}: a placed point needs lon and lat` });
  if (!placed && (p.lon !== null || p.lat !== null)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${p.id}: precision ${p.precision} must have no coordinates` });
});
export const OverlaysSchema = z.object({
  retrieved: isoDate, note: z.string(),
  core: z.object({ label: z.string(), county_fips: z.array(fips5), ref: z.number().int() }),
  crisis_catchment: z.object({ label: z.string(), county_fips: z.array(fips5), counties: z.array(z.string()), ref: z.number().int(), source_url: z.string(), as_of: z.string() }),
  community_mental_health_centers: z.object({
    ref: z.number().int(), source_url: z.string(), note: z.string(),
    centers: z.array(z.object({ center: z.string(), county_fips: z.array(fips5), counties: z.array(z.string()), ccbhc: z.boolean(), ccbhc_date: z.string().nullable(), ccbhc_ref: z.number().int().nullable() })),
  }),
  two_one_one: z.object({
    ref: z.number().int(), note: z.string(),
    centers: z.array(z.object({ center: z.string(), counties: z.array(z.string()).optional(), counties_in_this_map: z.array(z.string()).optional(), county_fips: z.array(fips5), also_serves: z.array(z.string()).optional() })),
  }),
  location_types: z.record(z.string()),
  service_locations: z.array(ServiceLocationSchema),
});
export type Overlays = z.infer<typeof OverlaysSchema>;

export const GraphNodeSchema = z.object({
  id: z.string().regex(/^(d[1-8]|s(9|1[0-3]))$/), label: z.string(), title: z.string(), kind: z.enum(['domain', 'cross-sector', 'region']),
  number: z.number().int(), section: kebab, scope: z.string(), scope_block: blockId,
}).strict();
export const GraphEdgeSchema = z.object({
  id: z.string(), from: z.string(), to: z.string(), row: z.number().int(), pair: z.string(), link: z.string(), evidence: z.string(),
  refs: z.array(z.number().int()), block: blockId, fan_out: z.boolean(),
}).strict();
export const SystemsGraphSchema = z.object({
  nodes: z.array(GraphNodeSchema).length(13), edges: z.array(GraphEdgeSchema).min(1), reading: z.string().min(1), reading_block: blockId, note: z.string().optional(),
});
export type SystemsGraph = z.infer<typeof SystemsGraphSchema>;

export const IndicatorsSchema = z.object({
  headline: z.array(z.object({
    label: z.string(), madison: z.string(), cullman: z.string(), alabama: z.string(), note: z.string(), layer: z.string().nullable(),
    refs: z.array(z.number().int()), nodes: z.array(z.string()).min(1), block: blockId.nullable(), source: z.string(),
  }).strict()),
  all_figures_by_node: z.record(z.array(z.object({
    claim: z.string(), text: z.string(), status: z.enum(LEDGER_STATUSES), refs: z.array(z.number().int()), section: kebab, block: blockId,
  }))),
  map_layers_by_node: z.record(z.array(z.string())),
  note: z.string().optional(),
});
export type Indicators = z.infer<typeof IndicatorsSchema>;

/** Format a zod error as one line per issue. */
export function zodLines(file: string, err: z.ZodError): string[] {
  return err.issues.map((i) => `${file}: ${i.path.join('.') || '(root)'}: ${i.message}`);
}
