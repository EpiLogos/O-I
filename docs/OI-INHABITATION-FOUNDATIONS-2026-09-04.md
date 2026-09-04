# O:I inhabitation — foundational install-state, smooth Agent entry, and the seams that remain (2026-09-04)

Thinking note, not a spec. Records the model the recent work implies and the
next owner-native seams. Where a mechanism is already built it is marked done;
where it is a design commitment it is marked proposed.

## 1. Install state is a first-class read, not a hard-coded list

The `bkmr` drift and the missing Hermes/Grok/Buzz observations are the same
defect: recognition asserted a fixed table instead of reading the live machine.

**Principle.** The installed system is the source of truth. A tool upgrade, a
new harness, a stopped daemon, a moved binary — these are *observations*, never
failures, never "drift". Nothing in code or tests asserts a fixed revision; the
World account reads version + provenance live and carries it forward.

**Done (v1).** `oi recognition inspect` now has a structured registry
(`NATIVE_TOOL_REGISTRY`) that observes:

- harnesses/agents by PATH + per-tool version probe (`--version`), with the
  upstream source revision parsed from the banner (Hermes `63279301`);
- tools with **no version flag** (Buzz) as present with an honest
  `version_flag: none` fact;
- daemons with **no PATH binary** (Grok Bot) from their machine-global state
  (`~/.grokbot/…`: pid, running, generation, settings schema);
- an extension frontier routing each recognised-but-unbound system to its owner
  (harness/agent/model-provider → Actuation; material-executor → Workcell).

**Proposed (v2).** Lift the curated table into the same `oi.world-recognition/v1`
package path cmux/Herdr already use, so "recognise my new tool" is *register a
package*, not *edit O:I source*. Add a per-tool `version_command` override so a
tool like Buzz (no flag) can still report a version from `--help`, package
metadata or a relay handshake when one exists. Keep the taxonomy open (harness,
agent, model-provider, material-executor, working-environment,
collaboration-client) and let unowned kinds stay observed-but-unrouted — honest,
not invented.

## 2. The smooth entry: "install; code as I would"

The user must never run `oi recognition inspect` / `oi adopt` / `aikit session up`
by hand to feel at home. The target is one act — install, then work — with the
field composing underneath.

```
install / agent-installs
  ├─ O:I recognises the live machine (registry + owner reconciliation)   [done]
  ├─ oi CLI is on PATH and routable into the harness                     [seam]
  ├─ skills are projected into the harness's native surface              [AIKit done]
  │     (Claude ~/.claude/skills · Codex .agents/skills · broker live)
  ├─ the hook dispatcher routes the harness back through AIKit           [AIKit done]
  ├─ the entering Agent gets a thin aikit-context bootstrap              [done]
  │     (World/SessionSpace + Project/Agency/Harness/Model + horizons + body pointer
  │      + operative access: oi / aikit CLIs, projected-skill masking)
  └─ a restart pick-up note, because some harnesses only discover skills at task start
```

**The one genuinely user-visible wrinkle:** a harness may need a restart (or a
new task) before it sees newly projected skills. That is a *native harness fact*,
not an O:I defect — but the product should say so ("restart Claude / start a new
Codex task to load N skills") rather than leaving the user to discover a silent
stale skill view. **Proposed:** the `oi dev world` / desktop disclosure carries a
`pickup: restart-required | next-task | live` fact per client from `aikit client
status`, surfaced quietly.

## 3. Skill masking is selection, not a second catalogue

"Mask a skill from the Agent context" must not become a hidden blacklist file.

- **Projection = inclusion.** AIKit projects only *active* skills; what the
  harness sees is already a masked/selected surface, never the whole catalogue.
- **Masking = disable/withhold.** `aikit enable/disable` in a scope, or the
  isolation-withholding path (shared Codex withholds the actor seed), is the
  mask. There is no separate "hide" object.
- The bootstrap says so explicitly now: *a skill you cannot see was not
  projected into this context; that is a selection fact, not a missing file.*

**Proposed:** a desktop/AIKit "effective skill surface" view that shows, per
harness, *assigned vs eligible vs effective vs projected vs withheld* — so a
human can see *why* a skill is absent without reading generation diffs.

## 4. The bootstrap's converse: the Agent can act, not just look

The bootstrap now gives the entering Agent its operative access (oi / aikit
CLIs) and its masked skill surface. The remaining converse seam is **authority**:
acting through `oi`/`aikit` still obeys the existing Invocation → evidence/proof
→ authorised Routine relation. Nothing in the bootstrap grants ambient action.
The Agent learns "you are in World X, these are your faculties" and still must
earn each consequential act. **Proposed:** the bootstrap names the *authority
boundary* explicitly ("consequential action remains under Routine/authority; the
CLI is your read/reconcile faculty") so the UX teaches the law, not just the
path.

## 5. Central setup + project migration is a branch of the same operation

The same "adopt an existing World" operation has a user-facing branch where the
human must *choose*, not just observe:

```
oi dev world (observe/reconcile)                     [done — resolve+delegate]
   └─ no Central ground?  →  Central setup branch
        · author personal ground (user identity, vocation, place)
        · adopt/migrate an existing project into Central Work
          (ProjectCentral source relations, provenance, revision — no copying
           of files the user hasn't ratified)
        · save a Central AgentProfile from an agency-intent expression
          (Control/agents/expressions/<slug>/intent.md → role/purpose/praxis refs)
        · user specifies: which World, which praxis, which Agent identity
```

This branch is where authored choice lives. The deterministic observe/reconcile
path must never silently fill in a human decision; it must *ask* at exactly the
point the decision is needed. **Proposed:** a `oi adopt --ground` that detects
"ground exists but no Central profile/project-migration" and offers the branch
instead of fabricating a World.

## 6. Divergence harmonisation (sane, not a blind merge)

ai-kit `main` (thin bootstrap, 865 commits ahead) and `codex/full-shape`
(compose/agent/portal, 50 commits) diverged long ago; the installed binary is an
uncommitted merge of both. A `git merge` would be a conflict snowstorm.

**Sane path — port, don't merge:**

1. Port the self-contained, high-value modules onto `main` first:
   `aikit-core/agent.rs` (AgentProfile document + validation) and
   `aikit-core/compose.rs` (ComposePlan), with their small deps
   (`policy::SpendPolicy`, `projection::ModelProjection`).
2. Then port the `resolve` change that resolves an AgentProfile into an
   `AgentContext` (the delicate part — do it as one reviewed commit with the
   core test suite green).
3. Then the store (`aikit-store/profiles.rs`) + CLI commands (`agent profile`,
   `compose`), leaving the portal/ops TUI for last (largest, least blocking).

Each step is independently shippable and keeps `main`'s thin bootstrap + the
`session_space` seam intact. The `agent/epilogos/oi-development` profile already
authored in the AIKit home survives this unchanged — it is data, not branch
state.

## What is done vs proposed (one glance)

| seam | state |
|---|---|
| registry-driven live install-state recognition (Hermes/Grok/Buzz) | done |
| version + provenance read (upstream/local revision) | done |
| `oi dev world` resolve + delegate launcher + committed carrier | done |
| bootstrap SessionSpace (World) identity + H4 disclosure | done |
| bootstrap operative converse (oi/aikit CLIs + masking note) | done |
| AgentProfile authored + compose real plan | done |
| package-path recognition for arbitrary new tools (v2) | proposed |
| restart/next-task skill pickup disclosure | proposed |
| desktop effective-skill-surface view | proposed |
| Central setup + project-migration adoption branch | proposed |
| main ↔ full-shape sane port (agent/compose first) | proposed |
