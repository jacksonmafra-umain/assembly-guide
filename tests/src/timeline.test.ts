import { expect, test } from 'vitest';
import { parseProduct } from '@shared/schema';
import { resolveProduct } from '@shared/rules/resolve';
import { sceneStateAt } from '../../src/timeline';
import { minimalProduct } from '../fixtures';

function threeSteps() {
  const p = minimalProduct();
  p.panels.push(
    { id: 'top', name: 'Top', role: 'top', size: { x: 770, y: 280, z: 15 } },
    { id: 'side-right', name: 'Right side', role: 'side', size: { x: 15, y: 280, z: 2020 } },
  );
  p.steps[0].actions.push({ type: 'insert-hardware', partNumber: '101339', kind: 'dowel', count: 2, target: { panelId: 'side-left', face: '+z' }, from: '+z' });
  const pose = (x: number, z: number) => ({ position: { x, y: 0, z }, rotation: { x: 0, y: 0, z: 0 } });
  p.steps.push(
    { index: 2, sourcePages: [5], text: 'Top.', actions: [{ type: 'place-panel', panelId: 'top', pose: pose(15, 2005), from: '+z' }] },
    { index: 3, sourcePages: [6], text: 'Right side.', actions: [{ type: 'place-panel', panelId: 'side-right', pose: pose(785, 0), from: '+x' }] },
  );
  return resolveProduct(parseProduct(p, 'x.json'));
}

test('at the start of step 2, step 1 items sit at their final pose and nothing is live', () => {
  const r = threeSteps();
  const s = sceneStateAt(r, 2, 0);
  for (const key of ['side-left', '101339#1', '101339#2']) {
    expect(s.visible.has(key)).toBe(true);
    expect(s.transforms.get(key)).toEqual(r.items.find((i) => i.key === key)!.final);
  }
  expect(s.live.has('side-left')).toBe(false);
});

test('a moving item is strictly between its from and to positions, and live', () => {
  const r = threeSteps();
  const s = sceneStateAt(r, 2, 0.45);
  const z = s.transforms.get('top')!.position[2]!;
  expect(z).toBeGreaterThan(2005);
  expect(z).toBeLessThan(2405);
  expect(s.live.has('top')).toBe(true);
});

test('an item whose delay has not come yet is hidden', () => {
  const s = sceneStateAt(threeSteps(), 1, 0.5);
  expect(s.visible.has('101339#1')).toBe(false);
});

test('after the last move ends nothing is live', () => {
  const s = sceneStateAt(threeSteps(), 1, 10);
  expect(s.live.size).toBe(0);
  expect(s.visible.has('101339#2')).toBe(true);
});

test('items of later steps are hidden', () => {
  const s = sceneStateAt(threeSteps(), 2, 10);
  expect(s.visible.has('side-right')).toBe(false);
});

test('a step past the end clamps to the last step', () => {
  const r = threeSteps();
  expect(sceneStateAt(r, 99, 0.3)).toEqual(sceneStateAt(r, 3, 0.3));
});

test('step 0 shows everything assembled with nothing live', () => {
  const r = threeSteps();
  const s = sceneStateAt(r, 0, 0);
  expect([...s.visible].sort()).toEqual(r.items.map((i) => i.key).sort());
  expect(s.live.size).toBe(0);
});

test('jumping to step 3 and then step 1 equals going to step 1 directly', () => {
  const r = threeSteps();
  sceneStateAt(r, 3, 0.5);
  expect(sceneStateAt(r, 1, 0.2)).toEqual(sceneStateAt(threeSteps(), 1, 0.2));
});

test('negative time is treated as the start of the step', () => {
  const r = threeSteps();
  expect(sceneStateAt(r, 2, -1)).toEqual(sceneStateAt(r, 2, 0));
});

test('earlier steps show an item where its latest move up to then left it', () => {
  const p = minimalProduct();
  p.panels.push({ id: 'top', name: 'Top', role: 'top', size: { x: 770, y: 280, z: 15 } });
  const pose = (y: number) => ({ position: { x: 15, y, z: 2005 }, rotation: { x: 0, y: 0, z: 0 } });
  p.steps[0].actions.push({ type: 'place-panel', panelId: 'top', pose: pose(600), from: '+z' });
  p.steps.push({ index: 2, sourcePages: [5], text: 'Fit.', actions: [{ type: 'place-panel', panelId: 'top', pose: pose(0), from: '+y' }] });
  p.steps.push({ index: 3, sourcePages: [6], text: 'Again.', actions: [{ type: 'place-panel', panelId: 'side-left', pose: p.steps[0].actions[0].pose, from: '-x' }] });
  const r = resolveProduct(parseProduct(p, 'x.json'));
  expect(sceneStateAt(r, 2, 0).transforms.get('top')!.position).toEqual([15, 600, 2005]);
  expect(sceneStateAt(r, 3, 0).transforms.get('top')!.position).toEqual([15, 0, 2005]);
});
