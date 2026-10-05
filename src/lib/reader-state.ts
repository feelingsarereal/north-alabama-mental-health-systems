/** Reader UI state shared by the reader, its blocks and the HoverLayer. */
import { keyedStore, persistedFlag } from '@/lib/store';
import { SLUG } from '@/lib/data';

/** The open citation fold-out per block (one per paragraph, DESIGN-SYSTEM §4). */
export const foldouts = keyedStore<number | null>(null);
/** "Show what was checked" (KICKOFF §4b): off by default, persisted. */
export const showChecked = persistedFlag(`bx-checked:${SLUG}`, false);
/** With the claim layer on: underline only the "not found" claims (the strips' "of which … not found" link). */
export const claimFilter = persistedFlag(`bx-claims-notfound:${SLUG}`, false);
