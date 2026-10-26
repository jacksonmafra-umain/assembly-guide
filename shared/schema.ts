import { z } from 'zod';

// Units: millimetres. Product frame: origin at the back-left-bottom corner of the
// assembled product, +x along the width, +y towards the front, +z up. Degrees, XYZ order.

export const Vec3Schema = z.object({ x: z.number(), y: z.number(), z: z.number() });
export type Vec3 = z.infer<typeof Vec3Schema>;

export const PoseSchema = z.object({ position: Vec3Schema, rotation: Vec3Schema });
export type Pose = z.infer<typeof PoseSchema>;

const axes = ['+x', '-x', '+y', '-y', '+z', '-z'] as const;
export const DirSchema = z.enum(axes);
export type Dir = z.infer<typeof DirSchema>;

/** A panel face, named by its outward normal in the product frame after placement. */
export const FaceSchema = z.enum(axes);
export type Face = z.infer<typeof FaceSchema>;

export const PanelRoleSchema = z.enum([
  'side', 'top', 'bottom', 'shelf', 'fixed-shelf', 'back', 'plinth', 'rail', 'other',
]);
export type PanelRole = z.infer<typeof PanelRoleSchema>;

export const HardwareKindSchema = z.enum([
  'dowel', 'cam-lock', 'cam-screw', 'wood-screw', 'nail', 'shelf-pin', 'corner-fitting', 'wall-bracket', 'connector',
]);
export type HardwareKind = z.infer<typeof HardwareKindSchema>;

export const PanelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: PanelRoleSchema,
  /** Size in the assembled orientation, mm. */
  size: Vec3Schema,
});
export type Panel = z.infer<typeof PanelSchema>;

export const HardwareLineSchema = z.object({
  partNumber: z.string().min(1),
  kind: HardwareKindSchema,
  quantity: z.number().int().positive(),
});
export type HardwareLine = z.infer<typeof HardwareLineSchema>;

export const PlacePanelSchema = z.object({
  type: z.literal('place-panel'),
  panelId: z.string(),
  pose: PoseSchema,
  from: DirSchema,
});

export const InsertHardwareSchema = z.object({
  type: z.literal('insert-hardware'),
  partNumber: z.string(),
  kind: HardwareKindSchema,
  count: z.number().int().positive(),
  target: z.object({
    panelId: z.string(),
    face: FaceSchema,
    offsetsMm: z.array(z.number()).optional(),
    acrossMm: z.number().optional(),
  }),
  from: DirSchema,
});

/** Re-poses the whole assembly, e.g. lying on its back, then upright. */
export const ReorientSchema = z.object({ type: z.literal('reorient'), pose: PoseSchema });

export const ActionSchema = z.discriminatedUnion('type', [PlacePanelSchema, InsertHardwareSchema, ReorientSchema]);
export type Action = z.infer<typeof ActionSchema>;

export const StepSchema = z.object({
  index: z.number().int().positive(),
  sourcePages: z.array(z.number().int().positive()),
  text: z.string().min(1),
  actions: z.array(ActionSchema),
});
export type Step = z.infer<typeof StepSchema>;

export const ProductSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  dimensionsMm: Vec3Schema,
  materials: z.object({ panelThickness: z.number().positive(), backThickness: z.number().positive() }),
  panels: z.array(PanelSchema),
  hardware: z.array(HardwareLineSchema),
  steps: z.array(StepSchema),
  source: z.object({ pdf: z.string() }),
});
export type Product = z.infer<typeof ProductSchema>;

export const CompositeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  components: z.array(z.object({
    instanceId: z.string().min(1),
    productId: z.string().min(1),
    placement: PoseSchema,
    roles: z.record(z.string(), z.string()).optional(),
  })),
  sequence: z.array(z.string()),
});
export type Composite = z.infer<typeof CompositeSchema>;

export const CatalogEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  articleNumbers: z.array(z.string()),
  kind: z.enum(['unit', 'composite']),
  dimensionsIn: z.object({ w: z.number(), d: z.number(), h: z.number() }).nullable(),
  photos: z.array(z.string()),
  pdf: z.string().nullable(),
  productUrl: z.string().url(),
});
export type CatalogEntry = z.infer<typeof CatalogEntrySchema>;

function pathString(path: readonly PropertyKey[]): string {
  return path.map((k, i) => (typeof k === 'number' ? `[${k}]` : `${i ? '.' : ''}${String(k)}`)).join('');
}

/** Zod parse plus cross-reference checks. Throws with the file name and offending path. */
export function parseProduct(json: unknown, file: string): Product {
  const res = ProductSchema.safeParse(json);
  if (!res.success) {
    const issue = res.error.issues[0]!;
    throw new Error(`${file}: ${pathString(issue.path)}: ${issue.message}`);
  }
  const p = res.data;
  const fail = (path: string, msg: string): never => { throw new Error(`${file}: ${path}: ${msg}`); };
  const panelIds = new Set(p.panels.map((x) => x.id));
  const parts = new Set(p.hardware.map((h) => h.partNumber));
  p.steps.forEach((step, i) => {
    const at = `steps[${i}]`;
    if (step.index !== i + 1) fail(`${at}.index`, `expected ${i + 1}, got ${step.index}`);
    if (step.actions.length === 0) fail(`${at}.actions`, 'step has no actions');
    step.actions.forEach((a, j) => {
      const aAt = `${at}.actions[${j}]`;
      if (a.type === 'place-panel' && !panelIds.has(a.panelId)) fail(`${aAt}.panelId`, `unknown panel "${a.panelId}"`);
      if (a.type === 'insert-hardware') {
        if (!parts.has(a.partNumber)) fail(`${aAt}.partNumber`, `unknown part "${a.partNumber}"`);
        if (!panelIds.has(a.target.panelId)) fail(`${aAt}.target.panelId`, `unknown panel "${a.target.panelId}"`);
      }
    });
  });
  return p;
}
