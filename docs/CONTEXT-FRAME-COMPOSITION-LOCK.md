---
Register: episteme
Standing: architecture-contract
---

# {O:I} Context Frame Composition Lock

**Status:** canonical composition lock
**Scope:** the Context Frames as one containing material frame organising six install modes; what each adoption contributes; the supersession of the #192 installation-modality taxonomy
**Date:** 2026-09-13
**Parent:** [#268](https://github.com/EpiLogos/O-I/issues/268) · corrects [#132](https://github.com/EpiLogos/O-I/issues/132) · supersedes [#192](https://github.com/EpiLogos/O-I/issues/192) as taxonomy

## 1. The lock: one containing frame, six install modes

The structure is:

```text
CF5 — 4.0/1–4.4/5
The containing material frame: the Workcell in which a world is realised
│  organises six install modes, each situated at a frame notation:
│
├── 00/00       Desktop mode — integrated encounter
├── 0/1         Ground + agency — Central + Actuation
├── 0/1/2       Operational core — Central + Actuation + AIKit
├── 0/1/2/3     Developmental core — + Software Factory
├── 4.5/0       Client mode — Central + minimal Workcell, connecting cells
└── 5/0         Learning mode — Central + Quaternal Logic
```

**The Context Frames organise the install modes; the modes do not define the frames.** A mode's identity is the frame notation it sits at — `0/1`, `4.5/0`, `5/0` — not the reverse. **These are not seven ascending editions.** There is one material condition within which six characteristic ways of adopting and encountering the system become possible. This is the founding position restated at installation scope: the products are centres within a field, not mandatory boxes in a workflow; the smaller relation — persistent ground plus actuated model capacity — is already the whole relation, developed through actual needs rather than mandatory product accumulation.

## 2. CF5: the machine is already the condition

Whether somebody installs two products, the Desktop, a remote client, or the entire suite, the installation already takes place within some material situation. Workcell is not an optional *fact* added when the system becomes sophisticated.

What varies is **how explicitly O:I manages that material situation**: recognising the existing computer, connecting it to another cell, managing services, providing isolated execution, hosting models, or materialising a larger world.

The implementation distinction that follows:

> **The Workcell context always applies. The installed Workcell management capabilities must be disclosed explicitly.**

Recognising the machine condition must not silently install a server, virtualisation stack or model runtime. Equally, omitting those packages must not make O:I pretend the installation has no material context. Central's machine-adoption contract (Central #87) already records an explicit machine–Workcell relation through Central's native actions without making Workcell a dependency of standalone Central; that foundation is developed, not replaced with an installer-owned machine registry.

Every installation accounts for **where it exists, where its work executes, which ground it relates to, and which bindings have actually been verified**. CF5's applicability does not by itself prove any particular machine identity, connection or health state.

## 3. The six install modes

| Mode (frame) | Installation composition | What the person is choosing |
|---|---|---|
| **`00/00`** | **O:I Desktop + Central ground, with an explicitly selected backing composition** | Encounter the system through one integrated application. |
| **`0/1`** | **Central + Actuation** | Give an existing agent-engaged world durable ground and explicit agency, without adopting O:I provisioning or development management. Existing realised agency and harnesses remain legitimate; no hidden AIKit, Factory or QL requirement. |
| **`0/1/2`** | **Central + Actuation + AIKit** | Add coherent provision of context, models, capabilities, Skills, harnesses and sessions. This is the normal operational core. |
| **`0/1/2/3`** | **Central + Actuation + AIKit + Software Factory** | Add durable developmental organisation: intended change, Runs, candidates, evidence and Recognition. Factory's presence must not force every ordinary session into a Factory Run. |
| **`4.5/0`** | **Central + minimal Workcell client/connectivity** | Make this machine a grounded access point to a world realised on another machine. **`4.5` is not an instruction to install product 5**: QL is not a client-mode dependency, locally or for the connection itself. Local Actuation, AIKit and Factory are not required merely to establish the client relation. |
| **`5/0`** | **Central + Quaternal Logic, including usable learning/exploration material** | Learn, explore and work with QL without adopting the agent-development stack. A legitimate educational/formal installation; agent tutoring is an optional richer composition. |

The main adoption progression is straightforward: **`0/1`** makes ground and agency explicit; **`0/1/2`** also takes responsibility for provisioning agency; **`0/1/2/3`** also offers a durable form for developmental work; richer Workcell management makes material execution and hosting explicit; **`5/0`** offers the formal system itself as something to learn and use. **`00/00`** changes the integrated experience; **`4.5/0`** changes the distribution across machines. Neither is squeezed into a "more products equals better" ladder. The installer explains **what responsibility each additional product takes on**, and what remains with the person's existing tools.

### Desktop remains a real choice, not a hidden dependency

For the Desktop mode (`00/00`) the installer says what is actually behind the application. A new Desktop installation may default to **Central + Actuation + AIKit** as its backing composition, while lighter, richer or remotely backed arrangements remain explicitly selectable. That is a packaging default — not a claim that `00/00` and `0/1/2` are the same frame. Someone choosing `0/1/2` without Desktop receives the same operative core; adding or removing Desktop must not reconstitute their Agents, rename their Projects or reinstall their ground.

### All-products remains a valid deployment

"all products" — with or without Desktop, including a headless host — means all six products are realised within the material frame. It does not mean CF5 suddenly comes into existence, and no eighth frame is invented for that package selection.

### `oi` is the doorway, not a product position

`oi` is the common installation, composition and command doorway for these offerings. Individual products must also remain usable through their own native entry points. Central remains the root meta-project and authored ground, not merely an installer configuration directory.

## 4. Supersession of the #192 installation-modality taxonomy

The six bootstrap labels introduced under #192 — `fresh-ground`, `existing-ground-reconcile`, `developer-source`, `existing-world-adoption`, `reference-world-host`, `harness-strap` — are **superseded as an installation-modality taxonomy**. They do not name "context frames" and they are not a second competing set of install modes.

What is preserved, and why:

- **Sound code stays.** The dispatch table, install descriptors and their per-path UX threads remain useful machinery.
- **Per-registration provenance stays.** A registration's recorded path label remains truthful historical evidence of *which installation path registered that surface*.
- **Historical receipts are not rewritten.** Changed semantics are versioned (`oi.current-world/v2`); an old v1 `cf5` field meant what v1 meant — maximal six-product presence — and is never silently reinterpreted as the v2 model. Unknown historical intent remains unknown.

## 5. The operative installation account

One composition catalogue drives CLI setup, Desktop setup, System, documentation and acceptance tests. It holds the seven frame definitions with their actual roles and nesting, together with the concrete product and surface selections they support. The operative installation account distinguishes:

```text
Containing material context
    which local/remote Workcell relations apply

Requested composition
    what the person chose

Effective composition
    what is actually bound and usable

Installed artifacts
    what software exists on each machine

Experience surfaces
    Desktop, native CLI, oi CLI, harness or remote client

Authority
    which available operations are permitted

Lifecycle evidence
    plan, changes, receipts, failures and retained state
```

Requested, installed, effective, active, reachable and authorised states stay distinct. Remote availability is not local installation. A present executable is not proof of a usable capability. An unavailable remote endpoint must not cause silent local fallback. Arbitrary explicit selections are disclosed exactly as they are; they are never forced into a false canonical frame.

Source acquisition and release channel remain ordinary installation facts; they do not become another set of public "modalities".

## 6. Three synchronisations, never collapsed

**Software updates** belong to O:I's suite composition and each machine's active receipt (#212 line). Two machines can follow compatible release lines while installing different product subsets; updating a `4.5/0` client must not pull the host's entire suite onto it.

**Ground and source synchronisation** belongs to Central and its native source/connector mechanisms, with explicit scope, direction, authority and conflict handling. Machine identities, credentials, absolute local paths and generated runtime state are not portable authored ground.

**Material reconnection and reconciliation** belongs to Workcell: endpoint reachability, current capabilities, connection permissions, service bindings and leases. Reconnecting is not permission to overwrite source or silently update software.

O:I coordinates and explains all three; it does not collapse them into an opaque "sync everything" operation.

## 7. Increments

| Increment | Deliverable |
|---|---|
| **Composition lock** | This document and [#268](https://github.com/EpiLogos/O-I/issues/268). |
| **Composition contract** | Shared catalogue in code, corrected `CurrentWorld` semantics (`oi.current-world/v2`), honest schema versioning, absence-aware regression tests. |
| **Lifecycle planner** | Native-owner install/change/remove operations, receipts, interruption recovery, composition-aware updates; `inspect → plan → install/adopt → verify → change/update/repair → rollback/disconnect/remove → verify retained state` with declared target machine, owner, effects and recovery per mutation. |
| **Cross-cell composition** | Client-mode (`4.5/0`) minimum, Central projection rules, Workcell connection lifecycle and compatibility. |
| **Setup and System** | The same plans and owner operations through CLI, Desktop and authorised agents; recognition precedes mutation; no second O:I settings database; Desktop preferences stay separate from the world constitution. |
| **Acceptance campaign** | Six forms inside CF5, standalone native products, all-products hosting, transitions, teardown and two-machine tests with exact evidence and physical readiness gates. |

Acceptance proves, for each supported composition: fresh install, existing-world adoption, a useful capability journey, absence of unselected dependencies, repeat application, restart, composition change, update, interruption/recovery, supported rollback, removal and retained-state verification. A package rollback is not automatically a data rollback; interrupted multi-product operations are not magically atomic; teardown is complete only when the residual state is explained.

Physical acceptance on the second machine is a separately authorised stage. The daily-use machine stays protected; unavailable physical cases remain explicitly pending while repository work continues.
