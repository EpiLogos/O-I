---
name: cradle-execution
description: "METHOD: Use when executing any unit of the O:I desktop cradle rebuild (OI-CRADLE-REBUILD-WF, issue #190) — the enforced loop: brief, build, walk, review, receipt; verification by app functionality; design-set precedence; capability-matrix grammar."
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
under you (it happened; see ledger ruling 2026-09-05). Implementers do not
move `main` or create side branches/worktrees. The orchestrator owns the
commissioned phase's ordinary push, PR, merge and retirement lifecycle at the
gate; a separate owner ruling is required only for exceptions named by law 13.

## Precedence

Use the design set below, together with subsequent explicit owner corrections:

- `docs/cradle/` files 01–05 (austere rest, Flow, focus model, event seam, honesty, verification law)
- `docs/OI-DESKTOP-APPLICATION-SPEC.md` (§4–§8 regional contracts, §14 design language, §17 acceptance)
- GitHub #155 (D1–D11 agent semantics + Buzz specimen, source-locked `buzz@00e61eaf`)
- #138 (Flow desktop contract), #25 (design system), `docs/CANONICAL-PRODUCT-FIELD.md` (the ontology)
- the alpha notes: `OI-INHABITATION-FOUNDATIONS`, `OI-CENTRAL-FOUNDATION`, `OI-ALPHA-*`

Never edit a design document to match code. If code and design disagree, the code is wrong.

## Ontology

Speak the canonical field grammar: **S is the `oi` CLI whole**, **M′ is the
desktop 0/1 whole**, and the native CLI positions are **S0 Central,
S1 Actuation, S2 AIKit, S3 Factory, S4 Workcell, S5 QL**, faces `H_i`/`A_i`.
Every unit names its relation cell (map §2), stated as a functional sentence —
what M′ makes usable through S, in which mode, because of whose operation — never as jargon
remapping. Never invent ontology: no desktop chat/session store, no fake
filesystem tree, no universal event store, no desktop-only
Agent/Run/SessionSpace semantics. No desktop model parameter — model selection
is harness-level stipulation through AIKit composition.

The desktop's base arrangement is left **0** (world/projects/files), centre
**/** (canvas, pane tabs, splits and popouts), right **1** (active-subject context
and agency). QL-MEF's later instruments project into this whole. Its M / S′
account remains QL-MEF-owned. See `docs/CANONICAL-PRODUCT-FIELD.md`.

Discovered product clients enter through `OI_BIN` / `oi`; native overrides select
owner artifacts inside the suite dispatcher. Verify the candidate suite CLI
alongside the owner binaries before walking the app. `oi desktop` uses the same
kernel application readers. Preserve the distinction between native command
parity, a mapped desktop operation and accepted running-app behaviour.

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

Most of the desktop implementation is classical, deterministic software: kernel event seam, focus
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

## Epi domain: source, loading and the lived walk

**Publication authorised; H ratification pending (Satya).** This new Epi practice
extension is available for review. It does not supersede the preceding Cradle
process or the already-approved QL execution map. Its publication and tests
are not owner ratification or installed/human acceptance.

When this host unit touches QL's living instrument, read `docs/cradle/03-UX-STATES.md`
§L and `04-VERIFICATION.md` §8 with their explicit pending standing, then QL-MEF's
`docs/kernel-rebuild/UX-SPINE-RECONCILIATION.md`. Name the UX story, original owner
intent, A/B criteria and native producer dependencies. Preserve the complete
field rather than testing only what the renderer presently exposes.

Acquire QL source-owned preparation/report/walk Skills through AIKit's native
source discovery and reviewed composition, as specified in
`docs/SUITE-OPERATOR-SKILLSET.md`. Do not copy them here or add them to O:I's
shipped guardian manifest. Establish current-generation projection and actual
harness loading separately. A present Skill file is not an operative agent;
a generic provider is not the full Epi instrument.

Use a fresh agent in the real walk. Check shared subject, permitted disclosed
source, actual Action/authority/result, short report, human correction and
retained Return/re-entry. Missing support is reported before human testing.
This Skill's phase/branch loop governs Cradle units; it does not override the
QL Wayfinder's separate parallel repository development. Source-only bootstrap
is bounded and never a claim of installed or human acceptance.
