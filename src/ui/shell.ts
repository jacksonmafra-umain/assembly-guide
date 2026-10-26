import type { AppData } from '../data';
import type { Route, Tab } from '../router';
import { formatRoute } from '../router';
import { esc } from './context';

const TAB_LABELS: [Tab, string][] = [['showroom', 'Showroom'], ['assembly', 'Assembly'], ['how', 'How it was made']];

export type Shell = { view: HTMLElement; controls: HTMLElement; update(r: Route): void };

/** Header with tabs, product list, view area and footer. */
export function renderShell(root: HTMLElement, data: AppData): Shell {
  root.innerHTML = `
    <div class="app">
      <header class="top">
        <div class="brand"><i></i>Assembly Lab</div>
        <nav class="tabs" aria-label="Sections"></nav>
        <div class="controls"></div>
      </header>
      <div class="body">
        <aside class="products"><p class="label">Products</p><ul></ul></aside>
        <main class="view"></main>
      </div>
      <footer class="foot">
        <span>Generated from IKEA assembly PDFs · internal demo</span>
        <a href="https://iso-glow.vercel.app" target="_blank" rel="noopener">Made with ISO-GLOW ↗</a>
      </footer>
    </div>`;
  const tabs = root.querySelector('.tabs')!, list = root.querySelector('.products ul')!;
  const available = (id: string) => data.resolved.has(id);

  return {
    view: root.querySelector('.view')!,
    controls: root.querySelector('.controls')!,
    update(r) {
      tabs.innerHTML = TAB_LABELS.map(([tab, label]) =>
        `<a href="${formatRoute({ ...r, tab, step: 1 })}"${tab === r.tab ? ' aria-current="page"' : ''}>${label}</a>`).join('');
      list.innerHTML = data.catalog.map((e) => {
        const error = data.errors.get(e.id);
        const ok = available(e.id);
        const note = ok ? (e.kind === 'composite' ? 'combination' : 'unit') : error ? 'data error' : 'not extracted yet';
        return `<li><a href="${formatRoute({ ...r, productId: e.id, step: 1 })}" class="${ok ? '' : 'unavailable'}"
          ${e.id === r.productId ? 'aria-current="page"' : ''} ${error ? `title="${esc(error)}"` : ''}>
          ${esc(e.name)}<small>${note}</small></a></li>`;
      }).join('');
    },
  };
}
