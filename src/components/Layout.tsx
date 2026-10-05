import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useTheme } from '@/lib/theme';
import { useNotepad } from '@/lib/notepad-context';
import { brand, manifest } from '@/lib/data';
import Drawer from '@/components/ui/Drawer';
import HoverLayerLoader from '@/components/HoverLayerLoader';

const SearchModal = lazy(() => import('./SearchModal'));
const NotepadPanel = lazy(() => import('./notepad/NotepadPanel'));

export const PRIMARY = [
  { to: '/read', label: 'Read' },
  { to: '/systems', label: 'Systems' },
  { to: '/map/region', label: 'Region map' },
  { to: '/map/tracts', label: 'Tract map' },
  { to: '/open-items', label: 'Open items' },
  { to: '/references', label: 'References' },
  { to: '/glossary', label: 'Glossary' },
  { to: '/concepts', label: 'Primers' },
  { to: '/methods', label: 'Methods' },
];
export const MORE = [
  { to: '/figures', label: 'Figures' },
  { to: '/notes', label: 'Notes' },
  { to: '/about', label: 'About' },
  { to: '/map/sources', label: 'Map sources' },
  { to: '/search', label: 'Search' },
];

/** The section in view on /read (set by the reader as it scrolls). */
export function currentSection(): string | null {
  return (typeof document !== 'undefined' && document.body.dataset.section) || null;
}

const LOGO = `${import.meta.env.BASE_URL}brand/little-orange-fish-logo-560.jpg`;

export function Logo({ className = '', height = 40 }: { className?: string; height?: number }) {
  // The logo as supplied (a JPEG on white): on dark surfaces it sits on a white rounded panel, never recoloured.
  return (
    <span className={`inline-flex items-center rounded-md bg-white px-1.5 py-1 ${className}`} data-testid="logo-panel">
      <img src={LOGO} alt="Little Orange Fish" width={Math.round(height * 2.62)} height={height} style={{ height, width: 'auto' }} />
    </span>
  );
}

/** The draft banner (KICKOFF §4f): every route, under the header, not dismissable; compacts to one line on scroll. */
function DraftBanner() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const on = () => setCompact((c) => (c ? window.scrollY > 40 : window.scrollY > 180));
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <div className="bx-draft no-print" role="note" aria-label="Draft notice" data-testid="draft-banner">
      <div className={`mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1 px-4 ${compact ? 'py-1 text-[13px]' : 'py-2 text-sm'}`}>
        <p className={`flex-1 min-w-[14rem] ${compact ? 'truncate' : ''}`}>
          <strong>Draft for review.</strong>{' '}
          {compact ? 'Not approved by Little Orange Fish; not peer reviewed.' : manifest.banner.text.replace(/^Draft for review\.\s*/, '')}
        </p>
        <span className="flex gap-3 font-semibold shrink-0">
          {manifest.banner.links.map((l) => <Link key={l.to} to={l.to} className="underline">{l.label}</Link>)}
        </span>
      </div>
    </div>
  );
}

function MoreMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const loc = useLocation();
  useEffect(() => { setOpen(false); }, [loc.pathname]);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', h); document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button type="button" className="rounded-md px-2 py-1.5 text-[15px] font-semibold hover:bg-paper-2 dark:hover:bg-night-2" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)}>More ▾</button>
      {open && (
        <ul className="bx-card absolute right-0 z-50 mt-1 w-44 p-1 text-sm">
          {MORE.map((m) => <li key={m.to}><NavLink to={m.to} className="block rounded px-2 py-1.5 hover:bg-paper-2 dark:hover:bg-night" style={{ color: 'var(--bx-ink)' }}>{m.label}</NavLink></li>)}
        </ul>
      )}
    </div>
  );
}

/** ≥ 1280 px: the reader docks the notepad beside the text (APP-SPEC §3.1). */
export function useWide(): boolean {
  const q = '(min-width: 1280px)';
  const [w, setW] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setW(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return w;
}

export default function Layout({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme();
  const np = useNotepad();
  const loc = useLocation();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const header = useRef<HTMLElement>(null);
  useEffect(() => { setMenu(false); }, [loc.pathname]);
  // the sticky header's height, for sticky asides, anchor offsets and popover placement
  useEffect(() => {
    const el = header.current;
    if (!el) return;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--hdr', `${el.offsetHeight}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearch(true); } };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, []);
  const onRead = loc.pathname === '/read';
  const wide = useWide();
  const docked = onRead && wide;
  const navCls = ({ isActive }: { isActive: boolean }) => `rounded-md px-2 py-1 text-[15px] font-semibold whitespace-nowrap hover:bg-paper-2 dark:hover:bg-night-2 ${isActive ? 'underline underline-offset-4 decoration-2' : 'no-underline'}`;
  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[80] bx-btn">Skip to content</a>
      <header ref={header} className="sticky top-0 z-40 border-b bg-white/95 dark:bg-night/95 backdrop-blur no-print" style={{ borderColor: 'var(--bx-line-soft)' }}>
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2">
          <Link to="/" className="flex items-center gap-2 shrink-0 no-underline" aria-label="North Alabama Mental Health Systems Report — home">
            <Logo height={34} />
            <span className="hidden sm:block leading-tight" style={{ color: 'var(--bx-ink)' }}>
              <span className="block text-[17px] font-bold">North Alabama Mental Health</span>
              <span className="block text-[14px] italic bx-muted">Systems Report</span>
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-1.5">
            <button type="button" className="bx-btn" onClick={() => setSearch(true)} aria-label="Search (Command K)" data-testid="search-button">
              <span aria-hidden="true">⌕</span><span className="hidden md:inline">Search</span><span className="hidden md:inline bx-kbd">⌘K</span>
            </button>
            <button type="button" className="bx-btn" onClick={toggle} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} data-testid="theme-toggle">{theme === 'dark' ? '☀' : '☾'}</button>
            <button type="button" className="bx-btn" onClick={() => (docked ? np.setDock(!np.dock) : np.toggle())} aria-expanded={docked ? np.dock : np.open} data-testid="notepad-toggle">✎<span className="hidden md:inline">Notepad</span></button>
            <button type="button" className="bx-btn lg:hidden" aria-expanded={menu} aria-controls="mobile-nav" onClick={() => setMenu((m) => !m)}>Menu</button>
          </div>
        </div>
        <nav aria-label="Main" className="hidden lg:block border-t" style={{ borderColor: 'var(--bx-line-soft)' }}>
          <div className="mx-auto flex max-w-7xl items-center gap-0.5 px-3 py-0.5">
            {PRIMARY.map((p) => <NavLink key={p.to} to={p.to} className={navCls} style={{ color: 'var(--bx-ink)' }}>{p.label}</NavLink>)}
            <MoreMenu />
          </div>
        </nav>
        {menu && (
          <nav id="mobile-nav" aria-label="Main" className="lg:hidden border-t px-4 py-2" style={{ borderColor: 'var(--bx-line-soft)' }}>
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-1">
              {[...PRIMARY, ...MORE].map((p) => <li key={p.to}><NavLink to={p.to} className={navCls} style={{ color: 'var(--bx-ink)' }}>{p.label}</NavLink></li>)}
            </ul>
          </nav>
        )}
        <DraftBanner />
      </header>
      <main id="main" className="flex-1 min-h-[100vh]" tabIndex={-1}>{children}</main>
      <footer className="border-t mt-12 no-print" style={{ borderColor: 'var(--bx-line-soft)' }}>
        <div className="mx-auto max-w-7xl px-4 py-8 text-sm grid gap-4 md:grid-cols-[1fr_auto]">
          <div className="grid gap-1.5">
            <p className="font-bold">{brand.organisation}</p>
            <p>{brand.address} · <a href={`mailto:${brand.email}`}>{brand.email}</a></p>
            <p className="italic">{brand.tagline}</p>
            <p className="bx-muted mt-2" data-testid="footer-line">Draft for review · Researched and written with Claude from public sources, October 2026 · awaiting review by Little Orange Fish · independent of WellStone and of every organization described.</p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap md:flex-col gap-x-4 gap-y-1 font-semibold">
            {MORE.slice(0, 3).map((m) => <Link key={m.to} to={m.to}>{m.label}</Link>)}
            <Link to="/methods">Methods</Link>
            <Link to="/map/sources">Map sources</Link>
          </nav>
        </div>
      </footer>
      <HoverLayerLoader />
      {search && <Suspense fallback={null}><SearchModal onClose={() => setSearch(false)} /></Suspense>}
      {!docked && (
        <Drawer open={np.open} onClose={() => np.setOpen(false)} label="Notepad" testId="notepad-drawer">
          <Suspense fallback={<p className="bx-muted">Loading…</p>}><NotepadPanel section={onRead ? currentSection() : null} /></Suspense>
        </Drawer>
      )}
    </div>
  );
}
