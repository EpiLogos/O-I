---
name: central-session-strap
description: Use at session start, resume, compaction recovery or a root/Project scope change in Central, especially before allocating task scratch. Resolve the current World, governing intent, native NOW and applicable practices; a normal authorised repository edit is not an inbox contribution or a reason to move all work into NOW.
---

<!-- O:I GUARDIAN SKILL SHIPMENT; held and projected by O:I (owner ruling 2026-09-17: "oi holds and projects the strap itself and the skill"); commissioned 2026-09-06. THIS repository file is the strap's authoritative source; AIKit assigns it to agents (the `oi` skill source, capsule skill/oi/central-session-strap), so no ground carries a copy. Merged 2026-10-27 on the owner's word (the guardian's structure and description, plus what Central had moved on to: `now.py` retired, the seat law, the routing table, the doorway, the doors-only floor). Owner-ratified edits happen here, never in projections. -->

# Central session strap

## What this holds

Central is the root meta-Project. Root/cross-Project work and child-Project work
are equally valid. Day is human-owned writing/receiving; NOW and explicit T work
are Agent-maintained under scope. Resolve their actual owner refs and locations;
do not require a fake Project or hard-code an old mixed NOW/day layout.

This Skill is the entry router, not a second lifecycle implementation. AIKit owns
Skill/METHOD discovery, composition, trust and projection; Central owns source,
placement and temporal operations; Actuation owns Agency/authority; Workcell owns
actual hosting and restrictions. A Skill cannot enforce a filesystem boundary.
Central repeats one shape at two registers — root (`Control/**`) and project
(`Work/<Name>/ProjectCentral/**`) — and this is the doorway to both.

## Orient and choose the next practice

1. Recover the human request and governing issue/Wayfinder/plan, current World,
   selected Agent/Agency, scope and retained next action. Establish the register:
   inside one project's concern (`Work/<Name>`), or root / cross-project /
   world-keeping; ambiguity resolves toward the project that owns the concern
   (central-now-field holds the rule). `oi current-world` and `ctrl central.world`
   show the world; `ctrl control index` is a standing-aware source index, not the
   contents of every instruction — read only the relevant permitted source, or
   search with `ctrl control.search <term>`.
2. Discover the current Action descriptors with `oi act` (list, `describe`) or
   `ctrl ... action list`; inspect required inputs, mutation class, result and
   failure shape before invocation. Central's published entry is
   `ctrl --json --root <root> action run <action-id> '<JSON>'`, and the same
   Action runs through the front door as `oi act invoke <action> --input '<json>'`.
   An omitted `project` means root in that contract; it is not a failed lookup.
3. Resolve the applicable practice from the table below through AIKit. Do not
   copy their bodies or infer installed availability from this list; if a skill
   is unavailable, use the bounded native route further down. Methods (same
   skill format, `METHOD:`-classified descriptions) compose these for end-to-end
   practices: `aikit method list`.
4. Before task scratch, read effective placement policy and resume or allocate
   the actual NOW through native operations. Current operations include
   `central.work.policy`, `central.now.allocate`, `central.now.read` and
   `central.work.validate`; consume returned revisions and destination rather
   than sample hashes. For existing work, a read does not renew an expired grant.
5. Keep intended Candidate worktree/source/cwd/test basis and task NOW related.
   Authorised source, README, docs, worktree and build writes remain in their own
   places. Missing ProjectCentral is not proof that an existing repo is litter.
6. Retain a bounded Return with governing-plan refs, actual delta/evidence and
   the next executable action. Follow `central-ledger`; do not duplicate its
   prose budgets here or apply them to human writing or plans.

| Interaction | Owning skill |
| --- | --- |
| Orient / resume / post-compaction | central-orient |
| Find governing ticket/map/plan; claim work | central-work-intake |
| Search, freshness, material classes | central-retrieval |
| Where a file or artifact goes; promotion | central-placement |
| Which NOW field; live state; resuming allocations | central-now-field |
| Write a return/handoff; record contract | central-ledger |
| Close or retry a day boundary | central-day-close |
| Reconstruct a day that never closed | central-archive-recovery |
| Human documents, drafts, review | central-contribution |
| Contribution acceptance and inclusion | central-contribution-inclusion |
| Durable knowledge; wiki returns | central-wiki-return |
| Delegation judgement and assignment contract | central-delegation |
| Parallel practice end-to-end | central-parallel-execution |
| One task claim → verified outcome | central-authorised-task |
| Local↔remote git convergence | central-git-convergence |
| Field health checks; safe repair | central-field-health |
| What tools/actions exist here | central-capability-discovery |
| Release a skill change through AIKit | central-skill-release |
| Source-ref grammar; retire/restore skills | central-ground-keeping |
| Plan a too-big effort as decision tickets | wayfinder |

## The root register doorway

The root register runs on the same native Actions as projects; root scope is
simply the absent `project` argument.

```text
ctrl --json action run central.now.list '{}'                 # allocated NOW clearings
ctrl --json action run central.now.read   '{"now_ref":"<ref>"}'
ctrl --json action run projectcentral.now.return '{"actor":"<you>","kind":"handoff|question|note|learning","subject":"...","result":"...","status":"active"}'   # the root return; no `project` argument
ctrl --json action run central.day.read   '{}'               # the current Day pointer
ctrl --json action run central.time.policy '{}'              # civil date + policy revision
```

Lifecycle mutations (`central.now.allocate`, `central.now.lifecycle`,
`central.now.obligations`, `central.day.ensure`, `central.day.lifecycle`,
`central.receiving.*`) are authenticated: the host supplies
`CENTRAL_NATIVE_TOKEN`. Locally the grants live in
`Control/user/native-action-authority.json` and the token at
`~/.central/native-token` (owner-rotatable). Read before you mutate:
`central.work.policy` gives `expected_policy_revision`,
`central.time.policy` gives `expected_time_policy_revision`, and a
read-before-write `central.now.read` gives `expected_revision`. Allocated
clearings own a `T/` destination for that task's artifacts; obligations are
`central.now-obligation/v1` sources that bind in the field, attached by ref.

Naming law is unchanged — returns `<slug>-<local civil date>`, flows
`<slug>-YYYY-MM-DD-HHMM.md` — and is owned by the ctrl `names` implementation
alone.

## Development seats

`seat status` reads the machine's workcell register — which persistent
workcells (env-1/2/3) exist, which seats are free, and the claim you already
hold. Join with `seat join <workcell> <product>` (Control/user/workcell/README.md).
env-1/2/3 are the only development trees: never create a worktree (`--isolated`
is refused; the seat guard refuses commits from stray checkouts).

## Governance projection

```text
Control/agents/governance/**            authored source (statements)
        ↓ render-context.py (byte-idempotent, digest-stamped)
~/Central/AGENTS.md (CLAUDE.md → it)    one derived file — a doors-only floor
```

The floor carries doors, never law or state: the `oi` front door, how to
load law and procedure by act, a never-do card, and any statement the source
register marks `floor: kernel`. It is held to 4096 bytes and the render
refuses past that — move content behind a door, never raise the number.
`render-context.py --check` reports drift without writing.

Re-render after governance moves: `python3
Control/user/skills/central-session-strap/render-context.py`. Skill projection
rides AIKit; the release practice is central-skill-release.

## Time, contribution and continuation

Use the selected native temporal policy and lifecycle. Day ensure/read, NOW
lifecycle, source history and receiving are distinct operations. A civil date
change alone does not close human writing, copy personal tasks, archive active
work or invoke an Agent. A session ending does not imply the task is complete.

A readable human Return states what changed, what remains and what needs the
person, with evidence links. Receiving is not inclusion, acknowledgement,
Recognition or task completion. Use exact-revision reviewed inclusion; protect
human text and human-edited H. Operational Agent knowledge follows its native
bounded write/return path and never becomes human-authored ground silently.

At re-entry distinguish retained history, prepared context and actual provider
resume/rehydration. Preserve pending messages, permissions, uncertain effects,
source revisions and archive references before releasing working material.

## Bounded bootstrap and repair

If native root operations are absent, disclose the exact installed gap. The
former Python mirror (`now.py`) is retired: a stub that prints the doorway and
exits non-zero. Do not recreate it, and never run a mirror against a native
clearing by guessed path.

Use source-bound owner commands or an exact explicitly loaded Skill body when
normal discovery is unavailable and the existing authority permits the act.
Record the temporary route, input/source revisions, operation, result and native
replacement condition. Missing authority, unreadable policy or unknown destructive
semantics stops that effect; unrelated safe work can continue. Do not install or
reorganise the user's World merely to complete repository coding.

Configured/projected/linked/loaded/used are different facts. A skill that is in
the spool but not enabled, or enabled but not linked into the harness root, is
invisible to the agent however healthy the apply receipt looks; a changed
`current` pointer does not prove that a running Agent reread instructions.
Preserve foreign files and a reversible receipt when repairing a link.

## Verification and handoff

Check one root and one child-Project orientation, a scope change, stale-policy
refusal with a valid next route, correct NOW/worktree readback and later re-entry.
Prove description-based selection and actual native effects independently of
merely reading this Skill. Do not claim all harnesses loaded it from an apply
receipt.

Return the current subject, governing source, observed outcome and next action
through the same NOW/receiving route. A handoff should let the next participant
read the canon and continue, not require the human to relay another agent chat.
Session end, every session: central-session-handoff — nothing new loose at the
Work root, a day you own the boundary of gets closed, and an empty field with no
new records is a valid close.
