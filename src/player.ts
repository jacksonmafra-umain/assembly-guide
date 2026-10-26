export type Player = {
  readonly step: number;
  readonly playing: boolean;
  play(): void;
  pause(): void;
  next(): void;
  prev(): void;
  goTo(i: number): void;
  /** Call once per animation frame. */
  tick(): void;
  onChange(fn: () => void): () => void;
};

/** Pause between the end of one step and the start of the next while playing, seconds. */
export const STEP_GAP_S = 0.8;

export function createPlayer(args: {
  steps: number;
  stepDuration: (i: number) => number;
  render: (step: number, t: number) => void;
  now?: () => number;
}): Player {
  const { steps, stepDuration, render, now = () => performance.now() } = args;
  let step = 1, playing = false;
  let elapsed = 0;            // seconds into the step when last paused or restarted
  let startedAt = 0;          // clock (ms) when playing last resumed
  const listeners = new Set<() => void>();
  const changed = () => listeners.forEach((f) => f());
  const time = () => (playing ? elapsed + (now() - startedAt) / 1000 : elapsed);

  function restart(i: number) {
    step = Math.min(Math.max(1, Math.floor(i) || 1), Math.max(1, steps));
    elapsed = 0; startedAt = now();
    render(step, 0);
  }

  const player: Player = {
    get step() { return step; },
    get playing() { return playing; },
    play() {
      if (playing) return;
      if (step === steps && elapsed >= stepDuration(step)) restart(step);
      playing = true; startedAt = now(); changed();
    },
    pause() {
      if (!playing) return;
      elapsed = time(); playing = false; changed();
    },
    next() { restart(step + 1); changed(); },
    prev() { restart(step - 1); changed(); },
    goTo(i) { restart(i); changed(); },
    tick() {
      const t = time();
      if (playing && t >= stepDuration(step) + STEP_GAP_S) {
        if (step < steps) { restart(step + 1); changed(); return; }
        elapsed = stepDuration(step); playing = false; render(step, elapsed); changed(); return;
      }
      render(step, t);
    },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
  return player;
}
