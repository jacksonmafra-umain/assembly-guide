import type { Face, HardwareKind, Panel, Pose, Vec3 } from '../schema';

/** Millimetres and degrees, in the product frame. */
export type Transform = { position: [number, number, number]; rotation: [number, number, number] };

/** Distance of the outermost holes from the ends of a face (the 32 mm system's front inset). */
export const END_INSET_MM = 37;

type V = [number, number, number];
const AXIS = { x: 0, y: 1, z: 2 } as const;

const clean = (n: number) => {
  const r = Math.round(n * 1e6) / 1e6;
  return Object.is(r, -0) ? 0 : r;
};

/** Rotates v by Euler angles in degrees, XYZ order (same convention as three.js). */
export function rotate(v: V, r: Vec3): V {
  const [cx, sx] = [Math.cos((r.x * Math.PI) / 180), Math.sin((r.x * Math.PI) / 180)];
  const [cy, sy] = [Math.cos((r.y * Math.PI) / 180), Math.sin((r.y * Math.PI) / 180)];
  const [cz, sz] = [Math.cos((r.z * Math.PI) / 180), Math.sin((r.z * Math.PI) / 180)];
  // R = Rx * Ry * Rz
  let [x, y, z] = v;
  [x, y] = [x * cz - y * sz, x * sz + y * cz];
  [x, z] = [x * cy + z * sy, -x * sy + z * cy];
  [y, z] = [y * cx - z * sx, y * sx + z * cx];
  return [clean(x), clean(y), clean(z)];
}

/** Axis-aligned bounds of a panel after its pose (rotations are multiples of 90 degrees). */
export function panelBounds(panel: Panel, pose: Pose): { min: V; max: V } {
  const { x: w, y: d, z: h } = panel.size;
  const min: V = [Infinity, Infinity, Infinity];
  const max: V = [-Infinity, -Infinity, -Infinity];
  for (const c of [[0, 0, 0], [w, 0, 0], [0, d, 0], [0, 0, h], [w, d, 0], [w, 0, h], [0, d, h], [w, d, h]] as V[]) {
    const p = rotate(c, pose.rotation);
    const world: V = [p[0] + pose.position.x, p[1] + pose.position.y, p[2] + pose.position.z];
    for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i]!, world[i]!); max[i] = Math.max(max[i]!, world[i]!); }
  }
  return { min, max };
}

/** Rotation that turns a part modelled along +z (pointing out of its seat) to point out of `face`. */
export const FACE_ROTATION: Record<Face, [number, number, number]> = {
  '+z': [0, 0, 0], '-z': [180, 0, 0],
  '+x': [0, 90, 0], '-x': [0, -90, 0],
  '+y': [-90, 0, 0], '-y': [90, 0, 0],
};

export function holePositions(args: {
  panel: Panel;
  pose: Pose;
  face: Face;
  kind: HardwareKind;
  count: number;
  offsetsMm?: number[];
  acrossMm?: number;
}): Transform[] {
  const { panel, pose, face, count, offsetsMm, acrossMm } = args;
  const { min, max } = panelBounds(panel, pose);
  const normal = AXIS[face[1] as 'x' | 'y' | 'z'];
  const plane = face[0] === '+' ? max[normal]! : min[normal]!;
  const inPlane = ([0, 1, 2] as const).filter((a) => a !== normal);
  const span = (a: number) => max[a]! - min[a]!;
  const [along, across] = span(inPlane[0]!) >= span(inPlane[1]!) ? inPlane : [inPlane[1]!, inPlane[0]!];

  const length = span(along!);
  const offsets = offsetsMm ?? (count === 1
    ? [length / 2]
    : Array.from({ length: count }, (_, i) => END_INSET_MM + (i * (length - 2 * END_INSET_MM)) / (count - 1)));
  const acrossAt = min[across!]! + (acrossMm ?? span(across!) / 2);

  return offsets.map((o) => {
    const p: V = [0, 0, 0];
    p[normal] = plane;
    p[along!] = min[along!]! + o;
    p[across!] = acrossAt;
    return { position: p.map(clean) as V, rotation: [...FACE_ROTATION[face]] as V };
  });
}
