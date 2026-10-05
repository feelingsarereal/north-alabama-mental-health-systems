/** Derived indexes over the lazy chunks, built once per chunk. */
import { D, useData } from '@/lib/data';
import type { LedgerItem, OpenItemT } from '@/types';

function memo<A, R>(f: (a: A) => R) {
  let last: A | undefined; let res: R | undefined;
  return (a: A) => { if (a !== last) { last = a; res = f(a); } return res!; };
}
function groupBy<T>(xs: T[], k: (x: T) => string | string[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) for (const key of ([] as string[]).concat(k(x))) { if (!m.has(key)) m.set(key, []); m.get(key)!.push(x); }
  return m;
}

const ledgerIndex = memo((l: LedgerItem[]) => ({ byId: new Map(l.map((x) => [x.id, x])), byBlock: groupBy(l, (x) => x.block) }));
const openIndex = memo((o: OpenItemT[]) => groupBy(o, (x) => x.blocks));

export function useLedgerIndex() { const l = useData(D.ledger); return l ? ledgerIndex(l) : undefined; }
export function useOpenByBlock() { const o = useData(D.openItems); return o ? openIndex(o) : undefined; }
