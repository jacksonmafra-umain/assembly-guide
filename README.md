# Assembly Guide

An internal demo that turns flat IKEA assembly PDFs into an interactive 3D showroom and an animated,
step-by-step assembly guide, down to every dowel, cam lock and nail.

**Demo page and 60 s film:** https://jacksonmafra-umain.github.io/assembly-guide/

It covers the BILLY bookcase family and the BILLY corner combination with extension units, built from four
wordless manuals. The 3D look comes from the [iso-glow](https://iso-glow.vercel.app) skill: dark hairline
drawing, one accent colour on whatever is moving.

## What's in the app

- **Showroom**: product photos next to the assembled 3D model. Drag to orbit, Iso view, Revolve, light/dark
  theme, accent colour. For the corner combination, "Made of" lists its units and lights one up in 3D.
- **Assembly**: plays the manual's steps one by one. Parts fly in and seat, the moving part glows.
  Click a part (in the list or in 3D) to zoom in and replay how it fits, in slow motion.
- **How it was made**: the manual page, the extracted JSON and the 3D step side by side, plus how many fields
  were corrected by hand.

Keys: `space` play/pause, `←` `→` previous/next step, `Esc` leave the part detail, `T` theme, `I` iso view.

## How it works

```
Assembly PDF ──► pipeline/ (Claude reads each page) ──► data/products/<id>.json ──► shared/rules ──► src/ (three.js)
```

1. **Extraction** (`pipeline/`, run by hand): one call lists every panel and part from the manual, then one call
   per step reads what goes where. Output is product JSON in millimetres.
2. **Review**: the raw output stays in `data/raw/`; the reviewed copy in `data/products/` is what the site uses.
   `npm run corrections` counts what was changed by hand.
3. **Rules** (`shared/rules/`): product-agnostic code turns "4 dowels into the top edge of the left side" into
   exact positions and timed moves. Composites (`data/composites/`) place several products in one frame.
4. **Site** (`src/`): a static Vite + three.js app on a stage ported from the iso-glow 3D shell.

The current data for all products was read from the manuals by Claude in a Claude Code session (the same JSON
shape the script asks for), because the API account had no credit at the time. Re-run the script to compare.

## Getting started

Requires Node 22+.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (vitest)
npm run build      # type-check and build to dist/
```

Extract a product (needs `ANTHROPIC_API_KEY` or an `ant auth login` profile):

```bash
npm run extract -- billy-80          # writes data/raw/billy-80.json (and data/products/ if missing)
npm run validate -- billy-80         # parts-list counts, dimensions, unplaced panels
npm run corrections                  # data/corrections.json
```

## Layout

| Path | What |
|---|---|
| `shared/schema.ts` | Product, composite and catalog schemas (zod) with reference checks |
| `shared/rules/` | Hardware placement, step resolution, composites |
| `pipeline/` | PDF splitting, Claude structured calls, prompts, validation, corrections |
| `src/stage/` | iso-glow stage: renderer, hairlines, themes, controls |
| `src/models/` | Panel and hardware models, scene building |
| `src/ui/` | Shell, Showroom, Assembly, How it was made |
| `data/` | Catalog, raw and reviewed products, composites, corrections |
| `public/` | Manuals and product photos (internal use only) |
| `docs/superpowers/` | Design spec and implementation plan |

## Notes

- Internal demo. The manuals and photos belong to IKEA and are stored here for the demo only.
- 3D style based on iso-glow (MIT), see `vendor/iso-glow/LICENSE`.
