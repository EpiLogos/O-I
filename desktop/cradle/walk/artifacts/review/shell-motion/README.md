# Shell motion review — 2026-09-08

Real browser walk against `http://localhost:1423` at 1280×820.

- Left open samples (px): `71.5, 174.4, 198.3, 223.1, 234.1, 237.0, 239.7, 240.0`. The canvas left edge remained exactly four pixels after the sidebar edge at every sample; the inner sidebar surface stayed 240px and was progressively revealed without content reflow.
- Resize affordance: 9px transparent pointer target; rendered line 1px; hover settled to `rgb(48,55,47)` (`--oi-ink: #30372f`); target background remained transparent.
- Right full samples (px): `535.2, 720.1, 908.7, 981.9, 1014.5, 1028.4, 1031.2, 1032.0`; restore samples: `818.0, 632.6, 443.5, 370.1, 337.5, 328.9, 320.8, 320.0`. The right edge stayed fixed at 1276px throughout both transitions.
- Canvas top-gap measurement: `0px` between the window strip and centre plane.
- Duplicate focused filename nodes in the global footer: `0`.
- `npm run build`: passed (TypeScript and production Vite bundle).

Screenshots: `final-shell.png` and `final-right-full.png`.

The existing `spatial` scenario could not start because its fixture expects the obsolete `Work/Editor` project (`[data-project-path="Work/Editor"]`); the focused measurements above drove the current real Central navigator and shell instead.
