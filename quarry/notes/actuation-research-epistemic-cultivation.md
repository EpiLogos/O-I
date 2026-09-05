# research/epistemic-cultivation (Actuation)

`origin/research/epistemic-cultivation` @ 97347cd (2026-08-16) · 18 commits ·
verdict QUARRY then delete (S-PRODUCTS, [OI-GIT-NORM]): 11 files absent from
main; main's `contracts/model-bearing-v1` is the evolved operative form — this
note preserves the research semantics + source-locked conformance cases.

## What it is

Model-bearing agency research: an experimental language-neutral contract for
model-bearing Actuation conditions and matched condition experiments, plus the
epistemic-cultivation / model-interior research programme. Files @tip:
`schemas/model-condition.v0.schema.json`,
`docs/EPISTEMIC-CULTIVATION-AND-MODEL-INTERIOR-RESEARCH.md`,
`docs/MODEL-BEARING-AGENCY-RESEARCH-AND-MATERIALISATION.md`,
`experiments/model-bearing-agency/{contract,fixtures,source-cases}.js` +
`test/model-condition.test.js`, `experiments/epistemic-cultivation/README.md`,
`.github/workflows/model-bearing-agency.yml` (dependency-free CI).

## The durable semantics (the quarry value)

**Model-condition contract v0** (`model-condition.v0.schema.json`, oneOf
Receipt | Experiment): Provider, material, session and endpoint facts remain
PROVENANCE and do not replace Agent/Agency/Model/Harness identity. A
`ModelConditionReceipt` requires: schema, receipt_ref, actuation_ref,
world_ref, agent_ref, agency_ref, model, engine, materialisation, surface,
harness, access. The experiment form binds matched conditions (same task,
varied model/harness facts) with source-locked cases.

**Epistemic cultivation as a first-class role** (research doc): two coupled
research modes — Discovery and Cultivation; QL/MEF as a disclosure
architecture with L0/L0′ as the minimum disclosure floor; "circumambulation
rather than exhaustive capture"; two J-spaces; QL enters before explicit QL
labelling; Actuation owns the model-bearing-condition field (why: conditions
carry agency/world/binding identity that Actuation already owns).

## Relation to live main

Main's `contracts/model-bearing-v1` (tested in
`contracts/model-bearing.test.mjs`, in the live CI file list) is the evolved
operative form of the same line. This branch is the research narrative and the
v0 schema/conformance fixtures. Recoverable from tip `97347cd` until GitHub GC
if the cultivation programme reopens (cross-refs: O:I #30-file refs, AIKit,
Workcell, Quaternal).
