import { expect, test } from 'vitest';
import { parseProduct } from '@shared/schema';
import { validateProduct } from '../../pipeline/validate';
import { minimalProduct } from '../fixtures';

function withDowels(count: number) {
  const p = minimalProduct();
  p.steps[0].actions.push({
    type: 'insert-hardware', partNumber: '101339', kind: 'dowel', count,
    target: { panelId: 'side-left', face: '+z' }, from: '+z',
  });
  return parseProduct(p, 'x.json');
}

test('hardware counts matching the parts list give no hardware issue', () => {
  expect(validateProduct(withDowels(2), null).filter((i) => i.code === 'hardware-count')).toEqual([]);
});

test('hardware count mismatch is an error naming part, expected and actual', () => {
  const issues = validateProduct(withDowels(3), null).filter((i) => i.code === 'hardware-count');
  expect(issues).toHaveLength(1);
  expect(issues[0]!.level).toBe('error');
  expect(issues[0]!.message).toMatch(/101339.*2.*3/);
});

test('bounding box off by more than 15 mm is a dimension warning', () => {
  const issues = validateProduct(withDowels(2), { x: 800, y: 280, z: 2020 });
  const dim = issues.filter((i) => i.code === 'dimension');
  expect(dim).toHaveLength(1);
  expect(dim[0]!.level).toBe('warn');
  expect(dim[0]!.message).toMatch(/x/);
});

test('bounding box within 15 mm gives no dimension warning', () => {
  expect(validateProduct(withDowels(2), { x: 20, y: 290, z: 2010 }).filter((i) => i.code === 'dimension')).toEqual([]);
});

test('a panel never placed is an unplaced-panel error', () => {
  const p = minimalProduct();
  p.panels.push({ id: 'top', name: 'Top', role: 'top', size: { x: 770, y: 280, z: 15 } });
  const issues = validateProduct(parseProduct(p, 'x.json'), null);
  expect(issues.filter((i) => i.code === 'unplaced-panel').map((i) => i.level)).toEqual(['error']);
});

test('the dimension check uses each panel where it finally ends up', () => {
  const p = minimalProduct();
  p.steps.push({ index: 2, sourcePages: [5], text: 'Move.', actions: [
    { type: 'place-panel', panelId: 'side-left', pose: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }, from: '-x' },
  ] });
  p.steps[0].actions[0].pose.position.y = 900;
  const issues = validateProduct(parseProduct(p, 'x.json'), { x: 15, y: 280, z: 2020 });
  expect(issues.filter((i) => i.code === 'dimension')).toEqual([]);
});
