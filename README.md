# {O:I}

**Operating Infrastructure · Objective Internality**

{O:I} is an open idea and architecture for the **provisioning and potentiation of technological agency around available model capacity**.

A model supplies capacity. An agent loop puts some of that capacity into motion. What that act can become depends on the world around it: where it stands, what it can reach, what it can do, what it can know, which projects it inhabits, which machines it can use, and how its work can persist and develop.

{O:I} names that wider field.

## An architecture for the engineering around the model

A large part of contemporary AI engineering begins after the model already exists.

Engineers can change the loop that invokes it, the context it receives, the knowledge it can retrieve, the tools and Actions it can use, the projects it inhabits, the environments it can enter, the machines it can reach, and the developmental structures through which its work accumulates.

That is the field {O:I} is concerned with.

> **Given available model capacity, what technological structures provision and potentiate useful forms of agency?**

The smallest case is simple: **a durable personal working ground plus an LLM running in a loop**. The same architecture can open outward into richer capability, knowledge, development, execution, and recursive intelligence without changing that basic relation.

## Operating Infrastructure · Objective Internality

**Operating Infrastructure** is the technical reading: the structures through which an artificial actor can operate.

**Objective Internality** names the same field from the side of the actor. Much of an agent's effective interior world can exist outside the model as objective, inspectable structure — files, projects, capabilities, histories, sources, environments — and still be disclosed back into the act as its working horizon.

There is also a small joke in the name: **“Oh. I.”** Orientation matters. At a deeper level, `{O:I}` also carries `0/1`: persistent ground and actuation, the minimal pair from which the wider architecture develops.

## The field

The present {O:I} family has six centres. Each can stand on its own.

| Function in the whole | Project | What it opens |
|---|---|---|
| Persistent personal ground | [**Central**](https://github.com/EpiLogos/Central) | Human-authored Control, ordinary Work, machine intent, recovery, and durable Actions/Connectors. |
| Agent actuation | [**Actuation**](https://github.com/EpiLogos/Actuation) | Agent actuation plus model, harness, agent-instance and agency research, including the migrated QL runtime experiment line. |
| Capability and context resolution | [**AIKit**](https://github.com/EpiLogos/ai-kit) | Capabilities, context, models, profiles, Skills/tools, HarnessComposition, sessions, and Surface resolution. |
| Developmental agency | [**Software Factory**](https://github.com/EpiLogos/agent-system-design) | Durable Project, Run, evidence, candidate, repair, and ExecutionDisposition semantics. |
| Material execution | [**Workcell**](https://github.com/EpiLogos/Workcell) | Processes, services, storage, network/fabric, lifecycle, and the material worlds in which agency becomes executable. |
| Recursive formal intelligence | [**Quaternal Logic**](https://github.com/EpiLogos/QL-MEF) | The formal QL/MEF system, operators, refraction, and structural research surfaces. |

Together they form a possibility space rather than a fixed workflow.

## `oi`

`oi` is the simple entry command for the composed system. It helps a human or agent see what is available, install/register the native surfaces with published contracts, reach them through one memorable namespace, and verify an exact composed candidate without absorbing native product behaviour.

The base personal encounter is executable:

```sh
bash cli/install.sh
oi install central
oi init --personal-ground "$HOME/Central"
oi status --json
oi ctrl doctor --json
oi ctrl action list --json
```

Central itself creates the valid personal ground. O:I does not populate authored Control material or copy Central configuration into composition state.

Existing ordinary work can be placed under that ground with:

```sh
oi migrate /path/to/existing-work-tree
```

This preserves the work tree as it is and does not create a new Factory/Project identity.

For suite convergence and pre-local acceptance, O:I can represent and verify a frozen composition candidate:

```sh
oi snapshot --output suite.json
noi verify --snapshot suite.json --receipt receipt.json --json
```

A Suite Snapshot records exact selected product revisions and accepted composition facts. A Composition Receipt records what O:I observed and which declared native verification operations actually ran. Partial suites remain legal and explicit. O:I never turns command reachability into product acceptance, never silently promotes a branch to accepted mainline, and never claims physical/provider evidence that has not occurred.

The native projects remain independently usable. `oi ctrl ...` and `oi kit ...` are transparent aliases over the native commands that actually exist today.

## Research and shared field

{O:I} is also a research proposal about the engineering space around a fixed or available model and about Objective Internality: the ways an actor's effective interior can be objectively externalised and re-entered as context, capability, memory, world, and orientation.

The local-first shared-field/research-commons programme is developed separately under its own issues and PRs. It is not a prerequisite for the original composition, verification, or local-acceptance programme.

## Start here

- [`docs/VISION.md`](docs/VISION.md) — founding vision and research frame.
- [`docs/SURFACES.md`](docs/SURFACES.md) — the six product surfaces from the outside in.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — the composition architecture.
- [`docs/CLI.md`](docs/CLI.md) — the `oi` command and pre-local verification surface.
- [`docs/INSTALL.md`](docs/INSTALL.md) — installation and composition.
- [`docs/MIGRATION.md`](docs/MIGRATION.md) — safe placement of existing ordinary work.
- [`docs/RESEARCH.md`](docs/RESEARCH.md) — the agency-potentiation research programme.
- [`skills/oi/SKILL.md`](skills/oi/SKILL.md) — agent-facing orientation to the whole.
