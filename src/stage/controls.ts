import type { Stage } from './stage';
import { ACCENTS } from './themes';

/** Theme toggle, accent swatches, Iso view and Revolve toggles, as in the iso-glow shell. */
export function mountControls(host: HTMLElement, stage: Stage): void {
  host.classList.add('stage-controls');
  host.innerHTML = `
    <div class="swatches" role="radiogroup" aria-label="Glow colour">
      ${ACCENTS.map(([n, c]) => `<button role="radio" data-accent="${n.toLowerCase()}" aria-label="${n}" title="${n}" style="--sw:${c}"><i></i></button>`).join('')}
    </div>
    <button class="pill" data-act="iso" aria-pressed="false" title="True isometric view (I)">Iso view</button>
    <button class="pill" data-act="revolve" aria-pressed="false" title="Slowly turn the camera around the object">⟳ Revolve</button>
    <button class="round" data-act="theme" title="Light / dark (T)" aria-label="Switch light or dark theme">◐</button>`;
  const sync = () => {
    host.querySelectorAll<HTMLButtonElement>('[data-accent]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.accent === stage.accent)));
    host.querySelector('[data-act="iso"]')!.setAttribute('aria-pressed', String(stage.isoView));
    host.querySelector('[data-act="revolve"]')!.setAttribute('aria-pressed', String(stage.revolve));
  };
  host.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    if (b.dataset.accent) stage.setAccent(b.dataset.accent);
    else if (b.dataset.act === 'iso') stage.setIsoView(!stage.isoView);
    else if (b.dataset.act === 'revolve') stage.setRevolve(!stage.revolve);
    else if (b.dataset.act === 'theme') stage.setTheme(stage.theme === 'dark' ? 'light' : 'dark');
    b.blur(); sync();
  });
  stage.onThemeChange(sync);
  sync();
}
