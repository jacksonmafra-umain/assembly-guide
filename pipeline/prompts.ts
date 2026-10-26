import type { Vec3 } from '@shared/schema';

export const SYSTEM = `You turn IKEA furniture assembly manuals into structured data for an animated 3D assembly guide.
The manuals are wordless line drawings. Read each drawing carefully: count every part, follow arrows, and note which panel each piece of hardware goes into.
Write all text in English. Be literal about what the drawing shows; do not invent steps that are not drawn.`;

const FRAME = `Coordinate frame (millimetres, degrees): origin at the back-left-bottom corner of the fully assembled, upright product as seen from the front.
+x runs along the width from left to right, +y runs from the back towards the front, +z points up.
Panel sizes are given in this frame in their final assembled orientation (a side panel is thin in x, deep in y, tall in z).
A panel pose position is the panel's minimum corner (smallest x, y, z) in this frame; rotation is normally {x:0,y:0,z:0} because sizes are already oriented.
A face is named by its outward normal in this frame: "+z" is a panel's top face or top edge, "-x" its left face, "+y" its front edge, and so on.`;

const KINDS = `Hardware kinds (pick the closest):
- dowel: short wooden peg with grooves.
- cam-lock: round metal disc with a slot or arrow, set into a hole in a panel face and turned to lock.
- cam-screw: metal pin screwed into a panel edge that the cam lock grabs.
- wood-screw: ordinary screw.
- nail: thin nail, usually for the back panel.
- shelf-pin: small metal pin that holds an adjustable shelf.
- corner-fitting: metal bracket joining two units at a corner.
- wall-bracket: wall anchor / tip-over restraint.
- connector: bolt or sleeve joining two panels or units.`;

export function inventoryPrompt(name: string, dims: Vec3 | null): string {
  return `This is the complete assembly manual for "${name}".
${dims ? `The assembled product measures ${dims.x} mm wide, ${dims.y} mm deep and ${dims.z} mm high.` : 'The product page gives no assembled dimensions.'}

${FRAME}

${KINDS}

Return:
- materials: panelThickness and backThickness in mm (BILLY-style particleboard is usually about 15 mm, a hardboard back about 3 mm; use what the drawings and dimensions imply).
- panels: every wooden panel in the box, one entry per physical panel, with a short stable id (e.g. "side-left", "side-right", "top", "bottom", "fixed-shelf", "shelf-1", "back", "plinth"), an English name, a role, and its size in the frame above. Sizes must add up to the product's outer dimensions.
- hardware: every line of the parts list, with the part number exactly as printed, the kind, and the quantity printed next to it.
- stepPages: every numbered assembly step in order (index 1..n, matching the manual's step numbers) with the 1-based PDF page numbers on which that step is drawn. Ignore safety, tools and parts-list pages.`;
}

export function stepPrompt(index: number, inventoryJson: string): string {
  return `These pages show step ${index} of the manual. The full parts inventory, already extracted, is:

${inventoryJson}

${FRAME}

Return step ${index}:
- index: ${index}
- sourcePages: leave empty, it is filled in later.
- text: one short imperative English instruction for this step, naming parts and quantities ("Insert 4 dowels into the top edge of the left side.").
- actions, in the order they happen in the drawing:
  - place-panel for each panel that joins the assembly in this step: its panelId from the inventory, its final pose in the frame above, and "from": the axis direction the panel comes in from (the opposite of the arrow in the drawing; a panel lowered onto the assembly comes from "+z").
  - insert-hardware for each group of hardware going into one face of one panel: partNumber and kind from the inventory, count, target panelId and face, and "from". Only add offsetsMm (distances along the face from its low-coordinate end) or acrossMm when the drawing clearly shows positions; otherwise leave them out.
  - reorient when the drawing turns the whole assembly (e.g. stands it up from lying on its back): the new pose of the assembly.
Use only panel ids and part numbers from the inventory. A panel is placed exactly once in the whole manual.`;
}
