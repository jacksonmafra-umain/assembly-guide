export type Tab = 'showroom' | 'assembly' | 'how';
export type Route = { tab: Tab; productId: string; step: number };

const TABS: Tab[] = ['showroom', 'assembly', 'how'];

/** `#/<tab>/<productId>[/<step>]`; anything unknown falls back to a valid route. */
export function parseRoute(hash: string, knownIds: string[]): Route {
  const [tab, id, step] = hash.replace(/^#\/?/, '').split('/');
  const n = Number.parseInt(step ?? '', 10);
  return {
    tab: TABS.includes(tab as Tab) ? (tab as Tab) : 'showroom',
    productId: id && knownIds.includes(id) ? id : (knownIds[0] ?? ''),
    step: Number.isFinite(n) && n >= 1 ? n : 1,
  };
}

export function formatRoute(r: Route): string {
  return r.tab === 'showroom' ? `#/showroom/${r.productId}` : `#/${r.tab}/${r.productId}/${r.step}`;
}
