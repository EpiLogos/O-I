# Expression overlay — integration spec for the cradle wayfinder, 2026-09-08

Standing: owner-adopted design commitment over an owner-directed visual study.
The owner agreed the points on 2026-09-08 and asked for the work to step onto
the wayfinder; D22, W1.8 and FND-07 are written there and in the programme,
with the build brief at `.superpowers/sdd/cradle-rebuild/BRIEF-FND-07-EXPRESSION-2026-09-08.md`.
No production code is changed by this document. Evidence of record: the running
study at `walk/artifacts/review/point-cloud-elements/` (index.html, checks.json,
screenshots), revision 6.

## What the study established

- **Forms** are continuous, stateful fields drawn from fine graphite grain: the
  four elemental loading directions (fire, water, air, earth), three quiet forms
  (arrival, presence, relation) and six agent-state forms (thinking, listening,
  holding, searching, settling, waiting). Revision 4 thinned density by roughly
  forty percent across the board and kept the finer grain.
- **Gestures** are bounded wisps with an anchor rect, a direction and a time.
  They ride one full-window overlay canvas, not the component. The component
  lands by its own token-driven transition first; the wisp answers afterwards,
  around its edges, and is gone within about a second. Less is more.
- **Directional awareness.** A gesture knows where the thing came from and
  where it is going: `from` and `rect` give a direction of travel, or `dir`
  gives an explicit vector, and `lean` bends the wisp that way. A panel opened
  from a button leans away from the button; a dragged chip's wake leans against
  its motion.
- **Temporal awareness.** `delay` schedules a start on the shared clock; `hold`
  keeps an emitter live until released (a resize edge while the pointer is
  down); `then` chains a follow-up gesture when one ends (close leaves a trace,
  then the summoning button breathes). All of it runs on the one scheduler's
  time base, so tempo, pause and reduced motion govern it uniformly.
- **Round grain.** Dots are drawn from a soft circular sprite at roughly four
  device pixels of diameter with a low opacity ceiling. Below that size a dot
  can only rasterise as a block, so fineness is carried by opacity and density,
  not by sub-pixel radius.
- **Owner steer (2026-09-08).** Keep idle/waiting, listening, presence,
  arrival, searching and the four elements. Thinking, holding, settling and
  relation are reserve. Of the interactions only panel resize is kept, as the
  reference for subtlety; revision 6 replaces the rest with two raw
  demonstrations of the system (drag-to-direct with hold; anchored edges with
  delay and chain). Ink is muted grey, never black. The vocabulary is settled
  at W1.8, in the running app.
- **Agent expression** is a state class, not a widget. One field morphs between
  forms by crossfade when the class changes, and the same change breathes on the
  overlay around that field.
- **Themes hold.** The study switches the root class between `oi-desktop`,
  `oi-surface-light` and `oi-surface-dark` from the shared tokens and re-reads
  ink from `--oi-foreground`. Dark resolves to a light ink with no other change.
- **Lifecycle is honest.** One scheduler, thirty drawing frames per second at
  most, visible fields only, emitters expire, nothing draws while paused, hidden,
  reduced-motion or under the initial-load preview, and the overlay is pixel
  clear when idle. `checks.json` carries these as data.

## Why it belongs on the map

D18 rules that attention renders through typed **notify** modalities in the
house visual language, never layout movement, tied to real activity events.
D9 rules the design system is extended, never bypassed. D15 rules every
interactive element is a canonical Action on a stable ref. Law 11 rules the host
themes every body. The expression overlay is the concrete carrier of D18 and the
first surface where D9, D15 and law 11 are exercised together by something
visibly alive: a gesture is the visual return of an Action; a form is the visual
reading of an owner-reported state; both are drawn only from tokens.

It is also the cheapest honest validation of the composability and agent-native
chains. A contribution that expresses through the overlay proves it never
self-chromes (law 11). An agent whose state reaches the overlay proves the state
enum crosses the AIKit seam as data (D4, law 4). Neither needs a new owner.

## Map insertions (adopted by the owner on 2026-09-08 and written to the wayfinder and programme)

**D22 Expression is a notify modality with two classes.** Forms (continuous,
owner-state readings) and gestures (bounded, Action returns). One full-window
overlay per host window draws both. Components never draw points; they post
intent through one seam and the overlay answers around their rects. Agent state
is an enum owned by the agency seam; the design system owns only its mapping to
forms. Reduced motion holds a still form and refuses gestures. Cites D18, D9,
D15, D4, law 7, law 11.

**Unit FND-07 Expression overlay** `(S)` · brief: `BRIEF-FND-07-EXPRESSION-2026-09-08.md` · files: `packages/oi-design-system/
expression.mjs` (+ `expression.css`, motion tokens appended to `tokens.css`),
`desktop/cradle/src/shared/Expression.tsx` (overlay host + `express()` seam with rect, direction and time),
consumers in `src/agent/AgentLayer.tsx` (state class → form) and the surface
engine (`src/surface/engine.ts`: open, close, split, resize, save events →
gestures) · operation: the overlay mounts once in `Cradle.tsx`, reads component
rects on demand, never owns state · walk: open, close, resize, split and save on
real surfaces each produce exactly one bounded gesture and the emitter count
returns to zero; two real encounters change agent state and the field morphs
with no widget swap; every gesture is off while `prefers-reduced-motion` holds;
frame budget stays under the thirty-frame cap with four surfaces live; the
overlay is pixel clear when idle; no raw value in component CSS.

**Waypoint W1.8 Expression vocabulary.** Opens after FND-07 lands. Design work
with the owner in the running app: which gestures survive, which forms map to
which agent states, and the per-modality on/off switches D18 already requires.
Never designed speculatively; the study is a candidate set, not the vocabulary.

**Design-system increment (D9, law 5).** Add motion tokens:
`--oi-grain-radius`, `--oi-grain-alpha-max`, `--oi-grain-density`,
`--oi-gesture-duration`, `--oi-gesture-reach`, `--oi-form-tempo`. Themes swap
them as they swap colour. Add a second and third theme to `tokens.css` for
hardening only (for example a warm dark and a high-contrast light), consumed by
the study and by FND-07's walk, not shipped as product themes.

**Agent form derivation (D4, law 4).** The agent form is presentation over
session events the encounter already receives: no session or idle → idle;
input arriving → listening; a turn streaming or a tool running → searching;
local operation under way → presence; a reply landed → arrival. No new state
store. A named state on the AIKit session is a later convenience, not a
prerequisite.

## Animation revisions carried by the study (revision 4)

| item | revision 3 | revision 4 |
|---|---|---|
| grain density | 1200–1900 points per field | 800–1200 points; alpha ceiling 0.66 |
| gesture surface | canvas per demo card | one fixed full-window overlay, `pointer-events: none`, page coordinates, scroll aware |
| gesture anchor | drawn on the component | anchored to the component rect, drawn outside its edges |
| sequencing | gesture and transition together | component transition first (`transitionend`), then the wisp |
| weight | 150–260 points, radius 0.44–0.46 | 34–110 points, radius 0.4, opacity peaks under 0.3 |
| vocabulary | confirm, dismiss, release, open, close, edge, wake, drop, save | same plus `breath` (agent state change) |
| seam (rev 5) | `express(name, {rect|x,y})` | `express(name, {rect, from, dir, lean, delay, hold, then})` + `release()`; direction from travel or vector, time on the shared clock |
| grain (rev 5) | sub-pixel arcs, read as blocks | soft circular sprite, ~4 device px, opacity ceiling 0.5 |
| lifecycle | drained on expiry | drained on expiry, cleared on pause/reduced/hidden, idle overlay verified clear |

## Test plan

1. **Seam contract** (unit tests in the design-system package): every declared
   state resolves to a form; every declared event resolves to a gesture or to
   `none`; an unknown name throws; `express()` returns `null` when motion is not
   allowed.
2. **Walk checks** (harness, FND-07): emitter count returns to zero after each
   gesture; overlay pixel-clear when idle; no frame scheduled while paused,
   hidden or reduced; theme swap mid-gesture does not leak an emitter; four live
   surfaces stay under the frame cap. These are the study's `checks.json` rows,
   ported to the walk receipt.
3. **Theme matrix**: render every form and gesture still under each theme and
   diff against stored stills; a new theme must pass without touching component
   code.
4. **Agent round trip**: a fake session host drives the enum through all six
   states; the overlay reaches each form; `unset` reaches the rest form.
5. **Owner gate**: the owner walks the app with the modalities on and off; the
   receipt records which gestures were kept.

## Open for the owner

- Whether the state enum lives with the agency seam (recommended) or the design
  system.
- Which of the eleven gestures and thirteen forms enter the vocabulary at W1.8.
- Whether FND-07 lands inside the foundation gate or as the first P2 unit.
