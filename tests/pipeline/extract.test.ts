import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { parseProduct } from '@shared/schema';
import type { StructuredCall } from '../../pipeline/claude';
import { extractProduct } from '../../pipeline/extract';
import { minimalProduct } from '../fixtures';

const pdf = readFileSync('public/pdfs/billy-bookcase-white__AA-2289108-3-100.pdf');

function fakeCall() {
  const base = minimalProduct();
  const calls: { prompt: string; pdfCount: number }[] = [];
  const call: StructuredCall = async ({ prompt, pdfs }) => {
    calls.push({ prompt, pdfCount: pdfs.length });
    if (calls.length === 1) {
      return {
        materials: base.materials,
        panels: base.panels,
        hardware: base.hardware,
        stepPages: [{ index: 1, pages: [4] }, { index: 2, pages: [5, 6] }],
      } as never;
    }
    const index = calls.length - 1;
    return { ...base.steps[0], index, sourcePages: [] } as never;
  };
  return { call, calls };
}

test('extractProduct makes one inventory call plus one call per step', async () => {
  const { call, calls } = fakeCall();
  await extractProduct({ id: 'billy-80', name: 'BILLY', pdf, pdfPath: '/pdfs/x.pdf', dimensionsMm: { x: 800, y: 280, z: 2020 }, call });
  expect(calls).toHaveLength(3);
  expect(calls[0]!.pdfCount).toBe(1);
});

test('extractProduct sends only the step pages to each step call', async () => {
  const { call, calls } = fakeCall();
  await extractProduct({ id: 'billy-80', name: 'BILLY', pdf, pdfPath: '/pdfs/x.pdf', dimensionsMm: { x: 800, y: 280, z: 2020 }, call });
  expect(calls[1]!.pdfCount).toBe(1);
  expect(calls[2]!.pdfCount).toBe(2);
});

test('extractProduct returns a valid product with source pages from the inventory', async () => {
  const { call } = fakeCall();
  const p = await extractProduct({ id: 'billy-80', name: 'BILLY', pdf, pdfPath: '/pdfs/x.pdf', dimensionsMm: { x: 800, y: 280, z: 2020 }, call });
  expect(() => parseProduct(p, 'extracted')).not.toThrow();
  expect(p.steps.map((s) => s.sourcePages)).toEqual([[4], [5, 6]]);
  expect(p.source.pdf).toBe('/pdfs/x.pdf');
});
