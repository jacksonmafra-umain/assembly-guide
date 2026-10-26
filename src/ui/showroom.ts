import * as THREE from 'three';
import { applyState, buildScene, disposeScene } from '../models/build';
import type { Route } from '../router';
import { sceneStateAt } from '../timeline';
import { esc, type AppContext } from './context';

const inches = (n: number) => `${n} in`;
const cm = (n: number) => `${Math.round(n * 2.54)} cm`;

/** Mounts the stage into `slot` and shows product `id` fully assembled. Returns a cleanup. */
export function showAssembled(slot: HTMLElement, ctx: AppContext, id: string): () => void {
  const r = ctx.data.resolved.get(id);
  if (!r) {
    const error = ctx.data.errors.get(id);
    slot.innerHTML = `<div class="stage-empty"><div><p class="label">3D model</p>${error ? `This product's data has an error:<br><small>${esc(error)}</small>` : 'Not extracted yet.'}</div></div>`;
    return () => {};
  }
  slot.append(ctx.stageHost);
  const objects = buildScene(ctx.stage, r);
  applyState(objects, sceneStateAt(r, 0, 0), ctx.stage);
  ctx.stage.scene.updateMatrixWorld(true);
  ctx.stage.frame(new THREE.Box3().setFromObject(ctx.stage.root), false);
  return () => disposeScene(objects);
}

export function renderShowroom(host: HTMLElement, ctx: AppContext, route: Route): () => void {
  const entry = ctx.data.catalog.find((e) => e.id === route.productId);
  if (!entry) { host.innerHTML = '<p>No products in the catalog.</p>'; return () => {}; }
  const d = entry.dimensionsIn;
  const ready = ctx.data.resolved.has(entry.id);
  const steps = ctx.data.resolved.get(entry.id)?.steps.length ?? 0;
  host.innerHTML = `
    <section class="showroom">
      <div class="gallery">
        <div class="main"><img alt="${esc(entry.name)}" src="${entry.photos[0] ?? ''}"></div>
        <div class="thumbs">${entry.photos.map((p, i) =>
          `<button aria-pressed="${i === 0}" data-src="${p}" aria-label="Photo ${i + 1}"><img alt="" src="${p}" loading="lazy"></button>`).join('')}</div>
      </div>
      <div class="stage-slot"></div>
      <div class="facts">
        <div class="panel">
          <h2>${esc(entry.name)}</h2>
          <dl>
            <dt>Article</dt><dd>${entry.articleNumbers.map(esc).join(', ')}</dd>
            ${d ? `<dt>Size</dt><dd>${inches(d.w)} × ${inches(d.d)} × ${inches(d.h)} (${cm(d.w)} × ${cm(d.d)} × ${cm(d.h)})</dd>` : ''}
            <dt>Assembly</dt><dd>${ready ? `${steps} animated steps` : 'not available yet'}</dd>
          </dl>
          <a class="button primary" href="#/assembly/${entry.id}/1" ${ready ? '' : 'aria-disabled="true"'}>Start assembly →</a>
          <a class="button" href="${entry.productUrl}" target="_blank" rel="noopener">Product page ↗</a>
        </div>
        <div class="panel made-of" hidden></div>
      </div>
    </section>`;

  const main = host.querySelector<HTMLImageElement>('.gallery .main img')!;
  host.querySelector('.thumbs')!.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-src]');
    if (!b) return;
    main.src = b.dataset.src!;
    host.querySelectorAll('.thumbs button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  });

  return showAssembled(host.querySelector('.stage-slot')!, ctx, entry.id);
}
