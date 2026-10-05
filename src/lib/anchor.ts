/**
 * Claim anchoring (KICKOFF §4b), shared by the content build and the tests. Pure functions, no DOM.
 *
 * A ledger `quote` is matched inside its block after normalising both sides: `**`, `_` and `*` emphasis markers,
 * backticks and backslash escapes dropped, HTML comments dropped, `<br>` read as a space, whitespace collapsed (the
 * same rule as tools/validate_pack.py). The block side is the block's *rendered text* — the concatenated text nodes
 * of its HTML tree, where a citation button's text is "[n]" exactly as the block writes it — so a match maps back to
 * character offsets the reader can wrap without changing a character.
 */
export const NORM_DROP = /[*_`\\]/;

export function cleanQuote(t: string): string {
  return t.replace(/<!--[\s\S]*?-->/g, '').replace(/<br\s*\/?>/gi, ' ');
}

export function norm(t: string): string {
  return cleanQuote(t).replace(/[*_`\\]/g, '').replace(/\s+/g, ' ').trim();
}

/** Normalise `text`, keeping a map from each normalised character back to its index in `text`. */
export function normWithMap(text: string): { s: string; map: number[] } {
  const out: string[] = [];
  const map: number[] = [];
  let pendingSpace = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (NORM_DROP.test(ch)) continue;
    if (/\s/.test(ch)) { if (out.length && pendingSpace === -1) pendingSpace = i; continue; }
    if (pendingSpace !== -1) { out.push(' '); map.push(pendingSpace); pendingSpace = -1; }
    out.push(ch); map.push(i);
  }
  return { s: out.join(''), map };
}

export interface TextRange { start: number; end: number }

/** All non-overlapping matches of `quote` inside `text`, as [start, end) offsets into the original `text`. */
export function locate(text: string, quote: string): TextRange[] {
  const { s, map } = normWithMap(text);
  const q = norm(quote);
  if (!q) return [];
  const out: TextRange[] = [];
  let i = s.indexOf(q);
  while (i !== -1) {
    out.push({ start: map[i], end: map[i + q.length - 1] + 1 });
    i = s.indexOf(q, i + q.length);
  }
  return out;
}

/** A quote that lists fragments of one table row, joined with " | " (KICKOFF §4b). */
export function tableFragments(quote: string): string[] | null {
  if (!quote.includes(' | ')) return null;
  return quote.split(' | ').map((f) => f.trim()).filter(Boolean);
}
