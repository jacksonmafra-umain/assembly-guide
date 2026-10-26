// Theme tokens and accent palette, from the iso-glow 3D shell (vendor/iso-glow/gallery-3d.html).

export type ThemeName = 'dark' | 'light';

export const THEMES = {
  dark: { bg: 0x121314, body: 0x1b1c1f, line: 0x6a7076, major: 0x50555a, edge: 0x34373b,
          sky: 0xdde4ff, ground: 0x080808, hemi: 0.7, amb: 0, sun: 0.7, fill: 0.2, shadow: 0.5, fadeMin: 0.75 },
  light: { bg: 0xe9eaea, body: 0xf1f1f0, line: 0x5d6266, major: 0x8a8f93, edge: 0xb9bcbf,
           sky: 0xffffff, ground: 0xe6e6e6, hemi: 0.9, amb: 1.6, sun: 0.35, fill: 0.15, shadow: 0.12, fadeMin: 0.8 },
} as const;

export const ACCENTS: [name: string, hex: string][] = [
  ['Ember', '#ff9d3c'], ['Cyan', '#22d3ee'], ['Lime', '#a3e635'], ['Violet', '#a78bfa'], ['Rose', '#fb7185'], ['Ice', '#dfe9ef'],
];

export const accentHex = (name: string) => (ACCENTS.find(([n]) => n.toLowerCase() === name.toLowerCase()) ?? ACCENTS[0]!)[1];

const KEY = 'assembly-lab-';
export const store = (k: string, v: string) => { try { localStorage.setItem(KEY + k, v); } catch { /* storage unavailable */ } };
export const load = (k: string): string | null => { try { return localStorage.getItem(KEY + k); } catch { return null; } };
