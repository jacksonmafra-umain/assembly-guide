# BILLY Assembly Visualizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A password-protected static site on Vercel that turns BILLY assembly PDFs (via a hand-run Claude extraction script) into a showroom with photos and an iso-glow 3D model, plus a step-by-step animated 3D assembly with full hardware detail.

**Architecture:** One TypeScript repo with three layers. `pipeline/` (Node, run by hand) sends PDFs to the Claude API and writes product JSON. `shared/` holds the data schema and a product-agnostic rules layer that turns extracted semantics into exact poses and timed moves. `src/` (Vite + three.js) renders resolved data on a stage ported from the iso-glow 3D shell, with three hash-routed tabs.

**Tech Stack:** TypeScript, Vite, three.js, zod v4 (schema + `z.toJSONSchema`), vitest, `@anthropic-ai/sdk`, `pdf-lib` (split PDFs into pages), `pdfjs-dist` (render a manual page in the browser), `tsx` (run pipeline scripts). Pin exact versions at install time.

**Spec:** `docs/superpowers/specs/2026-10-26-billy-assembly-visualizer-design.md`

## Global Constraints

- All UI copy, step text, labels, page titles, code, comments and commit messages in English.
- Static site only: no backend, no serverless functions, no secrets in the client bundle. `ANTHROPIC_API_KEY` is read only by `pipeline/` from the local environment; `.env*` stays gitignored.
- Nothing fetches from ikea.com at runtime. PDFs and photos live in the repo (`public/pdfs/`, `public/photos/`).
- Extraction model: `claude-opus-5-5`. Load the `claude-api` skill before writing `pipeline/claude.ts`.
- Units: millimetres everywhere in data and rules. Product frame: origin at the back-left-bottom corner of the assembled product, +x along the width (left to right, seen from the front), +y towards the front, +z up. Rotations in degrees, XYZ order. The scene converts with `MM = 0.01` (100 mm = 1 three.js unit, matching iso-glow's `W()`).
- iso-glow look: hairlines at 1 CSS px, one accent colour only on what is live (the part moving in the current step), dark/light themes, accent picker, Iso view, Revolve. Keep the footer "Made with ISO-GLOW" linking to https://iso-glow.vercel.app and the MIT licence in `vendor/iso-glow/LICENSE`.
- Repo stays private. Vercel deployment must be password protected; ask the user before enabling any paid Vercel feature or creating a remote repository.
- Commits: microcommits, one focused change each, no assistant attribution of any kind.
- Products in scope (ids used everywhere): `billy-80` (AA-2289108), `billy-40` (AA-2287624), `billy-ext` (AA-2287627, one manual for 40 and 80 cm extensions, extracted once with `width` as the varying dimension), `billy-corner` (AA-197501), composite `billy-corner-combo` (S99581504).

## Review Focus

1. A product JSON that references a panel id that does not exist, or a step with no actions: the loader rejects it with a message naming the file and the field, and the site shows that product as unavailable instead of a blank canvas. (Task 1, Task 10)
2. Pressing next/previous or scrubbing while a step is mid-animation: the scene snaps to a consistent state for the requested step, never shows a part twice or leaves one floating. (Task 8)
3. Hardware counts in steps that do not add up to the parts list: `validate` reports each mismatch by part number, and the How tab shows the count. (Task 4)
4. Switching theme or accent while the assembly is playing: the moving part keeps its accent and the animation continues. (Task 11, verification step)
5. Opening a deep link to an unknown product or a step number out of range: the app falls back to the first product / clamps the step, with no exception. (Task 10)

## File Structure

```
package.json, tsconfig.json, vite.config.ts, vitest.config.ts, index.html, vercel.json
shared/schema.ts            zod schemas + types for Product, Composite, Catalog
shared/rules/holes.ts       hardware positions on a panel face
shared/rules/resolve.ts     Product -> ResolvedProduct (exact transforms, timed moves)
shared/rules/composite.ts   Composite + products -> ResolvedProduct
pipeline/pdf.ts             split a PDF into single-page PDFs
pipeline/claude.ts          one structured call to Claude (forced tool use)
pipeline/prompts.ts         inventory and step prompts
pipeline/extract.ts         CLI: PDF -> data/raw/<id>.json (+ working copy)
pipeline/validate.ts        CLI: checks a product JSON, prints report
pipeline/corrections.ts     CLI: diff raw vs committed -> data/corrections.json
data/catalog.json           display metadata per product (names, articles, dims, photos, pdf)
data/raw/<id>.json          untouched model output
data/products/<id>.json     reviewed, committed product data
data/composites/billy-corner-combo.json
data/corrections.json       corrected-field count per product
public/pdfs/, public/photos/<id>/
vendor/iso-glow/            gallery-3d.html reference copy + LICENSE
src/stage/                  iso-glow 3D shell ported to modules (stage.ts, lines.ts, themes.ts, controls.ts)
src/models/panel.ts         panel mesh
src/models/hardware.ts      one factory per HardwareKind
src/models/build.ts         ResolvedProduct -> three.js objects keyed by item key
src/timeline.ts             pure: scene state at (step, t)
src/player.ts               play/pause/prev/next driving the timeline
src/data.ts                 load + validate JSON, resolve products and composite
src/router.ts               hash routes
src/ui/shell.ts, showroom.ts, assembly.ts, how.ts, styles.css
tests/                      mirrors shared/, pipeline/, src/ (pure logic only)
```

---

## Milestone 1: one 80 cm bookcase end to end

### Task 1: Scaffold and data schema

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `shared/schema.ts`
- Test: `tests/shared/schema.test.ts`

**Interfaces:**
- Produces (all exported from `shared/schema.ts`, each type `z.infer` of a same-named zod schema with `Schema` suffix):
  - `Vec3 = { x: number; y: number; z: number }`
  - `Pose = { position: Vec3; rotation: Vec3 }`
  - `Dir = '+x' | '-x' | '+y' | '-y' | '+z' | '-z'`
  - `Face = '+x' | '-x' | '+y' | '-y' | '+z' | '-z'` (panel face, in the product frame after placement)
  - `PanelRole = 'side' | 'top' | 'bottom' | 'shelf' | 'fixed-shelf' | 'back' | 'plinth' | 'rail' | 'other'`
  - `HardwareKind = 'dowel' | 'cam-lock' | 'cam-screw' | 'wood-screw' | 'nail' | 'shelf-pin' | 'corner-fitting' | 'wall-bracket' | 'connector'`
  - `Panel = { id: string; name: string; role: PanelRole; size: Vec3 }` (size in the assembled orientation, mm)
  - `HardwareLine = { partNumber: string; kind: HardwareKind; quantity: number }`
  - `Action =`
    `| { type: 'place-panel'; panelId: string; pose: Pose; from: Dir }`
    `| { type: 'insert-hardware'; partNumber: string; kind: HardwareKind; count: number; target: { panelId: string; face: Face; offsetsMm?: number[]; acrossMm?: number }; from: Dir }`
    `| { type: 'reorient'; pose: Pose }` (whole assembly, e.g. lying on its back, then upright)
  - `Step = { index: number; sourcePages: number[]; text: string; actions: Action[] }`
  - `Product = { id: string; name: string; dimensionsMm: Vec3; materials: { panelThickness: number; backThickness: number }; panels: Panel[]; hardware: HardwareLine[]; steps: Step[]; source: { pdf: string } }`
  - `Composite = { id: string; name: string; components: { instanceId: string; productId: string; placement: Pose; roles?: Record<string, string> }[]; sequence: string[] }`
  - `CatalogEntry = { id: string; name: string; articleNumbers: string[]; kind: 'unit' | 'composite'; dimensionsIn: { w: number; d: number; h: number } | null; photos: string[]; pdf: string | null; productUrl: string }`
  - `parseProduct(json: unknown, file: string): Product` — zod parse plus cross-reference checks; throws `Error` whose message contains `file` and the offending path.

- [ ] **Step 1: Scaffold.** `npm init`, add Vite (vanilla-ts), three, zod, vitest, tsx, @anthropic-ai/sdk, pdf-lib, pdfjs-dist. Scripts: `dev`, `build`, `test` (`vitest run`), `extract` (`tsx pipeline/extract.ts`), `validate` (`tsx pipeline/validate.ts`), `corrections` (`tsx pipeline/corrections.ts`). `tsconfig` strict, `resolveJsonModule`, path alias `@shared/*`.
- [ ] **Step 2: Write the failing tests**

```ts
test('parseProduct accepts a minimal valid product', () => {
  expect(parseProduct(minimalProduct(), 'p.json').id).toBe('billy-80');
});
test('parseProduct rejects an unknown panel reference with file and path', () => {
  const p = minimalProduct(); p.steps[0].actions[0] = { ...placeAction, panelId: 'ghost' };
  expect(() => parseProduct(p, 'data/products/billy-80.json')).toThrow(/billy-80\.json.*steps\[0\]\.actions\[0\]\.panelId.*ghost/);
});
test('parseProduct rejects a step with no actions', () => {
  const p = minimalProduct(); p.steps[0].actions = [];
  expect(() => parseProduct(p, 'x.json')).toThrow(/steps\[0\]\.actions/);
});
test('parseProduct rejects insert-hardware whose partNumber is not in hardware', () => { /* /partNumber/ */ });
```
`minimalProduct()` lives in `tests/fixtures.ts`: one side panel 15×280×2020, one dowel line, one step placing the panel.
- [ ] **Step 3: Run** `npm test -- schema` — expect FAIL (module missing).
- [ ] **Step 4: Implement `shared/schema.ts`.** Cross-reference checks run after zod parse (panelId exists, partNumber exists, step indexes are 1..n in order).
- [ ] **Step 5: Run** `npm test -- schema` — expect PASS. `npm run build` succeeds.
- [ ] **Step 6: Commit** — `chore: scaffold Vite + TypeScript project` then `feat: add product data schema with reference checks`.

### Task 2: Source material and catalog

**Files:**
- Create: `public/pdfs/*.pdf` (4 files), `public/photos/<id>/NN.jpg`, `data/catalog.json`, `public/pdfs/README.md` (provenance: URL and date per file)
- Test: `tests/shared/catalog.test.ts`

**Interfaces:**
- Produces: `data/catalog.json` = `CatalogEntry[]` with ids `billy-corner-combo`, `billy-80`, `billy-40`, `billy-ext`, `billy-corner` (in that order: the combo is listed first in the showroom). `pdf` paths are `/pdfs/<filename>.pdf`; `photos` are `/photos/<id>/NN.jpg`.

- [ ] **Step 1: Failing test** — every catalog entry parses with `CatalogEntrySchema`; every `pdf` and `photos` path exists under `public/`; ids are unique; `billy-corner-combo.kind === 'composite'`.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Download** the four PDFs (URLs in the spec) and 3–6 photos per product from the product pages in the spec (combo page lists each component's page). Fill dimensions from the spec's table: `billy-80` 31.5×11×79.5 in, `billy-40` 15.75×11×79.5, `billy-ext` 31×11×14 (80 cm), `billy-corner` null, combo 53.5×11×93.25.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** — `chore: add BILLY manuals and product photos`, `feat: add product catalog`.

### Task 3: Extraction script

**Files:**
- Create: `pipeline/pdf.ts`, `pipeline/claude.ts`, `pipeline/prompts.ts`, `pipeline/extract.ts`
- Test: `tests/pipeline/pdf.test.ts`, `tests/pipeline/extract.test.ts`

**Interfaces:**
- Consumes: `ProductSchema`, `PanelSchema`, `HardwareLineSchema`, `StepSchema` from Task 1.
- Produces:
  - `splitPdf(bytes: Uint8Array): Promise<Uint8Array[]>` — one single-page PDF per page.
  - `type StructuredCall = <T>(args: { schema: z.ZodType<T>; toolName: string; system: string; prompt: string; pdfs: Uint8Array[] }) => Promise<T>`
  - `createClaudeCall(apiKey: string): StructuredCall` — forced tool use (`tool_choice: { type: 'tool', name }`, `input_schema` from `z.toJSONSchema`), PDFs as base64 `document` blocks, model `claude-opus-5-5`; validates the tool input with `schema.parse`; one retry on parse failure with the zod error appended to the prompt.
  - `extractProduct(args: { id: string; name: string; pdf: Uint8Array; pdfPath: string; dimensionsMm: Vec3; call: StructuredCall; log?: (s: string) => void }): Promise<Product>`
  - CLI: `npm run extract -- <id>` reads catalog entry + PDF, writes `data/raw/<id>.json`, and writes `data/products/<id>.json` only if it does not exist yet (never overwrites reviewed data; `--force` overrides).

Extraction runs in two passes, which the prompts in `pipeline/prompts.ts` implement:
1. **Inventory** — whole PDF in one call. Returns `{ materials, panels, hardware, stepPages: { index: number; pages: number[] }[] }`. The prompt includes the product's real outer dimensions (from the catalog) and the frame convention from Global Constraints, the `HardwareKind` list with a one-line visual description of each, and asks for part numbers exactly as printed in the parts list.
2. **Steps** — one call per manual step with only that step's page PDFs plus the inventory JSON as text. Returns one `Step`. Prompt asks for actions in the order they happen and a short imperative English instruction.

- [ ] **Step 1: Failing tests.** `splitPdf` on `public/pdfs/billy-bookcase-white__AA-2289108-3-100.pdf` returns 16 parts. `extractProduct` with a fake `StructuredCall` (returns fixture inventory, then fixture steps) makes 1 + N calls, passes exactly the step's pages to each step call, and returns a product that passes `parseProduct`.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** the four files.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** — one commit per file pair (`feat: split PDFs into pages`, `feat: add structured Claude call`, `feat: extract product data from assembly PDF`).

### Task 4: Validation and corrections count

**Files:**
- Create: `pipeline/validate.ts`, `pipeline/corrections.ts`, `data/corrections.json`
- Test: `tests/pipeline/validate.test.ts`, `tests/pipeline/corrections.test.ts`

**Interfaces:**
- Produces:
  - `validateProduct(p: Product, dimsMm: Vec3 | null): Issue[]` with `Issue = { level: 'error' | 'warn'; code: 'hardware-count' | 'dimension' | 'unused-panel' | 'unplaced-panel'; message: string }`.
  - `countCorrections(raw: unknown, final: unknown): { changed: number; added: number; removed: number }` — leaf-level JSON diff (arrays by index).
  - CLI `npm run validate -- <id>` prints issues, exits 1 on any error. CLI `npm run corrections` rewrites `data/corrections.json` as `Record<productId, { changed; added; removed }>` for every product with both raw and final files.

- [ ] **Step 1: Failing tests.**
  - hardware: sum of `count` over all `insert-hardware` actions for a part number ≠ its `quantity` → one `error` `hardware-count` whose message contains the part number, the expected and the actual count.
  - dimension: the bounding box of placed panels differs from `dimsMm` by more than 15 mm on any axis → `warn` `dimension`.
  - a panel never placed → `error` `unplaced-panel`.
  - `countCorrections({a:1,b:[1,2]}, {a:2,b:[1,2,3]})` → `{ changed: 1, added: 1, removed: 0 }`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** — `feat: validate extracted product data`, `feat: count hand corrections per product`.

### Task 5: Extract and review billy-80

**Files:**
- Create: `data/raw/billy-80.json`, `data/products/billy-80.json`; Modify: `data/corrections.json`

This task needs `ANTHROPIC_API_KEY` in the shell. If it is missing, stop and ask the user.

- [ ] **Step 1:** `npm run extract -- billy-80`. Expected: both files written, log shows 1 inventory call + one call per step.
- [ ] **Step 2:** `npm run validate -- billy-80`. Fix the prompts (not the JSON) for systematic errors and re-run Step 1 with `--force` until remaining issues are one-off. Commit prompt changes separately (`fix: ...`).
- [ ] **Step 3:** Hand-correct the remaining issues in `data/products/billy-80.json` against the PDF. `npm run validate -- billy-80` exits 0.
- [ ] **Step 4:** `npm run corrections`. Record the counts in the commit message.
- [ ] **Step 5: Commit** — `data: add extracted billy-80 (raw)`, then `data: review billy-80 (N fields corrected)`.

### Task 6: Rules layer

**Files:**
- Create: `shared/rules/holes.ts`, `shared/rules/resolve.ts`
- Test: `tests/shared/holes.test.ts`, `tests/shared/resolve.test.ts`

**Interfaces:**
- Consumes: `Product`, `Panel`, `Pose`, `Face`, `HardwareKind` from Task 1.
- Produces:
  - `Transform = { position: [number, number, number]; rotation: [number, number, number] }` (mm, degrees)
  - `holePositions(args: { panel: Panel; pose: Pose; face: Face; kind: HardwareKind; count: number; offsetsMm?: number[]; acrossMm?: number }): Transform[]` — each transform's position is the seat point where the part's axis crosses the face; its rotation points the part's axis along `-face`, into the panel.
  - `ResolvedItem = { key: string; kind: 'panel' | HardwareKind; size?: Vec3; label: string; final: Transform }` — keys: panel id for panels, `${partNumber}#${n}` for hardware (n counts from 1 per part number across the product).
  - `Move = { itemKey: string; from: Transform; to: Transform; delay: number; duration: number }` (seconds from step start)
  - `ResolvedStep = { index: number; text: string; sourcePages: number[]; uses: { label: string; partNumber?: string; quantity: number }[]; moves: Move[]; assemblyPose: Transform }`
  - `ResolvedProduct = { id: string; items: ResolvedItem[]; steps: ResolvedStep[] }`
  - `resolveProduct(p: Product): ResolvedProduct`

Rules (product-agnostic, written once):
- Hardware sits on the given face of the panel (face in the product frame after `pose`). Along the face's longer in-plane axis: without `offsetsMm`, `count` positions evenly spaced between insets of 37 mm from each end (the 32 mm system's front inset); with `offsetsMm`, at those distances from the end with the smaller coordinate. Across the shorter in-plane axis: at `acrossMm` from the smaller-coordinate edge if given, otherwise centred.
- Seating depth (how far a part sticks out of the face) is not a rule here: each hardware model in Task 8 has its origin at its seat point, so a dowel model extends 15 mm out of the face, a cam screw 10 mm, a shelf pin 6 mm, and cam locks and nails sit flush.
- Move start: the final transform offset 400 mm along `from` for panels, 120 mm for hardware. Panels in a step start at `delay = 0.3 * i` (i = order in the step), hardware after the last panel, `0.08 * j` apart. Duration 0.9 s panels, 0.4 s hardware.
- `assemblyPose` carries forward: a `reorient` action changes it for its step and all later steps; default is upright identity.
- Cam locks also get a 180° turn about their axis at the end of their move (encoded as the `to.rotation`).

- [ ] **Step 1: Failing tests.**
  - `holePositions` for a side panel of size 15×280×2020 at the origin with identity rotation, face `+z`, `kind: 'dowel'`, count 2 → positions `[7.5, 37, 2020]` and `[7.5, 243, 2020]`.
  - same with `offsetsMm: [100, 180]` → `[7.5, 100, 2020]` and `[7.5, 180, 2020]`; with `acrossMm: 5` → x is `5`.
  - the same panel rotated 90° about z and placed at `[0, 0, 0]`: positions rotate with it (assert one point).
  - `resolveProduct(minimalProduct())`: item keys are unique; every item appears in exactly one step's moves; a step with two panels has delays 0 and 0.3; `from` of a `+z` panel move is `final` + 400 mm in z.
  - a product with a `reorient` in step 2 has that pose in steps 2..n and identity in step 1.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** — `feat: place hardware on panel faces`, `feat: resolve product into timed moves`.

### Task 7: iso-glow stage

**Files:**
- Create: `vendor/iso-glow/gallery-3d.html`, `vendor/iso-glow/LICENSE`, `src/stage/stage.ts`, `src/stage/lines.ts`, `src/stage/themes.ts`, `src/stage/controls.ts`, `src/stage/demo.ts` (dev-only page at `/stage-demo.html`)

**Interfaces:**
- Produces:
  - `createStage(host: HTMLElement): Stage`
  - `Stage = { scene: THREE.Scene; root: THREE.Group; addMesh(m: THREE.Mesh, parent?: THREE.Object3D): void; finalizeLines(): void; setLive(obj: THREE.Object3D, on: boolean): void; frame(box: THREE.Box3, animate?: boolean): void; setIsoView(on: boolean): void; setRevolve(on: boolean): void; setTheme(t: 'dark' | 'light'): void; setAccent(name: string): void; onTick(fn: (now: number, dt: number) => void): () => void; onThemeChange(fn: () => void): () => void; dispose(): void }`
  - `addMesh` gives the mesh iso-glow's body material, silhouette shell and registers it for crease extraction; `finalizeLines` runs crease extraction over meshes added since the last call; `setLive` swaps to the accent cap material (flat accent in light theme).
  - `mountControls(host: HTMLElement, stage: Stage): void` — theme toggle, accent picker (Ember, Cyan, Lime, Violet, Rose, Ice), Iso view and Revolve toggles; choices persisted in `localStorage` inside try/catch.

- [ ] **Step 1:** Install the skill (`curl -fsSL https://iso-glow.vercel.app/iso-glow.tar.gz | tar -xz -C ~/.claude/skills`), copy `assets/gallery-3d.html` and `LICENSE` into `vendor/iso-glow/`.
- [ ] **Step 2:** Port the shell's renderer setup, materials, line tiers, `addOutline`, `creases`, `hazeAndShadow`, theme tokens, accent palette, Iso view (orthographic) and Revolve into `src/stage/*`. Import three.js from npm, not the CDN import map. Drop the built-in figures, sounds and per-figure panel.
- [ ] **Step 3:** `src/stage/demo.ts` renders a 15×280×2020 box and a 300×280×15 box, one set live, with controls mounted.
- [ ] **Step 4: Verify** in the in-app browser (`npm run dev`, open `/stage-demo.html`): hairlines 1 px at every zoom, live box shows accent, theme/accent/iso/revolve all work, window resize keeps the canvas filled. Screenshot both themes.
- [ ] **Step 5: Commit** — `chore: vendor iso-glow 3D shell (MIT)`, `feat: port iso-glow stage to modules`.

### Task 8: Models and timeline

**Files:**
- Create: `src/models/panel.ts`, `src/models/hardware.ts`, `src/models/build.ts`, `src/timeline.ts`
- Test: `tests/src/timeline.test.ts`

**Interfaces:**
- Consumes: `Stage` (Task 7), `ResolvedProduct`, `Transform` (Task 6).
- Produces:
  - `makePanel(size: Vec3): THREE.Mesh` — box in mm scaled by `MM`, origin at its min corner.
  - `makeHardware(kind: HardwareKind): THREE.Group` — one recognisable hairline model per kind, built from lathes/cylinders/boxes at real scale: dowel Ø8×30 mm, cam lock Ø15×12 mm with slot, cam screw Ø6×34 mm, wood screw Ø4×30 mm, nail Ø1.5×20 mm, shelf pin Ø5×16 mm, corner fitting and wall bracket as bent plates ~40×40×2 mm, connector Ø8×40 mm.
  - `buildScene(stage: Stage, r: ResolvedProduct): Map<string, THREE.Object3D>` — one object per item key, placed at `final`, all added under `stage.root`, then `finalizeLines()`.
  - `SceneState = { visible: Set<string>; live: Set<string>; transforms: Map<string, Transform>; assemblyPose: Transform }`
  - `sceneStateAt(r: ResolvedProduct, stepIndex: number, t: number): SceneState` — items from steps before `stepIndex` at `final`; items in `stepIndex` interpolated (ease-in-out cubic) between `from` and `to` by their own delay/duration, hidden before their delay, live while moving; items of later steps hidden. `stepIndex` is clamped to `1..steps.length`; `t` clamped to `>= 0`. `stepIndex = 0` means fully assembled, nothing live (showroom).
  - `applyState(objects: Map<string, THREE.Object3D>, s: SceneState, stage: Stage): void`

- [ ] **Step 1: Failing tests** for `sceneStateAt`: at `t = 0` of step 2, step-1 items are visible at final and none live; mid-move item position is strictly between `from` and `to`; after the last move ends nothing is live; step 99 clamps to the last step; step 0 shows all items at final; calling step 3 then step 1 gives the same result as calling step 1 directly (no hidden state).
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** `timeline.ts`, then the three model files. **Step 4: Run** — PASS.
- [ ] **Step 5: Verify** on the stage demo page: each hardware kind rendered side by side is recognisable (screenshot).
- [ ] **Step 6: Commit** — `feat: add assembly timeline`, `feat: add panel and hardware models`, `feat: build scene from resolved product`.

### Task 9: Player

**Files:**
- Create: `src/player.ts`
- Test: `tests/src/player.test.ts`

**Interfaces:**
- Consumes: `sceneStateAt`, `applyState` (Task 8).
- Produces: `createPlayer(args: { steps: number; stepDuration: (i: number) => number; render: (step: number, t: number) => void; now?: () => number }): Player`, with `Player = { step: number; playing: boolean; play(): void; pause(): void; next(): void; prev(): void; goTo(i: number): void; tick(): void; onChange(fn: () => void): () => void }`. Play auto-advances to the next step after `stepDuration(i) + 0.8 s`; stops at the last step. `next`/`prev`/`goTo` restart the target step at `t = 0` and keep the playing state.

- [ ] **Step 1: Failing tests** with a fake clock: play advances through steps; `next` mid-step lands on `t = 0` of the next step; `prev` on step 1 stays on 1; `goTo(50)` clamps; `render` is called with monotonically increasing `t` within a step.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** — `feat: add step player`.

### Task 10: App shell, data loading, Showroom

**Files:**
- Create: `src/data.ts`, `src/router.ts`, `src/ui/shell.ts`, `src/ui/showroom.ts`, `src/ui/styles.css`, `src/main.ts`; Modify: `index.html`
- Test: `tests/src/router.test.ts`, `tests/src/data.test.ts`

**Interfaces:**
- Produces:
  - `loadData(): { catalog: CatalogEntry[]; resolved: Map<string, ResolvedProduct>; errors: Map<string, string> }` — `import.meta.glob('/data/products/*.json', { eager: true })`, `parseProduct` + `resolveProduct` per file; a failing file goes to `errors` keyed by product id, never throws.
  - `Route = { tab: 'showroom' | 'assembly' | 'how'; productId: string; step: number }`; `parseRoute(hash: string, knownIds: string[]): Route` (unknown id → first known id, missing/invalid step → 1); `formatRoute(r: Route): string` (`#/assembly/billy-80/4`).
  - `renderShowroom(host: HTMLElement, ctx: AppContext): () => void` where `AppContext = { data: ReturnType<typeof loadData>; stage: Stage; go(r: Partial<Route>): void }`; returns a cleanup function.

Layout per the approved wireframe: top nav (brand "Assembly Lab", tabs Showroom / Assembly / How it was made), left product list from the catalog (unavailable products greyed with the error on hover), centre photo gallery (main image + thumbnails) beside the 3D canvas showing step 0 (fully assembled) with iso-glow controls, below a "Made of" block shown only for composites. One shared `Stage` instance is reused across tabs. Footer: "Made with ISO-GLOW ↗". Laptop first; at < 720 px the gallery stacks above the canvas.

- [ ] **Step 1: Failing tests:** `parseRoute('#/assembly/nope/3', ['billy-80'])` → `{ tab: 'assembly', productId: 'billy-80', step: 3 }`; `parseRoute('', ids).tab === 'showroom'`; `parseRoute('#/assembly/billy-80/abc', ids).step === 1`; `formatRoute(parseRoute(x))` round-trips for valid hashes. `loadData` with one broken fixture puts it in `errors` and still returns the valid ones.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Verify** in the in-app browser: billy-80 shows photos and the assembled 3D model; orbit, iso view, theme and accent work; unknown hash falls back; no console errors.
- [ ] **Step 6: Commit** — `feat: load and resolve product data`, `feat: add hash router`, `feat: add showroom tab`.

### Task 11: Assembly tab

**Files:**
- Create: `src/ui/assembly.ts`

**Interfaces:**
- Consumes: `AppContext`, `createPlayer`, `buildScene`, `sceneStateAt`, `applyState`.
- Produces: `renderAssembly(host: HTMLElement, ctx: AppContext, route: Route): () => void`.

Layout (approved direction A): the 3D canvas is the hero; above it the step bar — previous, play/pause, next, "Step 4 / 14"; below it the step text and a "Parts in this step" list (`label`, `partNumber`, `× quantity`). The current step is reflected in the URL (`formatRoute`) without re-rendering the tab. Keyboard: ← → for prev/next, space for play/pause. The camera eases to frame the whole product at step 1 and stays put (no per-step camera moves unless a part leaves the frame). The PDF is not shown in this tab.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Verify** in the in-app browser: play billy-80 from step 1 to the end; every step animates, moving parts glow in the accent, hardware is visible going into place; prev/next mid-animation leaves no floating parts; switching theme while playing keeps the animation and the accent; deep link `#/assembly/billy-80/99` clamps to the last step.
- [ ] **Step 3: Faithfulness check:** step through billy-80 next to the PDF (open `public/pdfs/...` side by side) and list mismatches. Fix them in `data/products/billy-80.json` (re-run `npm run corrections`) or in the rules layer if the mismatch is systematic.
- [ ] **Step 4: Commit** — `feat: add assembly tab`, plus separate `data:`/`fix:` commits from Step 3.

### Task 12: How it was made tab

**Files:**
- Create: `src/ui/how.ts`

**Interfaces:**
- Consumes: `AppContext`, `data/corrections.json`, `data/raw/<id>.json`, catalog `pdf`.
- Produces: `renderHow(host: HTMLElement, ctx: AppContext, route: Route): () => void`.

Content, top to bottom: a four-stage pipeline strip (Assembly PDF → Claude reads each page → Product JSON → 3D scene) with one sentence each; a step picker for the current product; three panes for that step — the manual page rendered with `pdfjs-dist` (first page of `sourcePages`), the step's JSON excerpt (from the committed product, pretty-printed), and the 3D canvas playing that step; a corrections line per product from `data/corrections.json` ("12 of 640 fields corrected by hand"); the command to run the pipeline (`npm run extract -- <id>`).

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Verify** in the in-app browser: the PDF page renders, JSON and 3D match the selected step, corrections count matches `data/corrections.json`.
- [ ] **Step 3: Commit** — `feat: add how-it-was-made tab`.

### Task 13: Deploy and sign-off

**Files:**
- Create: `vercel.json` (framework vite, output `dist`)

- [ ] **Step 1:** Ask the user before creating a private GitHub repository and before linking a Vercel project; then do both with their go-ahead.
- [ ] **Step 2:** Check the team's Vercel plan for Password Protection. If it is not included, stop and ask the user (enable the paid add-on, or use Vercel Authentication instead).
- [ ] **Step 3:** Deploy a preview; open it in the in-app browser; confirm the password prompt appears and the three tabs work.
- [ ] **Step 4:** Send the user the link and ask them to sign off billy-80 against the PDF. Do not start Milestone 2 until they do.
- [ ] **Step 5: Commit** — `chore: add Vercel config`.

---

## Milestone 2: the rest of the combination

### Task 14: Extract billy-40, billy-ext, billy-corner

**Files:**
- Create: `data/raw/{billy-40,billy-ext,billy-corner}.json`, `data/products/{...}.json`; Modify: `data/corrections.json`, possibly `pipeline/prompts.ts`, `shared/schema.ts`

- `billy-ext` covers both widths: extract it once at 80 cm and add an optional `variants: { id: string; widthMm: number }[]` to `ProductSchema`; `resolveProduct(p, variantId?)` scales panels whose `size.x` equals the product width and re-spreads their hardware. Add a test for the 40 cm variant to `tests/shared/resolve.test.ts`.
- `billy-corner` actions target panels of the bookcases it joins: `panelId` takes the form `<role>:<panelId>` (e.g. `hostA:side-right`), allowed only when the product has `roles: string[]`. Extend `parseProduct` and its tests accordingly.

- [ ] **Step 1:** For each product, repeat Task 5 Steps 1–5 (extract, validate, fix prompts, hand-correct, count, commit).
- [ ] **Step 2:** Add the schema extensions above with failing tests first, then implementation.
- [ ] **Step 3:** Faithfulness check each product in the Assembly tab next to its PDF, as in Task 11 Step 3.
- [ ] **Step 4: Commit** — one `data:` commit per product, one `feat:` per schema extension.

### Task 15: Composite combination

**Files:**
- Create: `shared/rules/composite.ts`, `data/composites/billy-corner-combo.json`; Modify: `src/data.ts`, `src/ui/showroom.ts`, `src/ui/assembly.ts`
- Test: `tests/shared/composite.test.ts`

**Interfaces:**
- Produces: `resolveComposite(c: Composite, products: Map<string, Product>): ResolvedProduct` — item keys prefixed `${instanceId}/`; every transform pre-multiplied by the instance `placement`; roles resolved through `component.roles` (`hostA` → instance id) to the host's panel keys; steps concatenated in `sequence` order, each step's text prefixed with the instance label ("Bookcase 80 cm (left) · ..."); `assemblyPose` of a unit's `reorient` applies only to that unit's items.
- `ResolvedStep` gains `instanceId?: string`; the Made of block uses it to jump to the first step of an instance (`go({ tab: 'assembly', productId: 'billy-corner-combo', step })`).

Layout data (`data/composites/billy-corner-combo.json`), from the product page photos: two 80 cm bookcases on the two walls meeting at the corner, the 40 cm bookcase beside one of them, one extension on top of each bookcase (80 cm extensions on the 80 cm units, 40 cm on the 40 cm unit), corner hardware joining the two 80 cm units at the corner. Sequence: each bookcase, its extension, then the corner hardware.

- [ ] **Step 1: Failing tests:** keys of two instances of `billy-80` don't collide; an item of an instance placed at x = 1000 has its final position shifted by 1000 mm; a `hostA:side-right` target resolves to the mapped instance's panel; the overall bounding box of the resolved combo is within 25 mm of 53.5 in × 53.5 in × 93.25 in (1359 × 1359 × 2369 mm).
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement**, wire into `loadData`, Showroom "Made of" (component list with quantities; click highlights the instance in 3D via `setLive` and links to its first step), and Assembly.
- [ ] **Step 4: Run** — PASS. **Verify** in the in-app browser: full combo plays from first to last step; Made of click highlights and jumps.
- [ ] **Step 5: Commit** — `feat: resolve composite products`, `data: add BILLY corner combination`, `feat: show composite contents in showroom`.

### Task 16: Final deploy

- [ ] **Step 1:** `npm test` and `npm run build` pass; `npm run validate` exits 0 for every product.
- [ ] **Step 2:** Deploy to the same password-protected Vercel project; verify all products and the combo in the in-app browser.
- [ ] **Step 3:** Send the user the link.
