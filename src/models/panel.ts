import * as THREE from 'three';
import type { Vec3 } from '@shared/schema';

/** A panel box in mm, origin at its minimum corner (product frame). Material is set by the stage. */
export function makePanel(size: Vec3): THREE.Mesh {
  const geo = new THREE.BoxGeometry(size.x, size.y, size.z).translate(size.x / 2, size.y / 2, size.z / 2);
  return new THREE.Mesh(geo);
}
