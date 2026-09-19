# Expressions — visual review changes

Continuation of the accepted native-engine integration on `agent/native-engine-journeys`.
The production engine, schema-4 bridge and original authoring envelope remain in place.

## The reviewed interface

The workspace now opens with Interact first in a thinner, uniformly centred icon rail.
Each tool cycles open → closed → Interact; closing its inspector explicitly also makes
its next rail click return to Interact. The bottom-left orbital instrument supports
rotation, Shift/right-drag panning, wheel/button zoom, axis views and keyboard controls.
It shares the existing camera, has no simulation clock, and never sends particle forces.
The ordinary right-drag camera gesture was also fixed to clear field input in Interact.
View orientation still does not flatten physics or change the construction plane.

Default editorial captions, corner prose and redundant camera-mode controls are removed.
Optional authored text remains editable and existing documents retain their own words.
XYZ at bottom-right reports the current pointer's world-space construction-plane position.
The workspace keeps direct still-image and live-video icons, with a small nonmodal options
panel. Their native clean capture paths are unchanged.

The single library icon opens a full-page **Expressions** collection, with image, name
and subtitle cards, rather than a dialog. About, browser saving, native/authoring import,
JSON export and self-contained HTML export now live there. The public term is Expression;
`oi.journey/1` remains the compatible on-disk envelope, not a destructive schema rename.
Current-image covers are captured from native state; other cards use explicitly labelled
static composition previews, generated only when near the visible portion of the page.

Modes provides a lightweight route into every material study, native composition preset
and factory preset. Selecting one forks ordinary editable composition data. Previous
work is retained in the collection/history. Import is additive: a different document
with an existing ID becomes an imported variation rather than overwriting active work.
Storage-unavailable sessions keep imported documents in memory and clearly offer export.
Library browsing pauses the physical clock and returns without hidden elapsed-time catch-up.

## Acceptance

Run `npm run lint`, `npm test`, `npm run build`, `npm run test:journeys`,
`npm run test:gpu`, `npm run test:browser` and `npm run test:workspace`.
The unchanged native GPU suite checks real force/state behavior. The adapted original
25-workflow browser suite still decodes native PNG, video and exported living HTML.
The 23 model tests include rail transitions, camera independence and preset-fork isolation.
The additional 23 workspace checks exercise the revised rail, pointer ownership, orbit/pan/
zoom/axes/keyboard, XYZ, library navigation and clock preservation, complete modes route,
import collisions, metadata/export, mobile layout and trusted touch camera input.

Browser fixtures use 2,048 particles on Chromium's software GPU, with an explicitly
identified storage double for inline content. These are functional checks, not target-
hardware throughput claims. The separate CI served-module check uses the actual root
route and module-to-standalone export. Local managed-browser policy blocks localhost
navigation; it is not bypassed or misreported as a successful local served-route test.
The default standalone app remains at 62,000 particles.
