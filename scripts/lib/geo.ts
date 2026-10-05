/**
 * Map geometry (KICKOFF §4d), projected at build time into SVG path strings so the app fetches nothing and ships no
 * projection code.
 *
 * - Region: the fifteen counties of the Huntsville crisis catchment from `us-atlas` counties-10m.json, under a
 *   Mercator fitted to those fifteen; the rest of Alabama's counties as one muted backdrop path. Overlay outlines
 *   (center service areas, 2-1-1 areas, the core, the catchment) are topojson merges of the counties a list names.
 * - Tracts: the committed Census Bureau cartographic boundary file (public/data/geo/tracts-madison-cullman.topo.json,
 *   written once by scripts/fetch-geometry.ts). Each county is fitted to its own frame; they are drawn side by side.
 * - Service locations: lon/lat projected with the same projections; locations that share a coordinate become one
 *   marker listing all of them.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { geoMercator, geoPath, type GeoProjection } from 'd3-geo';
import { feature, merge } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Feature, FeatureCollection, Geometry } from 'geojson';

const require = createRequire(import.meta.url);
const atlasDir = path.dirname(require.resolve('us-atlas/package.json'));

const r1 = (n: number) => Math.round(n * 10) / 10;

export interface Area { id: string; name: string; d: string; cx: number; cy: number }
export interface PointIn { id: string; lon: number; lat: number; type: string; approximate: boolean }
export interface Marker { x: number; y: number; ids: string[]; type: string; approximate: boolean }

/** Group points that share a coordinate (to 1e-6°) into one marker, in input order. */
export function clusterMarkers(points: PointIn[], proj: GeoProjection): Marker[] {
  const by = new Map<string, Marker>();
  for (const p of points) {
    const key = `${p.lon.toFixed(6)},${p.lat.toFixed(6)}`;
    const m = by.get(key);
    if (m) { m.ids.push(p.id); m.approximate = m.approximate || p.approximate; continue; }
    const xy = proj([p.lon, p.lat]);
    if (!xy) continue;
    by.set(key, { x: r1(xy[0]), y: r1(xy[1]), ids: [p.id], type: p.type, approximate: p.approximate });
  }
  return [...by.values()];
}

export function regionGeometry(names: Map<string, string>, errors: string[]) {
  const topo = JSON.parse(fs.readFileSync(path.join(atlasDir, 'counties-10m.json'), 'utf8')) as Topology;
  const coll = topo.objects.counties as GeometryCollection;
  const al = coll.geometries.filter((g) => String(g.id).startsWith('01'));
  const ring = al.filter((g) => names.has(String(g.id)));
  const have = new Set(ring.map((g) => String(g.id)));
  for (const f of names.keys()) if (!have.has(f)) errors.push(`geo/ring_counties.csv: FIPS ${f} has no geometry in us-atlas counties-10m.json`);
  const fcRing = feature(topo, { type: 'GeometryCollection', geometries: ring }) as FeatureCollection<Geometry>;
  const W = 760; const H = 620;
  const proj = geoMercator().fitExtent([[16, 16], [W - 16, H - 16]], fcRing);
  const p = geoPath(proj).digits(1);
  const areas: Area[] = (fcRing.features as Feature<Geometry>[]).map((f) => {
    const [cx, cy] = p.centroid(f);
    return { id: String(f.id), name: names.get(String(f.id))!, d: p(f) ?? '', cx: r1(cx), cy: r1(cy) };
  }).sort((a, b) => a.id.localeCompare(b.id));
  const rest = al.filter((g) => !names.has(String(g.id)));
  const backdrop = p(feature(topo, { type: 'GeometryCollection', geometries: rest }) as never) ?? '';
  const mergeOf = (fips: string[]) => {
    const set = new Set(fips);
    for (const f of fips) if (!al.some((g) => String(g.id) === f)) errors.push(`geo/overlays.json: FIPS ${f} is not an Alabama county`);
    return p(merge(topo, al.filter((g) => set.has(String(g.id))) as never)) ?? '';
  };
  return { width: W, height: H, areas, backdrop, mergeOf, proj };
}

export function tractGeometry(file: string, counties: { fips: string; name: string }[], tractNames: Map<string, { name: string; county_fips: string; county: string }>, errors: string[]) {
  if (!fs.existsSync(file)) { errors.push(`${path.basename(file)}: missing — run npm run build:geometry once (KICKOFF §4d)`); return null; }
  const topo = JSON.parse(fs.readFileSync(file, 'utf8')) as Topology;
  const coll = topo.objects.tracts as GeometryCollection;
  const ids = new Set(coll.geometries.map((g) => String(g.id)));
  for (const id of tractNames.keys()) if (!ids.has(id)) errors.push(`geo/tracts.csv: tract ${id} has no geometry in the tract boundary file`);
  for (const id of ids) if (!tractNames.has(id)) errors.push(`tract boundary file: tract ${id} has no row in geo/tracts.csv`);
  const W = 460; const H = 520;
  const frames = counties.map((c) => {
    const geoms = coll.geometries.filter((g) => String(g.id).startsWith(c.fips) && tractNames.has(String(g.id)));
    const fc = feature(topo, { type: 'GeometryCollection', geometries: geoms }) as FeatureCollection<Geometry>;
    const proj = geoMercator().fitExtent([[10, 10], [W - 10, H - 10]], fc);
    // trim the frame to the county's own aspect so the two sit side by side without dead space
    const p0 = geoPath(proj);
    const [[x0, y0], [x1, y1]] = p0.bounds(fc);
    const width = Math.ceil(x1 - x0 + 20); const height = Math.ceil(y1 - y0 + 20);
    proj.translate([proj.translate()[0] - x0 + 10, proj.translate()[1] - y0 + 10]);
    const p = geoPath(proj).digits(1);
    const areas = (fc.features as Feature<Geometry>[]).map((f) => {
      const id = String(f.id);
      const t = tractNames.get(id)!;
      const [cx, cy] = p.centroid(f);
      return { id, name: t.name, county_fips: t.county_fips, county: t.county, d: p(f) ?? '', cx: r1(cx), cy: r1(cy) };
    }).sort((a, b) => a.id.localeCompare(b.id));
    const outline = p(merge(topo, geoms as never)) ?? '';
    return { fips: c.fips, name: c.name, width, height, outline, areas, proj };
  });
  return { frames, ids };
}
