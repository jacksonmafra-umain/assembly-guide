import * as THREE from 'three';
import type { ResolvedProduct, Transform } from '@shared/rules/resolve';
import type { Stage } from '../stage/stage';
import type { SceneState } from '../timeline';
import { makeHardware } from './hardware';
import { makePanel } from './panel';

const DEG = Math.PI / 180;

export function applyTransform(o: THREE.Object3D, t: Transform): void {
  o.position.set(...t.position);
  o.rotation.set(t.rotation[0] * DEG, t.rotation[1] * DEG, t.rotation[2] * DEG);
}

/**
 * One object per item key, placed at its final transform, all under one assembly group in the stage's
 * product frame. The assembly group carries the step's assembly pose.
 */
export function buildScene(stage: Stage, r: ResolvedProduct): Map<string, THREE.Object3D> {
  const assembly = new THREE.Group();
  assembly.name = `assembly:${r.id}`;
  stage.root.add(assembly);
  const objects = new Map<string, THREE.Object3D>();
  for (const item of r.items) {
    let obj: THREE.Object3D;
    if (item.kind === 'panel') {
      obj = makePanel(item.size!);
      stage.addMesh(obj as THREE.Mesh, assembly);
    } else {
      obj = makeHardware(item.kind);
      const parts = [...obj.children] as THREE.Mesh[];
      assembly.add(obj);
      for (const m of parts) stage.addMesh(m, obj);
    }
    obj.name = item.key;
    applyTransform(obj, item.final);
    objects.set(item.key, obj);
  }
  stage.finalizeLines();
  return objects;
}

export function applyState(objects: Map<string, THREE.Object3D>, s: SceneState, stage: Stage): void {
  let assembly: THREE.Object3D | null = null;
  for (const [key, obj] of objects) {
    assembly ??= obj.parent;
    obj.visible = s.visible.has(key);
    const t = s.transforms.get(key);
    if (t) applyTransform(obj, t);
    stage.setLive(obj, s.live.has(key));
  }
  if (assembly) applyTransform(assembly, s.assemblyPose);
}

/** Removes a scene built by buildScene. */
export function disposeScene(objects: Map<string, THREE.Object3D>): void {
  const first = objects.values().next().value as THREE.Object3D | undefined;
  const assembly = first?.parent;
  assembly?.traverse((o) => { if (o instanceof THREE.Mesh && !o.userData.outline) o.geometry.dispose(); });
  assembly?.removeFromParent();
}
