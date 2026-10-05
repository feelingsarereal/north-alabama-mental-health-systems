import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import Layout from '@/components/Layout';
import { ThemeProvider } from '@/lib/theme';
import { NotepadProvider } from '@/lib/notepad-context';
import Home from '@/pages/Home';

const Read = lazy(() => import('@/pages/Read'));
const Glossary = lazy(() => import('@/pages/Glossary'));
const Concepts = lazy(() => import('@/pages/Concepts'));
const Concept = lazy(() => import('@/pages/Concept'));
const Figures = lazy(() => import('@/pages/Figures'));
const Figure = lazy(() => import('@/pages/Figure'));
const References = lazy(() => import('@/pages/References'));
const OpenItems = lazy(() => import('@/pages/OpenItems'));
const MapRegion = lazy(() => import('@/pages/MapRegion'));
const MapTracts = lazy(() => import('@/pages/MapTracts'));
const MapSources = lazy(() => import('@/pages/MapSources'));
const Systems = lazy(() => import('@/pages/Systems'));
const Search = lazy(() => import('@/pages/Search'));
const Methods = lazy(() => import('@/pages/Methods'));
const About = lazy(() => import('@/pages/About'));
const Notes = lazy(() => import('@/pages/Notes'));
const NotFound = lazy(() => import('@/pages/NotFound'));

const TITLES: [RegExp, string][] = [
  [/^\/read/, 'Read'], [/^\/systems/, 'Systems'], [/^\/map\/region/, 'Region map'], [/^\/map\/tracts/, 'Tract map'], [/^\/map\/sources/, 'Map sources'],
  [/^\/open-items/, 'Open items'], [/^\/references/, 'References'], [/^\/glossary/, 'Glossary'], [/^\/concepts/, 'Primers'],
  [/^\/figures/, 'Figures'], [/^\/methods/, 'Methods'], [/^\/about/, 'About'], [/^\/notes/, 'Notes'], [/^\/search/, 'Search'],
];

function TitleAndScroll() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    const t = TITLES.find(([re]) => re.test(pathname))?.[1];
    document.title = t ? `${t} · North Alabama Mental Health Systems Report — draft for review` : 'North Alabama Mental Health Systems Report — draft for review';
    if (!hash) window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export default function App() {
  return (
    <ThemeProvider>
      <NotepadProvider>
        <TitleAndScroll />
        <Layout>
          <Suspense fallback={<p className="mx-auto max-w-3xl px-4 py-8 bx-muted" role="status">Loading…</p>}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/read" element={<Read />} />
              <Route path="/glossary" element={<Glossary />} />
              <Route path="/concepts" element={<Concepts />} />
              <Route path="/concepts/:id" element={<Concept />} />
              <Route path="/figures" element={<Figures />} />
              <Route path="/figures/:id" element={<Figure />} />
              <Route path="/references" element={<References />} />
              <Route path="/open-items" element={<OpenItems />} />
              <Route path="/map/region" element={<MapRegion />} />
              <Route path="/map/tracts" element={<MapTracts />} />
              <Route path="/map/sources" element={<MapSources />} />
              <Route path="/systems" element={<Systems />} />
              <Route path="/search" element={<Search />} />
              <Route path="/methods" element={<Methods />} />
              <Route path="/about" element={<About />} />
              <Route path="/notes" element={<Notes />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </Layout>
      </NotepadProvider>
    </ThemeProvider>
  );
}
