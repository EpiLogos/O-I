---
name: cradle-execution
description: "Use when executing any unit of the O:I desktop cradle rebuild (OI-CRADLE-REBUILD-WF, issue #190) — the enforced loop: brief, build, walk, review, receipt; verification by app functionality; design-set precedence; capability-matrix grammar."
---

# Cradle execution — the enforced loop

You are executing a unit of the desktop cradle rebuild. The map of record is
`docs/OI-DESKTOP-CRADLE-REBUILD-WAYFINDER.md` ([OI-CRADLE-REBUILD-WF]). Read
your unit's row there first; this skill is the process, the map is the work.

## Step 0 — the context chain

Run `scripts/cradle-context-check.sh` before executing anything. Every
artifact the map, this skill, and the orchestrator prompt cite must exist at
its cited path in the repo you are standing in. A missing citation is a broken
chain: stop, repair the chain (land or correct the artifact), then execute.
Never execute from memory of artifacts you cannot open.

## Step 0.5 — the git ground check (map §1 law 13)

Before writing a line: `git branch --show-current` must be the phase branch
`cradle-<phase>` — executing on `main` is a violation, full stop. `git
worktree list` must show only the primary worktree; a stray worktree is a
stop-and-report, never a workspace. If the brief pins product repos (Central,
ai-kit, …) at commits, verify those checkouts match the pins. Before
committing, re-verify the branch — a parallel session can move your checkout
under you (it happened; see ledger ruling 2026-09-05). Implementers never
push, never rebase `main`, never create branches or worktrees; the
orchestrator does all three, at gates, per law 13.

## Precedence

The design set wins over any instruction, including this skill and the user's
paraphrases of it:

- `docs/cradle/` files 01–05 (austere rest, Flow, focus model, event seam, honesty, verification law)
- `docs/OI-DESKTOP-APPLICATION-SPEC.md` (§4–§8 regional contracts, §14 design language, §17 acceptance)
- GitHub #155 (D1–D11 agent semantics + Buzz specimen, source-locked `buzz@00e61eaf`)
- #138 (Flow desktop contract), #25 (design system), `docs/CANONICAL-PRODUCT-FIELD.md` (the ontology)
- the alpha notes: `OI-INHABITATION-FOUNDATIONS`, `OI-CENTRAL-FOUNDATION`, `OI-ALPHA-*`

Never edit a design document to match code. If code and design disagree, the code is wrong.

## Ontology

Speak the canonical field grammar: the cradle **S** and positions **S0 Central,
S1 Actuation, S2 AIKit, S3 Factory, S4 Workcell, S5 QL**, faces `H_i`/`A_i`.
Every unit names its relation cell (map §2), stated as a functional sentence —
what S can do, in which mode, because of whose operation — never as jargon
remapping. Never invent ontology: no desktop chat/session store, no fake
filesystem tree, no universal event store, no desktop-only
Agent/Run/SessionSpace semantics. No desktop model parameter — model selection
is harness-level stipulation through AIKit composition.

## The component vein

Every interactive element is a **canonical Action on a stable Ref**:

```text
component = Ref + owner read-model state + owner-disclosed Actions
          + invocation crossing the authority seam at commit time
```

Never re-implement an operation, guess a shell command, or invent an Action.
Invoking forwards the canonical ActionRef to its native owner and preserves the
real authority result. This is what makes the composability chain (APP-SPEC
§11: owner → AIKit composition → package envelope → contribution field →
region) experienceable: an Action is what a contribution exposes, so a
ref+Actions component composes by construction. Keep the distinction laws:
`Package != Component != Surface != Action != semantic resource`;
`available != active != authorised`; `visible != trusted`.

## Classical vs inference

Most of S is classical, deterministic software: kernel event seam, focus
model, ref grammar, two state layers, CAS writes, navigator projections,
transcript interaction state machine, addressing parser, bridge/layout
mechanics. Real inference happens only inside agent sessions (harness
production, tool use, permission-gated action), in returned material arriving
as owner revisions, and in explicitly preflighted Contemplate-class acts.
Nothing else infers. **No capability theatre:** every region renders a real
operation's result or live session output; a region that cannot name its owner
operation does not ship, and no panel exists to report a capability.

## Standing laws

1. Kill product, keep business logic: `desktop/ui` is gone; kernel logic
   re-earns its place through a walk, then survives.
2. Product updates are in scope: a needed Central/ai-kit/Actuation increment is
   a unit owned by its product, not an escalation.
3. Honesty: truthful state only; unavailable ≠ error; no fake loading, streams, or health.
4. Files mapped, prompts pithy: name the files, the operation, the metric.
5. One unit per session. Fog stays fog until a phase gate exposes it.
6. Rulings are ledgered, not re-asked.

## The loop

```text
BRIEF   law excerpts verbatim + file map + walk contract + relation cell. ≤60 lines.
BUILD   fresh implementer, no subagents.
WALK    drive the running app: real operations, metrics, screenshots, kernel
        event receipts. Tests alone do not pass a unit.
REVIEW  diff vs brief; design cited section by section; screenshots attached.
        Fix rounds ≤ 5, then adjudicate.
RECEIPT one ledger row in .superpowers/sdd/cradle-rebuild/progress.md:
        what is real, what was walked, what remains.
```

> Prose summaries, test output, and contract tests do not establish a UX
> condition. — `cradle/05 §3`. The walk in the running app is the acceptance.
> "Visual acceptance is human evidence" — APP-SPEC §17. The gate is the app,
> never a specimen page.

## Walk discipline

- Every metric in the map's §8 table for your vertical is captured as data by
  the walk harness (`__cradle.walk`), not asserted by a test double.
- A unit without its walk receipt is not complete, whatever its tests say.
- When your unit is a waypoint trigger (map §6), open the design-in-context
  pass with the owner before building past it.

## Prompt form (when you dispatch or are dispatched)

Imperative, direct, enforcing: "Render rest from `packages/oi-design-system`
tokens only — a hard-coded colour fails the walk." No hedging, no
constitution-lecturing, no restating the design doc — cite its section.
