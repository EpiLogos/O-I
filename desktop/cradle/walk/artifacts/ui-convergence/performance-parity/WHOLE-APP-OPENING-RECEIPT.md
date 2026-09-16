# Ordinary desktop opening: hardware trace

Observed on 2026-09-15 through the actual WALK production build served at
`http://127.0.0.1:4321`, before the final restored-presentation and live
reduced-motion edge repairs. `opening.json` records the index SHA-256;
`opening-bundle-hashes.json` records the served asset bytes. This observation
does not cover those subsequent source changes.

The real Rust walk bridge ran on port 4330 with the same kernel implementation,
a fresh isolated `OI_HOME`, and Central as its source root. No kernel transport
or owner result was replaced. The probe used actual Chrome / Apple M4 Metal,
1280×820 CSS pixels, DPR2, and separate fresh light/dark browser contexts.

WebGL calls were observed without readback during loading and flight. The first
timestamp is an actual native default-framebuffer **draw submission**, not a
claim to a compositor-presented pixel timestamp. Resource Timing records the
real workspace chunk request; DOM observations record composition and entry.

| Event, ms from navigation | Light | Dark |
| --- | ---: | ---: |
| First native framebuffer draw | 272.3 | 137.0 |
| CradleFrame JS request begins | 277.4 | 140.3 |
| Desktop shell composed beneath field | 300.2 | 174.3 |
| Ready control enabled | 323.0 | 178.6 |
| Entering frontstate duration | 2618.7 | 2612.3 |

The workspace request starts after the native draw in both cases. The workspace
is composed, inert, and hidden from accessibility until entry. During the short
42–51 ms draw-to-ready interval, three/four native draw submissions occurred;
this interval is too short for a stable FPS claim. The largest observed gap was
29.6 ms. Native initialization produced one long JavaScript task of 118 ms in the
light run and 77 ms in the dark run, before the first native draw.

Steady rest and flight, excluding their short boundary transitions, both ran at
approximately 60 fps (mean intervals 16.67–16.68 ms). The field stayed visible for
the complete approximately 2.6-second entry. Across rest, flight and release,
each window kept exactly one held actual WebGL context at 2560×1640. It remained
healthy after ordinary release, as required. No native draw followed entry in
the final 1.2-second idle window. Stage diagnostics reported no live or scheduled
presentation, focus returned to `root`, no non-engine canvas or legacy Expression
SVG was present, and both runs had zero page errors.

`opening-summary.json` contains bounded metrics; `opening.json` contains raw draw,
resource, DOM and long-task timestamps. `opening.mjs` is the replay source and
`opening-kernel.log` preserves its real bridge result. Entered screenshots were
captured after measurements, in `opening-{light,dark}-entered.png`.

The observed walk-read API omitted playback details in this build, so the
duration and completion observations use real DOM/native-draw timing rather
than claiming unavailable internal diagnostics. The root task is checking that
read seam for its final full-sequence regression. This ordinary empty-workspace
case does not cover restored Expression, Knowledge or Nara competition; those
final priority cases remain with the active integration work.
