import { expect, test } from 'vitest';
import { parseProduct } from '@shared/schema';
import { resolveProduct } from '@shared/rules/resolve';
import { DETAIL_MIN_MM, DETAIL_SPEED, detailKeys, detailTarget, detailTime } from '../../src/detail';
import { minimalProduct } from '../fixtures';

function product() {
  const p = minimalProduct();
  p.steps[0].actions.push({ type: 'insert-hardware', partNumber: '101339', kind: 'dowel', count: 2, target: { panelId: 'side-left', face: '+z' }, from: '+z' });
  return resolveProduct(parseProduct(p, 'x.json'));
}

test('detailKeys lists the items of one part moving in a step, in order', () => {
  expect(detailKeys(product(), 1, '101339')).toEqual(['101339#1', '101339#2']);
  expect(detailKeys(product(), 1, 'side-left')).toEqual(['side-left']);
  expect(detailKeys(product(), 1, 'nope')).toEqual([]);
});

test('detailTarget frames the part from where it starts to where it seats, at least DETAIL_MIN_MM wide', () => {
  const t = detailTarget(product(), 1, '101339#1')!;
  expect(t.move.itemKey).toBe('101339#1');
  expect(t.label).toBe('Dowel 101339');
  // seat at (7.5, 37, 2020), starts 120 mm above
  expect(t.box.containsPoint(t.box.min.clone().set(7.5, 37, 2020))).toBe(true);
  expect(t.box.containsPoint(t.box.min.clone().set(7.5, 37, 2140))).toBe(true);
  const size = t.box.getSize(t.box.min.clone());
  expect(Math.min(size.x, size.y, size.z)).toBeGreaterThanOrEqual(DETAIL_MIN_MM);
});

test('detailTarget is null for an item that does not move in that step', () => {
  expect(detailTarget(product(), 1, 'ghost')).toBeNull();
});

test('detailTime starts at the move delay and replays it slowly in a loop', () => {
  const { move } = detailTarget(product(), 1, '101339#2')!;
  expect(detailTime(move, 0)).toBe(move.delay);
  const halfway = (move.duration / 2) / DETAIL_SPEED;
  expect(detailTime(move, halfway)).toBeCloseTo(move.delay + move.duration / 2);
  const loop = (move.duration + 0.6) / DETAIL_SPEED;
  expect(detailTime(move, loop + 0.01)).toBeCloseTo(move.delay + 0.01 * DETAIL_SPEED);
});

test('detailTime holds the seated pose at the end of each loop', () => {
  const { move } = detailTarget(product(), 1, '101339#1')!;
  const holding = (move.duration + 0.3) / DETAIL_SPEED;
  expect(detailTime(move, holding)).toBe(move.delay + move.duration);
});
