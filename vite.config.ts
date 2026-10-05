/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { localEndpoints } from './scripts/local-endpoints';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';

/** SPA deep links on GitHub Pages need a 404.html that is a copy of index.html (DESIGN-SYSTEM §1). */
function spaFallback(): Plugin {
  return {
    name: 'spa-404-fallback',
    apply: 'build',
    closeBundle() {
      const dist = path.resolve(fileURLToPath(new URL('./dist', import.meta.url)));
      const index = path.join(dist, 'index.html');
      if (fs.existsSync(index)) fs.copyFileSync(index, path.join(dist, '404.html'));
    },
  };
}

/**
 * Route preloads: index.html is the same for every route, so a deep link to /read would otherwise fetch the shell,
 * run it, then fetch the Read chunk, then the report data. This injects a tiny inline script that adds
 * <link rel="modulepreload"> for the current route's page chunk and its data chunks at parse time.
 */
const ROUTE_MODULES: Record<string, string[]> = {
  '/read': ['src/pages/Read.tsx', 'src/data/reader-1.json'],
  '/map/region': ['src/pages/MapRegion.tsx', 'src/components/maps/RegionMap.tsx', 'src/data/layers.json', 'src/data/map-region.json', 'src/data/locations.json'],
  '/map/tracts': ['src/pages/MapTracts.tsx', 'src/components/maps/TractMap.tsx', 'src/data/layers.json', 'src/data/map-tracts.json', 'src/data/locations.json'],
  '/systems': ['src/pages/Systems.tsx', 'src/data/systems.json'],
  '/open-items': ['src/pages/OpenItems.tsx', 'src/data/open-items.json'],
  '/references': ['src/pages/References.tsx', 'src/data/references.json'],
  '/glossary': ['src/pages/Glossary.tsx', 'src/data/glossary.json'],
  '/methods': ['src/pages/Methods.tsx', 'src/data/methods.json'],
};
function routePreload(): Plugin {
  let base = '/';
  return {
    name: 'route-preload',
    apply: 'build',
    configResolved(c) { base = c.base; },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle) return html;
        const chunks = Object.values(ctx.bundle).filter((c): c is import('rollup').OutputChunk => c.type === 'chunk');
        const entry = chunks.find((c) => c.isEntry);
        const skip = new Set([entry?.fileName, ...(entry?.imports ?? [])]);
        const byModule = (m: string) => chunks.find((c) => c.facadeModuleId?.replace(/\\/g, '/').endsWith(m) || Object.keys(c.modules).some((id) => id.replace(/\\/g, '/').endsWith(m) && c.name !== 'index'));
        const map: Record<string, string[]> = {};
        for (const [route, mods] of Object.entries(ROUTE_MODULES)) {
          const files = new Set<string>();
          const add = (c: import('rollup').OutputChunk | undefined) => {
            if (!c || skip.has(c.fileName) || files.has(c.fileName)) return;
            files.add(c.fileName);
            for (const i of c.imports) add(chunks.find((x) => x.fileName === i));
          };
          for (const m of mods) add(byModule(m));
          map[route] = [...files];
        }
        const script = `<script>(function(){try{var b=${JSON.stringify(base)},m=${JSON.stringify(map)},p=location.pathname.slice(b.length-1).replace(/\\/$/,'')||'/';(m[p]||[]).forEach(function(f){var l=document.createElement('link');l.rel='modulepreload';l.href=b+f;document.head.appendChild(l);});}catch(e){}})();</script>`;
        return html.replace('</head>', `    ${script}\n  </head>`);
      },
    },
  };
}

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  // localEndpoints(): dev/preview-server middleware only (notepad file autosave); never part of dist/.
  plugins: [react(), spaFallback(), routePreload(), localEndpoints(fileURLToPath(new URL('.', import.meta.url)))],
  json: { stringify: true },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          markdown: ['react-markdown', 'remark-gfm'],
          charts: ['recharts'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    testTimeout: 120_000,
  },
});
