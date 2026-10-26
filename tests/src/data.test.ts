import { expect, test } from 'vitest';
import { loadFrom } from '../../src/data';
import { minimalProduct } from '../fixtures';

test('loadFrom resolves valid products and reports broken ones by id without throwing', () => {
  const broken = minimalProduct();
  broken.id = 'billy-40';
  broken.steps[0].actions = [];
  const data = loadFrom({
    '/data/products/billy-80.json': minimalProduct(),
    '/data/products/billy-40.json': broken,
  }, []);
  expect([...data.resolved.keys()]).toEqual(['billy-80']);
  expect(data.errors.get('billy-40')).toMatch(/billy-40\.json.*steps\[0\]\.actions/);
});

test('loadFrom keys products by file name', () => {
  const data = loadFrom({ '/data/products/billy-80.json': minimalProduct() }, []);
  expect(data.products.get('billy-80')?.name).toBe('BILLY bookcase 80 cm');
});
