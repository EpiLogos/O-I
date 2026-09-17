---
Register: design
Standing: owner-approved development clarification
Adopted: 2026-09-16
---

# Workcell-root NOW and the temporal field

## Purpose

This document clarifies the temporal-spatial relation already being implemented through the continuous-work, SessionSpace, Factory, Routine, Workcell, desktop and SharedField programmes.

It is **not a new programme** and does not replace Central NOW/DAY, AIKit SessionSpace, Actuation Activity, Factory Journey/Run, Workcell material placement or SharedField semantics. It makes their existing relation explicit enough that the same development track can implement, test and present one coherent temporal field.

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

## 1. Existing meanings are retained

The clarification preserves the existing owner distinctions.

**Central** owns human Day identity and civil-time/timezone policy; root and Project temporal source; NOW identity/lifecycle; bounded child NOW allocation and working material/source relations; rollover, receiving, archive and continuation provenance.

**AIKit** owns operative composition and encounter continuity: Context/praxis/model/harness resolution; AgentSession and SessionSpace; working-environment/provider bindings; projection into admitted harnesses; dispatch, continuation and bounded delegation orchestration at the operative layer; Routine intent/occurrence and provider-facing recurrence composition.

**Actuation** owns actual agency: Agent / Agency / WorldBinding; determination, delegation and bounds; Activity / ActuationStream; attributable Return and current authority.

**Factory** owns developmental meaning: Commission, Journey, Run and workflow units; developmental topology and execution correlation; Claims/Evidence/Candidates; developmental Return and Recognition; derived telemetry over owner-native evidence.

**Workcell** owns material actuality: host/Workcell identity; process/service/storage/network placement; persistent hosting and lifecycle; material recovery/rematerialisation; process/resource observation and confinement where supported.

**O:I / SharedField** composes and presents native relations. SharedField owns selected shared participation/projection relations: Participant, Projection and SharedField; Contribution and Encounter; Presence and shared Activity projection; hosted/federated live state through the SpaceTimeDB adapter.

No product acquires another product's identity simply because these relations are shown together.

## 2. Recursive NOW law

Use the existing Central NOW relation recursively rather than minting a second `NowHorizon` ontology.

```text
World
  └─ WorkcellRef
       └─ root NowRef
            ├─ child NowRef
            │    └─ child NowRef
            └─ child NowRef
```

### Root NOW

The root NOW is the persistent temporal horizon through which a Workcell presently participates in a World.

It is stable across ordinary terminal/window/view changes, SessionSpace presentation changes, provider pane/workspace replacement, Day rollover, creation/completion of individual child tasks and foreground/background transitions.

It can require reconstruction after real material loss, but material reconstruction does not by itself make a new semantic NOW when the Central continuity relation remains valid.

### Child NOW

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

### Core identity laws

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

## 3. Material inhabitation

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

### Persistent agency field

Each Workcell can host a resident agency field beneath its root NOW. Provider servers, Gateway services, scheduler carriers and resident harness bodies may persist there according to their own lifecycle contracts.

This lets a Workcell remain genuinely inhabited while individual task/session Surfaces appear and disappear.

## 4. Personal Day over several Workcells

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

### Day rollover

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

### Offline primary machine

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

## 5. Temporal address for Activity and logging

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

## 6. Bounded delegation and the Pi harness adapter

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

### Pi adapter extension

AIKit's Pi adapter should project a thin O:I delegation extension through Pi's real native extension faculties. Useful affordances include equivalents of:

```text
delegate
inspect delegations
contribute
pause / cancel
receive Return
```

The extension invokes the native O:I/AIKit operation. It does not own tmux/Herdr commands or invent a Pi-only child identity model.

A Pi parent can therefore delegate to another Pi child, a different admitted harness, a specialised durable O:I Agent or a remote Workcell when placement resolves there.

Harness-native delegation facilities map onto the same semantic contract where possible. Provider team/subagent/process IDs remain provenance beneath the canonical Agency/NOW/session relation.

## 7. Routine, cron and temporal re-entry

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

## 8. Factory temporal projection

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

### SSSF / Build depths

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

## 9. SharedField collective temporal projection

SharedField already supports recursively composed fields, Presence, Activity, Contributions, subscriptions and hosted live state. The temporal field projects through those contracts.

SpaceTimeDB is the first material host of the collective live projection. It is not the owner of local Central time or NOW identity.

### FieldNow

A shared current reading equivalent to:

```text
FieldNow {
  field_ref
  projected_root_now_refs[]
  projected_child_now_refs[]
  presence_cursor?
  activity_cursor?
  contribution_cursor?
  audience / projection provenance
  revision
}
```

### FieldDay

A collective aggregation interval equivalent to:

```text
FieldDay {
  field_ref
  interval
  temporal_policy_provenance
  projected_source_day_refs[]
  projected_now_refs[]
  activity_cursor?
  contribution_cursor?
  encounter_cursor?
}
```

Source/local Day and FieldDay can both apply to one event. An occurrence can retain the participant's local civil Day while also falling into a shared UTC or field-defined aggregation interval. Neither relation invalidates the other.

### Projection law

```text
local NOW/DAY truth
    ↓ explicit audience-scoped Projection
SharedField temporal relations
    ↓
SpaceTimeDB live hosted state
    ↓
Explore / agent API / Watch / Encounter
```

Unprojected/private source, child NOWs, logs and Activity never enter the hosted/indexed field merely because their parent World participates.

Service loss leaves local temporal state intact. Reconnect reconciles from source refs/revisions/cursors.

## 10. One NOW UX grammar

O:I surfaces should present one temporal grammar at several frames rather than inventing separate status stores.

```text
Workcell NOW
  one material horizon

My NOW
  aggregate eligible Workcell root NOWs for the person/World

Project NOW
  child NOWs and Activity related to ProjectRef

Journey NOW
  Factory-correlated child NOWs and Activity

Agent NOW
  current bounded work involving the Agent

SharedField NOW
  audience-permitted projected NOWs / Presence / Activity

Global / Field NOW
  collective SharedField reading
```

### Desktop

The existing UX spine consumes this relation:

- Project `Now` destination — project-framed current work;
- footer — quiet current Agency/Attention ingress;
- Session Observatory — exact child/session/context/runtime depth;
- Factory Build — Journey/Run live current work and produced results;
- Personal/Today — human Day plus My NOW across Workcells;
- Explore — projected FieldNow/FieldDay;
- History/Explain — why an item appears in the selected temporal frame.

### TUI

Quick/Workspace uses the same refs/actions and supports equivalent My/Workcell/Project/Journey/Agent NOW readings with terminal-native progressive disclosure.

Opening/focusing another Surface preserves the current child NOW. Deliberate move/re-placement is visibly a different operation.

## 11. Development propagation

This clarification is implemented inside the existing track.

**Central:** #150 — recursive Workcell-root NOW and multi-Workcell Day composition; #153 — root→child allocation, placement and relocation provenance; #152 — late/headless Return retaining original temporal address.

**AIKit:** #53 — composition/Surface correlation; #114 — Pi/harness delegation adapter/conformance; #275 — session/dispatch/delegation binding to root/child NOW; #276 — Routine origin/destination temporal address; #277 — placement/enforcement against bounded child NOW; #67/#211 — TUI current-work presentation.

**Actuation:** #1 / current Stream/Activity contracts — optional temporal correlation on attributable Activity/Return while authority/agency semantics remain native.

**Workcell:** #72 — persistent root-horizon materiality, recovery, second placement and two-machine proof.

**Factory:** #195 and accepted #199/#200 semantics — temporal/material correlation, pstack child NOWs, Routine re-entry and SSSF live/trajectory presentation.

**O:I:** #220 — connective integration ledger; #154 — Gateway/session ecology temporal correlation; #155 — inhabitation/Activity/Observatory/placement/UX; #289/#292 — Factory Arrangement and desktop NOW spine; #13/#18 — SpaceTimeDB FieldNow/FieldDay and Explore; #279 — Personal/Today/My NOW and hosted personal-web temporal projection; #201–#205 — joined verification.

No mirror ticket set is required. Each existing native owner extends its current implementation boundary.

## 12. Acceptance matrix

The existing #201–#205 / #65 campaign proves this relation as part of the same installed world.

### Temporal roots and allocation

- primary workstation and Omarchy each expose one stable root NOW;
- several bounded child NOWs coexist beneath each;
- same-task retry/reconnect resumes the intended child;
- child scratch/context/authority do not bleed into siblings;
- Day rollover retains root NOWs and live children.

### Sessions and providers

- one child can be reached through desktop/TUI/Herdr/tmux without identity drift;
- provider/pane recreation cannot hijack another child;
- opening remote Omarchy work remains remote access;
- explicit re-placement establishes the target Workcell/root-NOW relation before useful execution resumes.

### Delegation

- parent Pi/another harness allocates a child NOW before child launch;
- parent Pi delegates once to Pi and once to a different admitted harness;
- child authority/scope/verification/return are bounded;
- failed/late/cancelled child state remains attributable;
- child quiescence releases child-owned material without ending the Workcell root NOW.

### Routine / cron

- trigger origin and execution destination can differ;
- primary trigger → Omarchy child execution is attributable end to end;
- Omarchy can continue while primary is offline;
- duplicate/restart/provider replacement does not duplicate consequential effects;
- late Return retains original occurrence/material temporal address.

### Factory

- one Journey has live children on both Workcells;
- one Run crosses a Day boundary without reminting;
- barriers converge exact child Returns;
- Build Live/Trajectory shows exact temporal/material correlations;
- produced result/handoff reopens the correct continuing work.

### SharedField

- explicit projection produces a live FieldNow in SpaceTimeDB;
- another independently grounded Participant/World can appear beside it;
- FieldDay retains its own aggregation policy while source Day refs remain intact;
- live subscriptions update projected Activity/Presence/Contributions;
- service loss/reconnect reconciles without local identity loss;
- withdrawal/revocation removes shared availability without deleting local source;
- private/unprojected NOW/source/log material is absent from hosted state, search, backlinks, previews and Encounters.

### Human experience

- `My Now` shows primary + Omarchy coherently;
- Project Now, Journey Now, Agent Now and Observatory co-refer to the same work;
- Today shows human Day and late Returns without rewriting occurrence history;
- footer gives direct ingress to live current Agency rather than another dashboard;
- human can distinguish `open here`, `open remote`, and `move work` through actual effects;
- desktop/TUI/Explore presentation preserves the same semantic refs and native Action lineage.

## Closure relation

This clarification is complete when the existing continuous-work track can be operated as an inhabitable temporal-spatial field:

- machines have their own persistent material presents;
- bounded work localises within those presents;
- human Day holds several Workcell presents together without erasing place;
- Factory and Routine reconstruct what happened where and why;
- Activity/logging remains attributable across frames;
- SharedField can expose a live collective present without appropriating local temporal/source identity;
- desktop, TUI and hosted surfaces present these relations as different views of the same current world.
