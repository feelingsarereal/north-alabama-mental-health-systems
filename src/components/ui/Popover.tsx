import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { FloatingFocusManager, FloatingPortal, autoUpdate, flip, offset, safePolygon, shift, useClick, useDismiss, useFloating, useHover, useInteractions, useRole } from '@floating-ui/react';

interface Props {
  children: ReactNode;          // trigger label
  content: ReactNode;           // popover body
  className?: string;           // trigger classes (e.g. bx-term, bx-chip)
  style?: CSSProperties;
  ariaLabel?: string;
  hover?: boolean;              // open on hover too (default true); keyboard/click always work
  placement?: 'bottom-start' | 'bottom' | 'top-start' | 'top' | 'right' | 'left';
  testId?: string;
  onOpen?: () => void;
}

type Arm = 'hover' | 'focus' | 'click';

/**
 * Popover anchored to a <button> trigger (floating-ui). Hover shows a read-only preview; click / Enter / Space
 * opens it interactively (focus moves inside, Esc closes and returns focus). Never hover-only.
 *
 * The draft carries hundreds of term and citation triggers, so the floating-ui machinery is mounted only when a
 * trigger is first hovered, focused or clicked; until then it is a plain button. Arming keeps focus on the trigger.
 */
export default function Popover(props: Props) {
  const [armed, setArmed] = useState<Arm | null>(null);
  if (armed) return <ArmedPopover {...props} armedBy={armed} />;
  const { children, className, style, ariaLabel, testId } = props;
  return (
    <button
      type="button"
      className={className}
      style={style}
      aria-label={ariaLabel}
      aria-haspopup="dialog"
      aria-expanded={false}
      data-testid={testId}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse' && props.hover !== false) setArmed('hover'); }}
      onFocus={() => setArmed('focus')}
      onClick={() => setArmed('click')}
    >
      {children}
    </button>
  );
}

function ArmedPopover({ children, content, className, style, ariaLabel, hover = true, placement = 'bottom-start', testId, onOpen, armedBy }: Props & { armedBy: Arm }) {
  const [open, setOpen] = useState(armedBy === 'click');
  const [interactive, setInteractive] = useState(armedBy === 'click');
  const btn = useRef<HTMLButtonElement | null>(null);
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: (o, _e, reason) => {
      setOpen(o);
      setInteractive(o && reason !== 'hover' && reason !== 'safe-polygon');
      if (o) onOpen?.();
    },
    placement,
    middleware: [offset(6), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  useEffect(() => {
    if (armedBy !== 'hover') btn.current?.focus();
    if (armedBy === 'hover') setOpen(true);
    if (armedBy === 'click') onOpen?.();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const hoverI = useHover(context, { enabled: hover, delay: { open: 120, close: 80 }, handleClose: safePolygon(), move: false });
  const click = useClick(context, { toggle: true });
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'dialog' });
  const { getReferenceProps, getFloatingProps } = useInteractions([hoverI, click, dismiss, role]);
  const panel = (
    <div ref={refs.setFloating} style={{ ...floatingStyles, zIndex: 60 }} {...getFloatingProps()} className="bx-card p-3 max-w-sm w-max text-sm shadow-lg" data-testid={testId ? `${testId}-popover` : undefined}>
      {content}
    </div>
  );
  return (
    <>
      <button
        type="button"
        ref={(el) => { btn.current = el; refs.setReference(el); }}
        {...getReferenceProps({ 'aria-describedby': open ? context.floatingId : undefined })}
        className={className}
        style={style}
        aria-label={ariaLabel}
        data-testid={testId}
      >
        {children}
      </button>
      {open && (
        <FloatingPortal>
          {interactive ? (
            <FloatingFocusManager context={context} modal={false} initialFocus={0} returnFocus>
              {panel}
            </FloatingFocusManager>
          ) : panel}
        </FloatingPortal>
      )}
    </>
  );
}
