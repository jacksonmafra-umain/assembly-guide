# Review: Assembly Guide demo film

## Creative calls

- Storyline A, "The page comes alive" (picked by the person). Not built: B "Before and after" (split screen to one) and
  C "One dowel's journey" (one continuous take). Both are in `STORYLINES.md`.
- Everything that claims to be the product is a real capture: the app was recorded frame by frame in its `?capture`
  mode (virtual clock, GPU Chrome); the manual pages are the real IKEA PDFs rendered with pdf.js.
- The app's own dark iso-glow ground, hairlines and mono labels are used as the product uses them (an exception to the
  default ban on dark grounds and mono labels, because they are the brand's real look).
- App captures sit as a window on the same ground with the title band below, so no text ever sits on the UI.
- No music: there is no music source on this machine (no HeyGen sign-in, no local model). The film carries
  on-screen text plus a few sound effects on visible actions: whooshes on the cuts into new worlds, a click on the
  part-detail zoom, a soft click on the seat, a riser into the end card and a bass hit when the dot lands.
- The IKEA logo does not appear; "BILLY" and the manual pages do.

## Measured vs looked at

- `hyperframes check`: no errors; warnings fixed (audio clips now have durations, "What's next" lines held long
  enough to read). Remaining info-level `container_overflow` on the push wrappers is intended (they scale inside a
  clipped frame).
- Looked at: the review beat sheet, the cut strips and the phone sheet (360 px). All titles read at phone width.
- Sound: placed by timing and the measured peak of the bass hit; measured with `hyperframes audio` after render, not
  heard.

## Weakest shot

- 09 "What's next": the revolving combination on the right is small and dark inside its frame; with more time it
  would get its own capture, framed tight on the 3D canvas, or one real visual per idea.
- 05 opens on two small staged panels before the push-in brings the bookcase up to size.

## Kept on purpose

- `container_overflow` (info) on `#s01-push`, `#s05-push`, `#s07-push`, `#s09-v`: camera pushes inside clipped frames.
