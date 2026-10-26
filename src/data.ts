import { CatalogEntrySchema, CompositeSchema, parseProduct, type CatalogEntry, type Composite, type Product } from '@shared/schema';
import { resolveComposite } from '@shared/rules/composite';
import { resolveProduct, type ResolvedProduct } from '@shared/rules/resolve';
import { z } from 'zod';
import catalogJson from '../data/catalog.json';

export type AppData = {
  catalog: CatalogEntry[];
  products: Map<string, Product>;
  composites: Map<string, Composite>;
  resolved: Map<string, ResolvedProduct>;
  /** Product id → why it could not be loaded. */
  errors: Map<string, string>;
};

const idOf = (path: string) => path.split('/').pop()!.replace(/\.json$/, '');

/**
 * Parses and resolves product and composite JSON keyed by file path; a broken file is reported, never thrown.
 * Joining products (with roles, e.g. corner hardware) are only shown inside their composite.
 */
export function loadFrom(modules: Record<string, unknown>, catalog: CatalogEntry[], composites: Record<string, unknown> = {}): AppData {
  const data: AppData = { catalog, products: new Map(), composites: new Map(), resolved: new Map(), errors: new Map() };
  for (const [path, json] of Object.entries(modules)) {
    const id = idOf(path);
    try {
      const product = parseProduct(json, path);
      data.products.set(id, product);
      if (product.roles) data.errors.set(id, 'Joins other units: shown inside the corner combination.');
      else data.resolved.set(id, resolveProduct(product));
    } catch (e) {
      data.errors.set(id, e instanceof Error ? e.message : String(e));
    }
  }
  for (const [path, json] of Object.entries(composites)) {
    const id = idOf(path);
    try {
      const composite = CompositeSchema.parse(json);
      data.composites.set(id, composite);
      data.resolved.set(id, resolveComposite(composite, data.products));
    } catch (e) {
      data.errors.set(id, e instanceof Error ? e.message : String(e));
    }
  }
  return data;
}

export function loadData(): AppData {
  const modules = import.meta.glob('/data/products/*.json', { eager: true, import: 'default' });
  const composites = import.meta.glob('/data/composites/*.json', { eager: true, import: 'default' });
  return loadFrom(modules, z.array(CatalogEntrySchema).parse(catalogJson), composites);
}
