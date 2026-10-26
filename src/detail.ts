import * as THREE from 'three';
import type { Move, ResolvedProduct } from '@shared/rules/resolve';

/** Smallest box the camera frames for one part, mm. */
export const DETAIL_MIN_MM = 260;
/** Playback speed of the detail replay (1 = real time). */
export const DETAIL_SPEED = 0.35;
/** Seconds of step time the seated pose is held before the replay loops. */
const DETAIL_HOLD_S = 0.6;

/** Keys of the items moving in a step for a part number (hardware) or a panel id, in order. */
export function detailKeys(r: ResolvedProduct, stepIndex: number, ref: string): string[] {
  return (r.steps[stepIndex - 1]?.moves ?? [])
    .map((m) => m.itemKey)
    .filter((k) => k === ref || k.startsWith(`${ref}#`));
}

export type DetailTarget = { move: Move; box: THREE.Box3; label: string };

/** What to frame and replay for one item in a step (product frame, mm); null when it does not move there. */
export function detailTarget(r: ResolvedProduct, stepIndex: number, key: string): DetailTarget | null {
  const move = r.steps[stepIndex - 1]?.moves.find((m) => m.itemKey === key);
  const item = r.items.find((i) => i.key === key);
  if (!move || !item) return null;
  const box = new THREE.Box3();
  for (const t of [move.from, move.to]) {
    const p = new THREE.Vector3(...t.position);
    box.expandByPoint(p);
    if (item.size) box.expandByPoint(p.clone().add(new THREE.Vector3(item.size.x, item.size.y, item.size.z)));
  }
  const s = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  box.setFromCenterAndSize(c, new THREE.Vector3(Math.max(s.x, DETAIL_MIN_MM), Math.max(s.y, DETAIL_MIN_MM), Math.max(s.z, DETAIL_MIN_MM)));
  const part = key.includes('#') ? ` ${key.split('#')[0]}` : '';
  return { move, box, label: `${item.label}${part}` };
}

/** Step time to show `elapsed` seconds into a slow, looping replay of one move. */
export function detailTime(move: Move, elapsed: number): number {
  const loop = move.duration + DETAIL_HOLD_S;
  const t = (Math.max(0, elapsed) * DETAIL_SPEED) % loop;
  return move.delay + Math.min(t, move.duration);
}
