import { expect, test } from 'vitest';
import { parseProduct } from '@shared/schema';
import { minimalProduct, placeAction } from '../fixtures';

test('parseProduct accepts a minimal valid product', () => {
  expect(parseProduct(minimalProduct(), 'p.json').id).toBe('billy-80');
});

test('parseProduct rejects an unknown panel reference with file and path', () => {
  const p = minimalProduct();
  p.steps[0].actions[0] = { ...placeAction, panelId: 'ghost' };
  expect(() => parseProduct(p, 'data/products/billy-80.json')).toThrow(
    /billy-80\.json.*steps\[0\]\.actions\[0\]\.panelId.*ghost/,
  );
});

test('parseProduct rejects a step with no actions', () => {
  const p = minimalProduct();
  p.steps[0].actions = [];
  expect(() => parseProduct(p, 'x.json')).toThrow(/steps\[0\]\.actions/);
});

test('parseProduct rejects insert-hardware whose partNumber is not in hardware', () => {
  const p = minimalProduct();
  p.steps[0].actions.push({
    type: 'insert-hardware',
    partNumber: '999999',
    kind: 'dowel',
    count: 2,
    target: { panelId: 'side-left', face: '+z' },
    from: '+z',
  });
  expect(() => parseProduct(p, 'x.json')).toThrow(/steps\[0\]\.actions\[1\]\.partNumber.*999999/);
});

test('parseProduct rejects step indexes out of order', () => {
  const p = minimalProduct();
  p.steps[0].index = 2;
  expect(() => parseProduct(p, 'x.json')).toThrow(/steps\[0\]\.index/);
});

test('parseProduct rejects a malformed shape with file name', () => {
  const p = minimalProduct();
  p.panels[0].role = 'roof';
  expect(() => parseProduct(p, 'bad.json')).toThrow(/bad\.json.*panels\[0\]\.role/);
});
