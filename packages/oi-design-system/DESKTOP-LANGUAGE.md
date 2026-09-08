# Desktop visual language — owner ruling, 6 September 2026

This package is the implementation source for tokens and shared primitives.
The companion desktop studies establish composition; this extension establishes
the accent/loading language. Existing canonical design documents remain intact.

## Ground and density

Apply `.oi-desktop` at the host and import tokens.css + point-cloud.css. It opts
into drab grey-yellow-green paper, graphite text/nodes, slender rules and muted
olive focus. The original site palette remains unchanged. Shared contributions
inherit host roles and must not bring their own cards, shadows, spinners or hues.

Use desktop type/bar/row/hit-target tokens rather than the site's fluid display
scale. Thin bars do not mean tiny click targets: icon bodies can be small while
the target is at least `--oi-desktop-hit-target`. Focus outlines and text remain
solid and readable; point clouds never replace semantic text, focus indication,
selection contrast or an accessible state label.

## Accents are fine point clouds

Fine, separate dots collect into small bounded clouds. Not large polka dots,
confetti, particle explosions, nebulous gradients or glowing panels. Default
radius is 0.45 CSS px at a 2 px pitch. Size stays legible at normal display scale;
never make a whole pane decorative particle noise. Context is conveyed by dot
density, small extent, relation and accompanying text—not colour alone.

`.oi-point-cloud` is the shared accent primitive. Its default is static. Set
`data-active="true"` only while the corresponding real operation is active;
stop it on completion, failure, cancellation or pause. Use sparingly on activity
rows, loading boundaries, attention markers or contextual selection accents.
Do not animate every node or every tab. There are no background agent acts
implied by a decorative animation.

`--oi-meta-relation` remains the only scarce gold role. Routine loading uses
foreground ink, not gold. A static sample in the reference demonstrates gold
only as a relation accent. No duplicate palette in consumer CSS.

`createPointClusters({active})` is the general motion primitive, not logo-only
ornament: three staggered bounded populations gather and relax through a small
local displacement and density change. Use it for work, loading and attention
with a separate readable state label. Size comes from the cloud-field tokens.
State changes start/stop the shared primitive; no per-feature particle engine.
Reduced motion keeps static clustered dots. Resting clusters never keep moving.

## The {O:I} loading mark

The loading mark uses the existing braced `assets/oi-mark.svg` as its exact mask;
it is not a text approximation or a newly drawn logo. Fine densely packed dots fill that
silhouette at a large 480 px default width (responsive to the containing surface). A slow 3.6-second density sweep preserves a continuously readable
mark. No rotation, rapid flicker, dramatic zoom, forced intro or simulated
percentage. Reduced motion removes all animation; forced colours renders a
readable literal fallback. The DOM status label remains accessible in all modes.

`createLoadingIndicator({label, detail, scope, active})` from `./loading` returns
`{element, update, remove}`. Labels are plain text, not HTML. No I/O, timer or
minimum display duration exists in this component. The host supplies observed
operation state and removes it as soon as that state ends.

- `inline`: a non-modal status body; usable surrounding content remains usable.
- `surface`: positioned in a host surface (host establishes positioning).
- `window`: only while initial shell/essential restoration is not usable.

A window overlay is presentation, not a modal/focus manager. The host must make
obscured content inert, manage focus restoration and expose any real retry,
cancel or recovery Actions outside the hidden work. The component must not
invent those Actions. Do not expose Cancel if the native operation cannot cancel.

Once a usable shell exists, discovery/refresh/provider work is local to its
surface. Keep last-observed content labelled during refresh. Missing products,
no credentials, no agents, unavailable network and failed recognition are named
states with real exits, never indefinite loading. Error/empty/paused is static.
Do not show a full-screen splash for every project/tab switch. Delay a transient
indicator if needed to avoid flash; never delay usable content to show branding.

## Bootstrap contract

The executable bootstrap state/owner/exit matrix is in
`.superpowers/sdd/cradle-rebuild/BOOTSTRAP-AND-LOADING.md`. Its host lifecycle
lands before wiki, provider and live-configuration gates; each later slice closes
its own onboarding/recovery branch. Partial compositions remain usable.

## Verification and migration

`examples/loading.html` renders the real package component as a clearly labelled
visual reference, including pause and window-overlay/focus-return. It is not an
implemented bootstrap flow. Browser checks cover actual DOM/motion/fallback and
safe labels. The root package audit remains strict: prototype raw-colour debt
must be migrated into semantic tokens during the desktop build, not exempted
or copied into production. Leave the running developer's app files alone during
this package pass; consume these exports in the implementation slice.

The 0.45px dot core has a 0.4px antialias edge so clusters survive standard-density displays; do not remove it when rendering the same tokens on canvas. Verify both 1× and Retina output.
