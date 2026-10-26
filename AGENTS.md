# AGENTS.md

Guidance for coding agents working in this repository.

## Project

Static Vite + TypeScript + three.js site that animates IKEA assembly manuals in 3D, plus a hand-run Node
pipeline that extracts product data from the PDFs with the Claude API. See `README.md` for the overview and
`docs/superpowers/specs/` for the design.

## Commands

```bash
npm install
npm run dev          # dev server on :5173
npm test             # vitest, all tests must pass
npm run build        # tsc --noEmit + vite build
npm run extract -- <id>   # Claude extraction (needs credentials), see pipeline/
npm run validate -- <id>  # check a product JSON
npm run corrections       # recount hand corrections
```

Run `npm test` and `npx tsc --noEmit` before every commit.

## Conventions

- Everything in the repo is written in English: code, comments, UI copy, step text, docs, commit messages.
- Units are millimetres and degrees. Product frame: origin at the back-left-bottom corner, +x width (left to
  right seen from the front), +y towards the front, +z up. The stage maps it to three.js with `MM = 0.01`.
- Test first: write the failing test, watch it fail, then implement. Pure logic lives in `shared/` and
  `src/timeline.ts`, `src/player.ts`, `src/detail.ts`, `src/router.ts` and is unit tested; UI is checked in a
  browser.
- Small, focused commits (`feat:`, `fix:`, `data:`, `chore:`). No assistant attribution in commits.
- Colours only through the stage theme tokens (`src/stage/themes.ts`), never literal hues in models.

## Data rules

- `data/raw/<id>.json` is untouched extraction output; edit `data/products/<id>.json` only, then
  `npm run validate -- <id>` and `npm run corrections`.
- Hardware counts in steps must add up to the manual's parts list; `offsetsMm` must have one entry per part.
- A panel may be placed twice: first at a staging pose where it is prepared, then where it is joined. Hardware
  set into it moves with it.
- Products with `roles` (corner hardware) target other units' panels as `<role>:<panel>` and only appear inside
  a composite. Composite `sequence` entries `<instance>@<n>` interleave single steps.

## Architecture map

- `shared/schema.ts`: zod schemas and `parseProduct` (reference checks with file and path in errors).
- `shared/rules/holes.ts`: where hardware sits on a panel face.
- `shared/rules/resolve.ts`: product → items and timed moves per step.
- `shared/rules/composite.ts`: several placed products → one resolved product.
- `src/stage/`: iso-glow stage (`createStage`, `mountControls`); do not add a second renderer.
- `src/models/build.ts`: scene objects keyed by item key; hardware drawn at `HARDWARE_DISPLAY_SCALE`.
- `src/timeline.ts`: pure `sceneStateAt(r, step, t)`; `src/player.ts`: play/pause/step.
- `src/ui/`: hash-routed tabs (`#/<tab>/<id>/<step>`), one shared stage moved between views.

## Don'ts

- Do not commit API keys or `.env` files; the client bundle must never contain secrets.
- Do not fetch from ikea.com at runtime; manuals and photos live in `public/`.
- Do not overwrite reviewed data: `npm run extract` keeps `data/products/` unless `--force`.
