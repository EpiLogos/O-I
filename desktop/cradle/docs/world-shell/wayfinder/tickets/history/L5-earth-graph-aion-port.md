# L5 — Earth / Graph / Aion port from Archetypal-Earth

Label: wayfinder:task (execution lane)
Claimed-by: — (resolved; lanes zcode:atlas-port-l5 → died mid-flight in the app restart → zcode:atlas-port-l5-r2 completed)

## Resolution — 2026-10-09 (zcode:atlas-port-l5-r2; committed by orchestrator as seat `4b17be9a2`)

The atlas port is landed: **82 modules** under
`packages/live-shell/ui/src/projections/atlas/` (+ the 3-line additive
import in `src/inhabitants/loadAgentShellFamilies.ts`) — globe engine,
camera rig, tiles, graph build/view/tools/switch, the five-state machine +
linkable router, aion model/view, the non-linear time scale, the image
pipeline — moved verbatim from the atlas (re-pinned per the errata law:
`44601d9` at resumption, two in-scope post-pin commits merged
hunk-by-hunk), amended per C2's work order: **28/28 amendments**, zero Jung
bytes in the port, Red Book named absence (landed post-pin; corpus-side by
port law). The dead hand's refusal to invent the corpus schema before it
landed (`c9732df`) was correct and carried.

**Executed proof (headless/scripted-labelled; computer use still blocked
machine-wide):** five renders from the non-Jung fixture corpus
`fixture-northern-lights` through the production fetch path (world / graph
/ graph-focus / aion / manifest); the §13 second-provider test **passes**
(registry admits a second provider, own bundle, no core change); corpus
deep links **pass end-to-end** (cite → link → passage sheet naming its
provider). Scoped tsc exit 0, zero diagnostics in zone.

**Disclosed:** sky binds the QL kerykeion interface — live provider
unreachable (no daemon; source-check only). The Aion→Timeline jump is
designed (`aionTimeline.ts`); the Timeline-side registration ships as a
proposed-not-applied patch for **L4**:
`new-shell/evidence/atlas-port-l5-20261009/r2-AION-TIMELINE-REGISTRATION.patch`.
The prior lane's ten named cross-lane package-build faults live in L1's
in-flight files (projectionModules/encounterBridge) — they resolve at L1's
landing + the orchestrator's integrated build. Evidence:
`new-shell/evidence/atlas-port-l5-20261009/` (r2-MANIFEST.md is the index).
Status: **resolved** — acceptance's first and third shapes met in code and
headless proof; computer-use verification stays open machine-wide.
Blocked-by: C1, C2

Zones: new projection modules (copied atlas `src/`), corpus-neutral binding,
browser entries. **Actual code copying — modules move verbatim first, hosts
and bindings adapt after; no React rewrite; no Jung corpus in the port.**

## Question

Port the atlas as the Earth and Graph projection foundation and the Aion
epoch view: globe engine + camera rig + tiles, graph engine (build/view/
tools/switch), the five-state machine + linkable router, aion model/view,
the non-linear time scale, the image pipeline — amended per C2 for
corpus-neutrality. The Jung vault slots back as one provider among others.
The sky layer binds from the QL kerykeion contract (no ephemeris is
invented); Aion becomes the Timeline's epoch navigation — jumping into
timelines.

## Evidence / acceptance

An Earth projection pane renders globe + graph from a non-Jung test corpus,
and the Jung vault re-attaches as a provider. An Aion jump lands in the
Timeline projection. Build + typecheck pass; NASA/Wikimedia data terms
recorded next to the target they serve (licence gate).
