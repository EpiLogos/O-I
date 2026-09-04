# O:I physical inhabitation alpha — agency-intent expression finding (2026-09-03)

## What was inspected

The prompt described a local convention "under approximately `agent/expression`"
not visible on canonical remote at handoff time. The actual local ground is:

```text
/Users/admin/central/Control/agents/expressions/
    maker/intent.md
    steward/intent.md
    oi-documentation/intent.md
```

plus sibling ground:

```text
Control/agents/hermes-nara.md          (recurring human-Agent relation ground)
Control/agents/wiki/wiki.json          (a single `central:wiki:root` space object)
Control/agents/governance/**           (attention / authorship / evidence / communicate)
```

## What it is

An **authored agency-intention expression**. Each expression is a single
`intent.md`: a natural-language statement, said once before a session exists, of
what sort of agency is wanted here. The three live specimens are:

- `maker` — writes the intent prompt that seeds a fresh agent; its home is
  `Control/agents/expressions/<slug>/intent.md`, "the spec: one object that says
  what this one is for".
- `steward` — a narrow custodian of `~`, `Documents`, Homebrew; surveys before
  claiming, proposes before moving.
- `oi-documentation` — holds documentation altitude across the six-product
  family; position/design/architecture/implementation/evidence/inference as six
  distinct claim kinds.

Each expression carries: purpose, scope (the field it holds), boundary laws,
when it "holds" (trigger conditions), and its relation to the human. There is no
schema file, no version, no ref namespace, no JSON envelope.

## What consumes it today

- The `maker` expression describes seeding "a fresh grok bot" from the intent —
  i.e. the current consumer is the **Grok Bot** case-study flow, not an O:I
  product.
- `hermes-nara.md` references the same ground and says its agent "consults the
  O:I six-product suite through `oi ctrl` and the ai-kit broker".
- **No O:I/Central/Actuation/AIKit/Factory/Workcell product code reads
  `expressions/<slug>/intent.md`.** The convention is authored ground, not a
  product schema.

## Distinctions preserved by source inspection

| the expression is | it is not |
|---|---|
| authored human-ground seed | AgentRef / Agent identity (that is Actuation) |
| `Control/agents/expressions/<slug>/intent.md` | Central AgentProfile (`Control/agents/profiles/profile-*.json`, `central.agent-profile/v1`) |
| natural-language intention | AIKit runtime Profile / ContextResolution |
| a seed for "what sort of agency" | SkillSet / Method / system prompt |
| a Unix-style folder definition | Harness / AgentSession |
| a durable seed that can accrue | Journey / Commission (Factory) |

Central's `AgentProfile.handoff()` already declares the cross-owner relation:
semantic identity → Actuation, operational resolution → AIKit, materialisation
→ Workcell, and explicitly that the source profile is *not* Agent identity,
*not* the effective profile, *not* a material binding. The expression is one
step earlier than even that source profile: it is the authored intention a
profile can later be resolved from.

## Relation to be made explicit (not presupposed, now evidenced)

```text
agency-intent expression  (Central-authored ground: purpose/scope/boundaries)
        ↓ resolve against current World + chosen praxis
Central AgentProfile      (role/purpose + skill/method/routine refs, world scope)
        ↓ Actuation actualises the Agent/Agency + authority
        ↓ AIKit resolves effective Profile/Context/SkillSet/body
        ↓ Workcell materialises where necessary
        ↓ Factory correlates developmental work (Commission/Journey/Run)
```

The expression is a **seed**, not a duplicate of any existing native object.
Its correct owner is Central-authored ground. Making it a product object would
be wrong; making its resolution into a Central AgentProfile explicit is the
useful next owner-native step (Agent-creation UX), and that is deferred as a
separate increment — this finding only records the real authored form.

## Action taken

None against the personal Control ground. This receipt records the finding as
development evidence; the convention is left exactly as authored.
