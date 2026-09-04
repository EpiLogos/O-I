# Central is the foundation — the ProjectCentral projection and the rooted World (2026-09-04)

Drawing out the model the `ProjectRef format was wrong` finding opened up. Central
is not one product among six: it is the **base/default project on setup**, the
filesystem root every other product operates within, and the authored World that
roots AIKit, Factory and Workcell. This note records the actual contracts.

## The base shape (verified in Central `ctrl`)

`oi init --personal-ground PATH` runs `ctrl --root PATH init`, which establishes:

```text
~/Central                          (the personal root; Central WorldRef world:personal)
├── Control/                       durable authored ground
│   ├── user/                      human identity / vocation / practice
│   ├── agents/                    governance/, wiki/wiki.json, expressions/, profiles/
│   └── machines/                  current.json → Workcell binding
├── Work/                          ordinary Projects (each a descendant World)
│   └── <Project>/                 e.g. O-I, Central, ai-kit, Actuation, Factory, Workcell, QL-MEF
│       └── ProjectCentral/        the fractal recurse of Control
│           ├── project.json       central.project/v1 (project_id, human_source, wiki)
│           ├── user/
│           └── agents/governance/ + agents/wiki/wiki.json
├── .central/                      derived state (never authored source)
└── .obsidian/                     local editor state
```

`root.rs` hard-codes the six required directories
(`Control/user`, `Control/agents/governance`, `Control/agents/wiki`,
`Control/machines`, `.central`, `Work`). `projectcentral.rs` defines the Project
manifest (`PROJECT_SCHEMA = central.project/v1`) and the canonical paths
(`ProjectCentral/`, `ProjectCentral/project.json`, `ProjectCentral/user`,
`ProjectCentral/agents/wiki/wiki.json`). The rule is fractal: **Control at the
root, ProjectCentral at every descendant** — the same human-source / Agent
governance / Agent-Wiki shape recurses at each depth.

## Three identity layers (this is the crux)

A "project" is three different, non-interchangeable identities:

| layer | owner | example | what it means |
|---|---|---|---|
| filesystem directory | the machine | `~/Central/Work/O-I/` | where ordinary work + ProjectCentral ground live |
| Central WorldRef | Central | `world:personal`, `world:project:o-i` | authored World identity + ancestry + placements + sources |
| AIKit ProjectRef | AIKit | `project:o-i` | operative binding for resolution/projection/session |

The carrier bug (`project/epilogos/o-i` vs `project:o-i`) was confusing the
**WorldRef/authoring convention** with the **ProjectRef binding format**. AIKit's
ProjectRef is `project:<spec-id>` (colon, from `aikit project bind <id>`); Central's
WorldRef is `world:<…>` (a separate namespace with its own ancestry). They are
joined at the filesystem directory — the one shared fact — not by string prefix.

## How Central roots each product

```text
                        ~/Central  (world:personal)
                              │
        ┌─────────────────────┼─────────────────────┐
        │ Control/            │ Work/<Project>/      │ .central/
        │ authored ground     │ ordinary project     │ derived
        │                     │   └ ProjectCentral/  │
        ▼                     ▼                       ▼
   Central ctrl         AIKit ProjectRef       indexes/read models
   WorldRef tree        project:<spec-id>      (never authority)
   AgentProfile         ProjectCentralBinding
   Computer/access      → orientation          Factory: Journey/Commission/Run
   machines/current.json  → account            within this Project
                         → root_wiki           Workcell: PlacementIntent +
                         → ground_relations    machine materialisation
```

- **AIKit** binds `project:<spec-id>` to the directory, then
  `ProjectCentralFilesystemBinding` inspects `ProjectCentral/` and emits
  `ProjectCentralBinding → Orientation/AccountContext`, carrying `root_wiki`
  (the Central personal root's `Control/agents/wiki/wiki.json`) and
  `ground_relations` (the Project↔root ground link). This is the exact
  "base/default project is Central" mechanism: every project's orientation
  points back at the root Wiki.
- **Factory** operates within a Project: Commission/Journey/Run take a Project
  (directory) as their developmental subject; Project-specific canon stays in
  `ProjectCentral/`, cross-context durable ground stays in `Control/`.
- **Workcell** materialises a World: `WorldRecord.placements` (PlacementIntent)
  and `Control/machines/<role>.json` (workcell binding) state durable placement
  intent; Workcell owns runtime materialisation. The root (`world:personal`)
  is the World Workcell projects/instantiates.

## What the desktop cradle app already carries, and the gap now closed

The desktop Project field (`ProjectFieldSnapshot`, built over AIKit's
`ProjectCentralBinding`) already carried `orientation` (project_id, human_root,
ground_status, canonical_wiki, native_project_root) and `account`
(preferred_human_sources, agent_wiki). What it did **not** render was the root
link. The `orientation` type in the UI dropped `root_wiki`, `ground_relations`
and `adopted_wikis`.

Now surfaced: the Knowledge mode shows a **"Rooted in Central personal ground"**
card — root Agent Wiki bound/unbound, the `ground_relations` ref, and adopted
wikis — so the Project is visibly a descendant of the Central root rather than a
detached folder.

## The UX this grows into

The cradle app's natural spine is the rooted World, not a dashboard of six
products:

```text
Central root (world:personal)  ·  Control / Work / .central
   └ Work/<Project> (world:project:<id> ↔ project:<id>)
        ├ ProjectCentral/ ground (human source, governance, Agent Wiki)
        ├ AIKit: profile, skillset, knowledge horizon, session, harness
        ├ Factory: Journey/Commission/Run (when developmental work exists)
        └ Workcell: placement/material state (where materialised)
```

A human should open the desktop and see the root World first — where the ground
is, what Projects exist, which are bound, what is authored vs derived — then
descend into one Project and see its ProjectCentral projection, its AIKit
operative surface, and its Factory/Workcell state, all resolving the same refs.

Remaining increments (deferred to the parallel planning, not rushed): a
root-Work-tree navigator (the `Work/` children as bound Projects), the
`ProjectCentral`/`Control` ground tree rendered from `ProjectCentralBinding`,
and the explicit `world:personal → world:project:<id>` ancestry line fed from
Central's `WorldGraph`.
