---
name: device-sdk
description: "METHOD: Build a device/plugin for the shell — find the functionality gap from the capability matrices and the UX spine, scaffold or extend the owning family through the Device SDK, declare faces and §14 parameter rows to the law, compose the face from the kit's controls to the editor standard with icon-cut.html's marks, pass the validation gate, verify in the running shell, and return."
---

# Device SDK — the loop for building shell devices

Use this Skill when the work is making a device/plugin/instrument face for
the shell — new functionality, a gap in existing functionality, or moving a
native capability onto the rack — for any family (the six products, or a
new one through its owner). This is the owner's development loop: point an
agent at functionality and the agent builds the device natively, to the
UI standard, within the correct paradigm.

## Where things live

```text
O-I packages/live-shell/ui/src/inhabitants/sdk/   the SDK (DEVICE-SDK.md is its law — read it first)
  define.ts        authoring kit: admitFamily / declareDeviceExtension / param builders
  validate.ts      the gate (per-device, per-family, world §14 cross-checks)
  controls.tsx     FacePlate · ScalarParam · EnumParam · BoolParam · ReadingRow · Lamp · Disclosure · WaitingFace
  icons.ts         GENERATED from icon-cut.html (scripts/sync-icons.mjs; never hand-edit)
  scaffold.ts      pure scaffolder (scripts/scaffold-device.mjs is its CLI)
O-I packages/live-shell/ui/src/inhabitants/       the neutral door + the standing families
  familyManifest.ts  the ONLY admission store
  manifest.ts        composed manifests + the door's validator
  agentParamAddresses.ts  the verified ownership map (AGENT_SHELL_ADDRESS_TABLE)
Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/
  WORLD-SHELL-DESIGN.md   §12–16: families, the uncarved block, §14, time, four surfaces
  UX-SPINE-ALIGNMENT.md   the thread order — WHERE work lands is the spine's decision
  AGENT-DEVICE-OWNERSHIP.md  the verified per-device ownership map
  icon-cut.html           the icon language (the specimen)
O-I suite/capability-matrix.json + suite/product-capabilities.json  the matrices
O-I docs/research/ableton-live-12.0.25/ui/UI-EVIDENCE.md  the measured chrome (density, accent, regions)
```

## The loop (run it in order; each step has a command)

1. **Find the work.** `npm run devices:gaps` (in `packages/live-shell/ui`)
   joins the capability matrices with the admitted device surface — each row
   is a capability claim with standing, its family, and the faces/params the
   family already fields. Cross-read `UX-SPINE-ALIGNMENT.md`: if the work is
   one of the spine threads (T1–T9), the thread's touchpoints decide where
   it lands; the SDK serves the thread, never the reverse.

2. **Own the family.** A device belongs to its native owner's family
   (`AGENT-DEVICE-OWNERSHIP.md` is the verified map). No family yet →
   `npm run devices:scaffold -- <family> <owner> <device> <title> [icon]`
   (manifest + face + test, gate-passing, readings-only). Existing family →
   add faces in the family's own manifest module, or compose additively with
   `declareDeviceExtension` — never rewrite an owner's base declaration.

3. **Declare to the law.** Every param row: one owning family, typed
   (`SDK_PARAM_TYPES`), `writePath` ONLY where a real owner write exists
   today (`kernel:<op>` | `shell.<setter>` | `<tool>:<command>`); a row
   without one IS a reading — add a verbatim `disclosure` when the source
   is absent. Waiting faces name the owner they wait for and carry no body.
   A dishonest declaration throws at admission naming each fault — fix the
   declaration, never the gate.

4. **Compose the face** from the kit's controls against the proven aperture
   `{reading, disabled, apply, captureCurrent}` — the face never dispatches
   a write of its own. Every device declares its mark from `icons.ts`
   (`npm run devices:sync-icons -- --check` proves no drift from
   icon-cut.html); no inline SVG. Colours resolve shell tokens only.

5. **Pass the gate.** `npm run test:device-sdk` (kit tests + world gate),
   then `npm run build`. Exit 0 is the floor, not the acceptance.

6. **Verify like the house verifies.** (`npm run devices:walk` is the kit's scripted capture) Exercise the face in the dev harness
   (`src/inhabitants/sdk/dev/`, served by `npm run devices:dev`), capture the running behaviour, and
   name exactly what is admitted, what is exercised, and what waits. An
   editor replacing native controls owes the admission packet in
   `NATIVE-EDITOR-STANDARD.md`.

7. **Return.** Commit inside your declared seat zones on the standing lane;
   write a NOW return in the O-I ProjectCentral register (kind, subject,
   result, status); name any fault you found but do not own, with its owner.

## Not-do laws (binding)

- No second admission path, no second registry, no parallel manifest shape.
- Modes are the spine — no mode SDK, no mode creation by families. What
  varies BY MODE is declared through the kit: `modes` scoping, `formats`
  (the device ontology in `sdk/modes.ts`), and Rev 5 `transport` bindings —
  all gate-checked against the specimen-sourced ontology.
- A family binds its product (§12) or binds nothing; one product family per
  product; a new product is claimed through `newProduct` with its
  authority; no product name squatting.
- No family name in the shell core — the seventh-product test stands.
- No writePath without its writer; no illuminated lamp on an unknown state;
  no milestone prose on the canvas.
- No new icon vocabulary outside the cut; no raw colour values in faces.
- No audio playback or device-editing claims ahead of those owners; the
  licence gate governs every reference adoption.
- A family appears in exactly four places — browser, rack, projections,
  inspectors — plus time bindings and telemetry. A fifth place is a design
  smell: re-examine the boundary, do not build the fifth place.
