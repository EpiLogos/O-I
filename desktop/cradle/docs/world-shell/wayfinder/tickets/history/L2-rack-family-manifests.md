# L2 — Rack generalisation and family manifests (seam 4)

Label: wayfinder:task (execution lane)
Claimed-by: — (resolved; lane zcode:rack-manifests-l2, committed by orchestrator as seat `5bd6ff239`)

## Resolution — 2026-10-09 (zcode:rack-manifests-l2)

**The manifest schema landed** (`src/inhabitants/manifest.ts`):
`InhabitantManifest extends FamilyManifest` carrying every §5.5/§12 field;
face kinds `parameter | document | conversation | instrument`; document
bodies declaring `oi.document-frame/v1` + the save router's five named
outcomes (order enforced); conversation bodies declaring
`oi.nara-dialogue-binding/v1`; dock lifecycle; `admission: admitted |
waiting`. Composition is by **declared extensions** onto owner-admitted
bases — the door's map is never rewritten; owner-authority, immutability
and face-collision refusals; waiting faces carry no body and name their
owner.

**Six families declared** — central 7/0, actuation 5/0, ai-kit 5/0,
software-factory 6/0, workcell 4/0 (the seat device reading
`workcell_status_read`, F3's source), **quaternal-logic 0/6 — all waiting
with named owners** (sky, torus, m3-clock, deck, chakra, m-prime-matrices;
telemetry honestly null).

**Document + conversation devices dock**: DocumentDayDieFace /
DocumentFlowFace over the owners' iframe + payload-island + CAS save
router; ConversationNaraFace over the nara binding; rendered by
inhabitantRack. The 16-step scripted walk shows **all five save-router
outcomes** on the die and three on flow (11 captures + walk JSON).

**Compatibility executed**: the five agent-shell manifests load through
the new schema byte-identical (10/10); `EXPRESSIONS_FAMILIES` composes
losslessly (22/22) and its landed manifest validates; a seventh product
admits through the unchanged door; the door module names no product
(§13 test). Pre-existing manifest tests 16/16; package tsc zero
diagnostics; the shared grammar files byte-untouched (git-diff verified).

**Disclosed**: the one permitted additive hunk in NativeWorldDetail.tsx
delivered as `NativeWorldDetail.inhabitants.patch` (the co-worker's active
lines); the capture walk ran against a **fixture kernel** (contract-shaped;
the document forms' bytes are the owners' own); nothing renders from these
manifests in the running shell yet — that is the patch plus the Base-
arrangement dock wiring; the ticket's computer-use acceptance stays OPEN
(held, not waived); QL's `ql-sky-earth-adapter` is a declared, reserved
seam the atlas port explicitly declined to write.

Also at convergence: the orchestrator landed the gate files that should
have ridden L1's and F1–F4's commits (`e9b4e3caf` — projection-encounter,
projection-seam, agent-shell-browser-rows, the F4 count assertion).
Status: **resolved**.

Zones: `NativeDeviceEditors` registry, new inhabitant-manifest module, panel
slots, browser categories, document/conversation face kinds.

## Question

Generalise the registries (panel slots, FIELD_FAMILIES, browser categories,
detached kinds) into the inhabitant manifest (`WORLD-SHELL-DESIGN.md` §5.5,
§12). Declare the six product families — central, actuation, ai-kit,
software-factory, workcell, quaternal-logic — as manifests: browser, faces,
params, projections, inspectors, time, telemetry. Faces are admitted only
where their native owner exists; everything else is declared, waiting, honest.
Promote document devices (ql-flow, ql-daily-die via the existing iframe +
payload-island + save-router path) and conversation devices (nara binding) to
face kinds with bodies.

## Evidence / acceptance

Manifest schema landed; six families declared; a document device docked in a
rack with save-router states visible by computer use; no parallel stores; the
Factory/Central entry points remain owner-admitted.
