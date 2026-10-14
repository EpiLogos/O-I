# UX spine alignment — from the integrated 0.1.2 shell to the world-shell frontier

Prepared 8 October 2026 by the native-composition parent. This is the
execution map between **what is running** (the integrated 0.1.2 candidate:
main-shell UI + kernel + six products, update-verified and installed) and
**the frontier** (`WORLD-SHELL-DESIGN.md` rev 2 + its mockup, written as a
component reference for development agents). It orders the work as threads
with exact touchpoints, so each thread can be developed, reviewed and landed
independently — the UI mockups drive the standard, the spine keeps every
thread honest.

## 0. The spine that already exists (verified in the 0.1.2 tree)

The design (§2) names the shell's existing tripartite state machine as the
spine — no second navigation model is introduced:

1. **Mode** — `WorkspaceMode` (`base | factory | expressions | techne |
   epi-logos | settings`, `desktop/cradle/src/workspace/mode.ts:18`), each
   mode with its own `modeLayouts`; a mode never closes surfaces.
2. **World context** — the workspace book's `WorldContext` (world: central |
   epi-logos, subject, reading, trail; `workspace/store.ts`), carried in the
   layout book (the 0.1.2 secured-quit/restart proof).
3. **Kernel epoch** — transport status + `accessEpoch` generation gating
   every read (the owner-epoch fencing this lane landed).

The five-region frame (TransportBar, browser, main panes, right dock, bottom
detail, status), the surface engine (`TabGroupPane`/`SplitPane`/detach/
redock), the device aperture (faces + custody + Apply/Discard/Retry), and
the inhabitants module are all live in 0.1.2. **The frontier is additive to
this spine** — eight seams, no rewrites.

## 1. Thread order

Each thread is independently landable; later threads consume earlier ones.
Owners: S = shell/UI threads (the mockup-development lanes), F = this
foundation lane (kernel/products/wiring), R = review by a non-implementing
worker.

### T1 — Projection pane kinds *(S; first)*
Extend the pane engine's body kinds with the four projections
(`projection.earth | projection.timeline | projection.constellation |
projection.expressions`) and promote the engine to compose the main area in
every mode (`modeLayouts` already exist). Touchpoints:
`desktop/cradle/src/surface/types.ts` (kinds), `surface/engine.ts`
(open/close ops), `Workbench.tsx` (the integrated retention wrapper — keep
`presented`/`ReceivingBody` semantics), `retention.tsx`
(`isRetainedCentreKind` gains the projection kinds). Gate: two panes hold
two projections of one subject; hidden retention restores camera/selection.

### T2 — Projection module boundary *(S+F)*
Each projection = a module with mount/unmount + encounter subscription. The
Earth projection adopts the owned Atlas engine (vanilla-TS controller, no
React rewrite): `Work/Archetypal-Earth/src/{globe,graph,controller}` —
globe engine, camera rig, d3-force constellation, non-linear time scale.
`src/types/field.ts` is the corpus seam; the corpus stays behind. Gate: the
Earth projection mounts/unmounts in a pane with zero parallel stores.

### T3 — Encounter bridge *(F; the keystone)*
`WorldContext` (subject/occasion/trail) drives every projection's state
machine; the Atlas's five-state machine maps World·Focus·Manifestation·
Thread·Deep ↔ spine, and its hash router (`state/router.ts` — every state
linkable, Back works) is the model for linkable encounters
(`?arr=techne&scale=surface&subject=…&ap=3&as=field`). Touchpoints:
`workspace/store.ts`, `workspace/continuity.tsx`, the kernel event
subscription (one generation-qualified subscription, already landed). Gate:
switching any axis (arrangement × projection × device) keeps the encounter;
the Trail tile returns to it.

### T4 — Inhabitant manifest *(F; second keystone)*
Generalise the four registries (shell panel slots, `FIELD_FAMILIES`,
browser categories, detached kinds) into **one declared inhabitant
manifest** admitted through `inhabitants.rs` (the name already exists).
Face kinds: parameter devices (landed aperture), **document devices**
(sandboxed iframe + save router → rack citizens), **conversation devices**
(`oi.nara-dialogue-binding/v1` over kernelOp), instrument devices
(Techneᵢ), mode plugins. Gate: a curated feature integrates by manifest
with zero shell surgery; documents and conversations appear as rack
devices with dock/expand/pop-out.

### T5 — Timeline generalisation *(S)*
Session and Arrangement become the two presentations of one Timeline
projection over any World track set — no longer audio-mode features
(the convergence study's recorded fault, resolved). The set model
(`useSet.ts`, `document.ts`) gains World track adapters: **day tracks**
(Civil time), **Factory run tracks**, **conversation clips**, celestial
motion. Clips carry epistemic standing (fact · claim · inferred ·
hypothesis · disputed · ghost) and are never upgraded by placement. Gate:
a day, a run and a conversation all present as tracks with launch/record/
move/trim/split through their native owners.

### T6 — Occurrence binding contract *(F)*
The generalised `Occurrence` (`subject_ref` + place + time + image + basis)
as the Earth projection's data seam; QL sky binds as the M2 layer through
the dated-sky provider contract (no ephemeris invented); material without
geography anchors to the declared home position and expands as a work
constellation. Gate: a Jung occurrence, a Factory artifact and a QL body
all place on the same globe through one contract.

### T7 — Time spine *(F; the strata lock)*
Four strata locked at the top — chronos (QL), civil (Central), cron,
transport — plus occasion (retained time). The transport gains Now /
Occasion / Instrument controls; Atlas's non-linear scale adopted for deep
time; cron firings land as Timeline clips. Gate: an experiment cadenced by
a transit and a day-close at 21:00 coexist without forking clocks.

### T8 — Device pop-out *(S; trivial once T1)*
Device pop-out rides the pane engine's existing detach/redock
(`DetachedFrame.tsx` → `window_binding`/`window_redock`; admitted kinds
gain device panes). The one gated gap in the rack aperture, closed by T1.

### T9+ — Family carvings *(per product, manifest work)*
Each of the six products declares its family manifest (§12): browser
categories, rack faces, typed params, projection adapters, inspectors,
time bindings, telemetry. Central first (the clip-view craft of the
ground — ground/hygiene device, impact device, day/now temporal controls,
document devices), then Actuation (harness/experiment devices), AIKit
(skill devices with admit/deny lights), Factory (run devices, custody
light), Workcell (seat + execution-target devices, hygiene tenders), QL
(torus/sky/clock/deck devices; chronos provider). **The seventh-product
test** is the neutrality law: a new family integrates with zero core
change.

## 2. Acceptance — the two vertical proofs

1. **Factory vertical**: a real Factory agent performs bounded work on a
   real object; the result is recovered through Earth, Timeline,
   Constellation, Expressions, the devices, and agent/files inspection —
   identity, provenance, work and context continuous; repeated with views
   closed, reopening, occupant change, retained occasion.
2. **Central vertical**: one real day recovered through the Timeline (day
   track + return/handoff clips), the Day document device, a conversation
   clip + Nara device, and the wiki's Constellation — Central resolved
   without a separate mode.

Both exercise the spine, panes, rack and projections with nothing built
twice. These two proofs are also the UX-side cutover gates 1–2 of
`LEGACY-CRADLE-RETIREMENT.md`.

## 2.1 The figure — the Glass Bead Game, and the praxis layer

The domain's figure is Hesse's Glass Bead Game. The source study stands at
O-I `docs/research/glass-bead-game/` (01–05: the Game's mechanics,
evolution and decay, ladder-character, computational afterlife — verified
against the novel), and its synthesis, `06-THE-PRAXIS.md`, states the
intended use of this shell as **the spec and verification layer**: the four
modes are chambers of one instrument; Epi-Logos is the philosophical corpus
(essay, QL/MEF, Bimba, M/M′, Ta-Onta, Nara, Epii, the Covenant) — the
esoteric identity projected over the exoteric substrate as the epi-logos
mode — and it is both the owner's game and the system's native game. Two
consequences bind every thread above:

1. **The threads exist so the day-arc of 06 §7 can be performed
   end-to-end** — a capability exists when its session performs against
   real owners with identity, provenance and standing continuous, not when
   its manifest declares it. The praxis invariants are session sentences:
   a highlight is an observation, not an offset; a drawn relation is a
   proposal; a refusal mutates nothing; every moved value names its cause;
   a day ends.
2. **The figure's three refusals are session-shaped audits**: rococo (a
   frame whose beauty exceeds its landed session is glass — downgraded like
   a DSP claim contradicted by golden renders), oracle (no device judges
   synthesis for the player; the modulated knob shows its cause),
   sterility (analysis without the World's own voice is Plinio's charge —
   the derivations serve the M1 instrument or they are the conservatoire
   outliving the orchestra).

The gap between a praxis sentence and the capability matrices
(`suite/capability-matrix.json` + `suite/product-capabilities.json`, joined
with the admitted surface by `npm run devices:gaps`) is where the next
thread's work is found.

## 3. Not-do laws (binding on every thread)

No parallel World models, event stores, selection systems, graph stores,
Factory/Expression state stores, agent registries or filesystem models. No
hierarchy of projections. No inspector as a view, no false tabs over
projections, no duplicate scrub bar. No cramming UI into footers/headers —
missing surface is a pane. No claims beyond native owners (no audio
playback before that owner lands; Factory/Central entry points reserved
for their owners; the source-by-source licence gate governs all reference
adoption). Every family appears in exactly four places — browser, rack,
projections, inspectors — plus time and telemetry declarations; a fifth
place is a design smell.

## 4. What this lane (F) does next

T3 (encounter bridge) and T4 (inhabitant manifest) are the two keystones
the foundation lane owns — they are where the kernel, the six products and
the spine meet, and everything else consumes them. The lane starts there
unless the owner orders otherwise; the shell/UI threads take T1/T2/T5 with
the mockup as the component reference.

## 5. Seam status — audit record (14 October 2026)

Recorded by the Phase 5 builder for cutover gate 2 (`LEGACY-CRADLE-RETIREMENT.md` §3). The eight seams are the
design's `WORLD-SHELL-DESIGN.md` §10 smallest seam set, which this document names as threads T1–T8, in the same order
(§10.1 = T1 … §10.8 = T8). T9+ are family carvings, not seams, and are not scored here.

Scope. The frontier is audited in the live shell, `packages/live-shell/ui/src`, on the cradle surface engine
`desktop/cradle/src/surface`, which the live shell imports. The 0.1.2 spine paths named in §0 are cited where they
still hold. Channels: **source** = source reading (file:line); **scripted** = a repo test run this audit. Nothing here
is a native run, and no seam is marked natively exercised.

Status key. **converged** = the shell's code matches the design seam and remaining work is native verification only.
**partial** = the seam's core exists and at least one stated part of the design is missing or unverified. **open** =
the design seam is not built.

| Seam (§10 / thread) | Status | Evidence | Remains |
|---|---|---|---|
| 1. Projection pane kinds (T1) | partial | Four kinds declared `desktop/cradle/src/surface/types.ts:37-40`; labels `engine.ts:239-242`; projection binding carries `subject_ref` `types.ts:110-118` (source). Each kind registered in the live shell: `packages/live-shell/ui/src/projections/timelinePane.tsx:49`, `projections/atlas/registerAtlasHost.ts:27-28`, `projections/expressionsPane.tsx:86` (source). `tests/projection-pane-kinds.test.mjs` 7/7 pass under `--experimental-strip-types --import ./tests/ts-register.mjs` (scripted). | Expressions is a one-frame lease: a second Expressions pane cannot hold the frame (`expressionsPane.tsx` header), so the "two projections of one subject" gate holds for Earth, Timeline and Constellation only. Hidden retention is claimed by pane concealment (`projectionPane.tsx`, IntersectionObserver) while `RETAINED_PANE_KINDS` (`desktop/cradle/src/surface/warmTrees.ts:18`) names no projection kind; needs a native check. "Compose the main area in every mode" not verified. |
| 2. Projection module boundary (T2) | converged (source; native mount pending) | Door: `desktop/cradle/src/surface/projectionModules.ts:160` `registerProjectionModule`, `:171` lookup. Pane mounts, unmounts, `setVisible`, and remounts on a new kernel epoch: `desktop/cradle/src/surface/projectionPane.tsx` (`ProjectionSurface`, mount effect keyed on binding, registration and `accessEpoch`) (source). Earth is a vendored copy pinned by `packages/live-shell/ui/src/projections/atlas/PORT-PIN.json` (source). | Earth mount and unmount in a pane has not been run natively. The Constellation kind mounts the Atlas graph view (`registerAtlasHost.ts:28`), not a relation projection (design §3.3). `projections/dev` and `projections/reference` modules are fixtures. |
| 3. Encounter bridge (T3) | partial | Bridge is a subscriber and router over the spine, with no state: `packages/live-shell/ui/src/projections/encounterBridge.ts:1-20`; mounted at `native/Workbench.tsx:76-78` and `:770` (source). `WorldContext` = world, subject, reading, trail `desktop/cradle/src/workspace/store.ts:62-66`; trail bounded `store.ts:487` (source). `tests/encounter-inhabitants.test.mjs` 8/8 pass (scripted). | The linkable grammar `?arr=…&projection=…&subject=…` is defined in `desktop/cradle/src/workspace/encounter.ts:9-118`, but its only consumer is `tests/encounter-inhabitants.test.mjs`; the live shell has no router, so "every encounter linkable, Back works" is unbuilt. "Switching any axis keeps the encounter" needs a native check. |
| 4. Inhabitant manifest (T4) | partial | One admission door: `packages/live-shell/ui/src/inhabitants/familyManifest.ts:57` `admitFamilyManifest`, `:76` `allFamilyManifests`; ten admitting modules (`grep admitFamilyManifest(`, excluding the door file: aiKit, actuation, central, workcell, softwareFactory, knowledgeGraph, quaternalLogic, atlas, agentNativeP0, sdk/define) (source). Panel slots compose through the manifest, `inhabitants/manifest.ts:230` (source). Document and conversation face kinds exist: `inhabitants/DocumentFlowFace.tsx`, `DocumentDayDieFace.tsx`, `ConversationNaraFace.tsx` (source). `FIELD_FAMILIES` appears in neither tree except a comment at `desktop/cradle/src/inhabitants/manifest.ts:8` (source). | Pop-out and detach kinds are still a closed set of seven non-device kinds, `packages/live-shell/ui/src/native/detachedKinds.ts:3`, not read from a manifest. The cradle contract `desktop/cradle/src/inhabitants/manifest.ts` is consumed only by `tests/encounter-inhabitants.test.mjs`. Browser-category migration not verified. Seventh-product test not run. |
| 5. Timeline generalisation (T5) | partial | World track adapters: `packages/live-shell/ui/src/timeline/dayTrackAdapter.ts`, `runTrackAdapter.ts`, `conversationTrackAdapter.ts`; one registry with lazy loading, `timeline/registerWorldTrackAdapters.ts` header (source). Session and Arrangement as two presentations of one projection: `packages/live-shell/ui/src/projections/timelineResidence.tsx:1-12` (source). | Standing is not implemented: `eventStanding` returns `'fact'` for every event (`timeline/timeSpine.ts:300-304`); claim, inferred, hypothesis, disputed and ghost appear only in a comment (`timeSpine.ts:302`). The gate "launch, record, move, trim, split through native owners" is unverified. |
| 6. Occurrence binding contract (T6) | partial | Earth data seam: `packages/live-shell/ui/src/projections/atlas/src/types/field.ts:185-215` carries additive `subject_ref`, place, lat/lon, year, image (source). Factory artifacts reach the Earth through a Factory-side shape, `packages/live-shell/ui/src/factory/factoryVertical.ts:62` `FactoryEarthOccurrence`, joined on `subject_ref` (`:209`, `:317`) (source). | `Occurrence` has no snapshot `basis` field; `ties.bases` (`field.ts:233`) is the relation basis. No QL body is placed: `projections/atlas/provider/skyProvider.ts` exists but no binding to `Occurrence` was found (source). Factory and Jung occurrences do not share one contract. |
| 7. Time spine (T7) | partial | Time spine module with Now, Occasion and Transport laws and the chronos binding read-only from the QL family: `packages/live-shell/ui/src/timeline/timeSpine.ts:1-20`, chronos `:120`, cron firings as clips `:23` (source). Now and Occasion chips in the Timeline presentation: `packages/live-shell/ui/src/projections/worldTimelinePresentation.tsx:409-413` (source). | The transport bar carries no Now, Occasion or Instrument control: `components/NativeTransportBar.tsx` has no "Occasion" (grep, 0 hits) (source). Cron firing to clip and the two-clock check are unverified. |
| 8. Device pop-out (T8) | open | Device cards declare pop-out and disable it without a handler: `packages/live-shell/ui/src/inhabitants/inhabitantCard.tsx:106` (`disabled={!onPopOut}`). The rack passes `popOut` but no `onPopOut` (`inhabitantRack.tsx:158`, `:225`; no other `onPopOut=` in the shell) (source). The receiving body admits seven non-device kinds (`native/detachedKinds.ts:3`), refused at `native/Detached.tsx:23` (source). | Device panes must be admitted as detach kinds and the card's press wired through the pane engine's detach door (`desktop/cradle/src/workspace/DetachedFrame.tsx`, 0.1.2 path) (design §10.8). |

Summary: 1 converged (seam 2, source only), 6 partial, 1 open (seam 8). Gate 2 stays **Open**. Each partial seam
names its remaining item above; none of the eight is verified natively.
