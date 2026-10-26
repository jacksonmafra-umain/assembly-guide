import { expect, test } from 'vitest';
import { parseProduct } from '@shared/schema';
import { resolveProduct } from '@shared/rules/resolve';
import { stepFocusBox } from '../../src/ui/assembly';
import { minimalProduct } from '../fixtures';

test('a panel step frames the panel from where it starts to where it lands', () => {
  const r = resolveProduct(parseProduct(minimalProduct(), 'x.json'));
  const box = stepFocusBox(r, 1);
  // side 15x280x2020 at the origin, coming 400 mm from -x; x and y padded to 450 mm
  expect(box.min.toArray()).toEqual([-417.5, -85, 0]);
  expect(box.max.toArray()).toEqual([32.5, 365, 2020]);
});

test('a hardware-only step is padded to at least 450 mm around the parts', () => {
  const p = minimalProduct();
  p.steps.push({ index: 2, sourcePages: [5], text: 'Dowels.', actions: [
    { type: 'insert-hardware', partNumber: '101339', kind: 'dowel', count: 2, target: { panelId: 'side-left', face: '+z' }, from: '+z' },
  ] });
  const box = stepFocusBox(resolveProduct(parseProduct(p, 'x.json')), 2);
  const size = box.getSize(box.min.clone());
  expect(size.toArray().every((n) => n >= 450)).toBe(true);
  expect(box.containsPoint(box.min.clone().set(7.5, 37, 2020))).toBe(true);
});
