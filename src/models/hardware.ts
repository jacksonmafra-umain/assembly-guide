import * as THREE from 'three';
import type { HardwareKind } from '@shared/schema';

// One recognisable model per hardware kind, at real scale in mm. Each part is modelled along +z with its
// origin at the seat point on the panel face: +z sticks out of the face, -z goes into the panel.

const rod = (d: number, z0: number, z1: number, segments = 16) =>
  new THREE.CylinderGeometry(d / 2, d / 2, z1 - z0, segments).rotateX(Math.PI / 2).translate(0, 0, (z0 + z1) / 2);
const block = (w: number, d: number, h: number, x = 0, y = 0, z = 0) =>
  new THREE.BoxGeometry(w, d, h).translate(x, y, z + h / 2);

const PARTS: Record<HardwareKind, () => THREE.BufferGeometry[]> = {
  // fluted wooden peg, Ø8 × 30, half in the panel
  'dowel': () => [rod(8, -15, 15, 12)],
  // Ø15 × 12 disc set into the face (its cap 1 mm proud so it reads), with a turning slot on top
  'cam-lock': () => [rod(15, -11, 1, 24), block(2, 10, 0.8, 0, 0, 1)],
  // Ø6 pin, 24 in the edge and 10 out, with a round head the cam grabs
  'cam-screw': () => [rod(6, -24, 6, 12), rod(8, 6, 10, 12)],
  // Ø4 × 30 screw with a countersunk head
  'wood-screw': () => [rod(4, -30, 0, 10), rod(8, 0, 1.5, 16)],
  // Ø1.5 × 20 nail with a flat head
  'nail': () => [rod(1.5, -20, 0, 6), rod(4, 0, 0.8, 10)],
  // Ø5 pin, 10 in the panel and 6 out
  'shelf-pin': () => [rod(5, -10, 6, 10)],
  // L-shaped bent plate, 40 × 40 × 2
  'corner-fitting': () => [block(40, 2, 40, 0, -1, -20), block(2, 40, 40, -21, 19, -20)],
  // flat plate with a raised tab
  'wall-bracket': () => [block(40, 20, 2, 0, 0, -2), block(40, 2, 18, 0, -9, 0)],
  // Ø8 × 40 connector bolt
  'connector': () => [rod(8, -20, 20, 12), rod(12, 20, 22, 16)],
  // flat washer Ø14 × 1 lying on the face
  'washer': () => [rod(14, 0, 1, 20)],
};

/** A group of meshes (materials set by the stage) for one hardware part. */
export function makeHardware(kind: HardwareKind): THREE.Group {
  const g = new THREE.Group();
  for (const geo of PARTS[kind]()) g.add(new THREE.Mesh(geo));
  g.userData.kind = kind;
  return g;
}
