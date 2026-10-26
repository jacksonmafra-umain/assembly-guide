// Dev-only page (/stage-demo.html): a side panel and a shelf on the iso-glow stage.
import * as THREE from 'three';
import './stage.css';
import { mountControls } from './controls';
import { createStage } from './stage';

const stage = createStage(document.getElementById('stage')!);
mountControls(document.getElementById('ctl')!, stage);

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
document.getElementById('live')!.addEventListener('click', () => { live = !live; stage.setLive(shelf, live); });
