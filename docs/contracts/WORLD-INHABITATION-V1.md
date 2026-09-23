# World inhabitation contract v1

Status: pinned cross-owner read/action contract for O-I #65 / #220 and Factory #195
(World-rooted inhabitation amendment, 2026-09-23). Behavioural reference:
`mvschwarz/openrig@c8fca9d5c436e5357807e05254bf6735613eea3f` — see
[`docs/research/openrig-c8fca9d/CROSSWALK.md`](../research/openrig-c8fca9d/CROSSWALK.md).

This contract names what each owner publishes so a fresh occupant can answer
*where am I, which address do I hold, who holds it with me, what work do I carry,
and where does my Return go* from native state alone. It adds no store beside the
owners: no Pod database, no queue clone, no second graph, no second Agent registry.

```text
Shared O:I World / SharedField   ↕ SpaceTimeDB hosted materialisation
Central-rooted Local World        control:root                       Central
  ProjectCentral Project World    project:<project_id>               Central
    bounded Co-Internality        (optional enclosing ref)           Factory / Central
      stable World Position       central:position:<world>:<slug>    Central (definition)
        occupancy / tenure        actuation:generation:<uuid>        Actuation
          Agent / Agency / AgentSession / SessionSpace / body         Actuation / AIKit
material placement                workcell:<label>, root/child NOW   Workcell / Central
developmental work custody        factory:custody:<uuid>             Factory
```

Semantic scope and material placement are independent axes: a Project World may span
several Workcells; a Workcell never becomes a Project scope.

## Distinctions that must not collapse

`Position != Agent != Agency != AgentSession != SessionSpace`,
`Position != work != inherited knowledge != model/harness body`.
A Position is an address. It survives changes of Agent, Agency, AgentSession,
SessionSpace, model, harness and Workcell placement. It never mints an Agent
identity; `eligible_agent_refs` point at the existing canonical Agents.

Every joined read reports each facet as one of
`present | absent | ambiguous | unavailable | not-attempted`, with `reason` and the
`source` that answered. Absence and ambiguity are results, never errors to paper over,
and never inferred from terminal labels, pane titles or recent UI state.

Every refusal is three-part (after OpenRig's convention): **fact** (current state),
**consequence** (what did or did not happen), **action** (the exact next lawful command).

## 1. Central — Local World, Project World, Position definition, NOW horizon

### `central.world.here` (read)

Input `{ "cwd"?: string, "project"?: string }`. `project` wins over `cwd`; `cwd` defaults
to the process working directory. Output `central.world-here/v1`:

```json
{
  "schema": "central.world-here/v1",
  "local_world": {
    "ref": "control:root", "root": "/Users/…/Central", "identity_ref": "central:pasu:nara:local",
    "roots": { "governance": "Control/agents/governance", "wiki": "Control/agents/wiki/wiki.json",
               "now": "Control/agents/now", "user": "Control/user" },
    "time_policy": { "ref": "central:source:control:root:Control/user/civil-time-policy.json", "revision": "…" }
  },
  "project_world": {
    "state": "present", "ref": "project:O-I", "name": "O-I", "path": "Work/O-I",
    "projectcentral": "Work/O-I/ProjectCentral", "parent_ref": "control:root",
    "roots": { "governance": "…", "wiki": "…", "now": "…", "user": "…" },
    "via": "cwd | registered-worktree | input"
  },
  "cwd": { "path": "…", "relation": "work-member | registered-worktree | central-root | outside" },
  "workcells": [ { "ref": "workcell:local", "declared_by": "Control/machines/current.json", "role": "current" } ],
  "world_record": { "state": "present | absent | mismatch", "ref": "…", "detail": "…" }
}
```

`project_world.state` is `absent` outside any Work member and `ambiguous` (with
`candidates`) when more than one member claims the path. A registered development
worktree resolves through its `repository` grant in `Control/user/placement.json`.

### Position definition — `central.world-position/v1`

Durable ground relation at `{Control|ProjectCentral}/relations/positions/<slug>.json`:

```json
{
  "schema": "central.world-position/v1",
  "ref": "central:position:project:O-I:factory-guardian",
  "revision": "r1",
  "slug": "factory-guardian",
  "label": "Software Factory Guardian",
  "enclosing_world_ref": "project:O-I",
  "enclosing_co_internality_ref": null,
  "role_ref": "role:product-guardian",
  "purpose": "Steward the Software Factory product: transformation.",
  "purpose_ref": "central:source:control:root:Control/agents/expressions/factory-guardian/OFFICE.md",
  "stewards_ref": "project:Factory",
  "eligible_agent_refs": ["agent/factory-guardian"],
  "profile_ref": "profile/factory-guardian",
  "continuity_ref": null,
  "handle": "@factory-guardian"
}
```

Rules: `ref == "central:position:" + enclosing_world_ref + ":" + slug`; slug
`[a-z0-9][a-z0-9-]{0,63}`; file name `<slug>.json`; `enclosing_world_ref` equals the
scope that holds the file; `handle` unique across the listing; `profile_ref`, when
present, resolves to an AgentProfile in the world's ancestry. Optional fields may be
`null`/absent. Unknown keys are refused (a silently dropped key alters the address).

Actions: `central.position.list {project?}` → `central.position-listing/v1`
`{world_ref, positions[], inherited[] (ancestor positions), invalid[{path, error}]}`
(uncapped); `central.position.read {position_ref}` → the record plus
`source {ref, revision}`; refusals `central.position_not_found`, `central.position_invalid`.

### NOW horizon: Workcell root NOW and child NOWs

Native clearings gain optional `workcell_ref`, `parent_now_ref` and
`horizon: "workcell-root" | "child"` (absent = standalone, byte-compatible with
existing records). `central.now.workcell-root {workcell_ref}` idempotently ensures the
one root NOW for that Workcell in the root register. `central.now.allocate` accepts
`parent_now_ref` (same scope or the root scope) and `workcell_ref`.
`central.now.children {now_ref}` lists every child (uncapped). Day rollover never
closes, completes or archives a clearing: live children carry; quiescent children are
reported as released from the live horizon and remain retained.

## 2. Actuation — occupancy and tenure

Append-only tenure ledger per Position (`$ACTUATION_OCCUPANCY_STORE`, default
`~/.actuation/occupancy/`). Occupant generation is distinct from the Position and from
every AgentSession: `generation_ref = "actuation:generation:<uuid>"`, with a per-Position
`generation_ordinal` (max + 1). The current occupant is the single open tenure; any
other shape is an explicit ambiguity refusal, never newest-wins.

`actuation occupancy <verb> --json`:

| Verb | Effect |
|---|---|
| `claim --position P --agent A --agency G [--agent-session S] [--session-space SS] [--harness-composition H] [--model M] [--workcell W] [--gateway-address ADDR] --reason R (--expect-vacant \| --expect-generation GEN) [--kind initial\|handover\|fresh\|adopt]` | Opens a tenure. On an occupied Position it requires `--expect-generation <current>` and supersedes the predecessor in the same locked write. |
| `release --position P --generation GEN --reason R` | Ends the current tenure; the Position becomes vacant. |
| `verify --position P --generation GEN` | Exit 0 only for the current generation; a superseded one is refused (`occupancy.superseded`). |
| `presence --position P --generation GEN --presence active\|idle\|away\|offline [--attention TEXT]` | Presence/attention of the current occupant only. |
| `read --position P` | `actuation.position-occupancy/v1 {position_ref, state: occupied\|vacant, current?, predecessor?, presence?, generations}` |
| `list` | Every Position with a ledger and its current state (uncapped). |

Tenure record: `{position_ref, generation_ref, generation_ordinal, kind, agent_ref,
agency_ref, agent_session_ref?, session_space_ref?, harness_composition_ref?, model_ref?,
workcell_ref?, gateway_address?, began_at_unix_ms, reason, predecessor_generation_ref?,
ended_at_unix_ms?, end_kind?: released|superseded}`. The predecessor's history stays
readable as testimony; it grants the successor no authority.

Launch stamps `OI_POSITION_REF` and `OI_OCCUPANT_GENERATION` into the body's
environment; identity is recovered from those, never from text.

## 3. Factory — custody and current work

Custody is the durable, obligation-bearing relation between a Position and
developmental work. `factory.work-custody/v1` records live in the project's
developmental state:

```json
{ "custody_ref": "factory:custody:<uuid>", "position_ref": "…", "work_ref": "…",
  "run_ref": "…", "journey_ref": "…", "workflow_unit_ref": "…",
  "state": "in-progress | blocked | released | completed | handed-off",
  "assigned_at_unix_ms": 0, "reason": "…", "origin": { "communique_ref": "…" } }
```

`factory development custody assign|update|list`, and
`factory development current-work --position P` → `factory.current-work/v1`:

```json
{ "schema": "factory.current-work/v1", "position_ref": "…",
  "outcome": "none | one | ambiguous", "current": { … } , "candidates": [ … ],
  "considered": 0, "basis": "plain-words reason" }
```

Law (OpenRig `deriveCurrentWork`): the input is **every** `in-progress` custody for the
Position plus every active attempt whose participant names the Position — never a
capped display page, never most-recent. Candidates naming the same work node collapse
to one; more than one distinct node is `ambiguous` with all candidates listed.
`blocked` custody is not current work.

`factory development inhabitation [--run R] [--position P]` →
`factory.inhabitation-reading/v1`: per Run, the Positions in custody and the occupant
relations Factory already holds (attempt participant, execution body, placement NOW,
return address), carrying foreign refs verbatim. It is a projection, not a registry.

## 4. AIKit — joined reading, contact, Refocus, hot projection, entry

- `aikit whoami [--position P] [--full] [--json]` → `aikit.inhabitation-reading/v1`:
  facets `local_world, project_world, position, occupancy, agent, agency,
  agent_session, session_space, body, workcell, root_now, child_now, current_work,
  peers, prepared_context, authority, working_surface, return_destination`. Resolution
  chain: `--position` → `OI_POSITION_REF` → the occupancy whose `agent_session_ref`
  matches the current AgentSession → `absent`.
- Gateway contact (`aikit gateway who | send | inbox | conversation | delegate`): a
  Communique is addressed to a Position, attributed from the sender's own occupancy,
  appended durably and delivered at the recipient occupant's next turn boundary. It
  never blocks on a reply and never mints Run ancestry. `delegate` is the explicit
  crossing into Factory custody. tmux/Herdr keystrokes are material transport only.
- `aikit gateway who [--project-world W] --json` → `aikit.population-reading/v1`, the
  "who is here" roster every consumer (including the Cradle Agents aperture) reads:

  ```json
  { "schema": "aikit.population-reading/v1", "project_world_ref": "project:O-I",
    "local_world_ref": "control:root",
    "positions": [ {
      "position_ref": "central:position:project:O-I:factory-guardian", "handle": "@factory-guardian",
      "label": "…", "role_ref": "role:product-guardian", "inherited": false,
      "occupancy": { "state": "occupied | vacant | unavailable", "generation_ref": "…",
                     "generation_ordinal": 1, "kind": "fresh", "agent_ref": "…", "agency_ref": "…",
                     "agent_session_ref": "…", "workcell_ref": "…", "since_unix_ms": 0,
                     "presence": "active | idle | away | offline", "attention": "…" },
      "current_work": { "outcome": "none | one | ambiguous | unavailable", "work_ref": "…",
                        "run_ref": "…", "candidates": 0 },
      "communiques": { "undelivered": 0 } } ],
    "absences": [ { "facet": "…", "reason": "…", "source": "…" } ] }
  ```

  Communique record `aikit.communique/v1`: `{communique_ref, from_position_ref,
  from_generation_ref, to_position_ref, to_workcell_ref?, body, sent_at_unix_ms,
  state: held | pending | delivered | escalated, delivered_to_generation_ref?,
  delivered_at_unix_ms?, escalated_custody_ref?, reply_to?}`. `held` = the recipient
  Position is vacant; it is delivered to the next occupant that claims it.
- `aikit refocus` → `aikit.refocus-reading/v1`: current operation ← workflow unit ←
  attempt/Run ← Journey/Commission ← Project intent ← ProjectCentral ground, plus
  Position, NOW, body, nearby work, changed sources and Return target. Delivered at
  fresh occupancy, post-compaction, current-work transition, sustained-work threshold
  and explicit request; recorded as delivered only when emitted into the turn.
- Redis hot World projection: a `world` family beside the prepared NOW context holding
  refs/revisions/cursors of the joined reading. Loss and rebuild preserve identity
  because every value is recomputed from its owner.
- Fresh entry: SessionStart delivers the lean reading (World, Project World, Position,
  current work/NOW, body/context pointers and the faculties above), not a historical
  NOW dump. Consequential work retrieves the governing source on demand.
