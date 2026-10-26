import { IDENTITY, type ResolvedProduct, type Transform } from '@shared/rules/resolve';

export type SceneState = {
  visible: Set<string>;
  live: Set<string>;
  transforms: Map<string, Transform>;
  assemblyPose: Transform;
};

const easeInOutCubic = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
const lerp3 = (a: Transform['position'], b: Transform['position'], k: number) =>
  a.map((v, i) => v + (b[i]! - v) * k) as Transform['position'];

/** Length of a step in seconds: when its last move ends. */
export const stepDuration = (r: ResolvedProduct, stepIndex: number) =>
  Math.max(0, ...(r.steps[stepIndex - 1]?.moves ?? []).map((m) => m.delay + m.duration));

/**
 * The scene at time `t` (seconds) into step `stepIndex` (1-based). Pure: depends only on its arguments.
 * Step 0 is the fully assembled product with nothing live.
 */
export function sceneStateAt(r: ResolvedProduct, stepIndex: number, t: number): SceneState {
  const n = r.steps.length;
  const step = stepIndex <= 0 ? 0 : Math.min(Math.max(1, Math.floor(stepIndex)), n);
  const time = Math.max(0, t);
  const s: SceneState = { visible: new Set(), live: new Set(), transforms: new Map(), assemblyPose: IDENTITY };

  if (step === 0) {
    for (const i of r.items) { s.visible.add(i.key); s.transforms.set(i.key, i.final); }
    return s;
  }
  for (const prev of r.steps.slice(0, step - 1)) {
    for (const m of prev.moves) { s.visible.add(m.itemKey); s.transforms.set(m.itemKey, m.to); }
  }
  const current = r.steps[step - 1]!;
  s.assemblyPose = current.assemblyPose;
  for (const m of current.moves) {
    if (time < m.delay) continue;
    const k = Math.min(1, (time - m.delay) / m.duration);
    const e = easeInOutCubic(k);
    s.visible.add(m.itemKey);
    s.transforms.set(m.itemKey, { position: lerp3(m.from.position, m.to.position, e), rotation: lerp3(m.from.rotation, m.to.rotation, e) });
    if (k < 1) s.live.add(m.itemKey);
  }
  return s;
}
