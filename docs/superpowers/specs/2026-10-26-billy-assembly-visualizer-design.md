# BILLY Assembly Visualizer — Design

Date: 2026-10-26
Status: awaiting approval

## Intent

A demo web page for an internal product team. It shows that a flat IKEA assembly PDF (image-only line drawings, no text) can be turned, with little human effort, into:

1. a **showroom**: product photos next to an interactive 3D model of the product, and
2. an **assembly guide**: an animated, step-by-step 3D reconstruction of the manual, down to every dowel, screw, cam lock and nail.

The point is the automation. The product team should leave thinking "we could run this on every product we sell." The visual language comes from the **iso-glow** Claude skill (https://isoglow.dev), in its 3D (three.js) mode: dark hairline drawing, one accent colour on whatever is live, orbit, true isometric view.

## Audience and success

- Audience: an internal product team, viewing a link on Vercel.
- Success: the team understands the pipeline (PDF in, interactive 3D out) and finds the result convincing enough to want it for more products.
- All user-facing content (UI copy, step text, labels, page titles) and all code are in **English**.

## Goals

- Static site hosted on Vercel with three areas: **Showroom**, **Assembly**, **How it was made**.
- Cover a multi-product combination: the BILLY corner combination with extension units (IKEA S99581504), built from its component products.
- A reusable extraction **script** in the repo that turns an assembly PDF into structured data. For now it is run by hand, locally, by us.
- A data-driven 3D renderer in the iso-glow style: the scene for any product and any step is built from the extracted data, not hand-drawn per product.
- Full hardware detail in the assembly animation.

## Non-goals

- No live PDF upload on the page and no backend. Nothing runs on Vercel except static files.
- No running the extraction in CI or on a schedule.
- No products beyond the BILLY set below.
- No pricing, cart, stock or any commerce feature.
- No AR, no mobile app.

## Anti-goals (would make it a failure even if it works)

- 3D that clearly does not match the manual (wrong panel order, hardware in the wrong place). The animation has to be faithful to the PDF, because faithfulness is the whole argument for the automation.
- A page that looks hand-made per product, which undercuts the "this is automated" story.
- Leaking an API key into the client bundle or the repo.

## Source material

Assembly PDFs (all image-only; text extraction returns nothing):

| Product | PDF | Pages |
|---|---|---|
| BILLY bookcase 80 cm (31 1/2 in) | https://www.ikea.com/us/en/assembly_instructions/billy-bookcase-white__AA-2289108-3-100.pdf | 16 |
| BILLY bookcase 40 cm (15 3/4 in) | https://www.ikea.com/us/en/assembly_instructions/billy-bookcase-white__AA-2287624-3-100.pdf | 16 |
| BILLY height extension unit (one manual for both 40 and 80 cm widths) | https://www.ikea.com/us/en/assembly_instructions/billy-height-extension-unit-white__AA-2287627-4-100.pdf | 16 |
| BILLY corner hardware, galvanized | https://www.ikea.com/us/en/assembly_instructions/billy-corner-hardware-galvanized__AA-197501-5-2.pdf | 8 |

Contents of the corner combination S99581504 (from its product page), overall 53 1/2 in x 53 1/2 in, 11 in deep, 93 1/4 in high:

| Product | Article | Qty | W x D x H |
|---|---|---|---|
| BILLY bookcase | 205.220.46 | 2 | 31 1/2 x 11 x 79 1/2 in |
| BILLY bookcase | 505.220.40 | 1 | 15 3/4 x 11 x 79 1/2 in |
| BILLY height extension unit | 805.252.78 | 2 | 31 x 11 x 14 in |
| BILLY height extension unit | 405.252.75 | 1 | 16 x 11 x 14 in |
| BILLY corner hardware | 401.041.09 | 1 | — |

Every assembly stage of the combination is covered by a manual: units by the bookcase manuals, extensions by the extension manual, the corner join by the corner hardware manual. Only the floor-plan layout of the units (which bookcase sits where around the corner) comes from the product page photos rather than a PDF.

Product pages (photos, names, dimensions, combination contents):

- BILLY bookcase: https://www.ikea.com/us/en/p/billy-bookcase-white-20522046/
- BILLY corner combination with extension units: https://www.ikea.com/us/en/p/billy-bookcase-corner-comb-w-ext-units-white-s99581504/

The PDFs and photos are downloaded once and stored in the repo (`source/`) so the pipeline and the site never fetch from ikea.com at runtime.

## How it gets made (decided)

### Pipeline: PDF to product data

- A Node/TypeScript script in the repo (e.g. `pipeline/extract.ts`), run by hand: `extract <pdf> --out data/products/<id>.json`.
- It sends the PDF directly to the Claude API (PDF document input; no rasterising step) and asks for structured output against a JSON schema. Requires `ANTHROPIC_API_KEY` locally. Model: latest Claude Opus.
- Output per product:
  - **parts**: panels (sides, top, bottom, shelves, back, plinth) with approximate dimensions in mm, and hardware with the IKEA part number from the manual's parts list (e.g. `118331`) and quantity.
  - **steps**: for each manual step, which parts enter, where they come from (direction), where they end up (position and orientation in the product's coordinate frame), and a short English instruction.
  - **source page** for every step, so it can be traced back to the PDF.
- Composite products are a separate, small data file: the combination lists its component products, quantities and placement, plus a final joining stage (corner hardware and extension units) taken from the relevant manuals.
- The generated JSON is reviewed and corrected by hand where needed, then committed. The site only reads committed JSON.
- Hardware geometry is not extracted per product: each hardware type (dowel, cam lock, cam screw, wood screw, nail, shelf pin, corner fitting, wall bracket) is modelled once in the renderer and referenced by part number.
- **Extraction gives semantics, shared code gives precision (my call).** The model extracts which parts, in which step, attached to which panel and at which edge or hole group, plus rough positions. A shared, product-agnostic rules layer written once in code (panel thickness, hole patterns along edges, how a cam lock seats against a dowel, how back-panel nails are spaced) turns that into exact coordinates. Panel dimensions are checked against the product page dimensions. This counts as automated: nothing in it is specific to one product.
- **Corrections are tracked and shown honestly (my call).** The raw model output is kept next to the committed JSON (`data/raw/` vs `data/products/`). "How it was made" shows how many fields were corrected by hand per product. The goal is to keep that number small through better extraction (page-by-page calls, the known hardware catalogue fed to the model, a check that extracted hardware counts match the manual's parts list), not to hide it.
- **Faithfulness check:** before a product is considered done, its animated steps are compared side by side with the PDF pages. The builder does this check, and the user signs off on the first bookcase before the rest are built.

### Site: static, Vercel

- Vite + TypeScript + three.js, deployed as a static site on Vercel. No backend, no secrets in the client.
- The 3D renderer is built on the iso-glow 3D shell (`assets/gallery-3d.html` from the iso-glow skill, MIT): hairline line tiers and crease extraction, dark/light themes, accent picker, **Iso view** (orthographic isometric) and **Revolve**. That shell is adapted into a module that builds scenes from product JSON instead of hand-written figures. The iso-glow skill gets installed locally for this.
- Keep the iso-glow footer credit ("Made with ISO-GLOW", linking to https://iso-glow.vercel.app) and the MIT licence notice.

### Page structure

**Showroom** (approved wireframe):
- Left: product list with the corner combination and each component product.
- Centre: product photo gallery side by side with the 3D canvas showing the assembled product (drag to orbit, iso view, theme and accent controls from iso-glow).
- Below: a **Made of** block for composite products listing the components and quantities. Clicking a component highlights it in 3D and links to its assembly.

**Assembly** (approved direction A, canvas first):
- A large 3D canvas is the hero. The PDF is not shown here.
- Step controls: previous, next, play/pause, and step counter ("Step 4 / 14").
- Each step animates: the parts for that step fly in along their direction and seat into place, hardware included (dowels pushed in, cam locks turned, nails tapped into the back panel).
- Under the canvas: the short instruction text and a list of the parts used in the step (name, part number, quantity).
- For the combination: assemble each unit, then the final joining stage.

**How it was made**:
- Tells the automation story: one manual page next to the extracted JSON for that step and the resulting 3D step. This is where the PDF appears.
- A short description of the pipeline and how to run it.

## Constraints

- **Private repository.** It holds IKEA's PDFs and product photos.
- **Password-protected deployment.** The Vercel link must ask for a password. Vercel's Password Protection is a paid deployment-protection feature; if the team's plan does not include it, the builder raises it with the user before falling back to anything else (e.g. Vercel Authentication, which only admits team members).
- **No deadline.** Full hardware detail applies to every unit; nothing is simplified to save time.
- **Build order (my call):** one 80 cm bookcase end to end first (extraction, review, showroom, full animated assembly), signed off by the user against the PDF; then the 40 cm bookcase, the extension units, the corner hardware, and finally the combination.

## Left to the builder

- Exact JSON schema, file layout, and how composite placements are expressed.
- Animation timing, easing, camera framing per step.
- How hardware is modelled (simple lathes and boxes are fine as long as each type is recognisable in the hairline style).
- Whether step text is taken from the model's output or tightened by hand during review.
- Responsive layout details; it must work on a laptop screen first, phone is a nice-to-have.
- Bundling three.js via npm rather than the CDN import map the iso-glow shell uses (my call: bundle it).

## Calls I made (not discussed)

- Vite + TypeScript + three.js static site, not Next.js; no backend is needed.
- Claude API with native PDF input for extraction; structured output; human review before commit.
- Source PDFs and photos stored in the repo; nothing fetched from ikea.com at runtime.
- Hardware modelled once per type in the renderer, not extracted as geometry.
- The "How it was made" tab and the "click component to highlight and jump" interaction.
