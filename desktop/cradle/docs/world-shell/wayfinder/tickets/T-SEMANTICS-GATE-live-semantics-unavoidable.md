# T-SEMANTICS-GATE — Every device declares its Live semantic; the gate refuses otherwise

Label: wayfinder:task (Phase 1 — before any new device work)
Claimed-by: —
Blocked-by: —

Zones: `packages/live-shell/ui/src/inhabitants/sdk/` (`modes.ts` vocabulary,
`define.ts`, `validate.ts`), `packages/live-shell/ui/src/inhabitants/manifest.ts`
(the face declaration type), every `*FamilyManifest.ts` / extension module in
`packages/live-shell/ui/src/inhabitants/` (add the field to existing faces),
`packages/live-shell/ui/scripts/validate-devices.mjs`, tests.

## Question

Make DEVICE-SEMANTICS-LOCK.md §5 law: add `liveSemantic` to the face
declaration from the closed vocabulary of the lock's §1; gate it (required,
mode-legal per §2, invariants per §5.3, format compatible per §5.4, Live
exemplar pointer per §5.5); declare it on every existing face per the lock's
§2 tables; emit the semantic registry from `devices:validate --json` and lock
it with a test (§5.6).

## Acceptance

- A face without `liveSemantic`, with an unknown one, an illegal mode or a
  broken invariant is refused at admission with the fault named (tests show
  each refusal).
- Every admitted face carries its semantic; `npm run devices:validate` exits 0;
  `npm run test:device-sdk` green; tsc zero; lane suites green.
- The registry snapshot is committed and test-locked.
- No face changes its behaviour — this is declaration and gate only.

## Resolution

—
