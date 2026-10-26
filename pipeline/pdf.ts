import { PDFDocument } from 'pdf-lib';

/** Splits a PDF into one single-page PDF per page, in page order. */
export async function splitPdf(bytes: Uint8Array): Promise<Uint8Array[]> {
  const src = await PDFDocument.load(bytes);
  const out: Uint8Array[] = [];
  for (const i of src.getPageIndices()) {
    const doc = await PDFDocument.create();
    const [page] = await doc.copyPages(src, [i]);
    doc.addPage(page!);
    out.push(await doc.save());
  }
  return out;
}
