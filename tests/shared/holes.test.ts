import { expect, test } from 'vitest';
import type { Panel, Pose } from '@shared/schema';
import { holePositions } from '@shared/rules/holes';

const side: Panel = { id: 'side-left', name: 'Left side', role: 'side', size: { x: 15, y: 280, z: 2020 } };
const atOrigin: Pose = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } };
const positions = (ts: { position: number[] }[]) => ts.map((t) => t.position);

test('two dowels on the top edge sit 37 mm from each end, centred in the thickness', () => {
  const ts = holePositions({ panel: side, pose: atOrigin, face: '+z', kind: 'dowel', count: 2 });
  expect(positions(ts)).toEqual([[7.5, 37, 2020], [7.5, 243, 2020]]);
});

test('offsetsMm places parts at those distances from the low end', () => {
  const ts = holePositions({ panel: side, pose: atOrigin, face: '+z', kind: 'dowel', count: 2, offsetsMm: [100, 180] });
  expect(positions(ts)).toEqual([[7.5, 100, 2020], [7.5, 180, 2020]]);
});

test('acrossMm moves parts across the face from its low edge', () => {
  const ts = holePositions({ panel: side, pose: atOrigin, face: '+z', kind: 'dowel', count: 2, acrossMm: 5 });
  expect(ts.map((t) => t.position[0])).toEqual([5, 5]);
});

test('a single part sits in the middle of the face', () => {
  const ts = holePositions({ panel: side, pose: atOrigin, face: '+z', kind: 'dowel', count: 1 });
  expect(positions(ts)).toEqual([[7.5, 140, 2020]]);
});

test('positions follow the panel when it is rotated 90 degrees about z', () => {
  const pose: Pose = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 90 } };
  const ts = holePositions({ panel: side, pose, face: '+z', kind: 'dowel', count: 2 });
  expect(ts[0]!.position).toEqual([-243, 7.5, 2020]);
});

test('parts point into the panel: +z face keeps identity, +x face turns the axis onto x', () => {
  expect(holePositions({ panel: side, pose: atOrigin, face: '+z', kind: 'dowel', count: 1 })[0]!.rotation).toEqual([0, 0, 0]);
  expect(holePositions({ panel: side, pose: atOrigin, face: '+x', kind: 'cam-lock', count: 1 })[0]!.rotation).toEqual([0, 90, 0]);
});
