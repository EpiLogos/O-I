# O:I public site

The public O:I front door is a small React + TypeScript site with a shadcn-compatible component layout and Tailwind CSS.

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

The parallax hero is `src/components/ui/parallax-scrolling.tsx`. It uses GSAP + ScrollTrigger and `@studio-freight/lenis`, replacing the remote demo artwork with O:I-native SVG layers.

The hero is deliberately built from vector pieces rather than backgrounded raster images. A white, `mix-blend-mode: difference` identity layer sits above a black wipe, so the same mark naturally reads black on white and then white on black during the scroll.

## Media

All site media lives under:

```text
public/media/
```

Production marks are in `public/media/brand/`. The supplied visual studies are preserved under `public/media/brand/reference/` as source/reference material and are not runtime dependencies.

## Projection boundary

Projection semantics do **not** live in React. The canonical UI-independent business-logic floor is the repository-level `../shared-field/` module. It defines Participant, Projection, receipt, Central public selection, revision/withdrawal, provenance and transport-neutral capability semantics.

`projection-renderer.mjs` is the existing browser adapter from that semantic contract to a sparse view model/DOM rendering. It is preserved beside the React front door while the final projection UX is developed. The React site should consume the same contract through a small adapter rather than duplicate its rules in components.

The public landing page currently advertises only its truthful state:

```html
<main data-oi-surface="projection-root" data-oi-state="front-door">
```

A typed projection can become another state of this same browser surface without creating a second site architecture.
