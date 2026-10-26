import * as THREE from 'three';
import type { ResolvedProduct } from '@shared/rules/resolve';
import { applyState, buildScene, disposeScene } from '../models/build';
import { detailKeys, detailTarget, detailTime } from '../detail';
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
      <div class="stage-slot">
        <div class="detail-bar" hidden>
          <span class="label">Detail</span><b class="detail-name"></b><span class="detail-count"></span>
          <button class="button" data-d="prev" aria-label="Previous part">‹</button>
          <button class="button" data-d="next" aria-label="Next part">›</button>
          <button class="button primary" data-d="close">✕ Back to step</button>
        </div>
      </div>
      <div class="panel step-info">
        <h2></h2>
        <p class="text"></p>
        <p class="label">Parts in this step · click one, or click a part in 3D, to zoom in</p>
        <ul class="uses"></ul>
      </div>
    </section>`;

  const slot = host.querySelector<HTMLElement>('.stage-slot')!;
  slot.append(ctx.stageHost);
  const objects = buildScene(ctx.stage, r);
  applyState(objects, sceneStateAt(r, 0, 0), ctx.stage);
  ctx.stage.scene.updateMatrixWorld(true);
  ctx.stage.frame(new THREE.Box3().setFromObject(ctx.stage.root), false, true);

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
    // ?capture&wide (video recording): keep the whole product in frame instead of following each step
    if (framedStep !== player.step && !new URLSearchParams(location.search).has('wide')) {
      framedStep = player.step;
      ctx.stage.scene.updateMatrixWorld(true);
      ctx.stage.frame(stepFocusBox(r!, player.step).applyMatrix4(assembly.matrixWorld), true);
    }
    counter.textContent = `Step ${player.step} / ${r!.steps.length}`;
    title.textContent = `Step ${player.step}`;
    text.textContent = step.text;
    uses.innerHTML = step.uses.map((u) =>
      `<li><button data-ref="${esc(u.ref)}" title="Zoom in on ${esc(u.label)}"><span>🔍 ${esc(u.label)}${u.partNumber ? ` <small>${esc(u.partNumber)}</small>` : ''}</span><span>× ${u.quantity}</span></button></li>`).join('');
    playBtn.textContent = player.playing ? '❚❚ Pause' : '▶ Play';
    playBtn.setAttribute('aria-label', player.playing ? 'Pause (space)' : 'Play (space)');
    host.querySelectorAll<HTMLButtonElement>('.ticks button').forEach((b) => {
      const i = Number(b.dataset.step);
      b.setAttribute('aria-selected', String(i === player.step));
      b.classList.toggle('done', i < player.step);
    });
    history.replaceState(null, '', formatRoute({ ...route, step: player.step }));
  }
  const offChange = player.onChange(() => { if (detail) exitDetail(false); sync(); });

  // ── detail: zoom in on one part and replay its fit slowly ──
  const bar = host.querySelector<HTMLElement>('.detail-bar')!;
  let detail: { keys: string[]; index: number; start: number } | null = null;
  function showDetail() {
    if (!detail) return;
    const target = detailTarget(r!, player.step, detail.keys[detail.index]!);
    if (!target) return;
    detail.start = performance.now();
    bar.hidden = false;
    bar.querySelector('.detail-name')!.textContent = target.label;
    bar.querySelector('.detail-count')!.textContent = detail.keys.length > 1 ? `${detail.index + 1} / ${detail.keys.length}` : '';
    bar.querySelectorAll<HTMLButtonElement>('[data-d="prev"], [data-d="next"]').forEach((b) => { b.hidden = detail!.keys.length < 2; });
    ctx.stage.scene.updateMatrixWorld(true);
    // look from the iso corner, swung towards the side the part comes in from
    const approach = new THREE.Vector3(...target.move.from.position).sub(new THREE.Vector3(...target.move.to.position))
      .transformDirection(assembly.matrixWorld);
    const dir = new THREE.Vector3(1, 1, 1).normalize().addScaledVector(approach, 1.2).normalize();
    ctx.stage.frame(target.box.clone().applyMatrix4(assembly.matrixWorld), true, false, dir);
  }
  function enterDetail(keys: string[], index = 0) {
    if (!keys.length) return;
    player.pause();
    detail = { keys, index, start: performance.now() };
    showDetail();
  }
  function exitDetail(reframe = true) {
    detail = null;
    bar.hidden = true;
    if (reframe) { framedStep = 0; sync(); }
  }
  function renderDetail(now: number) {
    const key = detail!.keys[detail!.index]!;
    const target = detailTarget(r!, player.step, key)!;
    const state = sceneStateAt(r!, player.step, detailTime(target.move, (now - detail!.start) / 1000));
    state.live = new Set([key]); // the part stays lit for the whole replay
    applyState(objects, state, ctx.stage);
  }
  bar.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!b || !detail) return;
    if (b.dataset.d === 'close') exitDetail();
    else {
      const n = detail.keys.length;
      detail.index = (detail.index + (b.dataset.d === 'next' ? 1 : n - 1)) % n;
      showDetail();
    }
    b.blur();
  });
  uses.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-ref]');
    if (!b) return;
    enterDetail(detailKeys(r!, player.step, b.dataset.ref!));
    b.blur();
  });
  // a click (not a drag) on a part in 3D zooms in on it
  let down: [number, number] | null = null;
  const onDown = (e: PointerEvent) => { down = [e.clientX, e.clientY]; };
  const onUp = (e: PointerEvent) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
    let o = ctx.stage.pick(e.clientX, e.clientY);
    while (o && !objects.has(o.name)) o = o.parent;
    if (!o) return;
    const key = o.name, ref = key.split('#')[0]!;
    const keys = detailKeys(r!, player.step, ref);
    if (keys.includes(key)) enterDetail(keys, keys.indexOf(key));
  };
  ctx.stageHost.addEventListener('pointerdown', onDown);
  ctx.stageHost.addEventListener('pointerup', onUp);
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
    if (e.key === 'Escape' && detail) exitDetail();
    else if (e.key === 'ArrowLeft') player.prev();
    else if (e.key === 'ArrowRight') player.next();
    else if (e.key === ' ') (player.playing ? player.pause() : player.play());
    else return;
    e.preventDefault();
  };
  addEventListener('keydown', onKey);
  const offTick = ctx.stage.onTick((now) => (detail ? renderDetail(now) : player.tick()));

  return () => {
    offTick(); offChange(); removeEventListener('keydown', onKey);
    ctx.stageHost.removeEventListener('pointerdown', onDown); ctx.stageHost.removeEventListener('pointerup', onUp);
    disposeScene(objects);
  };
}
