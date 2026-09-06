---
name: central-session-strap
description: Strap a harness session standing anywhere in the Central personal world — orient to the register (root Control vs Work/<project>), place live session work in the NOW field instead of loose folders, run the NOW/DAY lifecycle (ctrl Actions at projects, now.py at the root register), route wiki knowledge through returns, and project governance into derived harness context files (CLAUDE.md/AGENTS.md). Use at session start in Central, before creating any working folder or file at the Work root.
---

<!-- O:I GUARDIAN SKILL SHIPMENT; adopted into the guardian SkillSet from Central Control ground = central:source:control:root:Control/user/skills/central-session-strap; commissioned by the owner 2026-09-06; this repository file is authoritative for the shipped copy. -->

# Central session strap

## What this holds

Central repeats one shape at two registers — the root (`Control/**`) and every
project (`Work/<Name>/ProjectCentral/**`). The laws live in
`Control/agents/governance/`; the temporal fields live at
`Control/agents/now/` (root) and `ProjectCentral/now/` (projects); the wikis
live at `Control/agents/wiki/wiki.json` and `ProjectCentral/agents/wiki/wiki.json`.
This skill straps a session to that field so conformance is a procedure, not a
hope. The always-on floor is the derived `CLAUDE.md`/`AGENTS.md` at the Central
root (rendered by `render-context.py` from the governance statements); this
skill is the full procedure.

## 1 — Orient (session start)

1. Establish the register: is the work inside one project's concern
   (`Work/<Name>`), or root/cross-project/world-keeping? Ambiguity resolves
   toward the project that owns the concern.
2. Read the current horizon of your register:
   - root: `python3 Control/user/skills/central-session-strap/now.py inspect`
   - project: `ctrl --json action run projectcentral.now.inspect '{"project":"<Name>"}'`
3. Glance at the field: `ctrl central.world`. Read governance relevant to the
   work: `ctrl control.search <term>`.

## 2 — Place work (the placement law)

Source: `Control/agents/governance/field-and-now/session-work-placement.md`.

- Live session work goes to the register's NOW field — never a dated folder at
  the `Work/` root, never a draft file parked beside the projects.
- Bounded, attributed returns only: what was done, what it means, what remains
  open, where the durable evidence lives. Not transcripts.
- Durable material returns to its owner through promotion (human ground needs
  human acceptance; wiki knowledge goes to `agents/wiki/returns/**`). NOW
  keeps refs, not authority.
- Finding pre-paradigm loose material: account for it in the register's NOW
  field and propose placement. Never move silently — and never touch
  `Work/wiki-continuity-2026-09-06/` or other material an active parallel
  session is working (check mtime before judging).

## 3 — The NOW/DAY lifecycle

Source: `Control/agents/governance/field-and-now/day-close.md`,
`Work/Central/docs/PROJECTCENTRAL-NOW.md` (the contract).

Project register — canonical ctrl Actions:

```text
ctrl --json action run projectcentral.now.init     '{"project":"<Name>"}'
ctrl --json action run projectcentral.now.return   '{"project":"<Name>","actor":"<session-id>","kind":"handoff|question|note|learning","subject":"...","result":"...","status":"active|waiting"}'
ctrl --json action run projectcentral.now.update   '{"project":"<Name>","id":"<id>","status":"...","preserve_refs":["..."]}'
ctrl --json action run projectcentral.now.promote  '{"project":"<Name>","source":"...","target":"human-ground|agent-wiki","destination":"...","acceptance":"human-accepted|agent-return"}'
ctrl --json action run projectcentral.now.rollover '{"project":"<Name>","day":"YYYY-MM-DD","next_day":"YYYY-MM-DD"}'
```

Root register — same semantics through `now.py` (this skill's tool, mirroring
the ctrl Actions until Central ships native root Actions):

```text
now.py return --actor <session-id> --kind note --subject "..." --result "..." --status active \
        [--source-ref ...] [--evidence-ref ...] [--preserve-ref ...]
now.py update --id <id> --status waiting [--preserve-ref ...]
now.py promote --source Control/agents/now/agents/<id>.json \
        --target agent-wiki --destination Control/agents/wiki/returns/<id>.json --acceptance agent-return
now.py rollover --day YYYY-MM-DD --next-day YYYY-MM-DD
```

Day close order (both registers, one law): inspect → classify (carry
active/waiting/carried; release resolved/expired/promoted) → snapshot sources
into `day/YYYY-MM-DD.sources/**` → write the dated reading → then carry/mark
lineage, remove released (preserve refs protect), reset the promotions
ledger. A failed close stops before cleanup and says so. Local civil dates
only; the closing session supplies them. Human scratch (`now/user/**`) is
copied into the day, never cleaned by the agent.

When to close: the last session of a local civil day, or a session whose
day-old field is stale on orient. When in doubt, inspect; rollover is
refused for an already-closed day.

## 4 — Wiki routing

Source: `Control/agents/governance/field-and-now/wiki-field-law.md`.

- Never edit `wiki.json` at either register. Returns are the only door:
  promote into `agents/wiki/returns/**`; wiki maintenance belongs to the wiki
  owner (`aikit wiki ...`).
- Project cognition returns through the project's field; cross-project
  cognition through the root field. The root wiki does not aggregate project
  wikis.
- A project's docs live in that project's repository under its conventions —
  work them there, to that repo's standard. Central's wiki holds knowledge
  about the work, not the work.
- Session hooks, injection and wiki growth mechanics belong to the
  wiki-continuity programme (`Work/wiki-continuity-2026-09-06/`); do not
  duplicate them from here.

## 5 — Governance projection (how conformance reaches harnesses)

```text
Control/agents/governance/**            authored source (statements)
        ↓ render-context.py (this skill; byte-idempotent, fnv1a64-stamped)
~/Central/AGENTS.md + CLAUDE.md         derived twins — the always-on floor
        ↓ every harness reads its native file at session start
harness session                          strapped to the field's law
        ↓ session works, returns, closes the day
NOW/DAY fields + wiki returns            conformance leaves a trail
```

Re-render when governance moves: `python3
Control/user/skills/central-session-strap/render-context.py` (changed files
only are rewritten; identical sources produce identical bytes). The outputs
are generated-derived and stay that way until adopted in place — per
`repos/repo-content-and-structure.md`, a generated suggestion stays generated
until adopted.

Skill projection itself rides AIKit: this skill lives at
`Control/user/skills/central-session-strap/` (control ground, `central.skill/v1`
manifest), is picked up by the `personal` source (`--control-ground`), and
materialises into harness trees on `aikit apply`. After changing this skill:
`aikit source sync personal && aikit source promote personal && aikit apply`,
then verify with `aikit collate | grep central-session-strap`.

## 6 — Session close checklist

1. Every open thread returned to the register's NOW field (bounded, attributed).
2. Durable material promoted (human-ground only with human acceptance).
3. Day closed if the session owns the boundary.
4. Nothing new loose at the `Work/` root; found litter accounted, not moved.
5. Derived context files current (re-render if governance changed).

## Boundary

This skill executes the root-register lifecycle and the derived projection; it
does not author Control content (propose-not-write), does not edit wikis, does
not create product objects, and does not install hooks (wiki-continuity
programme's ground). When Central ships native root NOW Actions, §3's root
column retires in favour of the Actions and this skill says so.
