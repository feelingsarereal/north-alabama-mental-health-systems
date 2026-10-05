/**
 * Term matcher (APP-SPEC §3, KICKOFF §3.3). Runs on *rendered text* — the text a reader sees, with emphasis
 * markers gone — so `_Hunter_ consent decree` matches the variant "Hunter consent decree". Whole word,
 * case-insensitive, longest match first (the glossary has nested variants: "Hunter decree" inside "Hunter consent
 * decree" inside "Hunter v. Boswell"…). A variant written entirely in capitals (ADMH, CIT, ACT) matches
 * case-sensitively, or ordinary words ("act", "cit") would be linked.
 */
export interface TermDef { id: string; term: string; variants?: string[] }
interface VariantInfo { id: string; variant: string; caseSensitive: boolean }
export interface Matcher { regex: RegExp; lookup: Map<string, VariantInfo>; variants: number }
export interface TermMatch { start: number; end: number; id: string }

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isAllCaps(v: string): boolean {
  return /^[A-Z0-9/&+\-.]{2,}$/.test(v) && /[A-Z]/.test(v);
}

const clean = (s: string) => s.replace(/[*_]/g, '').replace(/\s+/g, ' ').trim();

export function findAmbiguousVariants(terms: TermDef[]): { variant: string; ids: string[] }[] {
  const owner = new Map<string, Set<string>>();
  for (const t of terms) for (const v of [t.term, ...(t.variants ?? [])]) {
    const key = clean(v).toLowerCase();
    if (!owner.has(key)) owner.set(key, new Set());
    owner.get(key)!.add(t.id);
  }
  return [...owner.entries()].filter(([, ids]) => ids.size > 1).map(([variant, ids]) => ({ variant, ids: [...ids].sort() }));
}

export function buildMatcher(terms: TermDef[]): Matcher {
  const lookup = new Map<string, VariantInfo>();
  const all: string[] = [];
  for (const t of terms) for (const v of [t.term, ...(t.variants ?? [])]) {
    const c = clean(v);
    if (!c) continue;
    const key = c.toLowerCase();
    if (lookup.has(key) && lookup.get(key)!.id !== t.id) continue;
    lookup.set(key, { id: t.id, variant: c, caseSensitive: isAllCaps(c) });
    all.push(c);
  }
  const uniq = [...new Set(all)].sort((a, b) => b.length - a.length || a.localeCompare(b));
  const alts = uniq.map((v) => v.split(/\s+/).map(escapeRegex).join('\\s+'));
  const regex = new RegExp(String.raw`(?<![\w-])(?:${alts.join('|')})(?![\w-])`, 'gi');
  return { regex, lookup, variants: uniq.length };
}

/** Every acceptable term match in `text`, left to right, longest first at each position, non-overlapping. */
export function findTerms(text: string, matcher: Matcher): TermMatch[] {
  const out: TermMatch[] = [];
  const re = new RegExp(matcher.regex.source, matcher.regex.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const raw = m[0].replace(/\s+/g, ' ');
    const info = matcher.lookup.get(raw.toLowerCase());
    if (!info || (info.caseSensitive && raw !== info.variant)) { re.lastIndex = m.index + 1; continue; }
    out.push({ start: m.index, end: m.index + m[0].length, id: info.id });
  }
  return out;
}
