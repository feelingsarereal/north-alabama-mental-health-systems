import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { cellNumber, classOf, intervalOf, positionOf, positionText, quantileBreaks } from '../../src/lib/stats';
import { fmtValue, MISSING, NO_MOE, caveatFor } from '../../src/components/maps/format';
import { surveyWords } from '../../src/components/maps/TractMap';
import type { LayerT } from '../../src/types';
import { ROOT, readPack } from './helpers';

const pct = { id: 'pct_poverty', unit: '%', type: 'numeric', caveats: '', higher_is: 'worse' } as unknown as LayerT;
const dollars = { id: 'median_hh_income', unit: '$ (2024 dollars)', type: 'numeric', caveats: '', higher_is: 'better' } as unknown as LayerT;

describe('map computations', () => {
  it('quantile class breaks: five classes over the published values, empty cells left out', () => {
    const vals = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(String).concat(['', '']).map(cellNumber);
    const b = quantileBreaks(vals);
    [2.8, 4.6, 6.4, 8.2].forEach((x, i) => expect(b[i]).toBeCloseTo(x, 9)); // d3 scaleQuantile (R-7)
    expect(classOf(1, b)).toBe(0);
    expect(classOf(3, b)).toBe(1);
    expect(classOf(10, b)).toBe(4);
    expect(classOf(null, b)).toBeNull();
  });
  it('position in the ordered list: ties share a position, missing values are not counted', () => {
    const vals = ['10', '20', '20', '5', ''].map(cellNumber);
    expect(positionOf(20, vals)).toEqual({ position: 1, of: 4, tied: 2 });
    expect(positionOf(10, vals)).toEqual({ position: 3, of: 4, tied: 1 });
    expect(positionText(positionOf(20, vals))).toBe('tied 1st highest of 4');
    expect(positionText(positionOf(5, vals))).toBe('4th highest of 4');
    expect(positionOf(null, vals)).toBeNull();
  });
  it('an empty cell is a missing value, never zero', () => {
    expect(cellNumber('')).toBeNull();
    expect(cellNumber('0')).toBe(0);
    const layer = { id: 'x', unit: 'percent', type: 'numeric', caveats: '', higher_is: 'worse' } as unknown as LayerT;
    expect(fmtValue('', layer)).toBe(MISSING);
    expect(fmtValue('', layer)).not.toMatch(/^0/);
    expect(fmtValue('12.5', layer)).toBe('12.5%');
    // the one suppressed tract cell: Census Tract 106.30, renters paying 35% or more
    const w = surveyWords('', '', pct);
    expect(w.value).toBe(MISSING);
    expect(w.value).not.toMatch(/\b0\b/);
    expect(w.between).toBeNull();
  });
  it('the survey interval: estimate ± margin, clipped at 0 and 100, absent when the margin is empty', () => {
    expect(intervalOf('17.8', '6.5', true)).toEqual({ lo: 11.3, hi: 24.3, dec: 1 });
    expect(intervalOf('3.1', '4.0', true)).toEqual({ lo: 0, hi: 7.1, dec: 1 });
    expect(intervalOf('97.5', '4.2', true)).toEqual({ lo: 93.3, hi: 100, dec: 1 });
    expect(intervalOf('120', '30', false)).toEqual({ lo: 90, hi: 150, dec: 0 });
    expect(intervalOf('86499', '', false)).toBeNull();
    expect(intervalOf('', '5', true)).toBeNull();
  });
  it('a survey tract value is never written without its margin', () => {
    expect(surveyWords('17.8', '6.5', pct)).toEqual({ value: '17.8% ± 6.5', between: 'between 11.3% and 24.3%' });
    expect(surveyWords('53557', '10800', dollars)).toEqual({ value: '$53,557 ± $10,800', between: 'between $42,757 and $64,357' });
    // a controlled benchmark estimate: no margin applies, and the words say so
    expect(surveyWords('86499', '', dollars).value).toBe(`$86,499 (${NO_MOE})`);
  });
  it('finds the caveat sentence that names an area', () => {
    const layer = { caveats: 'Coosa and Lamar counties are empty because the file reports 0 primary care physicians there (numerator 0), so no ratio exists; this is not suppression. Connecticut state value is blank in the supplement.' } as LayerT;
    expect(caveatFor(layer, 'Coosa')).toMatch(/^Coosa and Lamar counties are empty/);
    expect(caveatFor(layer, 'Connecticut')).toBe('Connecticut state value is blank in the supplement.');
    expect(caveatFor(layer, 'Madison')).toBe('');
  });
});

describe('tract geometry', () => {
  it('the committed geometry holds exactly the 117 tract ids of tracts.csv', () => {
    const topo = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/geo/tracts-madison-cullman.topo.json'), 'utf8')) as { objects: { tracts: { geometries: { id: string }[] } } };
    const geo = topo.objects.tracts.geometries.map((g) => String(g.id)).sort();
    const csv = readPack('geo/tracts.csv').trim().split('\n').slice(1).map((l) => l.split(',')[0]).sort();
    expect(geo).toHaveLength(117);
    expect(geo).toEqual(csv);
  });
});
