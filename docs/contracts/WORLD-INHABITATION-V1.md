# World inhabitation contract v1

Status: pinned cross-owner read/action contract for O-I #65 / #220 and Factory #195
(World-rooted inhabitation amendment, 2026-09-23). Behavioural reference:
`mvschwarz/openrig@c8fca9d5c436e5357807e05254bf6735613eea3f` — see
[`ProjectCentral/docs/5-evidence/research/openrig-c8fca9d/CROSSWALK.md`](../../ProjectCentral/docs/5-evidence/research/openrig-c8fca9d/CROSSWALK.md).

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
`{world_ref, positions[{record, source}], inherited[{record, source}] (ancestor positions),
invalid[{path, error}]}` (uncapped); `central.position.read {position_ref}` →
`central.position-reading/v1 {record, source {path, ref, revision}}`; refusals
`central.position_not_found`, `central.position_invalid`. A handle is `@` + the slug grammar.

### NOW horizon: Workcell root NOW and child NOWs

Native clearings gain optional `workcell_ref`, `parent_now_ref` and
`horizon: "workcell-root" | "child"` (absent = standalone, byte-compatible with
existing records). `central.now.workcell-root {workcell_ref}` idempotently ensures the
one root NOW for that Workcell in the root register. `central.now.allocate` accepts
`parent_now_ref` (same scope or the root scope) and `workcell_ref`.
`central.now.children {now_ref}` lists every child (uncapped). Day rollover never
closes, completes or archives a clearing: `central.day.ensure` and
`projectcentral.now.rollover` return `now_horizon`, listing active clearings as carried and
quiescent ones as released from the live horizon (still retained).

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
ended_at_unix_ms?, end_kind?: released|superseded, end_reason?}`. With no `--kind`, a claim
is `initial` on an empty ledger, `fresh` on a vacant Position with history and `handover`
when superseding; a contradictory kind is refused. `list` returns
`actuation.position-occupancy-listing/v1 {positions[], invalid[]}`. Refusals exit 2 with
`{ok:false, error:{code, fact, consequence, action}}`; codes `occupancy.occupied`,
`stale_expectation`, `superseded`, `unknown_generation`, `kind_inconsistent`, `ambiguous`,
`corrupt`, `store_unavailable`, `outcome_unknown`. The predecessor's history stays
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
  Across Workcells the record also carries `origin_gateway_ref`, `routing?`
  (`{workcell_ref, gateway_ref, generation_ref?, basis, observed_at_unix_ms}`, the
  remote occupancy answer a relay was taken on), `forward?` (the relay state) and
  `transitions` (each state change with its basis). Population rows gain
  `occupancy.observed_via` (`local` | `gateway:<gateway_ref>`) and the reading gains
  `remotes: [{workcell_ref, gateway_ref, status: reachable | unreachable, detail}]`.
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

## Across Workcells, and teams (landed 2026-09-24)

Proven live between the Mac (`workcell:mac`) and Omarchy (`workcell:omarchy`); evidence in the
owner's Central NOW flow `two-machine-inhabitation-2026-09-24`.

- **Each machine is its own Workcell.** A fabric never has two cells named `workcell:local`:
  occupancy and routing compare Workcell refs. The name is the machine's Central binding
  (`Control/machines/current.json`), the same ref its Workcell control plane serves.
- **Occupancy is owned per Workcell and asked for, never copied.** Each machine's Actuation
  keeps its own ledger. A gateway answers `occupancy-read` / `occupancy-list` from its own
  Workcell's Actuation at the moment it is asked; nothing is cached (EpiLogos/ai-kit#425).
- **Routing a Communique.** Local ledger first: a current tenure here is delivered here; a
  tenure naming another Workcell is relayed to that Workcell's declared gateway. With no
  current tenure here, every declared remote is asked (bounded wait): exactly one current
  occupant → relayed there, the answer recorded as `routing`; more than one → refused as
  ambiguous; none, or remotes unreachable → `held`, naming who was asked and who could not be.
  The relay pass (every service tick, or `aikit gateway forward`) re-resolves held Communiques,
  so a Position occupied later elsewhere still receives them. Remotes are declared per machine
  (`aikit gateway remote add --workcell W --ws HOST:PORT --token-location …`); the gateway runs as
  a user service serving its Unix socket beside the authenticated WebSocket
  (`aikit gateway install-service --ws … --ws-token-location …`, EpiLogos/ai-kit#433; Workcell's
  reference description, EpiLogos/Workcell#104).
- **Positions need their root ground on every machine.** A Position's `profile_ref` must resolve
  in that machine's `control:root`; Central's source transfer carries the root agent ground
  (profiles, agent expressions, agent sets) between grounds with the absent-`project` root scope,
  first transfer established with explicit acknowledgements, later ones fast-forwarding
  (EpiLogos/Central#224). `Control/user/` does not travel by agent.
- **The inhabited World in the SharedField.** Positions, and in `occupancy` mode their occupancy
  (state, generation ordinal, Workcell, `observed_via`, current-work outcome, undelivered count),
  enter the same World publication bundle as the wiki, selection-gated and privacy-scanned; an
  occupancy change re-projects as a source revision (O-I#505, `shared-field/WORLD-PUBLICATION.md`).
- **Teams.** When the Agent inhabiting a Position orchestrates a Central agent set, `aikit
  inhabit` launches Claude Code with the set's members as subagents and carries each member's
  catalogued skills in the same per-session plugin, named `<plugin>:<skill>`; the whole team or
  none, removed on release (EpiLogos/ai-kit#434, #437). Anima (`anima-4`) and Aletheia
  (`aletheia-5`) are occupied this way; their work arrives through Factory workflows authored in
  Vāk (EpiLogos/QL-MEF#247, EpiLogos/Factory#269).

## 5. Workcell-root NOW and the temporal field

### The governing determination

The governing determination is:

> **NOW is recursively localised and materially situated. Each Workcell participating in a World has one persistent root NOW horizon. Bounded tasks, Projects, Journeys and delegated acts occupy child NOWs within that horizon. A human Day composes eligible NOW horizons by reference. SharedField projects selected local NOW/DAY relations into a collective FieldNow/FieldDay without acquiring local source identity.**

The first physical proving world is the owner's primary workstation plus Omarchy.

```text
Personal World
│
├─ primary Workcell
│    └─ root NOW: primary
│         ├─ child NOW: direct work
│         ├─ child NOW: Factory unit
│         └─ child NOW: delegated work
│
└─ Omarchy Workcell
     └─ root NOW: omarchy
          ├─ child NOW: resident agency
          ├─ child NOW: Factory unit
          └─ child NOW: scheduled/delegated work
```

The human Day on the primary workstation is a temporal whole over these simultaneously present Workcell horizons. Neither Workcell needs to become the other's material owner in order to participate in the same Day.

### Recursive NOW law

Use the existing Central NOW relation recursively rather than minting a second `NowHorizon` ontology.

```text
World
  └─ WorkcellRef
       └─ root NowRef
            ├─ child NowRef
            │    └─ child NowRef
            └─ child NowRef
```

#### Root NOW

The root NOW is the persistent temporal horizon through which a Workcell presently participates in a World.

It is stable across ordinary terminal/window/view changes, SessionSpace presentation changes, provider pane/workspace replacement, Day rollover, creation/completion of individual child tasks and foreground/background transitions.

It can require reconstruction after real material loss, but material reconstruction does not by itself make a new semantic NOW when the Central continuity relation remains valid.

#### Child NOW

A child NOW is the bounded localisation of actual work within a Workcell horizon. It retains the existing NOW semantics, including as applicable:

```text
purpose / subject
participants
source basis + revisions
scope / World / Project
T artifacts and bounded scratch
pending obligations / requests
writable namespace
continuation / successor relation
return address
archive / quiescence state
```

Typical subjects include a direct task, Project-local task, Factory Journey/Run/workflow unit, Agent delegation, Routine occurrence or another explicitly bounded work relation.

Child nesting is permitted where a real bounded delegation or decomposition relation warrants it. Recursion follows real work rather than imposing a mandatory tree over everything that happens on a machine.

#### Core identity laws

```text
WorkcellRef != NowRef
root NowRef != child NowRef
NowRef != SessionSpaceRef
NowRef != AgentSessionRef
NowRef != RunRef
NowRef != JourneyRef
NowRef != provider workspace/pane/session id
NowRef != process/container id
```

The relations among these objects are first-class; their identities do not collapse.

### Material inhabitation

A Workcell-root NOW is made inhabitable through the already-developed AIKit/Workcell/provider field.

```text
root NOW
  ↓ contains/localises
child NOW
  ↓ operative binding
SessionSpace / AgentSession
  ↓ Surface/provider binding
Herdr | tmux | cmux | desktop | harness-native | other
  ↓ material support
Workcell process / service / storage / network
```

For the first physical setup, Omarchy / Herdr is the rich reference working-environment provider; tmux is the thin persistent portability provider; cmux remains an optional supported environment where present; desktop/TUI/harness-native views are additional Surfaces over the same canonical work.

A pane or workspace is therefore not a NOW. It is a material/presentation locus through which a NOW may be encountered.

Closing a view, closing a pane, interrupting a turn, cancelling an Agency act, stopping a process, quiescing a child NOW and ending a Factory attempt remain different operations.

#### Persistent agency field

Each Workcell can host a resident agency field beneath its root NOW. Provider servers, Gateway services, scheduler carriers and resident harness bodies may persist there according to their own lifecycle contracts.

This lets a Workcell remain genuinely inhabited while individual task/session Surfaces appear and disappear.

### One Surface grammar for the NOW

O:I surfaces should present one temporal grammar at several frames rather than inventing separate status stores.

Opening/focusing another Surface preserves the current child NOW. Deliberate move/re-placement is visibly a different operation.

### Personal Day over several Workcells

The human Day remains a Central-owned civil-time source, not a synonym for a machine or scheduler interval.

In the first personal setup:

```text
Personal Day D                  owned from primary Central temporal source
│
├─ primary root NOW
│    └─ child NOWs ...
│
└─ Omarchy root NOW
     └─ child NOWs ...
```

The Day gathers eligible relations from each horizon by stable reference and provenance.

#### Day rollover

Day rollover performs temporal closure/reconciliation, not global process reset.

At rollover:

1. account for the current participating Workcell/root-NOW horizons;
2. retain exact active/waiting child NOW relations;
3. preserve pending permissions, uncertain effects, Returns and unresolved obligations;
4. close the dated human Day reading;
5. advance the authorised Day pointer/create the next Day source;
6. allow quiescent child/provider material to be compacted or released under its existing owner policy;
7. continue live root NOWs and live children by reference.

Thus the person enters a new Day while the machines can remain continuously present.

#### Offline primary machine

Omarchy can continue working while the primary workstation is unavailable.

Its native activity retains occurrence/material/source evidence such as:

```text
occurred_at
observed_at
WorkcellRef
root NowRef
child NowRef
ActivityRef / ReturnRef
source/provider cursor
```

When the primary machine returns, Central receiving/Day composition reconciles the event according to its original occurrence/source/task relations. Receipt/review time does not replace occurrence time.

### Root work, the work occasion and the Day as a vantage

Central remains the root meta-project. A child software Project is not required to legitimate root work, a root Agent or personal Day inquiry. A Workcell-root NOW is a temporal/material anchor, not a new filesystem root or replacement for Central.

A bounded work occasion is not necessarily a model turn, a whole conversation, a single calendar date or a Factory Run. It can span several turns and Days; one Run can involve simultaneous children on both machines. Attempts retain their own effective conditions. The stable work relation and its changing execution conditions must both remain recoverable.

The person can read the field from My NOW, Workcell, Project, Journey/Run, Agent or an explicitly projected SharedField vantage. These are views over native relations, not copied tasks. The same Activity appearing in several views must not be counted several times.

**The Day is a human vantage, not an automatic scheduler or global permission grant.** Its writing and intentions can orient related tasks without silently issuing Commissions, marking personal tasks complete or granting every child access to every other child. Human intent evolves through actual source revision or accepted proposal. A result does not retroactively determine what the person must have intended.

### Receiving and re-entry

Central NOW/Inbox/DAY receives references to the real work, and AIKit Routine/provider scheduling can re-enter it under current proof/authority. Reconnect and DAY rollover do not schedule work or replenish exhausted bounds.

### Temporal address for Activity and logging

Do not create a universal event ontology. Instead allow existing Activity/Return/telemetry/logging readings to carry a bounded correlation envelope when their native owners can establish the relation.

Representative shape:

```text
TemporalAddress {
  occurred_at
  observed_at

  world_ref
  workcell_ref
  root_now_ref
  child_now_ref?
  day_ref?

  project_ref?
  journey_ref?
  run_ref?
  workflow_unit_ref?
  routine_ref?
  routine_occurrence_ref?

  agent_ref?
  agency_ref?
  agent_session_ref?

  shared_field_ref?
  field_day_ref?

  native_owner
  native_event_ref?
  cursor?
  provenance
}
```

This is a correlation grammar over native facts. Actuation remains Activity/Return owner; Factory remains developmental/telemetry owner; AIKit remains session/composition owner; Workcell remains material observation owner; Central remains temporal source owner; SharedField remains shared projection owner.

One attributable Activity can legitimately appear in several views because it participates in several real relations.

### Factory temporal projection

Factory's existing NOW law is strengthened by place, not replaced.

```text
Journey / Run / WorkflowUnit / Execution
  ↔ WorkcellRef
  ↔ root NowRef
  ↔ child NowRef
  ↔ Flow / source revisions
  ↔ Activity / Evidence / Return
  ↔ DayRef where applicable
```

A Journey or Run may span many Days, have simultaneous child work on several Workcells, continue while one UI or Workcell is unavailable, receive several Routine-backed invocations, and converge bounded child Returns without those children becoming one Agent identity.

Factory's live view is therefore a projection over native current relations.

#### SSSF / Build depths

```text
Semantic
  Journey / Run / workflow status and frontier

Cognitive
  Run Thought where available

Live
  Agency / Execution / AgentSession
  Workcell / root NOW / child NOW
  provider/material state

Trajectory
  attributable Activity / tool / process / permission / evidence
  ordered through owner cursors/times with temporal/material correlation
```

A result/handoff can expose the exact continuing child NOW/session/run address where useful, so continuation is executable rather than archaeological.

### Bounded delegation and the Pi harness adapter

The generic subagency relation is larger than any harness-native subagent feature.

```text
parent Agency / AgentSession
    + current temporal address
        ↓
bounded child determination / authority
        ↓
Central child NOW allocation
        ↓
AIKit child context / praxis / model / harness / SessionSpace resolution
        ↓
Workcell + provider materialisation
        ↓
child Pi | Codex | Claude | other admitted harness
        ↓
Activity / Evidence / Return
        ↓
parent return route / Factory convergence where applicable
```

#### Pi adapter extension

AIKit's Pi adapter should project a thin O:I delegation extension through Pi's real native extension faculties. Useful affordances include equivalents of:

```text
delegate
inspect delegations
contribute
pause / cancel
receive Return
```

The extension invokes the native O:I/AIKit operation. It does not own tmux/Herdr commands or invent a Pi-only child identity model.

A Pi parent can therefore delegate to another Pi child, a different admitted harness, a specialised durable O:I Agent or a remote Workcell when placement resolves there. In the DLW, delegation that resolves to another Workcell is a track whose Works in names that Workcell, and its next task starts there; a helper inside one lead's task works where its lead works, in the lead's seat and branch (manual §19.16, §19.23).

Harness-native delegation facilities map onto the same semantic contract where possible. Provider team/subagent/process IDs remain provenance beneath the canonical Agency/NOW/session relation.

### Routine, cron and temporal re-entry

A Routine occurrence has an origin and an execution destination.

```text
trigger observation
  on Workcell A / root NOW A
        ↓
proof + authority + eligibility revalidation
        ↓
placement/body resolution
        ↓
child NOW on Workcell A or Workcell B
        ↓
Agency / AgentSession / Activity / Return
```

Keep the accepted laws:

```text
Journey != Routine
Routine != scheduler job
NOW != scheduler queue
DAY rollover != trigger
trigger fired != Action authorised
provider job id != RoutineRef
restart != renewed authority
```

A scheduler on the primary workstation can trigger work that executes on Omarchy. Omarchy can also observe its own scheduled events while the primary is offline.

Each consequential occurrence retains enough provenance to reconstruct:

```text
RoutineRef + proof/praxis revision
RoutineOccurrenceRef
trigger observation + provider/cursor
origin Workcell/root NOW
execution Workcell/root NOW/child NOW
Agency / AgentSession / Factory refs where present
Activity / Return
source/Flow revisions
```

Duplicate occurrence delivery cannot produce a second consequential child/effect without passing the current idempotence/reconciliation law.
