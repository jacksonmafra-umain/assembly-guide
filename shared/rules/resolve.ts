import type { Dir, HardwareKind, Pose, Product, Vec3 } from '../schema';
import { holePositions, type Transform } from './holes';

export type { Transform } from './holes';

export type ResolvedItem = { key: string; kind: 'panel' | HardwareKind; size?: Vec3; label: string; final: Transform };
export type Move = { itemKey: string; from: Transform; to: Transform; delay: number; duration: number };
export type ResolvedStep = {
  index: number;
  text: string;
  sourcePages: number[];
  uses: { label: string; partNumber?: string; quantity: number }[];
  moves: Move[];
  assemblyPose: Transform;
  instanceId?: string;
};
export type ResolvedProduct = { id: string; items: ResolvedItem[]; steps: ResolvedStep[] };

export const PANEL_TRAVEL_MM = 400;
export const HARDWARE_TRAVEL_MM = 120;
export const PANEL_STAGGER_S = 0.3;
export const HARDWARE_STAGGER_S = 0.08;
export const PANEL_DURATION_S = 0.9;
export const HARDWARE_DURATION_S = 0.4;
export const CAM_TURN_DEG = 180;

export const IDENTITY: Transform = { position: [0, 0, 0], rotation: [0, 0, 0] };

export const KIND_LABEL: Record<HardwareKind, string> = {
  'dowel': 'Dowel', 'cam-lock': 'Cam lock', 'cam-screw': 'Cam screw', 'wood-screw': 'Screw', 'nail': 'Nail',
  'shelf-pin': 'Shelf pin', 'corner-fitting': 'Corner fitting', 'wall-bracket': 'Wall bracket', 'connector': 'Connector',
};

const poseToTransform = (p: Pose): Transform => ({
  position: [p.position.x, p.position.y, p.position.z],
  rotation: [p.rotation.x, p.rotation.y, p.rotation.z],
});

function offset(t: Transform, dir: Dir, mm: number): Transform {
  const axis = { x: 0, y: 1, z: 2 }[dir[1] as 'x' | 'y' | 'z'];
  const position = [...t.position] as Transform['position'];
  position[axis] = position[axis]! + (dir[0] === '+' ? mm : -mm);
  return { position, rotation: [...t.rotation] };
}

export function resolveProduct(p: Product): ResolvedProduct {
  const poses = new Map<string, Pose>();
  for (const a of p.steps.flatMap((s) => s.actions)) if (a.type === 'place-panel') poses.set(a.panelId, a.pose);

  const items: ResolvedItem[] = [];
  const counters = new Map<string, number>();
  let assemblyPose = IDENTITY;

  const steps = p.steps.map((step): ResolvedStep => {
    const moves: Move[] = [];
    const uses: ResolvedStep['uses'] = [];
    const placements = step.actions.filter((a) => a.type === 'place-panel');
    placements.forEach((a, i) => {
      const panel = p.panels.find((x) => x.id === a.panelId)!;
      const final = poseToTransform(a.pose);
      items.push({ key: panel.id, kind: 'panel', size: panel.size, label: panel.name, final });
      moves.push({ itemKey: panel.id, from: offset(final, a.from, PANEL_TRAVEL_MM), to: final, delay: i * PANEL_STAGGER_S, duration: PANEL_DURATION_S });
      uses.push({ label: panel.name, quantity: 1 });
    });

    let t = placements.length ? (placements.length - 1) * PANEL_STAGGER_S + PANEL_DURATION_S : 0;
    let first = true;
    for (const a of step.actions) {
      if (a.type === 'reorient') assemblyPose = poseToTransform(a.pose);
      if (a.type !== 'insert-hardware') continue;
      const panel = p.panels.find((x) => x.id === a.target.panelId)!;
      const pose = poses.get(panel.id) ?? { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } };
      const finals = holePositions({ panel, pose, face: a.target.face, kind: a.kind, count: a.count, offsetsMm: a.target.offsetsMm, acrossMm: a.target.acrossMm });
      for (const final of finals) {
        const n = (counters.get(a.partNumber) ?? 0) + 1;
        counters.set(a.partNumber, n);
        const key = `${a.partNumber}#${n}`;
        items.push({ key, kind: a.kind, label: KIND_LABEL[a.kind], final });
        const from = offset(final, a.from, HARDWARE_TRAVEL_MM);
        if (a.kind === 'cam-lock') from.rotation[2] -= CAM_TURN_DEG;
        if (!first) t += HARDWARE_STAGGER_S;
        first = false;
        moves.push({ itemKey: key, from, to: final, delay: Math.round(t * 1000) / 1000, duration: HARDWARE_DURATION_S });
      }
      const use = uses.find((u) => u.partNumber === a.partNumber);
      if (use) use.quantity += a.count;
      else uses.push({ label: KIND_LABEL[a.kind], partNumber: a.partNumber, quantity: a.count });
    }
    return { index: step.index, text: step.text, sourcePages: step.sourcePages, uses, moves, assemblyPose };
  });

  return { id: p.id, items, steps };
}
