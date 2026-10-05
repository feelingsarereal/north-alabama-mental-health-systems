/**
 * Renders compact hast (src/types.ts CNode) — the report's blocks, definitions, evidence paragraphs — as React.
 * Citations, terms and claims render as plain elements carrying data attributes; the single HoverLayer mounted in
 * the layout handles every popover by event delegation, so thousands of triggers cost nothing until used.
 */
import { createElement, Fragment, memo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { CNode } from '@/types';

const VOID = new Set(['br', 'hr', 'img']);

export function renderNodes(nodes: CNode[], opts: { checked?: boolean; key?: string } = {}): ReactNode[] {
  return nodes.map((n, i) => renderNode(n, `${opts.key ?? 'n'}-${i}`, opts));
}

function renderNode(n: CNode, key: string, opts: { checked?: boolean }): ReactNode {
  if (typeof n === 'string') return n;
  const [tag, props, ...kids] = n;
  const p = (props || {}) as Record<string, unknown>;
  const children = () => kids.map((k, i) => renderNode(k, `${key}-${i}`, opts));
  switch (tag) {
    case 'x-cite':
      return <button key={key} type="button" className="bx-cite" data-cite={String(p.n)} aria-label={`Source ${String(p.n)}`} aria-haspopup="dialog">[{String(p.n)}]</button>;
    case 'x-oi':
      // Appendix C prints the first 22 open items; each list item links to its entry (KICKOFF §4c)
      return <Link key={key} to={`/open-items#${String(p.id)}`} className="ml-2 text-[13px] font-semibold whitespace-nowrap no-print" data-testid="appendix-c-link">{String(p.id)} →</Link>;
    case 'x-term':
      return <button key={key} type="button" className="bx-term" data-term={String(p.id)} aria-haspopup="dialog">{children()}</button>;
    case 'x-claim':
      return opts.checked
        ? <span key={key} className={`bx-claim g-${String(p.g)}`} data-claim={String(p.id)} tabIndex={0} role="button" aria-haspopup="dialog">{children()}</span>
        : <span key={key} className={`bx-claim g-${String(p.g)}`} data-claim={String(p.id)}>{children()}</span>;
    case 'table':
      return <div key={key} className="bx-table-wrap" tabIndex={0} role="region" aria-label="Table"><table>{kids.filter((k) => typeof k !== 'string').map((k, i) => renderNode(k, `${key}-${i}`, opts))}</table></div>;
    case 'thead': case 'tbody': case 'tr': case 'ul': case 'ol':
      return createElement(tag, { key, ...(p.start ? { start: p.start } : {}) }, kids.filter((k) => typeof k !== 'string' || k.trim()).map((k, i) => renderNode(k, `${key}-${i}`, opts)));
    case 'a':
      return <a key={key} href={String(p.href ?? '#')} target="_blank" rel="noreferrer">{children()}</a>;
    case 'td': case 'th':
      return createElement(tag, { key, ...(p.align ? { style: { textAlign: p.align as 'left' } } : {}), ...(tag === 'th' ? { scope: 'col' } : {}) }, children());
    default:
      if (VOID.has(tag)) return createElement(tag, { key });
      return createElement(tag, { key }, children());
  }
}

/** Inline rich text (a definition, a reason): a single paragraph is unwrapped by the build. */
export const Rich = memo(function Rich({ nodes, className, as = 'span' }: { nodes: CNode[]; className?: string; as?: 'span' | 'div' }) {
  return createElement(as, { className }, <Fragment>{renderNodes(nodes)}</Fragment>);
});
