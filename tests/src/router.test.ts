import { expect, test } from 'vitest';
import { formatRoute, parseRoute } from '../../src/router';

const ids = ['billy-80', 'billy-40'];

test('an unknown product falls back to the first known id', () => {
  expect(parseRoute('#/assembly/nope/3', ['billy-80'])).toEqual({ tab: 'assembly', productId: 'billy-80', step: 3 });
});

test('an empty hash is the showroom of the first product', () => {
  expect(parseRoute('', ids)).toEqual({ tab: 'showroom', productId: 'billy-80', step: 1 });
});

test('a non-numeric step becomes 1', () => {
  expect(parseRoute('#/assembly/billy-80/abc', ids).step).toBe(1);
});

test('an unknown tab becomes the showroom', () => {
  expect(parseRoute('#/nowhere/billy-40', ids)).toEqual({ tab: 'showroom', productId: 'billy-40', step: 1 });
});

test('formatRoute round-trips valid hashes', () => {
  for (const h of ['#/showroom/billy-40', '#/assembly/billy-80/4', '#/how/billy-40/2']) {
    expect(formatRoute(parseRoute(h, ids))).toBe(h);
  }
});
