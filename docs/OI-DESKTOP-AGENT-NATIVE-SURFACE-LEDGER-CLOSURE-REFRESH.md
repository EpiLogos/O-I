# O:I Desktop #104 — Surface Ledger Closure-Time Revision Refresh

**Status:** authoritative closure-time revision overlay for `OI-DESKTOP-AGENT-NATIVE-SURFACE-LEDGER.md`  
**Date:** 2026-08-19  
**Scope:** exact revision/current-development-state refresh only. The capability accounting, owner boundaries, gap classification and #105–#111 implementation cut in the main ledger remain unchanged unless explicitly amended below.

## Why this overlay exists

The #104 reconciliation branch was deliberately cut from the then-current O:I main `9a34a83158dada7df236aa04efaa24f47704263d`. While the live audit was still running, O:I main advanced by two commits to `fcf603839d094799317a3de09e812e7eec34e212`.

The exact GitHub compare from the branch-cut main to closure-time main reports:

```text
status: ahead
ahead_by: 2
files changed: 0
```

The second commit is `Revert accidental schema-test file creation`. This is therefore a **current-development-state change with no net file/content delta** relevant to the reconciliation. The #104 branch is intentionally not rebased merely to erase that concurrent no-op movement; #96/#97 remain the convergence owners.

A second live refresh found that AIKit PR #115 advanced after the initial ledger snapshot, and a new Factory Epi/Bimba conformance PR #160 opened. Both are recorded here so the closure receipt does not freeze stale heads.

## Closure-time accepted/current mains

| Product | Closure-time main | Relation to initial ledger |
|---|---|---|
| O:I | `fcf603839d094799317a3de09e812e7eec34e212` | advanced from `9a34a83158dada7df236aa04efaa24f47704263d`; net compare has zero changed files |
| Central | `a332b26eb08b95581533fc5053a2d16a22cf1f69` | unchanged |
| Actuation | `0c6a9147a780329007733df643eb07108f589ac6` | unchanged |
| AIKit | `42127820d6e5bf4ea5ee248e88e305e14c5c1a7c` | unchanged |
| Software Factory | `02627a2373ada04369e9d2d338cfd0809f49725c` | unchanged |
| Workcell | `8a744b1ddbdc694ad71b7aea72064f7def6620d2` | unchanged |
| Quaternal Logic / MEF | `385a0b8693cfa9f50b52410d484f04a70a702cde` | unchanged |

## Closure-time active implementation/design heads

| Owner | PR / branch | Closure-time head | Status / desktop relation |
|---|---|---|---|
| O:I design | #102 `design/desktop-application-spec` | `5f5b1f8e76e00d4fd56aa10282b02bd83b5276ae` | open draft; consume both design docs directly |
| O:I inherited desktop | #99 `agent/oi-desktop-workbench-94` | `dd862fad5bfc51532b4974039bf646612be1f494` | open draft; consume-now #94 substrate, not a #105 blocker |
| O:I Explore | #72 `agent/explore-projection-space` | `d4334a2147d417baf3d192b916c3eb51e121c596` | open draft; renderer-neutral Explore/SharedField application line |
| Central Ground | #73 `agent/projectcentral-authored-ground` | `7865ddba7d4eb91a276f8a248f4e7a93d5c7282f` | active owner line |
| Central NOW/DAY | #75 `agent/projectcentral-now-day` | `ab354c1278396b0d50620bf8a43c40eedc26b907` | active owner line |
| Central governance | #80 `feat/layered-agent-governance-sources` | `9068b1452a270124a75039a9328a8e1e664d0e25` | active owner stack; AIKit remains operational precedence owner |
| Actuation realised loop | #17 `agent/realised-actuation-loop` | `85ac3dee1eb9cc1ad0761eb8451ae51d2167c4e3` | active WHAT-of-instantiated-agency line |
| AIKit praxis/reflection | #115 `agent/praxis-project-reflection` | `49c2f1f42e5fd58c15d1677b933a919491528d11` | **advanced after initial snapshot**; same Method/reflection ownership, currently mergeable and non-draft |
| AIKit harness adapter | #116 `agent/harness-admission-sdk` | `9974e7ed61a57123442b2f464a1d174081a55bac` | open draft stacked on the #115 line; current base is behind the moving parent and must not be raced here |
| Factory praxis/reflection | #159 `agent/projectcentral-praxis-reflection` | `60e61c29172a92badd2658e6df6aae38a2365171` | active ProjectCentral/praxis/reflection consumer |
| Factory Epi/Bimba structural fidelity | #160 `agent/epi-bimba-structural-ground-binding` | `fea16cf2e756eca872824f2d907be4e078a23b0e` | **new during reconciliation**; one conformance test over existing `factory.structural-ground/v1`; not a Bimba parser and not a #108 dependency |
| Epi host foundation | O:I #87 `agent/oi-epi-mode-kernel-bridge` | `aa4bc55198461feaa68d1adccd44383af4dbe417` | active QL/Epi convergence exception |
| Epi Nara | O:I #88 `agent/oi-epi-nara-lived-vertical` | `f9f1a53111826938e6d6791b761973e50628cb38` | active rich native Surface |
| Epi Personal | O:I #89 `agent/oi-epi-personal-450-return` | `b1b42f3a0a90eea157fcd9377b3d4d3108d6184c` | active Nara/Epii/Anuttara return stack |
| Epi PRE-D | O:I #100 `agent/oi-pre-d-personal-map-lineage` | `7bd18d15e367113fdd8be2410d1e3fecd8664408` | active coordinate-lineage host reconciliation only |

## Amendments to the main ledger

1. Read the O:I main row in §2 as `fcf603839d094799317a3de09e812e7eec34e212` for closure-time state.
2. Read AIKit #115's active/current head as `49c2f1f42e5fd58c15d1677b933a919491528d11`; the earlier `e36e8fc...` remains a real green validation receipt but is no longer the PR head.
3. Add Factory #160 `fea16cf2e756eca872824f2d907be4e078a23b0e` to the active convergence exceptions. It strengthens exact Epi source ↔ generalized QL C ↔ Factory developmental structural-fidelity evidence only. It does **not** change the current Factory Build GUI, Build Action handler, SSSF source-fidelity disposition, or #108 integration cut.
4. AIKit #116 remains a real current adapter implementation, but because its parent #115 moved during this audit, #104 records it as an active stacked head rather than treating its ancestry as final accepted convergence.
5. No closure-time movement changes the returned execution graph:

```text
#105 stable host/Search/Command
   ↓
#106 + #107 + #108 + #109 + #110 in parallel
   ↓
#111 final accepted-revision parity + physical/security/human acceptance
```

6. No new unowned native semantic gap was discovered by the refresh. Existing native-owner issues remain sufficient.

## Convergence law

This overlay is evidence of **closure-time observation**, not an instruction to merge/rebase active work. O:I #96/#97 select final accepted ancestry. P7/#111 must regenerate the parity ledger against those final accepted revisions before whole-application closure.