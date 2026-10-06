# O:I

O:I is a suite of six command-line products, plus a front-door tool, `oi`, that installs and joins them. Together they give an AI agent's world six explicit parts: ground, agency, capability, development, environment and reflection. Each part gets its own tool, its own records and its own contracts, so it can be inspected, changed and shared without taking the others apart.

O:I stands for **Objective : Internality**: the means through which a life knows and acts within a world. Memory, language, instructions, tools, permissions and other people are internal because every act proceeds through them, and objective because each can be examined and changed.

## An agent's world has six facets

| Facet | What it covers |
|---|---|
| **Ground** | what a person has written, the projects under way, what carries over from one session to the next |
| **Agency** | who is acting, on whose behalf, within what bounds, and how results come back |
| **Capability** | the models, skills, tools and sources available to the agent here and now |
| **Development** | how an intention becomes work, and work becomes evidence that can be judged |
| **Environment** | the workspaces, services and machines where the work actually runs |
| **Reflection** | a formal way of reading all of these: what shaped an act, and what should change |

## Why keep the facets apart

Agent harnesses give a model a loop, some tools and a context window for the length of a session. They, and the products built around them, treat these facets as implicit, or add them one at a time as features: a memory file here, a permissions setting there, a plugin for tools. The facets end up tangled inside one harness's configuration. Then:

- changing harness or model means rebuilding the ground, permissions and tool set by hand;
- what a person wrote, what software observed and what an agent inferred end up in the same file, with nothing to tell them apart;
- "who was allowed to do this, and on whose behalf?" has no record to answer from;
- a capability counts as available because a file exists, whether or not it was selected, loaded or used;
- the result of a piece of work comes back as a chat message, with no record of what was asked for, what was tried, or how it was judged.

O:I differentiates them. Each facet is its own product, with its own records and versioned JSON contracts. Products meet by calling each other's command-line tools and reading each other's documents, not through a shared runtime, so each can be used alone, alongside tools you already have, or replaced.

## The Cradle

The Cradle is the O:I desktop application, and it is being built now. It comes before the harness. It sets up the agent's world as one working situation that any harness can then act within: the ground, the agents present and what each may do, the capabilities in play, the work under way and the machines it runs on. In the Cradle a person chooses the world and project in focus, brings an agent into it, sees what that agent is actually doing, pulls knowledge into view when it helps, moves into structured development when the work calls for it, and lets the right workspace or machine be provided underneath. It is a meta-harness, not a dashboard: files, knowledge, agents and their activity form one situation rather than a view over separate tools.

Technically it is a Tauri application with a Rust kernel and a React interface (`desktop/cradle/`). The interface sends typed operations to the kernel. The kernel composes readings from each product's own commands and writes only through Central's Actions, as compare-and-swap writes. There is no generic shell, filesystem, network or secret bridge. Design: [`docs/cradle/01-DESIGN.md`](docs/cradle/01-DESIGN.md); architecture: [`docs/cradle/02-ARCHITECTURE.md`](docs/cradle/02-ARCHITECTURE.md). One Linux pre-release bundle exists (`oi-desktop-v0.1.0-prelocal.1`, installed with `oi desktop install --recorded`). Otherwise, build it from source as described in [`desktop/README.md`](desktop/README.md).

## The six products

| Facet | Product | CLI | What it does | Repository |
|---|---|---|---|---|
| Ground | **Central** | `ctrl` | Keeps what a person has written, their projects, and their machine declarations as plain files in a personal root (`~/Central`). People and agents read and change it through 188 named, typed Actions. It also keeps the NOW and DAY records that carry work between sessions. | [EpiLogos/Central](https://github.com/EpiLogos/Central) |
| Agency | **Actuation** | `actuation` | Records which agent holds which position, on whose authority and within what bounds. It admits or refuses agency requests against explicit grants, and keeps an append-only record of attributed events and returned results. It also detects which agent harnesses are installed. | [EpiLogos/Actuation](https://github.com/EpiLogos/Actuation) |
| Capability | **AIKit** | `aikit` | Works out which skills, tools, models and knowledge sources apply to a project, agent and task. It projects that set into the harness in use where it has a declared, reversible way to do so, and brokers the rest. | [EpiLogos/ai-kit](https://github.com/EpiLogos/ai-kit) |
| Development | **Software Factory** | `factory` | Keeps a file-based record of agent-driven development: the Commission (what was asked for and why), its Runs and attempts, the evidence gathered, and where a person's judgement was asked for. | [EpiLogos/Factory](https://github.com/EpiLogos/Factory) |
| Environment | **Workcell** | `workcell` | Turns a request for a workspace, process or service, on this machine or a connected one, into a real one. It records what was provided and what became of it. | [EpiLogos/Workcell](https://github.com/EpiLogos/Workcell) |
| Reflection | **Quaternal Logic / MEF** | `ql` | Implements Quaternal Logic's formal structures as typed, versioned operations: a six-position coordinate kernel with deterministic operators and a registry of twelve reading lenses. It is optional: nothing else requires it. | [EpiLogos/QL-MEF](https://github.com/EpiLogos/QL-MEF) |

`oi` itself is the seventh executable, not a seventh facet. It installs, verifies and updates the six, and dispatches to them.

## How they meet

Each product owns its own records and is the only writer of them. The others read those records through the owner's CLI and versioned JSON.

| Owner | Owns | Read by |
|---|---|---|
| Central | the person's authored files, projects, World Positions (`central:position:<world>:<slug>`), NOW/DAY | AIKit (ground and NOW), Factory (receiving, Flows), Actuation (positions), the Cradle (every source reference) |
| Actuation | who occupies which Position, authority grants, agency admission, the event stream, harness detection | AIKit (`aikit inhabit` claims through it), Factory (custody checks the current occupancy), Workcell (runs need `agency actualise`), Central (harness census) |
| AIKit | resolved capability per context, sessions, the encounter and delivery journal | Factory (model selection, task dispatch), Workcell (worktree verdicts), `oi search` / `oi explain` / `oi ui` |
| Software Factory | Commissions, Journeys, Runs, attempts, custody of work | AIKit (`aikit factory`), `oi work factory`, `oi prove factory` |
| Workcell | material placement, service instances, run records, harness-process census | Factory (attempt material and places, resource usage), AIKit (instance intake) |
| Quaternal Logic / MEF | formal operations, lens registry, Vāk composition | AIKit (capability negotiation), Factory (`@epilogos/ql-vak` workflow types), Actuation research |

One worked path is a piece of commissioned work:

1. A person submits a **Commission** to Factory: a recorded request for a piece of work and its reasons. Factory records a Project, a Journey and a first Run, and runs nothing yet.
2. Factory assigns custody of the work to a Central World Position, checked against Actuation's current occupant.
3. Each attempt is dispatched to its owner: the agent task goes through AIKit and Actuation's gateway, and its workspace and process through Workcell.
4. Workcell returns material evidence and Factory checks the unit's verification obligations.
5. The result is submitted to Central's review queue.
6. The person reviews it there. Accepting a result is a person's act, never the side effect of a receipt.

The current, source-linked map of every such relation is [`docs/architecture/README.md`](docs/architecture/README.md), with [`world-ownership.md`](docs/architecture/world-ownership.md) and [`execution-return.md`](docs/architecture/execution-return.md).

## Quick start

Install `oi` from the release. This needs only `curl`, `tar` and a SHA-256 tool, and works on Apple Silicon macOS and x64 Linux:

```sh
curl -fsSL https://raw.githubusercontent.com/EpiLogos/O-I/main/install.sh -o oi-install.sh
less oi-install.sh          # inspect before running; the script installs a binary onto your PATH
sh oi-install.sh
```

Then install the products and set up a personal ground. A ground needs a current Central, which `oi install central` builds from source, so this step needs a Rust toolchain:

```sh
oi install central
oi init --personal-ground "$HOME/Central"
oi install actuation ai-kit software-factory workcell quaternal-logic
oi status
oi doctor
```

Everyday commands:

```sh
oi world                    # where you are: ground, machine, products present
oi products                 # each product's executable, namespace and recorded revision
oi search <words>           # search the composed world through AIKit; finds, never executes
oi act                      # list Actions; `oi act describe <action>`, `oi act invoke <action> --input <json>`
oi agent roster             # the agents defined in your ground
oi work direct|factory      # choose plain session work or an explicit Factory Commission
oi verify                   # is the installed composition usable?
oi update --check           # what a managed update would change
```

Each product is also reachable through `oi` by its namespace:

```text
oi central ...      -> ctrl         (compatibility alias: oi ctrl)
oi actuation ...    -> actuation
oi aikit ...        -> aikit         (compatibility alias: oi kit)
oi factory ...      -> factory
oi workcell ...     -> workcell
oi ql ...           -> ql
oi products [--json]
```

The command namespace is a convenience for composition, not a claim of ownership. Each product remains installable and usable on its own. `oi --help` lists the full surface, including `oi setup`, `oi adopt` (recognise an existing setup without changing it), `oi desktop` and the developer commands under `oi dev`.

Other install routes (an npm-packaged launcher, `cargo install --path cli`) and the developer source workflow are in [`docs/INSTALL.md`](docs/INSTALL.md).

## Status

- **Pre-release.** Every build is a pre-release (`0.1.0-prelocal.6`, 14 September 2026). `oi` itself reports: "These builds have not passed physical acceptance." `oi doctor` lists the deferred physical checks: the macOS reference workstation, the Ubuntu Workcell reference machine, and private provider materialisation (credentials, Tailscale, Docker or GPU, live model providers).
- **Release archives lag `main`.** The Central release predates the root NOW/DAY Actions, and the Actuation 0.2.1 archive predates its occupancy commands. Managed updates (`oi update --apply`, which installs from the ground's committed source cuts) and developer installs (`oi dev install`) carry the current surface.
- **Per product.** Each README's "What it does today" section separates what works now from what is in development, checked against the code. In short:
  - Central's NOW/DAY, machine and recovery Actions are on `main`.
  - Actuation's authority, occupancy and stream ledgers are in use by the other products.
  - AIKit resolves and projects capability into Claude Code, Codex, zcode and pi, and brokers the rest.
  - Factory records Commissions, Runs and attempts, but a whole development Run end to end is unfinished.
  - Workcell's local mode, cross-machine connections and secret references work, while its Docker and Arrakis providers are not yet in the shipped binary.
  - QL's kernel and lens registry work, while two of its five service operations have no provider.
- **The Cradle** is being built.
- **`oi prove factory`** exercises Factory's self-hosting Commission through the real Factory CLI and records evidence grades (deterministic, conformance, provider, material, human) independently. It needs its full argument set: `oi prove factory --factory PATH --factory-source PATH --request PATH --workflow-mutation PATH --state PATH --output PATH`. `oi prove` on its own reports "unknown command". The checked-in snapshot establishes the deterministic and conformance grades only. See [`docs/FACTORY-PROVING-FLOOR.md`](docs/FACTORY-PROVING-FLOOR.md).

## Reading further

| Kind of claim | Where |
|---|---|
| Authored position: why this is worth doing and what must not be lost | [`docs/positions/FOUNDING-POSITIONS.md`](docs/positions/FOUNDING-POSITIONS.md) |
| The concepts and primitives behind the six facets | [`docs/PRIMITIVES.md`](docs/PRIMITIVES.md) |
| Vision and design: what the product is intended to become | [`docs/VISION.md`](docs/VISION.md), [`docs/cradle/`](docs/cradle/README.md) |
| Architecture: how the present system is structured, and which operation lives where | [`docs/architecture/README.md`](docs/architecture/README.md), [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/CANONICAL-PRODUCT-FIELD.md`](docs/CANONICAL-PRODUCT-FIELD.md) |
| Shared-field relations | [`docs/SHARED-FIELD.md`](docs/SHARED-FIELD.md), [`docs/OBJECTIVE-CO-INTERNALITY.md`](docs/OBJECTIVE-CO-INTERNALITY.md) |
| Surfaces | [`docs/SURFACES.md`](docs/SURFACES.md) |
| Research programme | [`docs/RESEARCH.md`](docs/RESEARCH.md) |
| Installation (changes with each release) | [`docs/INSTALL.md`](docs/INSTALL.md) |
| CI: what gates a change, and where sibling checks run | [`docs/CI.md`](docs/CI.md) |

Agents working inside an O:I world: see [`skills/oi/SKILL.md`](skills/oi/SKILL.md).

## Background

Objective Internality is the account of the means through which a life knows and acts within a world: memory, language, models, abilities, habits and relations. Those means are examined there as one relation with the knower and the known. It is developed in the essay [*Confronting the Limit: Determination, Subjectivity and Mind as Objective Internality*](https://oi.epi-logos.org/essay/), and O:I is its technological side.

The research stance is to hold model capacity constant and treat the surrounding arrangement as the thing that varies. A simpler arrangement beating a richer one, or two formally different arrangements proving operationally equivalent, are legitimate results. The longer conceptual account that previously opened this README, covering the composition circuit, the primitives and the human contact points, now lives verbatim in [`docs/PRIMITIVES.md`](docs/PRIMITIVES.md). O:I also reads as **Operating Infrastructure**: the engineering face of the same field.
