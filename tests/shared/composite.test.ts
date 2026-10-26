import { expect, test } from 'vitest';
import { parseProduct, type Composite, type Product } from '@shared/schema';
import { resolveComposite } from '@shared/rules/composite';
import { minimalProduct } from '../fixtures';

const pose = (x: number, y: number, z: number, rz = 0) => ({ position: { x, y, z }, rotation: { x: 0, y: 0, z: rz } });

function products(): Map<string, Product> {
  const unit = minimalProduct();
  unit.hardware[0].quantity = 2;
  unit.steps[0].actions.push({ type: 'insert-hardware', partNumber: '101339', kind: 'dowel', count: 2, target: { panelId: 'side-left', face: '+z' }, from: '+z' });
  const joiner = minimalProduct();
  joiner.id = 'joiner';
  joiner.roles = ['a', 'b'];
  joiner.panels = [];
  joiner.hardware = [{ partNumber: '115257', kind: 'corner-fitting', quantity: 2 }];
  joiner.steps[0].actions = [
    { type: 'insert-hardware', partNumber: '115257', kind: 'corner-fitting', count: 1, target: { panelId: 'a:side-left', face: '+z' }, from: '+z' },
    { type: 'insert-hardware', partNumber: '115257', kind: 'corner-fitting', count: 1, target: { panelId: 'b:side-left', face: '+z' }, from: '+z' },
  ];
  return new Map([['unit', parseProduct(unit, 'unit.json')], ['joiner', parseProduct(joiner, 'joiner.json')]]);
}

const combo: Composite = {
  id: 'combo', name: 'Combo',
  components: [
    { instanceId: 'left', productId: 'unit', placement: pose(0, 0, 0) },
    { instanceId: 'right', productId: 'unit', placement: pose(1000, 0, 0) },
    { instanceId: 'turned', productId: 'unit', placement: pose(0, 800, 0, -90) },
    { instanceId: 'join', productId: 'joiner', placement: pose(0, 0, 0), roles: { a: 'left', b: 'right' } },
  ],
  sequence: ['left', 'right', 'turned', 'join'],
};

test('instances of the same product get distinct item keys', () => {
  const r = resolveComposite(combo, products());
  const keys = r.items.map((i) => i.key);
  expect(new Set(keys).size).toBe(keys.length);
  expect(keys).toEqual(expect.arrayContaining(['left/side-left', 'right/side-left']));
});

test('an instance placed 1000 mm along x has its items shifted by 1000 mm', () => {
  const r = resolveComposite(combo, products());
  const at = (k: string) => r.items.find((i) => i.key === k)!.final.position;
  expect(at('right/side-left')[0]! - at('left/side-left')[0]!).toBe(1000);
});

test('a turned instance has its panels rotated and moved by its placement', () => {
  const r = resolveComposite(combo, products());
  const side = r.items.find((i) => i.key === 'turned/side-left')!;
  expect(side.final.position).toEqual([0, 800, 0]);
  expect(side.final.rotation).toEqual([0, 0, -90]);
});

test('role references resolve to the mapped instance panels', () => {
  const r = resolveComposite(combo, products());
  const step = r.steps.find((s) => s.instanceId === 'join')!;
  const xs = step.moves.map((m) => m.to.position[0]);
  expect(xs).toEqual([7.5, 1007.5]);
});

test('steps follow the sequence, each tagged with its instance and numbered from 1', () => {
  const r = resolveComposite(combo, products());
  expect(r.steps.map((s) => s.instanceId)).toEqual(['left', 'right', 'turned', 'join']);
  expect(r.steps.map((s) => s.index)).toEqual([1, 2, 3, 4]);
});

test('a sequence entry "<instance>@<n>" takes one step of an instance, so steps can interleave', () => {
  const p = products();
  const joiner = p.get('joiner')!;
  joiner.steps.push({ ...joiner.steps[0]!, index: 2, actions: [joiner.steps[0]!.actions[1]!] });
  joiner.steps[0]!.actions = [joiner.steps[0]!.actions[0]!];
  joiner.hardware[0]!.quantity = 2;
  const r = resolveComposite({ ...combo, sequence: ['left', 'join@1', 'right', 'turned', 'join@2'] }, p);
  expect(r.steps.map((s) => s.instanceId)).toEqual(['left', 'join', 'right', 'turned', 'join']);
});
