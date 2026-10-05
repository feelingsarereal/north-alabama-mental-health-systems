/**
 * The content build fails loudly: a copy of the real pack with one deliberate error per rule must exit non-zero
 * and name each error. Runs scripts/build-content.ts against a temporary pack (BX_PACK) with temporary outputs; the
 * committed tract geometry is copied into the temporary public folder so the geometry join runs too.
 */
import { describe, expect, it, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT, PACK } from './helpers';

let out = '';
let code = 0;

beforeAll(() => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bx-pack-'));
  const pack = path.join(tmp, 'content-pack');
  fs.cpSync(PACK, pack, { recursive: true });
  fs.rmSync(path.join(pack, 'BUILD-ERRORS.md'), { force: true });
  const pub = path.join(tmp, 'public');
  fs.mkdirSync(path.join(pub, 'data', 'geo', 'raw'), { recursive: true });
  for (const f of ['tracts-madison-cullman.topo.json', 'raw/tract_geometry.json']) fs.copyFileSync(path.join(ROOT, 'public', 'data', 'geo', f), path.join(pub, 'data', 'geo', f));
  const edit = (f: string, fn: (s: string) => string) => {
    const before = fs.readFileSync(path.join(pack, f), 'utf8');
    const after = fn(before);
    if (after === before) throw new Error(`fixture edit to ${f} changed nothing`);
    fs.writeFileSync(path.join(pack, f), after);
  };
  // 1. a ledger entry whose quote is not in its block
  edit('claims-ledger.yaml', (s) => s.replace('quote: Little Orange Fish, Huntsville, Alabama, the backbone organization for the North Alabama Mental Health Coalition [397]', 'quote: Big Blue Whale, the backbone of nothing [397]'));
  // 2. a ledger source number with no reference
  edit('claims-ledger.yaml', (s) => s.replace(/(sources:\n  - n: )397/, '$19999'));
  // 3. an open item pointing at an unknown block
  edit('open-items.yaml', (s) => s.replace('blocks: [B0280, B0004, B0115, B0174]', 'blocks: [B0280, B0999, B0115, B0174]'));
  // 4. a map column with no layer, 5. a layer with no column
  edit('geo/ring_counties.csv', (s) => s.split(/\r?\n/).map((l, i) => (l ? `${l},${i === 0 ? 'mystery_column' : '1'}` : l)).join('\n'));
  edit('geo/layers.json', (s) => { const j = JSON.parse(s); j.push({ ...j[0], id: 'ghost_layer', label: 'Ghost' }); return JSON.stringify(j); });
  // 6. a tract id with no geometry
  edit('geo/tracts.csv', (s) => s.replace('\n01043964100,', '\n01043999999,'));
  // 7. a survey tract value with no margin of error
  edit('geo/tracts_moe.csv', (s) => s.replace('\n01089010630,', '\n01089010630,X').replace(/\n01089010630,X[^,]*,/, '\n01089010630,,'));
  // 8. uncited prose in review.md (the framing marker removed from a block with no citation)
  edit('review.md', (s) => s.replace(/(lists what could not be read, confirmed or found\.) <!-- framing --> <!-- b: B0002 -->/, '$1 <!-- b: B0002 -->'));
  try {
    out = execFileSync('npx', ['tsx', 'scripts/build-content.ts'], {
      cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, BX_PACK: pack, BX_OUT: path.join(tmp, 'out'), BX_PUBLIC: pub },
    });
  } catch (e) {
    const err = e as { status: number; stdout: string; stderr: string };
    code = err.status; out = `${err.stdout}\n${err.stderr}`;
  }
}, 120_000);

describe('content build fails loudly', () => {
  it('exits non-zero', () => expect(code).not.toBe(0));
  it('names a ledger quote that is not in its block', () => expect(out).toMatch(/claims-ledger\.yaml B0001\.a: anchor fails in B0001 — quote matches 0 times/));
  it('names a ledger source number with no reference', () => expect(out).toMatch(/claims-ledger\.yaml B0001\.a: reference \[9999\] is not in references\.yaml/));
  it('names an open item pointing at an unknown block', () => expect(out).toMatch(/open-items\.yaml OI-001: block B0999 is not in review\.md/));
  it('names a map column with no layer', () => expect(out).toMatch(/geo\/ring_counties\.csv: column mystery_column has no county layer in layers\.json/));
  it('names a layer with no column', () => expect(out).toMatch(/geo\/layers\.json ghost_layer: no column in geo\/ring_counties\.csv/));
  it('names a tract id with no geometry', () => {
    expect(out).toMatch(/geo\/tracts\.csv: tract 01043999999 has no geometry in the tract boundary file/);
    expect(out).toMatch(/tract boundary file: tract 01043964100 has no row in geo\/tracts\.csv/);
  });
  it('names a survey estimate with no margin of error', () => expect(out).toMatch(/geo\/tracts_moe\.csv: tract 01089010630 has a pop_total estimate but no margin of error/));
  it('names uncited prose', () => expect(out).toMatch(/review\.md B0002: uncited block of \d+ words/));
});
