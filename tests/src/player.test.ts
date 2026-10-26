import { expect, test } from 'vitest';
import { createPlayer } from '../../src/player';

function setup(steps = 3) {
  let clock = 0;
  const frames: [number, number][] = [];
  const player = createPlayer({ steps, stepDuration: () => 1, render: (s, t) => frames.push([s, t]), now: () => clock });
  const advance = (ms: number) => { clock += ms; player.tick(); };
  return { player, frames, advance };
}

test('starts paused on step 1', () => {
  const { player } = setup();
  expect(player.step).toBe(1);
  expect(player.playing).toBe(false);
});

test('play advances to the next step after the step duration plus 0.8 s', () => {
  const { player, advance } = setup();
  player.play();
  advance(1700);
  expect(player.step).toBe(1);
  advance(200);
  expect(player.step).toBe(2);
});

test('play stops at the last step', () => {
  const { player, advance } = setup(2);
  player.play();
  for (let i = 0; i < 10; i++) advance(1000);
  expect(player.step).toBe(2);
  expect(player.playing).toBe(false);
});

test('next mid-step lands on t = 0 of the next step and keeps playing', () => {
  const { player, frames, advance } = setup();
  player.play();
  advance(500);
  player.next();
  expect(player.step).toBe(2);
  expect(player.playing).toBe(true);
  expect(frames.at(-1)).toEqual([2, 0]);
});

test('prev on step 1 stays on step 1', () => {
  const { player } = setup();
  player.prev();
  expect(player.step).toBe(1);
});

test('goTo clamps out-of-range steps', () => {
  const { player } = setup();
  player.goTo(50);
  expect(player.step).toBe(3);
  player.goTo(-2);
  expect(player.step).toBe(1);
});

test('render receives increasing t within a step while playing', () => {
  const { player, frames, advance } = setup();
  player.play();
  advance(100); advance(100); advance(100);
  const ts = frames.filter(([s]) => s === 1).map(([, t]) => t);
  expect(ts).toEqual([...ts].sort((a, b) => a - b));
  expect(ts.at(-1)).toBeCloseTo(0.3);
});

test('pause freezes time and play resumes from the same point', () => {
  const { player, frames, advance } = setup();
  player.play();
  advance(400);
  player.pause();
  advance(5000);
  expect(frames.at(-1)![1]).toBeCloseTo(0.4);
  player.play();
  advance(100);
  expect(frames.at(-1)![1]).toBeCloseTo(0.5);
});

test('play on a finished last step restarts that step', () => {
  const { player, frames, advance } = setup(1);
  player.play();
  advance(5000);
  player.play();
  expect(frames.at(-1)).toEqual([1, 0]);
});

test('onChange fires on step and play state changes', () => {
  const { player } = setup();
  let n = 0;
  player.onChange(() => n++);
  player.play(); player.next(); player.pause();
  expect(n).toBe(3);
});
