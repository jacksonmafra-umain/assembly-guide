import './stage/stage.css';
import './ui/styles.css';
import { loadData } from './data';
import { formatRoute, parseRoute, type Route } from './router';
import { mountControls } from './stage/controls';
import { createStage } from './stage/stage';
import type { AppContext } from './ui/context';
import { renderShell } from './ui/shell';
import { renderShowroom } from './ui/showroom';

const data = loadData();
const ids = data.catalog.map((e) => e.id);
const shell = renderShell(document.querySelector<HTMLDivElement>('#app')!, data);

const stageHost = document.createElement('div');
stageHost.className = 'stage-host';
const stage = createStage(stageHost);
mountControls(shell.controls, stage);

let route: Route = parseRoute(location.hash, ids);
const ctx: AppContext = {
  data, stage, stageHost,
  go(r) { location.hash = formatRoute({ ...route, ...r }); },
};

const VIEWS: Record<Route['tab'], (host: HTMLElement, ctx: AppContext, r: Route) => () => void> = {
  showroom: renderShowroom,
  assembly: renderShowroom,
  how: renderShowroom,
};

let cleanup = () => {};
function show() {
  route = parseRoute(location.hash, ids);
  const canonical = formatRoute(route);
  if (location.hash !== canonical) history.replaceState(null, '', canonical);
  cleanup();
  shell.update(route);
  cleanup = VIEWS[route.tab](shell.view, ctx, route);
}
addEventListener('hashchange', show);
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement).closest('input, textarea')) return;
  if (e.key.toLowerCase() === 't') stage.setTheme(stage.theme === 'dark' ? 'light' : 'dark');
  if (e.key.toLowerCase() === 'i') stage.setIsoView(!stage.isoView);
});
show();
