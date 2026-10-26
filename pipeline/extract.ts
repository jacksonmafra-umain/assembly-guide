import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import {
  CatalogEntrySchema, HardwareLineSchema, PanelSchema, ProductSchema, StepSchema,
  parseProduct, type Product, type Vec3,
} from '@shared/schema';
import { createClaudeCall, type StructuredCall } from './claude';
import { splitPdf } from './pdf';
import { SYSTEM, inventoryPrompt, stepPrompt } from './prompts';

export const InventorySchema = z.object({
  materials: ProductSchema.shape.materials,
  panels: z.array(PanelSchema),
  hardware: z.array(HardwareLineSchema),
  stepPages: z.array(z.object({ index: z.number().int(), pages: z.array(z.number().int()) })),
});

export async function extractProduct(args: {
  id: string;
  name: string;
  pdf: Uint8Array;
  pdfPath: string;
  dimensionsMm: Vec3;
  call: StructuredCall;
  log?: (s: string) => void;
}): Promise<Product> {
  const { id, name, pdf, pdfPath, dimensionsMm, call, log = () => {} } = args;
  log(`inventory: ${name}`);
  const inventory = await call({ schema: InventorySchema, system: SYSTEM, prompt: inventoryPrompt(name, dimensionsMm), pdfs: [pdf] });
  const pages = await splitPdf(pdf);
  const inventoryJson = JSON.stringify({ materials: inventory.materials, panels: inventory.panels, hardware: inventory.hardware });
  const steps = [];
  for (const { index, pages: stepPages } of inventory.stepPages) {
    log(`step ${index} (pages ${stepPages.join(', ')})`);
    const stepPdfs = stepPages.map((n) => pages[n - 1]).filter((p): p is Uint8Array => !!p);
    const step = await call({ schema: StepSchema, system: SYSTEM, prompt: stepPrompt(index, inventoryJson), pdfs: stepPdfs });
    steps.push({ ...step, index, sourcePages: stepPages });
  }
  return {
    id, name, dimensionsMm,
    materials: inventory.materials,
    panels: inventory.panels,
    hardware: inventory.hardware,
    steps,
    source: { pdf: pdfPath },
  };
}

const IN_TO_MM = 25.4;

async function main(argv: string[]) {
  const id = argv.find((a) => !a.startsWith('--'));
  const force = argv.includes('--force');
  if (!id) throw new Error('usage: npm run extract -- <product id> [--force]');
  const catalog = z.array(CatalogEntrySchema).parse(JSON.parse(readFileSync('data/catalog.json', 'utf8')));
  const entry = catalog.find((e) => e.id === id);
  if (!entry?.pdf) throw new Error(`no catalog entry with a pdf for "${id}"`);
  const d = entry.dimensionsIn;
  const dimensionsMm = d ? { x: Math.round(d.w * IN_TO_MM), y: Math.round(d.d * IN_TO_MM), z: Math.round(d.h * IN_TO_MM) } : { x: 0, y: 0, z: 0 };
  const product = await extractProduct({
    id, name: entry.name, pdfPath: entry.pdf, dimensionsMm,
    pdf: readFileSync(`public${entry.pdf}`),
    call: createClaudeCall(),
    log: (s) => console.log(s),
  });
  mkdirSync('data/raw', { recursive: true });
  mkdirSync('data/products', { recursive: true });
  writeFileSync(`data/raw/${id}.json`, JSON.stringify(product, null, 2) + '\n');
  console.log(`wrote data/raw/${id}.json`);
  const finalPath = `data/products/${id}.json`;
  if (existsSync(finalPath) && !force) console.log(`kept ${finalPath} (reviewed data; pass --force to overwrite)`);
  else { writeFileSync(finalPath, JSON.stringify(product, null, 2) + '\n'); console.log(`wrote ${finalPath}`); }
  try { parseProduct(product, finalPath); } catch (e) { console.warn(`not yet valid: ${(e as Error).message}`); }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
}
