import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export type Corrections = { changed: number; added: number; removed: number };

function leaves(v: unknown): number {
  if (v !== null && typeof v === 'object') return Object.values(v).reduce<number>((n, x) => n + leaves(x), 0);
  return 1;
}

/** Leaf-level JSON diff between the raw model output and the reviewed file (arrays by index). */
export function countCorrections(raw: unknown, final: unknown): Corrections {
  const out: Corrections = { changed: 0, added: 0, removed: 0 };
  const walk = (a: unknown, b: unknown) => {
    const aObj = a !== null && typeof a === 'object';
    const bObj = b !== null && typeof b === 'object';
    if (aObj && bObj) {
      const ar = a as Record<string, unknown>, br = b as Record<string, unknown>;
      for (const k of new Set([...Object.keys(ar), ...Object.keys(br)])) {
        if (!(k in br)) out.removed += leaves(ar[k]);
        else if (!(k in ar)) out.added += leaves(br[k]);
        else walk(ar[k], br[k]);
      }
    } else if (aObj !== bObj) {
      out.removed += leaves(a);
      out.added += leaves(b);
    } else if (a !== b) out.changed++;
  };
  walk(raw, final);
  return out;
}

function main() {
  const result: Record<string, Corrections & { total: number }> = {};
  for (const f of readdirSync('data/products').filter((f) => f.endsWith('.json')).sort()) {
    if (!existsSync(`data/raw/${f}`)) continue;
    const raw = JSON.parse(readFileSync(`data/raw/${f}`, 'utf8'));
    const final = JSON.parse(readFileSync(`data/products/${f}`, 'utf8'));
    result[f.replace(/\.json$/, '')] = { ...countCorrections(raw, final), total: leaves(final) };
  }
  writeFileSync('data/corrections.json', JSON.stringify(result, null, 2) + '\n');
  for (const [id, c] of Object.entries(result)) console.log(`${id}: ${c.changed} changed, ${c.added} added, ${c.removed} removed of ${c.total} fields`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
