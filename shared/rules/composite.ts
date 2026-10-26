import type { Action, Composite, Dir, Pose, Product, Vec3 } from '../schema';
import { rotate } from './holes';
import { resolveProduct, type ResolvedProduct } from './resolve';

type M = number[]; // 3x3, row-major
const RAD = Math.PI / 180;
const clean = (n: number) => { const r = Math.round(n * 1e6) / 1e6; return Object.is(r, -0) ? 0 : r; };

/** Rotation matrix for Euler degrees, XYZ order (R = Rx * Ry * Rz, as three.js). */
function matrix(r: Vec3): M {
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(r.x * RAD), Math.sin(r.x * RAD), Math.cos(r.y * RAD), Math.sin(r.y * RAD), Math.cos(r.z * RAD), Math.sin(r.z * RAD)];
  return [
    cy * cz, -cy * sz, sy,
    cx * sz + sx * sy * cz, cx * cz - sx * sy * sz, -sx * cy,
    sx * sz - cx * sy * cz, sx * cz + cx * sy * sz, cx * cy,
  ];
}
const mul = (a: M, b: M): M => Array.from({ length: 9 }, (_, i) => {
  const r = Math.floor(i / 3), c = i % 3;
  return a[r * 3]! * b[c]! + a[r * 3 + 1]! * b[3 + c]! + a[r * 3 + 2]! * b[6 + c]!;
});
function euler(m: M): Vec3 {
  const y = Math.asin(Math.min(1, Math.max(-1, m[2]!)));
  const [x, z] = Math.abs(m[2]!) < 0.9999999 ? [Math.atan2(-m[5]!, m[8]!), Math.atan2(-m[1]!, m[0]!)] : [Math.atan2(m[7]!, m[4]!), 0];
  return { x: clean(x / RAD), y: clean(y / RAD), z: clean(z / RAD) };
}

/** Places a pose given in an instance's frame into the composite frame. */
function placePose(p: Pose, at: Pose): Pose {
  const [x, y, z] = rotate([p.position.x, p.position.y, p.position.z], at.rotation);
  return {
    position: { x: clean(x + at.position.x), y: clean(y + at.position.y), z: clean(z + at.position.z) },
    rotation: euler(mul(matrix(at.rotation), matrix(p.rotation))),
  };
}

/** Turns an axis direction ("+x" ...) by a placement rotation. */
function placeDir(d: Dir, at: Pose): Dir {
  const v: [number, number, number] = [0, 0, 0];
  v['xyz'.indexOf(d[1]!)] = d[0] === '+' ? 1 : -1;
  const r = rotate(v, at.rotation);
  const i = r.map(Math.abs).indexOf(Math.max(...r.map(Math.abs)));
  return `${r[i]! > 0 ? '+' : '-'}${'xyz'[i]}` as Dir;
}

/**
 * Merges the products of a composite into one product in the composite frame, then resolves it.
 * Panel ids become "<instance>/<panel>"; a joining product's "<role>:<panel>" references point at the
 * instance its component maps that role to. Steps follow `sequence`, each tagged with its instance.
 */
export function resolveComposite(c: Composite, products: Map<string, Product>): ResolvedProduct {
  const merged: Product = {
    id: c.id, name: c.name, dimensionsMm: { x: 0, y: 0, z: 0 },
    materials: { panelThickness: 15, backThickness: 3 }, panels: [], hardware: [], steps: [], source: { pdf: '' },
  };
  const owner: string[] = [];
  for (const instanceId of c.sequence) {
    const comp = c.components.find((x) => x.instanceId === instanceId);
    const p = comp && products.get(comp.productId);
    if (!comp || !p) throw new Error(`${c.id}: no product for instance "${instanceId}"`);
    const at = comp.placement;
    const panelRef = (id: string) => {
      if (!id.includes(':')) return `${instanceId}/${id}`;
      const [role, panel] = id.split(':') as [string, string];
      const host = comp.roles?.[role];
      if (!host) throw new Error(`${c.id}: instance "${instanceId}" maps no role "${role}"`);
      return `${host}/${panel}`;
    };
    merged.materials = p.materials;
    merged.panels.push(...p.panels.map((x) => ({ ...x, id: `${instanceId}/${x.id}` })));
    for (const h of p.hardware) {
      const line = merged.hardware.find((x) => x.partNumber === h.partNumber);
      if (line) line.quantity += h.quantity; else merged.hardware.push({ ...h });
    }
    for (const step of p.steps) {
      const actions = step.actions.map((a): Action => {
        if (a.type === 'place-panel') return { ...a, panelId: panelRef(a.panelId), pose: placePose(a.pose, at), from: placeDir(a.from, at) };
        if (a.type === 'insert-hardware') {
          return { ...a, from: placeDir(a.from, at), target: { ...a.target, panelId: panelRef(a.target.panelId), face: placeDir(a.target.face, at) } };
        }
        return { ...a, pose: placePose(a.pose, at) };
      });
      merged.steps.push({ ...step, index: merged.steps.length + 1, text: `${p.name} (${instanceId}) · ${step.text}`, actions });
      owner.push(instanceId);
    }
  }
  const r = resolveProduct(merged);
  r.steps.forEach((s, i) => { s.instanceId = owner[i]; });
  return r;
}
