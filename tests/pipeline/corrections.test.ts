import { expect, test } from 'vitest';
import { countCorrections } from '../../pipeline/corrections';

test('countCorrections counts changed and added leaves', () => {
  expect(countCorrections({ a: 1, b: [1, 2] }, { a: 2, b: [1, 2, 3] })).toEqual({ changed: 1, added: 1, removed: 0 });
});

test('countCorrections counts removed leaves inside nested objects', () => {
  expect(countCorrections({ p: { x: 1, y: 2 } }, { p: { x: 1 } })).toEqual({ changed: 0, added: 0, removed: 1 });
});

test('countCorrections treats a replaced subtree by its leaves', () => {
  expect(countCorrections({ s: [{ t: 'a', n: 1 }] }, { s: [] })).toEqual({ changed: 0, added: 0, removed: 2 });
});

test('identical documents have no corrections', () => {
  expect(countCorrections({ a: [1, { b: 'x' }] }, { a: [1, { b: 'x' }] })).toEqual({ changed: 0, added: 0, removed: 0 });
});
