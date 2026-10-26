import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// Crease lines that stay continuous (ported from the iso-glow 3D shell): an edge sharper than the threshold
// starts a line, which is then followed through softer neighbouring edges as long as it keeps going straight.
// Tiny isolated fragments are dropped.

type Edge = { a: number; b: number; ang: number; dir: THREE.Vector3; len: number };
type Crease = { p: THREE.BufferAttribute; edges: Edge[]; byVert: Map<number, number[]> };

function creaseInfo(geo: THREE.BufferGeometry): Crease {
  if (geo.userData.crease) return geo.userData.crease as Crease;
  const src = new THREE.BufferGeometry().setAttribute('position', geo.attributes.position!);
  if (geo.index) src.setIndex(geo.index);
  const g = mergeVertices(src, 1e-4);
  const p = g.attributes.position as THREE.BufferAttribute, ix = g.index!.array, nV = p.count;
  const P = (i: number) => new THREE.Vector3().fromBufferAttribute(p, i);
  const faceN: (THREE.Vector3 | null)[] = [], edgeFaces = new Map<number, number[]>();
  for (let f = 0; f < ix.length / 3; f++) {
    const a = ix[3 * f]!, b = ix[3 * f + 1]!, c = ix[3 * f + 2]!;
    const n = new THREE.Vector3().crossVectors(P(b).sub(P(a)), P(c).sub(P(a)));
    faceN.push(n.lengthSq() > 1e-14 ? n.normalize() : null);
    for (const [u, v] of [[a, b], [b, c], [c, a]] as const) {
      if (u === v) continue;
      const k = Math.min(u, v) * nV + Math.max(u, v);
      (edgeFaces.get(k) ?? edgeFaces.set(k, []).get(k)!).push(f);
    }
  }
  const edges: Edge[] = [];
  for (const [k, fs] of edgeFaces) {
    const a = Math.floor(k / nV), b = k % nV;
    const ns = fs.map((f) => faceN[f]).filter((n): n is THREE.Vector3 => !!n);
    let ang = 180;
    if (ns.length >= 2) { ang = 0; for (let i = 1; i < ns.length; i++) ang = Math.max(ang, THREE.MathUtils.radToDeg(ns[0]!.angleTo(ns[i]!))); }
    else if (ns.length === 0) continue;
    const dir = P(b).sub(P(a)), len = dir.length();
    if (len > 0) edges.push({ a, b, ang, dir: dir.divideScalar(len), len });
  }
  const byVert = new Map<number, number[]>();
  edges.forEach((e, i) => { for (const v of [e.a, e.b]) (byVert.get(v) ?? byVert.set(v, []).get(v)!).push(i); });
  return (geo.userData.crease = { p, edges, byVert });
}

const GROW = 0.55, STRAIGHT = 0.9;

/** Segment positions (pairs of points) for creases sharper than `thr` degrees; fragments shorter than `minLen` are dropped. */
export function creaseLines(geo: THREE.BufferGeometry, thr: number, minLen: number): number[] {
  const { p, edges, byVert } = creaseInfo(geo), low = thr * GROW;
  const on = new Uint8Array(edges.length), queue: number[] = [];
  edges.forEach((e, i) => { if (e.ang >= thr) { on[i] = 1; queue.push(i); } });
  while (queue.length) {
    const i = queue.pop()!, e = edges[i]!;
    for (const [v, out] of [[e.a, -1], [e.b, 1]] as const) {
      for (const j of byVert.get(v) ?? []) {
        if (on[j]) continue; const f = edges[j]!; if (f.ang < low) continue;
        const d = f.dir.dot(e.dir) * (f.a === v ? 1 : -1) * out;
        if (d > STRAIGHT) { on[j] = 1; queue.push(j); }
      }
    }
  }
  const parent = new Map<number, number>();
  const find = (x: number): number => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x)!)!); x = parent.get(x)!; } return x; };
  edges.forEach((e, i) => { if (!on[i]) return; for (const v of [e.a, e.b]) if (!parent.has(v)) parent.set(v, v); parent.set(find(e.a), find(e.b)); });
  const total = new Map<number, number>();
  edges.forEach((e, i) => { if (on[i]) { const r = find(e.a); total.set(r, (total.get(r) ?? 0) + e.len); } });
  const out: number[] = [];
  edges.forEach((e, i) => { if (on[i] && (total.get(find(e.a)) ?? 0) >= minLen) out.push(p.getX(e.a), p.getY(e.a), p.getZ(e.a), p.getX(e.b), p.getY(e.b), p.getZ(e.b)); });
  return out;
}
