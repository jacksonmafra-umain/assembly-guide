import type { Action } from '@shared/schema';

export const placeAction = {
  type: 'place-panel',
  panelId: 'side-left',
  pose: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
  from: '-x',
} satisfies Action;

// One side panel 15x280x2020, one dowel line, one step placing the panel.
// Returned as a plain mutable object so tests can break it.
export function minimalProduct(): any {
  return {
    id: 'billy-80',
    name: 'BILLY bookcase 80 cm',
    dimensionsMm: { x: 800, y: 280, z: 2020 },
    materials: { panelThickness: 15, backThickness: 3 },
    panels: [{ id: 'side-left', name: 'Left side', role: 'side', size: { x: 15, y: 280, z: 2020 } }],
    hardware: [{ partNumber: '101339', kind: 'dowel', quantity: 2 }],
    steps: [{ index: 1, sourcePages: [4], text: 'Place the left side.', actions: [structuredClone(placeAction)] }],
    source: { pdf: '/pdfs/billy-bookcase-white__AA-2289108-3-100.pdf' },
  };
}
