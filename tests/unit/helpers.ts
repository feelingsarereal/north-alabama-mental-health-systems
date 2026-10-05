import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import type { Element } from 'hast';
import { parseReview, inlineHast } from '../../scripts/lib/review';

export const ROOT = path.resolve(__dirname, '../..');
export const PACK = path.join(ROOT, 'content-pack');
export const readPack = (f: string) => fs.readFileSync(path.join(PACK, f), 'utf8');
export const yamlPack = <T>(f: string) => yaml.load(readPack(f)) as T;

let parsed: ReturnType<typeof parseReview> | null = null;
export function realReview() { return (parsed ??= parseReview(readPack('review.md'))); }

/** One block parsed from a markdown fragment (a section marker and heading are added). */
export function block(md: string) {
  const r = parseReview(`<!-- section: s -->\n# S\n\n${md}\n`);
  if (r.errors.length) throw new Error(r.errors.join('\n'));
  return r.blocks;
}
export function inlineEl(md: string): Element { return inlineHast(md).root as unknown as Element; }
