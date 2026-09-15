# Central template

This is the default personal-ground shape distributed with {O:I}.

```text
Central/
├── Control/
│   ├── user/                  human personal authorship — freely structured
│   ├── agents/
│   │   ├── governance/        human-authored: how agents should relate and work
│   │   └── wiki/              agent-maintained: what is known about/across the sources
│   └── machines/              authored machine intent; adopted machine declarations
└── Work/                      the personal home for Projects
    └── <project>/ProjectCentral/   the same relation, repeated at Project scope
```

The shape is a recursion: every Project carries a `ProjectCentral/` that repeats the Control relation at small scale — `user/`, `agents/governance/`, `agents/wiki/`. See `templates/Project/` for the default Project scaffold.

Files in this tree are distributed defaults. They become human source when a person adopts and edits them; until adoption they are suggestions with provenance, not implied authorship.

Central owns the behaviour of this structure — `ctrl` is its CLI: `central.init` creates the required roots; `projectcentral.init` establishes a Project's ProjectCentral; `central-machine-adopt` grounds the default machine through the local Workcell. This tree carries only the human-facing defaults so a new installation has a clear place to begin.
