---
Register: episteme
Standing: architecture-contract
---

# {O:I} Context Frame Acceptance Campaign

**Status:** canonical acceptance matrix and fresh-machine runbook
**Scope:** what each install mode must prove, the teardown law, and the reproducible fresh/two-machine campaign — everything up to the boundary of physical execution
**Date:** 2026-09-13
**Parent:** [#268](https://github.com/EpiLogos/O-I/issues/268) · lock: [CONTEXT-FRAME-COMPOSITION-LOCK.md](CONTEXT-FRAME-COMPOSITION-LOCK.md) · suite coherence: [CONVERGENCE-AND-ACCEPTANCE.md](CONVERGENCE-AND-ACCEPTANCE.md) · UX campaign: `docs/experience/`

## 1. Purpose and relation to other carriers

This document is the **technical acceptance carrier** for the composition lock. It is deliberately distinct from its neighbours:

- `CONVERGENCE-AND-ACCEPTANCE.md` proves that a selected set of product states is **one coherent suite** before any of this runs.
- `docs/experience/` carries the **human/agent experience campaign** over those installations.
- This document proves each **install mode's own promise**: what a person adopting only that mode gets, what must be absent, and that leaving it again is safe.

CI and browser fixtures never stand in for physical or human acceptance. The deterministic cases below run on isolated machines/homes; the physical cases are executed when hardware is authorised.

## 2. The proof matrix

Every supported composition proves the full lifecycle on its production paths — never fixture-only alternatives:

```text
inspect → plan → install/adopt → verify → use a promised capability
        → repeat application → restart → composition change → update
        → interruption/recovery → supported rollback → removal
        → retained-state verification
```

| Case | Fresh install | Existing-world adoption | Promised capability journey | Absence of unselected dependencies | Change / update / rollback | Removal + retained state |
|---|---|---|---|---|---|---|
| **`00/00` Desktop** | Desktop + backing composition (default `0/1/2`) from one flow | existing ground adopted, not reconstructed | one integrated encounter through the app | no Desktop ⇒ same operative core reachable natively (`0/1/2` equal to CF1's backing) | Desktop add/remove **without world reconstruction** — Agents, Projects, ground unchanged | removing Desktop leaves the world and its products intact |
| **`0/1` Ground + agency** | Central + Actuation only | existing agency/harnesses remain legitimate after adoption | ground + one actuated loop, no O:I provisioning | no AIKit, Factory, QL, Workcell management appears | products change without identity drift | ground and authored sources retained |
| **`0/1/2` Operational core** | the normal new-install core | adopted world gains provisioning | one provisioning journey (context → capability) | no Factory/QL/Workcell management appears | update within mode; CF2↔CF3↔CF4 transitions without drift | core data survives removal of one product |
| **`0/1/2/3` Developmental core** | + Factory | adopted world gains developmental form | one Run-shaped journey; **ordinary sessions are not forced into Runs** | no Workcell management or QL required | Factory absent ⇒ sessions unaffected | Factory removal leaves Project history readable |
| **`4.5/0` Client** | Central + minimal Workcell client | existing ground becomes the access point | reach and use an authorised capability **on the other machine, proved not executed locally** | closure excludes QL and the agent-development stack; **one host fixture also lacks QL** | disconnect, host restart, revocation, version skew, reconnect | client removal leaves the remote world intact |
| **`5/0` Learning** | Central + QL with usable learning material | QL adopted onto existing ground | one learn/explore journey through native surfaces | no Actuation, AIKit, Factory, or hosted stack | QL updated within mode | learning material removal is scoped and explained |
| **All-products** | six products realised inside CF5, headless or Desktop | maximal adoption path | whole-field journey (§10 of the product field) | n/a — but **presence must not rebrand CF5**: containing frame is unconditional | update subsets per machine receipt | teardown explains every residual |
| **Standalone native products** | each product installs and runs through its own entry points | pre-existing registrations honoured | one native journey per product, no `oi` involved | no `oi`-installed shims or hooks | native update paths unaffected by O:I | unregistering leaves native installation untouched |

**CF5 containing invariants** (proved in every case above): the material context is disclosed with zero products installed; recognising a machine never silently installs a server, virtualisation stack or model runtime; omitting Workcell management never hides the material relation; `workcell:local` adoption stays honest about what was and was not verified.

**Transition cases** (each proves no identity drift and no world reconstruction): `0/1`→`0/1/2`→`0/1/2/3` ascending; descending the same ladder; Desktop add/remove over any backing; ground re-binding between modes.

## 3. The teardown law

Uninstall/disconnect is distinct from deletion of authored data. Removal is complete only when **every residual is explained**:

- every created file, registration, service, process, shell hook, network exposure and credential reference is **owned by a recorded plan**; only owned resources are removed;
- pre-existing native installations, shared dependencies, Central ground and native product data are preserved unless deletion is separately authorised;
- a **disposable-test purge** is an explicit, separately scoped action with target validation — tested against path boundaries, symlinks, unexpected contents, interrupted and repeated runs;
- after teardown, the post-state is compared with the captured baseline; intended retained source and evidence are not failures — **unexplained services, hooks, credentials, registrations, listeners or managed files are**;
- a successful uninstall exit code is not sufficient evidence.

## 4. Fresh-machine runbook

One runbook, executed per case; deterministic fixtures first, physical machines later:

1. **Baseline capture** — before any mutation: relevant filesystem (managed roots, config locations), registrations, services, processes, environment modifications, network exposure. Recorded with digests into the run's evidence directory.
2. **Isolation** — isolated `OI_HOME`, `OI_DATA_HOME`, `HOME`, ground, installation root and credentials. Nothing on the daily-use machine is a target; it stays protected.
3. **Execution** — the case's row from the matrix, via production lifecycle paths only. Commands, exit results and revisions recorded as they run.
4. **Evidence export** — evidence is written **outside any root cleanup will remove**, exported before teardown.
5. **Teardown + residual accounting** — per §3, compared against the baseline.
6. **Restore** — a fresh or restored baseline between destructive composition cases; no case inherits another's state.

Physical readiness gates: inspect the target machine's actual OS/hardware/readiness before selecting physical cases — never assume a platform from old plans, never treat "almost ready" as authorisation to reset. The second machine's campaign executes under separate, explicit authorisation.

## 5. Two-machine case list

Each case records machine roles, source revisions, artifact digests, environment, commands, exit results, service/network changes and human-observed results:

1. authorised remote use — the client reaches and uses a permitted capability; execution location is proved, not assumed;
2. permitted disclosure — what the client can see is exactly what was granted; capability advertising is not authorisation;
3. disconnect and offline state; host restart and reconciliation;
4. expired and revoked access; unsupported version combinations refuse loudly;
5. reconnect with compatibility reporting;
6. scoped source changes and conflicts between two machines sharing a related ground — no copied machine identities, credentials, absolute paths or generated runtime state;
7. independent client teardown — the remote world intact; hosted-service removal names what connected clients lose.

## 6. Status

- **Ready now (repository-side):** the deterministic per-mode cases, transitions, teardown accounting and two-machine fixtures on isolated homes/machines.
- **Pending authorisation (physical):** fresh-machine physical runs on the second machine, and any case touching the daily-use machine's real environment. These remain explicitly pending; their absence never blocks repository implementation.
