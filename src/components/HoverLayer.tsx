/**
 * One popover for every citation, term and claim on the page (KICKOFF §4b; DESIGN-SYSTEM §5), by event delegation:
 * opens on hover, on keyboard focus and on tap; Tab from an open trigger moves into the card; Esc closes and focus
 * returns to the trigger. At narrow widths (< 640 px) it renders as a bottom sheet. In the reader, clicking a
 * citation also toggles its fold-out card under the paragraph (handled here so there is one source of truth).
 *
 * Claims respond only inside a `.bx-checked` container, i.e. when "Show what was checked" is on.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { autoUpdate, flip, offset, shift, size, useFloating } from '@floating-ui/react';
import { CiteCard, ClaimCard, TermCard } from '@/components/cards';

type Kind = 'cite' | 'term' | 'claim';
interface Open { kind: Kind; key: string; el: HTMLElement; block: string | null; pinned: boolean }

export const SEL = '[data-cite],[data-term],[data-claim]';
/** room for the sticky header and draft banner, which the card must not slide under */
const hdr = () => (typeof document !== 'undefined' ? (document.querySelector('header')?.getBoundingClientRect().bottom ?? 120) + 6 : 120);
const FOCUSABLE = 'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])';

export function triggerOf(t: EventTarget | null): HTMLElement | null {
  if (!(t instanceof Element)) return null;
  const el = t.closest(SEL) as HTMLElement | null;
  if (!el) return null;
  // a claim span only responds while the claim layer is shown; a cite inside a claim wins over the claim
  if (el.dataset.claim !== undefined && !el.closest('.bx-checked')) return null;
  return el;
}
function kindOf(el: HTMLElement): { kind: Kind; key: string } {
  if (el.dataset.cite !== undefined) return { kind: 'cite', key: el.dataset.cite };
  if (el.dataset.term !== undefined) return { kind: 'term', key: el.dataset.term };
  return { kind: 'claim', key: el.dataset.claim! };
}
function blockOf(el: HTMLElement): string | null {
  return (el.closest('[data-block]') as HTMLElement | null)?.dataset.block ?? null;
}
function nextFocusable(after: HTMLElement): HTMLElement | null {
  const all = [...document.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((e) => e.offsetParent !== null || e === after);
  const i = all.indexOf(after);
  return i >= 0 ? all[i + 1] ?? null : null;
}

export default function HoverLayer({ initial }: { initial?: { el: HTMLElement; pinned: boolean } | null }) {
  const [open, setOpen] = useState<Open | null>(null);
  const [sheet, setSheet] = useState(false);
  const openRef = useRef<Open | null>(null);
  openRef.current = open;
  const panel = useRef<HTMLDivElement | null>(null);
  const timer = useRef<number | undefined>();
  const { refs, floatingStyles } = useFloating({
    open: !!open, placement: 'bottom-start', strategy: 'absolute',
    middleware: [
      offset(6),
      flip(() => ({ padding: { top: hdr(), bottom: 8, left: 8, right: 8 }, fallbackPlacements: ['top-start', 'bottom-end', 'top-end'] })),
      shift(() => ({ padding: { top: hdr(), bottom: 8, left: 8, right: 8 } })),
      size(() => ({ padding: { top: hdr(), bottom: 8 }, apply({ availableHeight, elements }) { elements.floating.style.maxHeight = `${Math.max(180, availableHeight)}px`; } })),
    ],
    whileElementsMounted: autoUpdate,
  });

  useEffect(() => { refs.setReference(open?.el ?? null); }, [open?.el, refs]);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const on = () => setSheet(mq.matches);
    on(); mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const close = useCallback((refocus = false) => {
    const cur = openRef.current;
    window.clearTimeout(timer.current);
    if (cur) { cur.el.removeAttribute('aria-describedby'); cur.el.setAttribute('aria-expanded', 'false'); if (refocus) cur.el.focus(); }
    setOpen(null);
  }, []);

  const show = useCallback((el: HTMLElement, pinned: boolean) => {
    window.clearTimeout(timer.current);
    const prev = openRef.current;
    if (prev && prev.el !== el) { prev.el.removeAttribute('aria-describedby'); prev.el.setAttribute('aria-expanded', 'false'); }
    const { kind, key } = kindOf(el);
    el.setAttribute('aria-describedby', 'bx-hover-card');
    el.setAttribute('aria-expanded', 'true');
    setOpen({ kind, key, el, block: blockOf(el), pinned: pinned || (prev?.el === el && prev.pinned) });
  }, []);

  useEffect(() => {
    const inPanel = (t: EventTarget | null) => !!(t instanceof Node && panel.current?.contains(t));
    const onOver = (e: MouseEvent) => {
      if (inPanel(e.target)) { window.clearTimeout(timer.current); return; }
      const el = triggerOf(e.target);
      if (!el) return;
      window.clearTimeout(timer.current);
      if (openRef.current?.el === el) return;
      timer.current = window.setTimeout(() => show(el, false), openRef.current ? 60 : 140);
    };
    const onOut = (e: MouseEvent) => {
      const cur = openRef.current;
      const from = triggerOf(e.target) ?? (inPanel(e.target) ? cur?.el ?? null : null);
      if (!from) { window.clearTimeout(timer.current); return; }
      if (inPanel(e.relatedTarget) || (cur && e.relatedTarget instanceof Node && cur.el.contains(e.relatedTarget))) return;
      if (cur?.pinned) return;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => { if (!openRef.current?.pinned) close(); }, 180);
    };
    const onFocusIn = (e: FocusEvent) => {
      if (inPanel(e.target)) return;
      const el = triggerOf(e.target);
      if (el) { show(el, false); return; }
      if (openRef.current) close();
    };
    const onClick = (e: MouseEvent) => {
      const el = triggerOf(e.target);
      if (el) {
        show(el, true); // the reader's fold-out toggle is handled by HoverLayerLoader, which is always mounted
        if (e.detail === 0) window.setTimeout(() => panel.current?.focus(), 0); // keyboard activation: move into the card
        return;
      }
      if (openRef.current && !inPanel(e.target)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      const cur = openRef.current;
      if (!cur) return;
      if (e.key === 'Escape') { e.preventDefault(); close(document.activeElement === cur.el || inPanel(document.activeElement)); return; }
      if (e.key === 'Tab' && !e.shiftKey && document.activeElement === cur.el) {
        const first = panel.current?.querySelector<HTMLElement>(FOCUSABLE);
        if (first) { e.preventDefault(); setOpen({ ...cur, pinned: true }); first.focus(); }
        return;
      }
      if (e.key === 'Tab' && inPanel(document.activeElement)) {
        const items = [...(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
        const last = items[items.length - 1];
        if (!e.shiftKey && (document.activeElement === last || items.length === 0)) {
          e.preventDefault(); const nx = nextFocusable(cur.el); close(); (nx ?? cur.el).focus();
        } else if (e.shiftKey && (document.activeElement === items[0] || document.activeElement === panel.current)) {
          e.preventDefault(); cur.el.focus();
        }
      }
    };
    document.addEventListener('mouseover', onOver);
    document.addEventListener('mouseout', onOut);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseout', onOut);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [show, close]);

  // the event that loaded this layer (see HoverLayerLoader) opens its card
  useEffect(() => { if (initial && document.contains(initial.el)) show(initial.el, initial.pinned); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // a trigger that leaves the DOM (route change, re-render) closes its card
  useEffect(() => {
    if (!open) return;
    const t = window.setInterval(() => { if (!document.contains(open.el)) close(); }, 500);
    return () => window.clearInterval(t);
  }, [open, close]);

  if (!open) return null;
  const body = open.kind === 'cite' ? <CiteCard n={Number(open.key)} block={open.block} limit={3} /> : open.kind === 'term' ? <TermCard id={open.key} /> : <ClaimCard id={open.key} />;
  const label = open.kind === 'cite' ? `Source ${open.key}` : open.kind === 'term' ? 'Term definition' : 'What the check found';
  const common = {
    id: 'bx-hover-card', role: 'dialog' as const, 'aria-label': label, tabIndex: -1,
    'data-testid': `${open.kind}-popover`,
    onMouseEnter: () => window.clearTimeout(timer.current),
    onMouseLeave: () => { if (!openRef.current?.pinned) timer.current = window.setTimeout(() => close(), 180); },
  };
  return createPortal(
    sheet ? (
      <div ref={panel} {...common} className="fixed inset-x-0 bottom-0 z-[70] max-h-[65vh] overflow-y-auto rounded-t-xl border-t bg-white dark:bg-night-2 p-4 shadow-2xl" style={{ borderColor: 'var(--bx-line)' }}>
        <div className="flex justify-end -mt-1 mb-1"><button type="button" className="bx-btn !py-0.5" onClick={() => close(true)}>Close ×</button></div>
        {body}
      </div>
    ) : (
      <div ref={(el) => { panel.current = el; refs.setFloating(el); }} {...common} style={{ ...floatingStyles, zIndex: 70 }} className="bx-card p-3 w-[min(26rem,calc(100vw-1.5rem))] shadow-xl overflow-y-auto">
        {body}
      </div>
    ),
    document.body,
  );
}
