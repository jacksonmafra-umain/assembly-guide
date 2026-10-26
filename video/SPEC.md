# SPEC: Assembly Guide demo film

```text
GOAL:    the product team leaves believing any flat assembly manual can become an interactive 3D guide,
         automatically, and starts naming where they would use it.
OUTPUT:  HyperFrames, 1920 x 1080, 30 fps.
TIME:    60 s x 30 = 1800 frames. Music bed if a track is available; cuts follow the motion, payoff and mark on
         strong beats once the track is known.
LOOK:    two worlds from the subject itself:
         PAPER  = the real IKEA manual page, #ffffff ground, black line art exactly as printed, no tint.
         STAGE  = the app's iso-glow ground #121314, hairlines #6a7076 / #50555a / #34373b, panels #1b1c1f,
                  ONE accent ember #ff9d3c, only on the moving part, the payoff number and the end-card dot.
         Display: Inter 900, 96 px (8.9% of height), tracking -2%, ink #ffffff on STAGE / #111111 on PAPER.
         Body / labels: JetBrains Mono 500, 30 px, tracking +6%, #c9d0db (the app's own mono UI).
         App captures shown at 1.0 (full UI) or punched to 1.6-2x on the 3D canvas; text in captures >= 26 px
         after the push. No grain, no vignette, no added glow beyond the app's own lit part.
OBJECTS: the manual page (real PNG, step 4, cam-lock inset 119081), the BILLY bookcase (real app capture),
         the cam lock (real app detail capture), the corner combination (real app capture), the app shell
         (header, tabs, product list: real capture), the Assembly Lab mark (ember dot + "ASSEMBLY LAB" wordmark,
         the app's own brand from the header).
MOTION:  arrivals expo.out 0.7 s; camera pushes power2.inOut 1.2-2.0 s from 1.00 to 1.12; cuts hard on motion;
         page riffle 0.35 s per page with 12 px horizontal blur peak; titles land once and hold (no drift);
         the paper-to-stage turn is a colour flood power2.inOut 0.8 s.
SHOTS:
  01   0.0-4.0   PAPER step 4 page fills frame, push 1.00->1.12 toward the cam-lock inset;
                 reads "16 pages. Zero words." at 1.2 s (held to 3.8 s). Sound: bed enters.
                 Hands off: the inset circle grows into the next page.
  02   4.0-8.5   PAPER riffle of pages 7-16, one per 0.35 s, the step number big each time;
                 reads "Every step is a drawing to decode" at 5.0 s. Hands off: last page holds.
  03   8.5-12.5  PAPER floods to STAGE (lines invert to hairlines); reads "Assembly Guide" (display)
                 + "The manual, rebuilt in 3D" (mono) at 9.6 s. Hands off: the title's dot becomes the app header dot.
  04  12.5-17.5  STAGE app capture: Showroom, BILLY 80 photo + revolving 3D model;
                 reads "Photos next to a live 3D model" at 13.2 s.
  05  17.5-29.0  STAGE app capture: Assembly playing steps 1-3, punched to 1.5x on the canvas;
                 reads "Every part, every step, in order" at 18.2 s, then step text from the app itself.
  06  29.0-35.5  STAGE app capture: part detail on cam lock 119081, slow-motion fit;
                 reads "Click a part. Watch it fit." at 29.6 s. Sound: soft click on the seat.
  07  35.5-43.0  STAGE app capture: corner combination assembling (time-lapse);
                 reads "4 manuals. 72 steps. One corner." at 36.4 s (accent on "72").
  08  43.0-47.5  STAGE app capture: How it was made (manual page, JSON, 3D side by side);
                 reads "Read from the PDF by Claude" at 43.6 s.
  09  47.5-55.0  Claim + what's next: "Any manual. Any product." (display) at 47.8 s, then four lines, one at a
                 time over app close-ups, each 1.6 s: "Support & returns", "In-store screens",
                 "AR on your phone", "Is this the right part?"; labelled "What's next" (ideas, not features).
  10  55.0-60.0  End card: the ember dot drops in, "ASSEMBLY LAB" wipes in beside it, line
                 "github.com/jacksonmafra-umain/assembly-guide" under it, held 2.5 s.
BANNED:  the defaults in spec.md, except the app's own dark ground, hairlines and mono labels, which are the
         product's real look and appear only as the app uses them. Also banned here: mock UI of any kind,
         the IKEA logo, invented numbers, "unlock / seamless / effortless", three cards in a row,
         titles drifting after they land, everything fading and sliding up.
QA:      frame 0 (paper page readable, not black), 9.8 s (title on STAGE), 20 s (parts moving, text >= 26 px),
         31 s (cam lock filling >= 40% of frame), 39 s ("72" in accent), 50 s (one possibility line only),
         58 s (end card centred, mark 15-30% of width).
```
