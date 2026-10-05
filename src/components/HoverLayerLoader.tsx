/**
 * Loads the popover layer (floating-ui and the cards) on the first hover, focus or tap of a citation, term or claim,
 * so the first paint of every page does not pay for it. The triggering element's card opens as soon as it loads.
 */
import { lazy, Suspense, useEffect, useState } from 'react';
import { foldouts } from '@/lib/reader-state';

const HoverLayer = lazy(() => import('./HoverLayer'));
const SEL = '[data-cite],[data-term],[data-claim]';

export default function HoverLayerLoader() {
  // clicking [n] in the reader folds its card out under the paragraph (one per block); always on, cheap
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = e.target instanceof Element ? (e.target.closest('[data-cite]') as HTMLElement | null) : null;
      if (!el || !el.closest('[data-foldable]')) return;
      const b = (el.closest('[data-block]') as HTMLElement | null)?.dataset.block;
      if (!b) return;
      const n = Number(el.dataset.cite);
      foldouts.set(b, foldouts.get(b) === n ? null : n);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
  const [initial, setInitial] = useState<{ el: HTMLElement; pinned: boolean } | null | undefined>(undefined);
  useEffect(() => {
    if (initial !== undefined) return;
    const arm = (e: Event) => {
      const t = e.target instanceof Element ? (e.target.closest(SEL) as HTMLElement | null) : null;
      if (!t) return;
      if (t.dataset.claim !== undefined && !t.closest('.bx-checked')) return;
      setInitial({ el: t, pinned: e.type === 'click' });
    };
    const idle = window.setTimeout(() => setInitial((v) => (v === undefined ? null : v)), 4000);
    document.addEventListener('mouseover', arm);
    document.addEventListener('focusin', arm);
    document.addEventListener('click', arm);
    return () => { window.clearTimeout(idle); document.removeEventListener('mouseover', arm); document.removeEventListener('focusin', arm); document.removeEventListener('click', arm); };
  }, [initial]);
  if (initial === undefined) return null;
  return <Suspense fallback={null}><HoverLayer initial={initial} /></Suspense>;
}
