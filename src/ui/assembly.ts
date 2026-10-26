import * as THREE from 'three';
import type { ResolvedProduct } from '@shared/rules/resolve';
import { applyState, buildScene, disposeScene } from '../models/build';
import { createPlayer } from '../player';
import { formatRoute, type Route } from '../router';
import { sceneStateAt, stepDuration } from '../timeline';
import { esc, type AppContext } from './context';

/** Smallest box the camera frames for a step, mm; keeps tiny hardware readable without losing its context. */
const MIN_FOCUS_MM = 450;

/** Box around everything that moves in a step (start and end positions), in the product frame (mm). */
export function stepFocusBox(r: ResolvedProduct, stepIndex: number): THREE.Box3 {
  const box = new THREE.Box3();
  const step = r.steps[stepIndex - 1];
  for (const m of step?.moves ?? []) {
    const size = r.items.find((i) => i.key === m.itemKey)?.size;
    for (const t of [m.from, m.to]) {
      const p = new THREE.Vector3(...t.position);
      box.expandByPoint(p);
      if (size) box.expandByPoint(p.clone().add(new THREE.Vector3(size.x, size.y, size.z)));
    }
  }
  const s = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  return box.setFromCenterAndSize(c, new THREE.Vector3(Math.max(s.x, MIN_FOCUS_MM), Math.max(s.y, MIN_FOCUS_MM), Math.max(s.z, MIN_FOCUS_MM)));
}

export function renderAssembly(host: HTMLElement, ctx: AppContext, route: Route): () => void {
  const entry = ctx.data.catalog.find((e) => e.id === route.productId);
  const r = ctx.data.resolved.get(route.productId);
  if (!entry || !r || r.steps.length === 0) {
    host.innerHTML = `<section class="assembly"><div class="stage-slot"><div class="stage-empty"><div><p class="label">Assembly</p>
      ${esc(entry?.name ?? 'This product')} has no assembly data yet.</div></div></div></section>`;
    return () => {};
  }

  host.innerHTML = `
    <section class="assembly">
      <div class="stepbar">
        <div class="transport">
          <button class="button" data-act="prev" aria-label="Previous step (←)">◀</button>
          <button class="button primary" data-act="play" aria-label="Play (space)">▶ Play</button>
          <button class="button" data-act="next" aria-label="Next step (→)">▶▶</button>
        </div>
        <div class="counter" aria-live="polite"></div>
        <div class="ticks" role="tablist" aria-label="Steps">${r.steps.map((s) =>
          `<button role="tab" data-step="${s.index}" title="Step ${s.index}"></button>`).join('')}</div>
      </div>
      <div class="stage-slot"></div>
      <div class="panel step-info">
        <h2></h2>
        <p class="text"></p>
        <p class="label">Parts in this step</p>
        <ul class="uses"></ul>
      </div>
    </section>`;

  const slot = host.querySelector<HTMLElement>('.stage-slot')!;
  slot.append(ctx.stageHost);
  const objects = buildScene(ctx.stage, r);
  applyState(objects, sceneStateAt(r, 0, 0), ctx.stage);
  ctx.stage.scene.updateMatrixWorld(true);
  ctx.stage.frame(new THREE.Box3().setFromObject(ctx.stage.root), false);

  const player = createPlayer({
    steps: r.steps.length,
    stepDuration: (i) => stepDuration(r, i),
    render: (step, t) => applyState(objects, sceneStateAt(r, step, t), ctx.stage),
  });

  const playBtn = host.querySelector<HTMLButtonElement>('[data-act="play"]')!;
  const counter = host.querySelector('.counter')!, title = host.querySelector('.step-info h2')!;
  const text = host.querySelector('.step-info .text')!, uses = host.querySelector('.step-info .uses')!;
  const assembly = objects.values().next().value!.parent!;
  let framedStep = 0;
  function sync() {
    const step = r!.steps[player.step - 1]!;
    if (framedStep !== player.step) {
      framedStep = player.step;
      ctx.stage.scene.updateMatrixWorld(true);
      ctx.stage.frame(stepFocusBox(r!, player.step).applyMatrix4(assembly.matrixWorld), true);
    }
    counter.textContent = `Step ${player.step} / ${r!.steps.length}`;
    title.textContent = `Step ${player.step}`;
    text.textContent = step.text;
    uses.innerHTML = step.uses.map((u) =>
      `<li><span>${esc(u.label)}${u.partNumber ? ` <small>${esc(u.partNumber)}</small>` : ''}</span><span>× ${u.quantity}</span></li>`).join('');
    playBtn.textContent = player.playing ? '❚❚ Pause' : '▶ Play';
    playBtn.setAttribute('aria-label', player.playing ? 'Pause (space)' : 'Play (space)');
    host.querySelectorAll<HTMLButtonElement>('.ticks button').forEach((b) => {
      const i = Number(b.dataset.step);
      b.setAttribute('aria-selected', String(i === player.step));
      b.classList.toggle('done', i < player.step);
    });
    history.replaceState(null, '', formatRoute({ ...route, step: player.step }));
  }
  const offChange = player.onChange(sync);
  player.goTo(route.step);

  host.querySelector('.stepbar')!.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!b) return;
    if (b.dataset.step) player.goTo(Number(b.dataset.step));
    else if (b.dataset.act === 'prev') player.prev();
    else if (b.dataset.act === 'next') player.next();
    else if (b.dataset.act === 'play') (player.playing ? player.pause() : player.play());
    b.blur();
  });
  const onKey = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement).closest('input, textarea')) return;
    if (e.key === 'ArrowLeft') player.prev();
    else if (e.key === 'ArrowRight') player.next();
    else if (e.key === ' ') (player.playing ? player.pause() : player.play());
    else return;
    e.preventDefault();
  };
  addEventListener('keydown', onKey);
  const offTick = ctx.stage.onTick(() => player.tick());

  return () => { offTick(); offChange(); removeEventListener('keydown', onKey); disposeScene(objects); };
}
