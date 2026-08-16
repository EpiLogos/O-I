# O:I public site

The public O:I front door is a small React + TypeScript site with a shadcn-compatible component layout and Tailwind CSS.

Its stable public navigation grammar is:

```text
Understand · Explore · Build
```

The first substantive content after the parallax identity is the canonical six-product field: Central, Actuation, AIKit, Software Factory, Workcell, and Quaternal Logic.

## Development

```bash
cd site
npm install
npm run dev
```

Production build:

```bash
npm run build
```

The Vite build uses relative asset paths so the output can be served from GitHub Pages or another static host.

## Component structure

The shadcn alias is configured so reusable UI components live at:

```text
src/components/ui/
```

The parallax hero is `src/components/ui/parallax-scrolling.tsx`. It uses GSAP + ScrollTrigger and `@studio-freight/lenis`, replacing remote demo artwork with O:I-native SVG layers.

The hero is built from vector pieces rather than backgrounded raster images. A white, `mix-blend-mode: difference` identity layer sits above a black wipe, so the same mark reads black on white and then white on black during the scroll.

## Design tokens

`src/tokens.css` owns the foundation and semantic token layer used by the front door:

- surface / foreground / muted;
- border/rule;
- relation / focus / projection;
- scarce gold `meta-relation`;
- spacing/rhythm;
- typography scale;
- motion.

The front door uses only the house light/dark surfaces. The semantic layer is intentionally suitable for later world-presentation remapping on the parallel Explore programme without implementing participant theming here.

## Media

All site media lives under:

```text
public/media/
```

Production marks are in `public/media/brand/`. The twelve supplied visual studies are preserved under `public/media/brand/reference/` as source/reference material and are not runtime dependencies.

## Shared-field boundary

Shared-field semantics do **not** live in React. The canonical UI-independent business-logic floor is the repository-level `../shared-field/` module. It owns Participant, Projection, SharedField, Contribution, Encounter, provenance and the `selfOtherReadModel()` semantics.

The browser layer remains thin:

```text
shared-field canonical contracts
        ↓
site/self-other-read-model.mjs
        ↓
React presentation-only view model
```

`self-other-read-model.mjs` validates the fixture through the canonical contracts and returns only the fields the visual component needs. `self-other-read-model.test.mjs` proves this boundary in CI alongside the shared-field and projection-renderer tests.

`projection-renderer.mjs` remains the generic sparse Projection adapter and support proof. It is not a second application entry point.

The root stays general:

```html
<main data-oi-surface="projection-root" data-oi-state="front-door">
```

The Self / Other proof is subordinate to the front-door narrative and is explicitly fixture-backed. Live addressable worlds, search, hosting and wiki projection belong to the equal parallel Explore programme tracked by issue #18.
