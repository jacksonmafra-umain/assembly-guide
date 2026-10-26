import { readdirSync, readFileSync } from 'node:fs';
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

test('a joining product is kept for composites but not shown on its own', () => {
  const joiner = minimalProduct();
  joiner.id = 'joiner';
  joiner.roles = ['a'];
  const data = loadFrom({ '/data/products/joiner.json': joiner }, []);
  expect(data.products.has('joiner')).toBe(true);
  expect(data.resolved.has('joiner')).toBe(false);
  expect(data.errors.get('joiner')).toMatch(/combination/);
});

test('composites are resolved from the loaded products', () => {
  const composite = {
    id: 'combo', name: 'Combo', sequence: ['a', 'b'],
    components: ['a', 'b'].map((instanceId, i) => ({ instanceId, productId: 'billy-80', placement: { position: { x: i * 1000, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } } })),
  };
  const data = loadFrom({ '/data/products/billy-80.json': minimalProduct() }, [], { '/data/composites/combo.json': composite });
  expect(data.resolved.get('combo')!.steps.map((s) => s.instanceId)).toEqual(['a', 'b']);
  expect(data.composites.get('combo')!.components).toHaveLength(2);
});

test('a broken composite is reported, not thrown', () => {
  const composite = { id: 'combo', name: 'Combo', sequence: ['a'], components: [{ instanceId: 'a', productId: 'missing', placement: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } } }] };
  const data = loadFrom({}, [], { '/data/composites/combo.json': composite });
  expect(data.errors.get('combo')).toMatch(/missing|instance/);
});

test('the real corner combination resolves with every component', () => {
  const glob = (dir: string) => Object.fromEntries(readdirSync(dir).filter((f) => f.endsWith('.json'))
    .map((f) => [`/${dir}/${f}`, JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'))]));
  const data = loadFrom(glob('data/products'), [], glob('data/composites'));
  expect(data.errors.has('billy-corner-combo')).toBe(false);
  const r = data.resolved.get('billy-corner-combo')!;
  expect(new Set(r.steps.map((s) => s.instanceId))).toEqual(new Set(['left', 'leftExt', 'middle', 'middleExt', 'right', 'rightExt', 'corner']));
});
