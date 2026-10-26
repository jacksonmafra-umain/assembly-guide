// Dev-only page (/stage-demo.html): a side panel and a shelf on the iso-glow stage,
// or every hardware model side by side with ?hardware.
import * as THREE from 'three';
import { HardwareKindSchema } from '@shared/schema';
import { makeHardware } from '../models/hardware';
import './stage.css';
import { mountControls } from './controls';
import { createStage } from './stage';

const stage = createStage(document.getElementById('stage')!);
mountControls(document.getElementById('ctl')!, stage);
const toggle = document.getElementById('live')!;

if (new URLSearchParams(location.search).has('hardware')) {
  const groups = HardwareKindSchema.options.map((kind, i) => {
    const g = makeHardware(kind);
    const parts = [...g.children] as THREE.Mesh[];
    g.position.set(i * 60, 0, 0);
    stage.root.add(g);
    for (const m of parts) stage.addMesh(m, g);
    return g;
  });
  stage.finalizeLines();
  stage.scene.updateMatrixWorld(true);
  stage.frame(new THREE.Box3().setFromObject(stage.root), false);
  let live = false;
  toggle.addEventListener('click', () => { live = !live; groups.forEach((g) => stage.setLive(g, live)); });
} else {
  const box = (w: number, d: number, h: number) => new THREE.BoxGeometry(w, d, h).translate(w / 2, d / 2, h / 2);
  const side = new THREE.Mesh(box(15, 280, 2020));
  const shelf = new THREE.Mesh(box(300, 280, 15));
  shelf.position.set(15, 0, 1000);
  stage.addMesh(side);
  stage.addMesh(shelf);
  stage.finalizeLines();
  stage.setLive(shelf, true);
  stage.scene.updateMatrixWorld(true);
  stage.frame(new THREE.Box3().setFromObject(stage.root), false);
  let live = true;
  toggle.addEventListener('click', () => { live = !live; stage.setLive(shelf, live); });
}
