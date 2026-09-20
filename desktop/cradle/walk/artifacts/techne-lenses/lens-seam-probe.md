# Technē lens seam — probe receipt (T3, 2026-09-19)

Result: PASS · 9/9 steps

- ok — registration: exactly six M′ lenses stand in the mount registry · project, canvas, timeline, journey, place, palace
- ok — registration: a duplicate lens registration is refused · A Technē lens for project is already registered
- ok — resolve once, lens many: six-lens round trip on one subject · provider reads 6→6, one session, hops 5
- ok — no false waiting: every resolved lens mounts its body immediately · project:mounted canvas:mounted timeline:mounted journey:mounted place:mounted palace:mounted
- ok — journey real refs: the Studio panel names the reading's own Expression scene refs · 2 real scene beats — oi.expression:probe:scene:oneoi.expression:probe:scene:two
- ok — lifecycle: canvas mount → unmount → remount ×3 with Studio release · 3 remounts, final release [body:null, tools:null]
- ok — lifecycle: journey mount → unmount → remount ×3 with Studio release · 3 remounts, final release [body:null, tools:null]
- ok — four states: each renders its named state with the actual reason
- ok — no page errors across the whole probe

Probe: `node walk/techne-lenses-probe.mjs` (vite 4391 + playwright, page `tests/techne-lenses-page.tsx`).
The six lenses register through `src/techne/lensMount.ts`; the disclosure is the real
`useTechneDisclosure` over a counting fixture provider; the session is the one
`DisclosureSession` store (`src/techne/session.ts`).
