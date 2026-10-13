# T-CAPABILITY-HOMES — the 25 suite capabilities get their homes

Label: wayfinder:task (Phase 1 — declaration, no UI leg)
Claimed-by: claude-code:dlw-lead (13 Oct 2026; builder haiku ×1)
Blocked-by: —
Source: DEVICE-SEMANTICS-LOCK §4.2; `npm run devices:gaps` (25 rows print
`(no family scope)` at `8bf279d3e`).

Zones: `packages/live-shell/ui/src/inhabitants/manifest.ts` (the
`capabilities` field), `src/inhabitants/capabilityHomes.ts` (new),
`src/inhabitants/worldShellFamilies.ts` (one load line),
`scripts/device-gaps.mjs`, `tests/capability-homes.test.mjs` (new).

## Question

Lock §4.2: each suite capability with no family scope lands as a
declaration in its owning family, or is named as the shell itself (no
device). Make it a declaration the door carries and `devices:gaps` reads.

## Lead's design (13 Oct 2026)

- `InhabitantManifest` and `FamilyExtension` gain `capabilities?: readonly
  string[]` (capability refs the family homes); `inhabitantManifest()`
  composes them like panelSlots. `validateInhabitantManifest` refuses a
  capability ref that does not match `^cap\.[a-z0-9-]+\.[a-z0-9-]+$`.
- `capabilityHomes.ts`: `declareCapabilityHomes()` declares one additive
  extension per owning family (`<family>:capability-homes`, `by` the ticket,
  no faces, `capabilities` + a `note` naming each home's semantic), and
  exports `SHELL_CAPABILITIES` (ref → the shell surface it is: no device).
  `loadWorldShellFamilies()` calls it after the families are admitted.
- `device-gaps.mjs`: a capability whose product scope maps to no family is
  homed by any family whose composed manifest lists it, else by
  `SHELL_CAPABILITIES` (printed `shell: <surface>`); `(no family scope)`
  remains only for a ref in neither (the test asserts none remain).

**The homes** (lock §4.2; the lead's ruling where §4.2 names no family):

| Capability | Home | Semantic home |
|---|---|---|
| cap.o-i.session-observatory | software-factory | Factory arrangement — the run viewer (run-device) |
| cap.o-i.flow-loop | central | the Flow track + document devices (flow-document) |
| cap.suite.agent-creation-chain | ai-kit | Factory browser New — create a track (an agent profile) |
| cap.o-i.cas-source-editing | central | the Text document device |
| cap.o-i.living-wiki-desktop | central | Technē M0′ + Central's Wiki category |
| cap.suite.local-wiki-world | central | Central's Wiki category (ProjectCentral wiki) |
| cap.suite.wiki-publish-projection | central | the Wiki projected into the shared field (Link) |
| cap.suite.semantic-identity-precedence | central | agent-identity / the source-ref grammar |
| cap.suite.participant-addressing | central | the Flow Participants device |
| cap.suite.recursive-worlds | quaternal-logic | Technē M4′ bodies + Graph |
| cap.suite.world-relative-agent-knowledge | quaternal-logic | Technē M4′ bodies + Graph |
| cap.suite.agentset-primitive | ai-kit | the Factory Agentset rack |
| cap.suite.activity-and-attention | software-factory | the Factory Activity tile |
| cap.software-factory.agent-agency-contract | software-factory | the Agent device's custody (agent-custody) |
| cap.suite.workcell-placement-intent | workcell | the Factory World device's placement (seat) |
| cap.suite.explicit-co-internality | actuation | the agency ontology (gateway → agent chain) |
| cap.o-i.search-aperture | shell | Browser search, every mode |
| cap.o-i.rooted-world-navigator | shell | Browser places |
| cap.o-i.currentworld-reading | shell | the status bar's run context |
| cap.suite.versioned-world-faculty | shell | the Arrangement (every mode) + re-enable |
| cap.o-i.desktop-agency-encounter | shell | the companion dock |
| cap.o-i.cradle-frame-grammar | shell | the shell frame itself |
| cap.o-i.cradle-kernel | shell | the shell's kernel host |
| cap.o-i.cradle-verification | shell | the shell's verification harness |
| cap.o-i.desktop-embodiment | shell | the native window (embodiment) |

## Acceptance

- `npm run devices:gaps` prints no `(no family scope)` row; each of the 25
  shows its family or `shell: <surface>`.
- A malformed capability ref is refused by `validateInhabitantManifest`.
- `devices:validate` PASS; the semantic registry snapshot unchanged (no
  faces added); tsc 0; inhabitant-manifest and live-semantics suites green.

## Resolution

**Landed (13 Oct 2026; builder haiku ×1, converged by the lead).**
`capabilities` on manifests and extensions (malformed refs and duplicates
refused); `capabilityHomes.ts` declares one `<family>:capability-homes`
extension per owning family (no faces) and `SHELL_CAPABILITIES` (10, incl.
`cap.o-i.desktop-surface-host`, the lock's "surface host", absent from the
table); `devices:gaps` homes them. Scripted: `(no family scope)` 25 → 0;
devices:validate PASS; semantic registry byte-identical; tsc 0;
capability-homes + inhabitant-manifest + live-semantics + device-sdk +
agent-family-manifest → 62/62.

**Carried:** `devices:gaps --all` still shows 13 *landed* O-I/Suite refs
without a family scope (e.g. `cap.suite.shared-field-grammar`) — outside
the lock's 25; **T-CAPABILITY-HOMES-LANDED** when the matrix is next
reconciled.
