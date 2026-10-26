import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { CatalogEntrySchema } from '@shared/schema';
import catalog from '../../data/catalog.json';

const publicDir = join(__dirname, '../../public');

test('every catalog entry parses', () => {
  for (const e of catalog) expect(() => CatalogEntrySchema.parse(e)).not.toThrow();
});

test('catalog ids are unique and in showroom order', () => {
  expect(catalog.map((e) => e.id)).toEqual(['billy-corner-combo', 'billy-80', 'billy-40', 'billy-ext', 'billy-corner']);
});

test('the corner combination is the only composite', () => {
  expect(catalog.filter((e) => e.kind === 'composite').map((e) => e.id)).toEqual(['billy-corner-combo']);
});

test('every pdf and photo path exists under public/', () => {
  for (const e of catalog) {
    for (const p of [...e.photos, ...(e.pdf ? [e.pdf] : [])]) {
      expect(existsSync(join(publicDir, p)), `${e.id}: ${p}`).toBe(true);
    }
    expect(e.photos.length, e.id).toBeGreaterThanOrEqual(2);
  }
});
