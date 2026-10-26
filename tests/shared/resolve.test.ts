import { expect, test } from 'vitest';
import { parseProduct } from '@shared/schema';
import { resolveProduct } from '@shared/rules/resolve';
import { minimalProduct } from '../fixtures';

const top = { id: 'top', name: 'Top', role: 'top', size: { x: 770, y: 280, z: 15 } };

function twoStepProduct() {
  const p = minimalProduct();
  p.panels.push(top, { id: 'side-right', name: 'Right side', role: 'side', size: { x: 15, y: 280, z: 2020 } });
  p.steps[0].actions.push({ type: 'insert-hardware', partNumber: '101339', kind: 'dowel', count: 2, target: { panelId: 'side-left', face: '+z' }, from: '+z' });
  p.steps.push({
    index: 2, sourcePages: [5], text: 'Add the top and the right side.',
    actions: [
      { type: 'place-panel', panelId: 'top', pose: { position: { x: 15, y: 0, z: 2005 }, rotation: { x: 0, y: 0, z: 0 } }, from: '+z' },
      { type: 'place-panel', panelId: 'side-right', pose: { position: { x: 785, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }, from: '+x' },
    ],
  });
  return p;
}

test('item keys are unique and hardware keys are numbered per part', () => {
  const r = resolveProduct(parseProduct(twoStepProduct(), 'x.json'));
  const keys = r.items.map((i) => i.key);
  expect(new Set(keys).size).toBe(keys.length);
  expect(keys).toEqual(expect.arrayContaining(['side-left', 'top', 'side-right', '101339#1', '101339#2']));
});

test('every item moves in exactly one step', () => {
  const r = resolveProduct(parseProduct(twoStepProduct(), 'x.json'));
  const moved = r.steps.flatMap((s) => s.moves.map((m) => m.itemKey)).sort();
  expect(moved).toEqual(r.items.map((i) => i.key).sort());
});

test('panels in one step start 0.3 s apart and hardware follows the last panel', () => {
  const r = resolveProduct(parseProduct(twoStepProduct(), 'x.json'));
  expect(r.steps[1]!.moves.map((m) => m.delay)).toEqual([0, 0.3]);
  const step1 = r.steps[0]!.moves;
  expect(step1.map((m) => m.delay)).toEqual([0, 0.9, 0.98]);
  expect(step1.map((m) => m.duration)).toEqual([0.9, 0.4, 0.4]);
});

test('a panel coming from +z starts 400 mm above its final position', () => {
  const r = resolveProduct(parseProduct(twoStepProduct(), 'x.json'));
  const move = r.steps[1]!.moves.find((m) => m.itemKey === 'top')!;
  expect(move.to.position).toEqual([15, 0, 2005]);
  expect(move.from.position).toEqual([15, 0, 2405]);
});

test('hardware starts 120 mm away along its from direction', () => {
  const r = resolveProduct(parseProduct(twoStepProduct(), 'x.json'));
  const move = r.steps[0]!.moves.find((m) => m.itemKey === '101339#1')!;
  expect(move.from.position[2]! - move.to.position[2]!).toBe(120);
});

test('cam locks turn 180 degrees about their own axis as they seat', () => {
  const p = minimalProduct();
  p.hardware.push({ partNumber: '118331', kind: 'cam-lock', quantity: 1 });
  p.hardware[0].quantity = 0;
  p.hardware = p.hardware.filter((h: { quantity: number }) => h.quantity > 0);
  p.steps[0].actions.push({ type: 'insert-hardware', partNumber: '118331', kind: 'cam-lock', count: 1, target: { panelId: 'side-left', face: '+x' }, from: '+x' });
  const move = resolveProduct(parseProduct(p, 'x.json')).steps[0]!.moves.find((m) => m.itemKey === '118331#1')!;
  expect(move.to.rotation[2]! - move.from.rotation[2]!).toBe(180);
});

test('a reorient carries forward from its step and identity applies before it', () => {
  const p = twoStepProduct();
  p.steps[1].actions.push({ type: 'reorient', pose: { position: { x: 0, y: 0, z: 0 }, rotation: { x: -90, y: 0, z: 0 } } });
  p.steps.push({ index: 3, sourcePages: [6], text: 'Next.', actions: [{ type: 'place-panel', panelId: 'side-right', pose: p.steps[1].actions[1].pose, from: '+x' }] });
  p.steps[1].actions.splice(1, 1);
  const r = resolveProduct(parseProduct(p, 'x.json'));
  expect(r.steps.map((s) => s.assemblyPose.rotation)).toEqual([[0, 0, 0], [-90, 0, 0], [-90, 0, 0]]);
});

test('uses lists placed panels and hardware quantities for the step', () => {
  const r = resolveProduct(parseProduct(twoStepProduct(), 'x.json'));
  expect(r.steps[0]!.uses).toEqual([
    { label: 'Left side', quantity: 1 },
    { label: 'Dowel', partNumber: '101339', quantity: 2 },
  ]);
});

function stagedProduct() {
  // step 1: top laid out 600 mm in front and given 2 dowels; step 2: top moved into place
  const p = minimalProduct();
  p.panels.push(top);
  p.hardware[0].quantity = 2;
  const pose = (y: number) => ({ position: { x: 15, y, z: 2005 }, rotation: { x: 0, y: 0, z: 0 } });
  p.steps[0].actions.push(
    { type: 'place-panel', panelId: 'top', pose: pose(600), from: '+z' },
    { type: 'insert-hardware', partNumber: '101339', kind: 'dowel', count: 2, target: { panelId: 'top', face: '-x' }, from: '-x' },
  );
  p.steps.push({ index: 2, sourcePages: [5], text: 'Fit the top.', actions: [{ type: 'place-panel', panelId: 'top', pose: pose(0), from: '+y' }] });
  return resolveProduct(parseProduct(p, 'x.json'));
}

test('a panel placed again is one item that moves from its staged pose to its new pose', () => {
  const r = stagedProduct();
  expect(r.items.filter((i) => i.key === 'top')).toHaveLength(1);
  expect(r.items.find((i) => i.key === 'top')!.final.position).toEqual([15, 0, 2005]);
  const move = r.steps[1]!.moves.find((m) => m.itemKey === 'top')!;
  expect(move.from.position).toEqual([15, 600, 2005]);
  expect(move.to.position).toEqual([15, 0, 2005]);
});

test('hardware goes into a panel where the panel is at that step', () => {
  const r = stagedProduct();
  const move = r.steps[0]!.moves.find((m) => m.itemKey === '101339#1')!;
  expect(move.to.position[1]).toBe(600 + 37);
});

test('hardware in a panel moves with the panel when it is placed again', () => {
  const r = stagedProduct();
  const move = r.steps[1]!.moves.find((m) => m.itemKey === '101339#1')!;
  expect(move.from.position[1]).toBe(637);
  expect(move.to.position[1]).toBe(37);
  const panelMove = r.steps[1]!.moves.find((m) => m.itemKey === 'top')!;
  expect([move.delay, move.duration]).toEqual([panelMove.delay, panelMove.duration]);
  expect(r.items.find((i) => i.key === '101339#1')!.final.position[1]).toBe(37);
});
