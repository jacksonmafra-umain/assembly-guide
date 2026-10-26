import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { expect, test } from 'vitest';
import { splitPdf } from '../../pipeline/pdf';

test('splitPdf returns one single-page PDF per page of the 80 cm manual', async () => {
  const bytes = readFileSync('public/pdfs/billy-bookcase-white__AA-2289108-3-100.pdf');
  const pages = await splitPdf(bytes);
  expect(pages).toHaveLength(16);
  const first = await PDFDocument.load(pages[0]!);
  expect(first.getPageCount()).toBe(1);
});
