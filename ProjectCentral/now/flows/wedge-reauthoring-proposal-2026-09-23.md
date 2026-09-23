# The left corner wedge — a re-authoring proposal for the owner's eye

*Flow: ui/shell-law programme, 2026-09-23. Status: PROPOSAL — nothing landed.
Owner ruling 5 (DESKTOP-LANGUAGE.md, 2026-09-22): the corner treatment is
never silently removed or reshaped; its precise geometry returns to the owner
for recognition. This document is that return. No wedge code exists to
restore — the refinement died twice uncommitted (09-20, 09-22 resets) and was
never written to the branch; verified across the working tree, the stash list
and the reflog before this proposal was drafted.*

## The three laws any wedge must satisfy

1. **The corner toggles stay visible and clickable in every mode**
   (`src/workspace/shell.css` ~410–414). The window row rides above every
   region — `.shell-topbar` sits at `z-index: drawer + 1` with
   `pointer-events: none` on the bar and `auto` on its buttons — so the
   navigator toggle, region toggles and agent toggle work over the canvas,
   the drawer and the floating panels alike. Geometry may not touch z-order
   or hit targets.
2. **The cut floor lands exactly on the canvas top edge** (`shell.css`
   ~449–455). The left corner's floor is `calc(var(--oi-shell-tabbar) + 1px)`
   — tab strip height plus its hairline. Shallower and the cut slices the
   strip's hairline, leaving a grey sliver across the notch; deeper and the
   band reads too tall. (The right corner is deliberately ~3.5px deeper —
   the 09-19 ruling plus the 09-20 refinement: each corner carries its own
   depth.)
3. **Hosted applications align with the posted cutout** (`src/expressions/
   hostedApp.ts`). The shell posts `{width, height, right}` — the lights
   corner, the tab-bar depth, and the far corner's icon reserve — whenever
   the shell moves (resize, side regions, the lights flip). The hosted
   masthead turns those into its own insets so the app's header row and the
   shell's cut corners read as one continuous aligned edge. Any new geometry
   must keep the posted numbers describing the real cut.

Current reserve: 42px when the traffic lights are absent, 116px while they
show (`data-window-lights`, committed 2026-09-22 as b7f9bfd8). Both corners
cut with rectangular notches today.

## The three options

Each option is drawn only inside the existing clip-path polygon; z-order,
hit targets, the floor constant and the posted contract stay as the laws fix
them. Screenshots for each render the rest page (lights present), same
viewport; committed beside this file.

### Option A — Square notch (the state on the branch today)

The corner is cut horizontally: reserve wide, `tabbar + 1px` deep. The
lights sit in a rectangular void whose floor is the canvas edge.

- Reads as: absence — a notch, not a form.
- Cheapest; zero contract risk; it is what every walk currently proves.
- It does not express anything: the corner the owner asked to keep working
  "with the corner icons" has no shape of its own.

### Option B — Full diagonal wedge

One slope from the window's top edge down to the canvas edge: the polygon's
two left horizontal segments become a single diagonal from
`(reserve, 0)` to `(0, depth-left)`. The tab strip's first tab clears the
slope's foot; the lights sit in the open wedge.

- Reads as: a deliberate cut corner — the same cut-corner language the
  right corner and the hosted mastheads already speak. Strongest identity.
- The diagonal spends the full reserve: at 116px of lights reserve the slope
  is shallow (~5°), which can read as a rendering slip rather than a shape.
  With the lights hidden (42px) it steepens to ~14° and reads best.
- Hosted alignment: the masthead's first-icon inset must follow the slope's
  run, not the reserve — the posted `width` stays the reserve, but the
  masthead needs `reserve` clearance only at the very top row, which is
  exactly its one-row height, so the existing contract holds unchanged.
- Risk: every tab-strip element that assumed a horizontal floor needs its
  left padding verified against the slope (the strip's own floor is the
  same tabbar+1px line, so the risk is one padding rule).

### Option C — Chamfered notch (recommended)

Keep the notch's horizontal floor at the canvas edge exactly as today, and
add one short 45° chamfer — 10px of run, 10px of rise — at the notch's
outer foot, where the material's outer wall meets the floor. The notch
flares a little at its base instead of ending in a hard inside corner; the
right corner can take the mirrored chamfer in the same rule so the two
corners rhyme.

- Reads as: a shaped corner that stays quiet — closest to the reference
  shells the convergence review drew on (Buzz, Grok) without inventing a
  new motif. (Rendered, it stays subtle next to A; its value shows most
  with the traffic lights present, where the reserve is 116px.)
- Contract risk: none beyond the polygon (the floor segment keeps its
  height; the posted numbers are unchanged; the toggle row keeps its full
  reserve because the chamfer rises above the floor, not into it).
- Cost: one clip-path edit + the mirrored right-corner variant, one
  screenshot pass.

## What the owner is being asked to recognise

A shape, and only a shape: A (leave the notch square), B (commit to the full
diagonal), or C (the stepped shoulder, mirrored right). On a ruling, the
change is one commit to the corner clip-path rule plus screenshots; nothing
in the toggle, floor or hosted contracts moves. Until the ruling, the corner
regime stays exactly as it stands on the branch (Option A), per ruling 5.

## Evidence

- Screenshot set: `wedge-option-a.png` / `wedge-option-b.png` /
  `wedge-option-c.png` beside this file — the real app (dark appearance,
  left region closed, a flow open), which is the corner regime's own
  context: with the navigator open the reserve spends against the sidebar
  and no left cut renders at all (`--window-cutout: max(0px, reserve −
  left-width)`). Each option is a live override of the one clip-path rule
  (`desktop/cradle/scripts/wedge-option-shots.mjs`, throwaway render pass,
  uncommitted except as images and the script).
- Laws: `desktop/cradle/src/workspace/shell.css` (window-row rule, corner
  cut rule), `desktop/cradle/src/expressions/hostedApp.ts` (`shellCutout`,
  `trackShellCutout`), `packages/oi-design-system/DESKTOP-LANGUAGE.md`
  ruling 5. Contract test for the carried regime:
  `desktop/cradle/tests/window-lights-contract.test.mjs` (7/7).
