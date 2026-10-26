import * as THREE from 'three';
import corrections from '../../data/corrections.json';
import { applyState, buildScene, disposeScene } from '../models/build';
import { formatRoute, type Route } from '../router';
import { sceneStateAt, stepDuration } from '../timeline';
import { stepFocusBox } from './assembly';
import { esc, type AppContext } from './context';

type CorrectionCounts = { changed: number; added: number; removed: number; total: number };

const PIPELINE: [string, string][] = [
  ['Assembly PDF', 'The wordless IKEA manual, exactly as it ships in the box.'],
  ['Claude reads each page', 'One call lists every panel and part; then one call per step reads what goes where.'],
  ['Product JSON', 'Panels, hardware and steps with positions in millimetres, checked against the parts list and reviewed.'],
  ['3D scene', 'Shared rules place every dowel and cam lock exactly; the iso-glow stage animates each step.'],
];

async function renderPdfPage(canvas: HTMLCanvasElement, url: string, page: number): Promise<void> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ url }).promise;
  const p = await doc.getPage(Math.min(Math.max(1, page), doc.numPages));
  const base = p.getViewport({ scale: 1 });
  const scale = (canvas.parentElement!.clientWidth * devicePixelRatio) / base.width;
  const viewport = p.getViewport({ scale });
  canvas.width = viewport.width; canvas.height = viewport.height;
  await p.render({ canvas, viewport }).promise;
}

export function renderHow(host: HTMLElement, ctx: AppContext, route: Route): () => void {
  const entry = ctx.data.catalog.find((e) => e.id === route.productId);
  const r = ctx.data.resolved.get(route.productId);
  const composite = ctx.data.composites.get(route.productId);
  // a combination's step comes from the manual of the unit it builds
  const stepIndex = Math.min(route.step, r?.steps.length ?? 1);
  const instance = composite?.components.find((c) => c.instanceId === r?.steps[stepIndex - 1]?.instanceId);
  const sourceId = instance?.productId ?? route.productId;
  const product = ctx.data.products.get(sourceId);
  const pdf = product?.source.pdf || entry?.pdf;
  const all = corrections as Record<string, CorrectionCounts>;
  const counts = composite
    ? [...new Set(composite.components.map((c) => c.productId))].map((id) => all[id]).filter((c): c is CorrectionCounts => !!c)
      .reduce((a, c) => ({ changed: a.changed + c.changed, added: a.added + c.added, removed: a.removed + c.removed, total: a.total + c.total }), { changed: 0, added: 0, removed: 0, total: 0 })
    : all[route.productId];

  const strip = PIPELINE.map(([t, d], i) =>
    `<li><span class="n">${i + 1}</span><b>${t}</b><span>${d}</span></li>`).join('');
  if (!entry || !product || !r || !pdf) {
    host.innerHTML = `<section class="how"><ol class="pipeline">${strip}</ol>
      <div class="panel"><h2>${esc(entry?.name ?? 'This product')}</h2><p>Not extracted yet.</p></div></section>`;
    return () => {};
  }

  const resolvedStep = r.steps[stepIndex - 1]!;
  const step = composite
    ? product.steps.find((s) => resolvedStep.text.endsWith(` · ${s.text}`)) ?? product.steps[0]!
    : product.steps[stepIndex - 1]!;
  const page = step.sourcePages[0] ?? 1;
  host.innerHTML = `
    <section class="how">
      <ol class="pipeline">${strip}</ol>
      <div class="stepbar">
        <span class="counter">Step ${stepIndex} / ${r.steps.length}</span>
        <div class="ticks" role="tablist" aria-label="Steps">${r.steps.map((s) =>
          `<a role="tab" href="${formatRoute({ ...route, step: s.index })}" aria-selected="${s.index === stepIndex}" title="Step ${s.index}"></a>`).join('')}</div>
      </div>
      <div class="trio">
        <figure class="pane"><figcaption class="label">${composite ? `${esc(product.name)} manual` : 'Manual'} · page ${page}</figcaption><div class="page"><canvas aria-label="Manual page ${page}"></canvas></div></figure>
        <figure class="pane"><figcaption class="label">Extracted JSON · ${composite ? `${esc(product.name)} step ${step.index}` : `step ${stepIndex}`}</figcaption><pre>${esc(JSON.stringify(step, null, 2))}</pre></figure>
        <figure class="pane"><figcaption class="label">3D · step ${stepIndex}</figcaption><div class="stage-slot"></div></figure>
      </div>
      <div class="facts">
        <div class="panel">
          <h2>Hand corrections</h2>
          <p>${counts
            ? `${counts.changed + counts.added + counts.removed} of ${counts.total} fields corrected by hand (${counts.changed} changed, ${counts.added} added, ${counts.removed} removed).`
            : 'No correction count yet for this product.'}</p>
        </div>
        <div class="panel">
          <h2>Run it</h2>
          <pre>npm run extract -- ${esc(sourceId)}\nnpm run validate -- ${esc(sourceId)}\nnpm run corrections</pre>
        </div>
      </div>
    </section>`;

  const canvas = host.querySelector('canvas')!;
  renderPdfPage(canvas, pdf, page).catch((e) => { canvas.replaceWith(Object.assign(document.createElement('p'), { textContent: `Could not render the page: ${e}` })); });

  host.querySelector('.stage-slot')!.append(ctx.stageHost);
  const objects = buildScene(ctx.stage, r);
  ctx.stage.scene.updateMatrixWorld(true);
  ctx.stage.frame(stepFocusBox(r, stepIndex).applyMatrix4(objects.values().next().value!.parent!.matrixWorld), false);
  const loop = stepDuration(r, stepIndex) + 1.2;
  const start = performance.now();
  const offTick = ctx.stage.onTick((now) => applyState(objects, sceneStateAt(r, stepIndex, ((now - start) / 1000) % loop), ctx.stage));
  return () => { offTick(); disposeScene(objects); };
}
