# Point-cloud options · 8 September 2026

Isolated visual proposals, commissioned separately from the shell tranche. No production integration or provider activity is implied. Only files in this directory were authored for this task. Existing SpatialFeedback.tsx was inspected but not changed.

Open `index.html` through an HTTP server rooted at the O-I repository; its six-level relative imports consume the actual shared `tokens.css`, `point-cloud.css` and `loading.mjs`. For example, from the repository root run `python3 -m http.server 4287 --bind 127.0.0.1`, then visit `http://127.0.0.1:4287/desktop/cradle/walk/artifacts/review/point-cloud-options/`.

| Option | Use | Tradeoff |
| --- | --- | --- |
| 01 · Arrival | One 240 ms opacity/scale trace when a deliberate tab switch finishes | Optional polish; avoid triggering from both pointerdown and focusin. It adds no semantic information and should wait for stable panel behavior. |
| 02 · Local work | Existing small field beside an observed operation label | Preferred default for ongoing work while content stays usable. Host must drive start/stop from actual operation state. |
| 03 · Surface entry | Actual shared loading mark at a 190 px surface scale | Use only when the surface has no usable content yet. Existing 480 px window scale remains available for genuine initial bootstrap. |

Recommendation: 02 and 03 have distinct useful roles. Keep 01 optional until the owner chooses it. Static screenshots show the layout; use the buttons to judge motion. Screenshots are captured at 2× display density to retain the shared fine-dot pattern.

## Resource behavior and evidence

No dependency additions, particle engine, canvas, requestAnimationFrame loop, timers or synthetic progress. Arrival retains at most one Web Animation and cancels before replacement. Local work has one CSS opacity animation; loading has one shared pseudo-element animation. IntersectionObserver and visibilitychange suspend continuous previews; reduced-motion retains static marks. Stop all previews is immediate. Controls explicitly say preview so simulated visual states cannot be mistaken for real product work.

Playwright exercised this actual artifact in Chromium; `checks.json` records: no page errors; zero animations at rest; two with local-work and loading active; zero with reduced motion; zero after 30 interrupted arrival previews and settling; no overflow at 390 px; offscreen activity disabled. These are bounded visual lifecycle checks, not native GPU/CPU/memory measurements or a foundation acceptance claim. The loading mask animation may require paint work; native resource measurement belongs after a chosen integration.

The earlier SpatialFeedback implementation listened globally to pointerdown and focusin, so one physical interaction could restart it twice. The UI lead subsequently removed that global production effect. A selected arrival option should instead be called by the successful tab transition with semantic focus/selection left intact. This proposal does not make that integration.
