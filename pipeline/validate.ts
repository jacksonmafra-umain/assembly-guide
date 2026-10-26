import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { CatalogEntrySchema, parseProduct, type Product, type Vec3 } from '@shared/schema';

export type Issue = {
  level: 'error' | 'warn';
  code: 'hardware-count' | 'dimension' | 'unused-panel' | 'unplaced-panel';
  message: string;
};

const DIMENSION_TOLERANCE_MM = 15;

export function validateProduct(p: Product, dimsMm: Vec3 | null): Issue[] {
  const issues: Issue[] = [];
  const actions = p.steps.flatMap((s) => s.actions);

  for (const line of p.hardware) {
    const used = actions.reduce((n, a) => (a.type === 'insert-hardware' && a.partNumber === line.partNumber ? n + a.count : n), 0);
    if (used !== line.quantity) {
      issues.push({ level: 'error', code: 'hardware-count', message: `part ${line.partNumber} (${line.kind}): parts list says ${line.quantity}, steps use ${used}` });
    }
  }

  const placed = new Set(actions.flatMap((a) => (a.type === 'place-panel' ? [a.panelId] : [])));
  for (const panel of p.panels) {
    if (!placed.has(panel.id)) issues.push({ level: 'error', code: 'unplaced-panel', message: `panel ${panel.id} is never placed` });
  }

  if (dimsMm) {
    const min = { x: Infinity, y: Infinity, z: Infinity };
    const max = { x: -Infinity, y: -Infinity, z: -Infinity };
    const lastPlacement = new Map(actions.flatMap((a) => (a.type === 'place-panel' ? [[a.panelId, a] as const] : [])));
    for (const a of lastPlacement.values()) {
      const size = p.panels.find((x) => x.id === a.panelId)!.size;
      for (const k of ['x', 'y', 'z'] as const) {
        min[k] = Math.min(min[k], a.pose.position[k]);
        max[k] = Math.max(max[k], a.pose.position[k] + size[k]);
      }
    }
    for (const k of ['x', 'y', 'z'] as const) {
      const got = max[k] - min[k];
      if (Number.isFinite(got) && Math.abs(got - dimsMm[k]) > DIMENSION_TOLERANCE_MM) {
        issues.push({ level: 'warn', code: 'dimension', message: `${k}: placed panels span ${Math.round(got)} mm, product is ${dimsMm[k]} mm` });
      }
    }
  }
  return issues;
}

function main(argv: string[]) {
  const id = argv[0];
  if (!id) throw new Error('usage: npm run validate -- <product id>');
  const file = `data/products/${id}.json`;
  const product = parseProduct(JSON.parse(readFileSync(file, 'utf8')), file);
  const catalog = z.array(CatalogEntrySchema).parse(JSON.parse(readFileSync('data/catalog.json', 'utf8')));
  const d = catalog.find((e) => e.id === id)?.dimensionsIn;
  const issues = validateProduct(product, d ? { x: Math.round(d.w * 25.4), y: Math.round(d.d * 25.4), z: Math.round(d.h * 25.4) } : null);
  for (const i of issues) console.log(`${i.level.padEnd(5)} ${i.code.padEnd(15)} ${i.message}`);
  console.log(issues.length ? `${issues.length} issue(s)` : 'ok');
  if (issues.some((i) => i.level === 'error')) process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try { main(process.argv.slice(2)); } catch (e) { console.error(e instanceof Error ? e.message : e); process.exit(1); }
}
