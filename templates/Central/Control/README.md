# Control

This directory is the durable human-authored control surface of a personal {O:I} installation.

```text
Control/
├── user/                  the human's durable personal authorship space
├── agents/
│   ├── governance/        human-authored recurring Agent governance
│   └── wiki/              Agent-maintained knowledge (canonical source wiki.json)
└── machines/              authored machine intent and adopted machine declarations
```

It holds the user's working conventions, agent governance, machine and tool intent, and other material that should remain inspectable and portable. Natural prose is a first-class format; no universal schema is imposed below these roots.

Central defines the detailed structure; its `ctrl` CLI provides the operations that manage it (`central.init`, `central.doctor`, and the adoption and maintenance actions).
