# O:I Suite Convergence and Local Acceptance

## Purpose

O:I composes independently developed product surfaces. That creates one whole-level responsibility that no native product can own by itself:

> **When are the selected native product states coherent enough to count as one exact O:I suite, and how is that suite proved on a real machine?**

This protocol bridges cloud-available product development and physical/local acceptance without moving native behaviour into O:I.

It is part of O:I's installation/composition programme under #1 and #17. It is independent of the shared-field/projection programme under #9.

## Foundation-ready product state

A product does not need to be "finished" before convergence. It needs an intentionally selected foundational line that is suitable for whole-suite testing.

For a surface to enter a full-suite convergence candidate:

- the accepted foundational implementation is on the product's native `main`;
- PRs/branches required for that line have been merged or deliberately excluded;
- the native install/update or compatible-registration path is known;
- the native executable/runtime entry is known;
- the current documentation and agent Skill/operating instructions are usable;
- the product owns a verification operation appropriate to its own semantics;
- any required cross-product compatibility fixtures/contracts are identified;
- physical/provider evidence that cannot yet exist is explicitly marked rather than inferred.

Experimental work may continue elsewhere. Convergence selects a known state; it does not freeze all product development.

## Suite Snapshot / Composition Receipt

O:I should be able to emit a compact exact record for a convergence candidate.

Conceptually:

```text
SuiteSnapshot
  schema revision
  created/observed at
  O:I composition revision
  surfaces[]
    module identity
    repository
    accepted version / main commit
    native install or registration method
    native executable/runtime entry
    O:I alias
    docs entry
    agent skill entry
    native verification declaration
    compatibility declarations
  cross-product conformance declarations[]
  outstanding physical/provider gates[]
```

The serialized contract should be as small as the implementation needs. The semantic laws are fixed:

- a Suite Snapshot is composition/acceptance metadata, not a copy of product configuration;
- it does not own native package dependency graphs;
- it records the exact product states that were selected/proved;
- independently versioned products remain independently versioned;
- partial compositions remain legal, while a **full-suite acceptance** requires all six selected foundational surfaces.

## Phase 1 — live convergence

Before building a candidate, O:I rereads the actual live native repositories rather than trusting stale planning prose.

For each of the six surfaces, capture the accepted `main` state and current installation/entry/verification facts. If a required foundational PR is still open, the suite candidate is not yet converged; the owning product remains the place to finish that work.

This phase should produce an exact candidate Suite Snapshot.

## Phase 2 — clean-environment preflight

Exercise as much of the Suite Snapshot as possible in a disposable clean environment before touching the user's long-lived machine.

The intended flow is approximately:

```text
oi init / adopt composition
  ↓
install or register each selected native surface
  ↓
oi status / alias disclosure
  ↓
native verification for each product
  ↓
declared cross-product conformance
  ↓
preflight receipt
```

A preflight may legitimately report that a check requires a physical/local provider unavailable in hosted CI. That is an **outstanding evidence gate**, not a passing result and not a general blocker for unrelated deterministic checks.

## Phase 3 — physical local acceptance

Install/register the exact candidate Suite Snapshot on the user's actual workstation.

Record at least:

- observed machine/platform facts relevant to installation;
- exact installed native product states;
- O:I composition state and aliases;
- each native verification result;
- cross-product conformance evidence that can run there;
- physical/provider evidence newly available locally;
- deviations from the candidate snapshot;
- failures routed to their owning product.

Do not repair a native product only in local machine state and then call the suite accepted. A reusable product defect returns to that repository, is fixed/tested there, and the candidate snapshot advances.

## Phase 4 — reference-machine/topology acceptance

A later reference server or richer Workcell arrangement proves that the same O:I suite can inhabit a different physical topology without changing semantic ownership.

The expected responsibility boundary remains:

```text
Central
  persistent personal/machine ground and intent

Agent Runtime
  actuation / agent loop

AIKit
  capability, context, HarnessComposition and Surface resolution

Software Factory
  developmental Project/Run/Agent/Agency semantics

Workcell
  material processes, services, bindings, storage, machines and lifecycle

Quaternal Logic
  recursive formal intelligence

O:I
  composition, installation/disclosure and whole-level acceptance receipt
```

The reference-machine phase should consume actual Workcell acceptance evidence rather than infer it from a deployment profile.

## `oi verify`

O:I may provide one whole-level verification command once the native declarations exist.

`oi verify` is deliberately thin. It may:

- validate O:I composition metadata;
- verify registered executable/runtime reachability;
- verify alias dispatch integrity;
- invoke each registered module's declared native verification/self-check;
- report exact observed version/commit and result;
- invoke explicitly declared cross-product conformance checks where the relation belongs to the composition;
- mark unavailable physical/provider checks as outstanding.

It must not:

- reinterpret a native product's internal health model;
- duplicate Workcell, Factory, AIKit, Central, runtime or QL verification semantics;
- mutate product state merely to make a check pass;
- claim physical evidence that the executing environment did not observe.

The result should be suitable for both humans and agents and should be recordable alongside the Suite Snapshot as acceptance evidence.

## Known-good suite states

After physical acceptance, O:I can record the exact combination as a known-good suite state.

This does not require one synchronized version number for all products. A known-good O:I suite is a proven relation among independently versioned native surfaces.

Future product work can advance independently. The next convergence candidate is created by deliberately selecting newer accepted product states and running the protocol again.

## Failure routing

The protocol must preserve product ownership when something fails:

```text
native install/runtime/self-check failure
    → owning product

Workcell materialisation/provider failure
    → Workcell

AIKit resolution/Surface/Harness binding failure
    → AIKit

Factory Project/Run/developmental contract failure
    → Factory

Central personal-ground/control failure
    → Central

agent-runtime/loop/harness execution failure
    → owning runtime/harness surface

QL/MEF provider/formal failure
    → Quaternal Logic

O:I registration/alias/snapshot/whole-level verification failure
    → O:I
```

Cross-product failures should be diagnosed at the narrowest contract seam and fixed in the semantic owner rather than hidden by translation in O:I.

## Closure

The first full local acceptance closes when:

1. one exact foundational state of all six selected surfaces is on their native `main` branches;
2. a Suite Snapshot/Composition Receipt records those exact states and entry/verification declarations;
3. clean-environment preflight has accounted for every runnable check and every genuinely physical outstanding gate;
4. the exact suite has been installed/registered on the user's real workstation;
5. native and declared cross-product verification has been recorded there;
6. failures discovered during acceptance have either been fixed in the owning product and reconverged or remain explicitly open;
7. reference-server/provider acceptance remains separately identified where physical infrastructure is not yet available.
