# Desktop visual language — owner rulings

This package is the implementation source for tokens and shared primitives.
The companion desktop studies establish composition; this document records the
owner rulings the desktop ground stands on, newest first, so the provenance of
each value stays legible. Existing canonical design documents remain intact.

## Owner revision, 15 September 2026 — canonical light and dark

The desktop's canonical appearance is **neutral light** and **neutral dark**.
`.oi-desktop` is the light ground (quiet warm-white paper, ink, fine hairlines,
restrained depth); `.oi-desktop[data-theme="dark"]` is its inverse. `system` is
a preference that resolves — before first paint — into one of those two; it is
not a third visual theme. The accent is ink, not a hue: selection, the send
control and the focus ring are drawn in foreground strength; colour is reserved
for the scarce gold meta-relation role, which keeps one value in both
appearances.

This supersedes the 6 September ruling below, which explicitly opted the
desktop into a grey-yellow-green/olive palette. That ruling is not erased: the
returned application experience — the Expression language as it actually runs
on the desktop — is now the canonical ground, and the olive values are retired
from `tokens.css` rather than kept as an alternative. The later 15 September opening/runtime revision below also supersedes the
legacy loading mark and separate overlay. Density, hit targets, semantic role
ownership and scarce gold remain in force.

## Owner revision, 15 September 2026 — one field, complete opening

The owner returned a further ruling after experiencing an interrupted opening:
remove the legacy loading renderers and hardcoded SVG point clouds; let the full
Expression field stand first while the workspace loads beneath it; invert the
opening colours on entry and let the actual particle flight finish. The window
field is the base presentation. A transparent activity treatment is one use of
that field, not an independently mounted renderer underneath every surface.

The implementation uses one native engine, canvas, context and simulation clock
per window. A focused body borrows that canvas. Local semantic cues use the same
stage when no explicit presentation or retained-field reservation owns it.
Components submit meaning, bounds and observed activity; they do not draw points,
create simulation loops or retain a second renderer. The native glyph sampler
owns point formation. Static cues paint once; actual activity may animate. No
live presentation or active cue means no continuing simulation frames.

The opening starts on the inverse of the selected app ground. A successfully
rendered native frame releases the lazy workspace import. Kernel state and ground
reads start immediately; workspace composition happens underneath the full field.
The labelled entry control becomes usable when the field has painted, the initial
kernel state and boot decision have settled, and the workspace has composed. A
failed field reports its real error and permits entry into the usable workspace.
Optional products are not prerequisites for entry.

Entry preserves the saved appearance and transitions the native scene into it.
The relational motion, explosion and fade finish according to successfully
rendered simulation progress. Hidden/suspended time cannot skip the flight. The
same canvas supplies the interpolated background, points and final reveal. There
is no independent scrim fade or wall timer cutting off the simulation. Only a
completed entry records the session marker. Release stops immediately and retains
resident identity; it does not substitute an empty scene or reseed the field.
Reduced motion paints the final state once and releases. Disabling Expression
removes its canvas, actual GPU context and clock.

The host makes obscured workspace content inert and restores keyboard focus
when the opening leaves. Failed, missing, paused and empty states are named and
static. Semantic status text survives regardless of renderer availability,
reduced motion or forced colours. Native Actions retain their owner contracts;
no loader invents progress, cancellation or recovery capabilities.

## Current desktop grammar

Use `tokens.css`, `desktop.css` and the stage placement rules in `point-cloud.css`.
The host selects appearance. Native and composable bodies consume `--oi-*` roles
and bring no global chrome. Typography, proportion, hairlines and restrained
selection do the work; gold remains the scarce meta-relation role. Pane/tab
chrome, contextual headers, quiet actions, disclosure, provenance and inspectors
retain their actual product relationships rather than becoming generic cards.

Use desktop type/bar/row/hit-target tokens rather than fluid marketing scales.
Small icon bodies retain at least `--oi-desktop-hit-target` interaction bounds.
Focus and text stay solid and readable. A particle cue never replaces a state
label, provenance, keyboard focus or selection contrast. Do not animate whole
panes or resting clouds to suggest that the app is alive.

Agent cues still derive from observed encounters: TurnInFlight or an actual
interrupt request is searching; a newly observed completion is arrival; composer
focus/draft change is listening; a pending local operation is presence; otherwise
idle. Old transcript completion does not replay arrival. A concealed encounter
may preserve its native observation contract while its hidden cue does no work.
Only resize is an admitted layout gesture; reserved open/close/split/move/save
intents still produce no invented effect.

Local loading belongs to its affected surface. Existing content can remain with
a freshness label. The React status body owns only semantic labels; it has no
SVG mask, point clusters, observer, timer, minimum dwell or alternate renderer.
Full-window loading belongs to the actual opening above, not repeated tab changes.

## Historical rulings and supersession

**6 September — olive ground.** The desktop deliberately opted into
 grey-yellow-green paper, graphite text and olive focus. The neutral light/dark
owner revision above supersedes that choice. The original site themes remain
available; `system` only resolves the canonical desktop appearance.

**6 September — clusters and masked loading mark.** The package originally
specified `.oi-point-cloud`, `createPointClusters`, and `createLoadingIndicator`
with the braced SVG mask, a density sweep and inline/surface/window scopes. The
later owner revision explicitly retires those renderers and their cloud/loader
roles. The source logo remains an identity asset, not a loading mechanism.
The old prohibition on particle explosions applied to routine accent clouds;
the owner now explicitly commissions the real opening flight.

**D22 / FND-07 — separate Expression overlay.** `createExpressionOverlay` and
`formPoints` formerly owned a Canvas2D renderer, a separate scheduler and held
emitter leases. They are retired. Semantic expression names, gesture admission
and handle identity remain; the O:I stage resolves them through its single native
field. No legacy renderer is retained as a fallback. Retained Nara target and
checkpoint ownership continues at the native boundary without an unsolicited cue
resizing or reseeding the resident field between visits.

## Verification and standing

The bootstrap meaning and native exits remain in
`.superpowers/sdd/cradle-rebuild/BOOTSTRAP-AND-LOADING.md`. Browser checks exercise
real WebGL readiness, delayed module delivery, browser suspension, reduced motion,
context creation failure, theme pixels, focus and lifecycle. Native owner tests
verify actual context disposal and retained-field recovery. Package references
show semantic grammar, not simulated runtime progress.

Implementation/build/browser evidence does not constitute the owner’s lived UX
acceptance of O:I #65. Native child-window behaviour, real encounters and the
C0–C5 campaign retain their separate evidence obligations.
