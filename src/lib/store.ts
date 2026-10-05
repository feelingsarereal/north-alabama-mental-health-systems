/**
 * A tiny keyed store for reader UI state (open citation fold-outs, open change lists, the claim-layer toggle), so a
 * click re-renders only the block it concerns, not all 436 blocks.
 */
import { useSyncExternalStore } from 'react';

export function keyedStore<V>(initial: V) {
  const values = new Map<string, V>();
  const subs = new Map<string, Set<() => void>>();
  const get = (k: string) => (values.has(k) ? values.get(k)! : initial);
  const set = (k: string, v: V) => { values.set(k, v); subs.get(k)?.forEach((f) => f()); };
  const subscribe = (k: string) => (f: () => void) => {
    if (!subs.has(k)) subs.set(k, new Set());
    subs.get(k)!.add(f);
    return () => { subs.get(k)!.delete(f); };
  };
  const use = (k: string) => useSyncExternalStore(subscribe(k), () => get(k), () => get(k));
  return { get, set, use };
}

/** A persisted boolean preference (localStorage, keyed by app slug), with a hook. */
export function persistedFlag(key: string, initial: boolean) {
  let v = initial;
  try { const s = localStorage.getItem(key); if (s === '1' || s === '0') v = s === '1'; } catch { /* storage blocked */ }
  const subs = new Set<() => void>();
  const set = (x: boolean) => { v = x; try { localStorage.setItem(key, x ? '1' : '0'); } catch { /* ignore */ } subs.forEach((f) => f()); };
  const use = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => v, () => v);
  return { get: () => v, set, use };
}
