import { useNotepad } from '@/lib/notepad-context';
import type { Anchor } from '@/lib/notepad';

/** "Add note" on anything the app renders (APP-SPEC §3.1): anchors a new note and opens the notepad on it. */
export function AddNoteButton({ anchor, quote, label = 'Add note', className = '' }: { anchor: Anchor; quote?: string; label?: string; className?: string }) {
  const np = useNotepad();
  return (
    <button type="button" className={`bx-btn !py-0.5 !text-xs no-print ${className}`} onClick={() => { np.addNote(anchor, quote); np.setOpen(true); }} data-testid="add-note">
      ✎ {label}
    </button>
  );
}
