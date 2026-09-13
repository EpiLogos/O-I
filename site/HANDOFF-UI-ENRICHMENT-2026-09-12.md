# Handoff — site redesign v2: full UI cleanup & enrichment

Recorded 2026-09-12 by the local session after pushing the current state of
`site/redesign-v2`. This is the brief for a fresh web chat session taking over
the site for a whole-surface UI cleanup and enrichment pass.

## State at handoff

- Branch `site/redesign-v2`, pushed to `origin` with upstream tracking. Start
  from the branch tip; everything described below is committed.
- The latest content work is commit `3bdd308d` ("site: deepen content —
  offices as aspects of Life, ref grammar, decisive distinction woven through
  pages and product copy"): a deep prose-enrichment pass over
  `site/content/public-site.md` and `site/src/shell/content.ts`.
- Preceding accepted commits (the trajectory to respect, do not regress):
  `6495ec22` hero video shifted right + vignette softened, `e3c84a11` hero
  title dropped + paler shift + vignette mask, `5df2b905` bone-white palette +
  un-pinned header, `08616a6c`/`07bdedd8` real layout system + un-boxed
  layouts.

## What surface this is

The redesign target is the **v2 shell**, not the v1 document pages:

- Entry: `site/shell.html` → `site/src/shell/main.tsx` → `ShellApp.tsx`
- Hash-routed pages: `home`, `oi`, `products`, `shared-field`, `research`,
  `build` (nav in `ShellNav.tsx`)
- The v1 pages (`index.html`, `oi.html`, `products.html`, … driven by
  `src/lib/public-content.ts` from the markdown) still exist in parallel and
  are out of scope here.

Run it:

```sh
cd site
npm install
npm run dev      # open /shell.html
npm run build    # tsc -b && vite build — must stay green
```

## File map (everything you need lives in these)

| File | Role |
| --- | --- |
| `site/src/shell/content.ts` | ALL copy and page/section structure (`PAGES`, `PRODUCTS`). Section fields: `eyebrow`, `title`, `sub`, `body` (multi-paragraph, split on `\n\n`), `layout`, `tone`, `items`, `figure`, `media`. |
| `site/src/shell/ShellApp.tsx` | Hash router + section renderer. Layouts: `band` (full-bleed video + shade), `statement`, `split`, `feature` (poster figure, `flip` variant), `grid`, `index` (numbered rows). |
| `site/src/shell/HeroParallax.tsx` | The hero. Lenis smooth scroll (lerp 0.09) + GSAP ScrollTrigger scrub. Four `ShellMark` layers over a `VideoField`. |
| `site/src/shell/VideoField.tsx` | Looping point-cloud video field with `zoom` / `shift` props. |
| `site/src/shell/ShellMark.tsx` | The O:I mark drawn as pieces (`braces`, `ring`, `colon`, `bar`) — thin black edges, transparent body so the point cloud shows through. |
| `site/src/shell/shell.css` | All v2 styles (~800 lines). Hero `.pl*`, video field `.vf*`, sections `.sec*`, band `.band*`, opening `.opening*`, footer `.sf*`. |
| `site/src/tokens.css` | Palette + rhythm + type tokens: `--oi-black/white/paper/ink/gold/dust`, `--oi-section-x/y`, `--oi-type-*`. Warm bone-white ground, near-black ink, one scarce gold. |
| `site/content/public-site.md` | Human-editable content source of record. The shell's `content.ts` was hand-mirrored from it — keep the two in sync. |
| `site/public/media/motion/` | Assets: `oi-pointcloud-{a,b,c,d}.mp4`, `oi-pointcloud-poster-{1,2,3}.jpg`. |

## Owner's verdict on the current state (the brief, in their words)

- **Good, keep:** the video sections, the image parts, the basics overall.
  Some text sections are fine.
- **Hero:** liked, but the video is **too zoomed**, and it needs a **better
  mask** and **better scroll/animation logic**.
- **Text sections:** kinda basic — need enrichment.
- **Layout:** certain bits aren't great.
- **General bar:** keep the design intent; make every interaction state and
  animation cleaner and more professional.

## Workstreams

### 1. Hero video treatment

- Current: `HeroParallax.tsx:74` renders `VideoField media="b" zoom={1.12}
  shift={4}`. The 1.12 zoom still reads as cropped/tight — bring it toward
  ~1.0–1.05 and re-evaluate the `shift` offset.
- Mask lives in `shell.css:246–250` (`.pl__video .vf__video`):
  `radial-gradient(120% 105% at 50% 45%, #000 50%, transparent 82%)`. Rework so
  the cloud dissolves into the bone-white ground with no visible vignette
  rim and no hard rectangle edge at any viewport ratio (the generic `.vf`
  mask at `shell.css:227–228` has the same issue).
- The shade layer `.pl__shade` (`shell.css:252`) scrubs `scaleY 0.4→1,
  opacity 0.6→1` — decide what it is actually for now that the title is gone;
  either give it a purpose (legibility ramp, scroll fade) or simplify it away.

### 2. Hero scroll/animation logic

- The scrub timeline (`HeroParallax.tsx:30–57`) moves four mark layers
  `yPercent` out-then-back (36/24/13/6) with `ease: 'none'`. That reads as
  drift without intent. Rebuild it with a legible idea — e.g. layers
  separating at different rates as you scroll away, the video scaling or
  settling, opacity handing off to the first content section — with real
  easing, not linear scrub.
- `prefers-reduced-motion`: the hero effect currently returns early, which
  just disables everything; the `VideoField` effect skips its play() fallback
  while the `autoPlay` attribute still fires natively. Make reduced-motion a
  designed static state (poster/still cloud, mark composed, no Lenis), not a
  degraded accident.
- Keep Lenis + ScrollTrigger wiring and its cleanup (it is correct today).

### 3. Text section enrichment (the "basic" problem)

- Long multi-paragraph bodies (`content.ts` bodies are now 2–4 paragraphs)
  render through the naive `Prose` splitter into `.sec__prose` — verify
  measure (~60–70ch), line-height, paragraph spacing, and that statement
  layouts don't become walls of text.
- Give each layout a distinct typographic treatment: `statement` as
  editorial pull-quote territory (larger leading line, restrained body),
  `split` with a clearer head/side hierarchy, `eyebrow` styled as a real
  kicker (letterspaced small caps, rule or index number).
- Inline emphasis in bodies (e.g. `Objective Internality ≠ Subjective
  Immediacy`, the `Ref → Relation → Operation → Consequence → Return`
  grammar) deserves a styled treatment (mono or highlighted line), not plain
  paragraph text.

### 4. Layout cleanup

- Audit all six layouts for spacing rhythm (use `--oi-section-y/x`), max
  widths, and the dark/light tone alternation (`sec--dark` / `sec--light`) —
  transitions between alternating sections should feel deliberate.
- `band` sections default to `zoom={1.3}` (`ShellApp.tsx:106`,
  `VideoField.tsx:17`) — same over-zoom question as the hero.
- `feature` figures are raw `<img>` posters (`ShellApp.tsx:89–95`) — give
  them consistent framing/mask so they sit in the same visual family as the
  video fields.
- Mobile: `shell.css` has responsive blocks (~line 780+) — walk every layout
  and the hero at phone width; nothing should crop badly or overlap.

### 5. Interaction & motion polish

- Add restrained reveal-on-scroll for sections (opacity/translate, small
  distance, once) — the page currently pops in with no life below the hero.
- Nav: hover/focus/active states, and a clean (non-jarring) transition
  between hash routes (scroll-to-top is currently instant and abrupt).
- Links (`sec__link ↗`), item rows (`sec__rows`), grid cells (`sec__cells`):
  consistent hover states at a professional level of subtlety.
- Centralise easing/durations in `tokens.css` and use them everywhere; honor
  `prefers-reduced-motion` globally via a single media query pattern.

## Constraints

- **Keep the design intent.** Bone-white point-cloud field, near-black ink,
  scarce gold, thin-edge transparent mark, alternating light/dark editorial
  sections. Refine; don't re-skin.
- Video and imagery are the liked parts — improve their treatment (zoom,
  mask, motion), don't replace or bury them.
- `npm run build` must stay green (strict TS). No new heavyweight deps —
  GSAP + ScrollTrigger + Lenis are already there and sufficient.
- Keep `content.ts` and `content/public-site.md` in sync when copy moves.
- Copy is settled (just enriched at `3bdd308d`) — this pass is about **UI,
  layout, and motion**, not rewriting the words.

## Acceptance

- Build green; all six hash routes render correctly.
- Hero reads well at rest and through the scroll; no visible over-zoom or
  vignette rim; reduced-motion state is deliberate.
- Text sections feel enriched (hierarchy, measure, rhythm), not basic.
- All animation/interaction states are subtle, consistent, and professional;
  mobile holds up.
