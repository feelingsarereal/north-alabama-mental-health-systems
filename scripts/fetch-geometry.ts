/**
 * One-time geometry step (KICKOFF §4d, `npm run build:geometry`). Downloads the Census Bureau's 2023 cartographic
 * boundary file for Alabama census tracts, keeps the tracts of Madison (089) and Cullman (043), checks that there are
 * exactly 117 and that their GEOIDs equal the `geoid` column of content-pack/geo/tracts.csv as a set, simplifies
 * lightly, and writes public/data/geo/tracts-madison-cullman.topo.json plus a record of the download in
 * public/data/geo/raw/tract_geometry.json. Both files are committed; `npm run build` never needs the network.
 *
 * If the download fails, or the count or the id set differs, it stops with a non-zero exit and writes nothing: no
 * other vintage is substituted and no tract is drawn any other way.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';
import * as shapefile from 'shapefile';
import { topology } from 'topojson-server';
import { presimplify, simplify, quantile } from 'topojson-simplify';
import type { Feature, Geometry } from 'geojson';

const URL_ = 'https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_01_tract_500k.zip';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'data', 'geo', 'tracts-madison-cullman.topo.json');
const RECORD = path.join(ROOT, 'public', 'data', 'geo', 'raw', 'tract_geometry.json');
const TRACTS_CSV = path.join(ROOT, 'content-pack', 'geo', 'tracts.csv');
const KEEP = new Set(['089', '043']);

function fail(msg: string): never {
  console.error(`\n✗ build:geometry stopped: ${msg}\n  Nothing was written. Do not substitute another vintage (KICKOFF §4d).`);
  process.exit(1);
}

async function main() {
  console.log(`downloading ${URL_}`);
  let res: Response;
  try { res = await fetch(URL_); } catch (e) { fail(`download failed: ${(e as Error).message}`); }
  if (!res.ok) fail(`download failed: HTTP ${res.status}`);
  const zip = new Uint8Array(await res.arrayBuffer());
  const sha256 = crypto.createHash('sha256').update(zip).digest('hex');
  const lastModified = res.headers.get('last-modified');
  console.log(`  ${zip.length} bytes, sha256 ${sha256}, last-modified ${lastModified ?? '(none)'}`);

  const files = unzipSync(zip);
  const shpName = Object.keys(files).find((f) => f.endsWith('.shp'));
  const dbfName = Object.keys(files).find((f) => f.endsWith('.dbf'));
  if (!shpName || !dbfName) fail('the zip has no .shp/.dbf');
  const toAB = (u: Uint8Array) => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;
  const src = await shapefile.open(toAB(files[shpName]), toAB(files[dbfName]));
  const kept: Feature<Geometry, { GEOID: string; NAME: string }>[] = [];
  let total = 0;
  for (;;) {
    const r = await src.read();
    if (r.done) break;
    total++;
    const p = r.value.properties as Record<string, string>;
    if (KEEP.has(String(p.COUNTYFP))) kept.push({ type: 'Feature', id: p.GEOID, properties: { GEOID: p.GEOID, NAME: p.NAME }, geometry: r.value.geometry });
  }
  console.log(`  ${total} Alabama tracts in the file; ${kept.length} in counties 089 and 043`);

  const csvIds = fs.readFileSync(TRACTS_CSV, 'utf8').trim().split('\n').slice(1).map((l) => l.split(',')[0]);
  const want = new Set(csvIds);
  const have = new Set(kept.map((f) => f.properties.GEOID));
  if (kept.length !== 117) fail(`expected exactly 117 tracts, found ${kept.length}`);
  const missing = [...want].filter((g) => !have.has(g));
  const extra = [...have].filter((g) => !want.has(g));
  if (missing.length || extra.length || want.size !== 117) fail(`GEOID set differs from tracts.csv: missing ${missing.join(', ') || 'none'}; extra ${extra.join(', ') || 'none'}`);

  kept.sort((a, b) => a.properties.GEOID.localeCompare(b.properties.GEOID));
  let topo = topology({ tracts: { type: 'FeatureCollection', features: kept } as never }, 1e5);
  topo = presimplify(topo as never) as never;
  topo = simplify(topo as never, quantile(topo as never, 0.25)) as never;
  fs.mkdirSync(path.dirname(RECORD), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(topo) + '\n');
  fs.writeFileSync(RECORD, JSON.stringify({
    url: URL_, downloaded: new Date().toLocaleDateString('en-CA'), bytes: zip.length, sha256, last_modified: lastModified,
    vintage: '2023 cartographic boundary file, 1:500,000', state: '01', counties_kept: ['043', '089'], tracts: kept.length,
    simplification: 'topojson-simplify, presimplify then simplify at the 25th percentile of triangle area; quantization 1e5',
    output: 'public/data/geo/tracts-madison-cullman.topo.json', output_bytes: fs.statSync(OUT).size,
  }, null, 2) + '\n');
  console.log(`✓ wrote ${path.relative(ROOT, OUT)} (${fs.statSync(OUT).size} bytes) and ${path.relative(ROOT, RECORD)}`);
}

main();
