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

## Converging and accepting

Convergence is the ordinary workflow, not a phase: each product lands its accepted state on its own `main` through its own gate; the next local session refreshes the accepted source and rebuilds or rebinds the executable it will actually use (`oi dev sync`, `oi dev build`, `oi dev test`, `oi dev install`), and `oi dev acceptance` proves that the local software world is the current clean mainline world before any physical or provider test. Physical, provider and human evidence stay separately outstanding until recorded on the real machine; nothing in hosted CI claims them (`docs/CI.md`).

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
