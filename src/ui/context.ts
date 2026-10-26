import type { AppData } from '../data';
import type { Route } from '../router';
import type { Stage } from '../stage/stage';

export type AppContext = {
  data: AppData;
  stage: Stage;
  /** The element that holds the stage canvas; views move it into their own slot. */
  stageHost: HTMLElement;
  go(r: Partial<Route>): void;
};

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
