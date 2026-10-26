import { CatalogEntrySchema, parseProduct, type CatalogEntry, type Product } from '@shared/schema';
import { resolveProduct, type ResolvedProduct } from '@shared/rules/resolve';
import { z } from 'zod';
import catalogJson from '../data/catalog.json';

export type AppData = {
  catalog: CatalogEntry[];
  products: Map<string, Product>;
  resolved: Map<string, ResolvedProduct>;
  /** Product id → why it could not be loaded. */
  errors: Map<string, string>;
};

/** Parses and resolves product JSON keyed by file path; a broken file is reported, never thrown. */
export function loadFrom(modules: Record<string, unknown>, catalog: CatalogEntry[]): AppData {
  const data: AppData = { catalog, products: new Map(), resolved: new Map(), errors: new Map() };
  for (const [path, json] of Object.entries(modules)) {
    const id = path.split('/').pop()!.replace(/\.json$/, '');
    try {
      const product = parseProduct(json, path);
      data.products.set(id, product);
      data.resolved.set(id, resolveProduct(product));
    } catch (e) {
      data.errors.set(id, e instanceof Error ? e.message : String(e));
    }
  }
  return data;
}

export function loadData(): AppData {
  const modules = import.meta.glob('/data/products/*.json', { eager: true, import: 'default' });
  return loadFrom(modules, z.array(CatalogEntrySchema).parse(catalogJson));
}
