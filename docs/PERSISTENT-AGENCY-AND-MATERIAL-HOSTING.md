# Persistent Agency and Material Hosting in the O:I Field

## Purpose

O:I exists partly to make distinctions visible that contemporary agent systems often collapse inside one application, gateway or deployment.

A modern system may package an Agent, Harness, session, gateway process, messaging adapters, API, tools, machine and deployment under one product name. That can be a useful implementation. It should not force the wider architecture to treat those things as one identity.

Within the six-surface O:I field, persistent agency exposes a particularly important relation between:

```text
#1 actuation
    Agent runtime / loop / harness activity

#2 capability + context resolution
    AIKit resolution of HarnessComposition and encounter Surfaces

#3 developmental agency
    Factory Project / Run / Agent / Agency / execution meaning

#4 material context
    Workcell processes / services / storage / bindings / machines / lifecycle
```

These are centres of responsibility, not compulsory pipeline stages.

## The #1 ↔ #4 relation

Actuation requires material conditions in which it can occur. A persistent agent host makes that relation especially concrete.

From the actuation side, a resolved agent/harness may need:

- continuous or long-lived execution;
- durable session/runtime state;
- supervised recovery;
- an interactive control path;
- event/webhook ingress;
- outbound network access;
- one or more human/software communication surfaces.

From the material side, a Workcell can offer:

- host process, container, MicroVM or future execution providers;
- workspace and durable storage;
- logical services/endpoints;
- network exposure and bindings;
- credentials through appropriate provider seams;
- health/readiness observation;
- reconciliation and restart;
- an optional Workcell Control Service for remote operation of the Workcell itself.

The relation is not `Agent = process` or `Harness = machine`. The higher layer expresses/resolve the needed affordances; Workcell materialises them according to available offers.

## Communication surfaces

One effective agent may be encountered through many methods:

```text
command line
TUI
GUI / web conversation
messaging application
HTTP/API
webhook / application event
editor integration
agent-to-agent protocol surface
```

O:I should disclose the distinction rather than define those surfaces itself.

AIKit owns the operational relation by which Agent/Harness/session capabilities are exposed through such Surfaces. Workcell owns the material services and bindings that keep those Surfaces reachable. The Agent Runtime/Harness owns its actual loop and target-native protocol semantics. Factory owns the developmental meaning of the Agent/Agency/Execution where that relation is present.

O:I may later tell a human or agent which installed native surface to use, but it does not become a messaging router or gateway.

## Gateway-shaped systems

Hermes, OpenClaw and similar systems use persistent gateway/service processes to decouple the continuing agent runtime from one or more communication/control methods.

This is useful evidence for the O:I paradigm because it demonstrates why the identities above must be separated. It does not imply one universal `Gateway` primitive or protocol.

The target-owned gateway may itself contain several responsibilities. O:I should preserve those native meanings while disclosing their place in the larger field:

```text
target Agent/Harness/session relation
        ↓ operational resolution
AIKit Surfaces / HarnessComposition
        ↓ material support relation
Workcell service/process/binding world
```

The Workcell Control Service is a separate concept again: it is the optional control surface for operating a Workcell. It must not be confused with the hosted agent's own gateway merely because both may be long-running network services.

## Identity laws

The O:I field should make these statements ordinary and inspectable:

```text
Agent != AgentSession
Agent != gateway process
Agent != Workcell
Harness != Workcell
Surface != physical endpoint
Surface != Projection
Workcell Control Service != agent gateway
provider/container/process ID != semantic Agent/Project/Run identity
```

Therefore:

- changing communication method need not change the Agent;
- losing one Surface need not erase the Agent or other Surfaces;
- restarting a gateway process need not mint a new Agent;
- replacing a session must remain separately observable from restarting a service;
- moving the material host from local machine to server Workcell need not alter Project/Run/Agent identity;
- changing target-native protocol does not redefine O:I semantic identity.

## O:I responsibility

O:I owns only the whole-level disclosure/composition consequences:

- surface descriptors should explain which native product owns each concern;
- installation/registration should expose native Workcell/AIKit/runtime commands and Skills rather than proxy their behaviour;
- Suite Snapshots may record the installed native versions and entry points that realise the accepted whole;
- `oi verify` may invoke declared native checks but must not reinterpret gateway, Surface or Workcell health as its own domain model;
- future Projection/shared-field work may selectively disclose these relations without becoming their canonical owner.

This makes the O:I paradigm useful precisely where the current software scene often conflates agency, embodiment, communication and deployment: each can remain interoperable while retaining the identity and ownership appropriate to its level.

## Session grounding

### Who makes each part true

| Concern | Native responsibility | What the person/Agent can rely on |
|---|---|---|
| Durable purpose, source, machine roles and working destination | Central | Real authored scope and references, explicit proposals/defaults, legitimate root or Project NOW |
| Who may perform which act | Actuation | Real Agent/Agency/WorldBinding and bounded, current authority; attributable Activity and Return |
| What becomes operative for this act | AIKit | Selected context/praxis/model/harness, effective composition, AgentSession and SessionSpace relations |
| Persistent terminals and other concrete environments | AIKit environment adapters and the native providers | Exact native workspace/pane/window/connection bindings and truthful provider-specific lifecycle |
| Where the processes/services/storage/network exist | Workcell | Actual material placement, observation, supported persistence/recovery and finite resource/effect boundaries |
| Developmental purpose and accountability | Factory | Commission/Journey/Run, exact attempt, independent work, evidence, Candidate and Recognition |
| Human and Agent access | Native Surfaces, Gateway, O:I and the OS host | Appropriate forms of the same permitted state and operations, with stable return routes |

These are interacting owners, not seven compulsory deployment stages. A valid thin/local or externally started session remains useful without a persistent multiplexer, Factory, remote service or QL. The Omarchy reference specifically requires the richer Herdr/Hyprland/Gateway experience under #158/#159; generic portability does not excuse dropping that reference branch.

### Place, identity and continuity

SessionSpace is a semantic arrangement independent of Project, AgentSession, provider and machine. It can bind several Surfaces/providers and several sessions. An actual process can already exist before AIKit is involved; a new session can also require AIKit to request an appropriate environment. Both paths are legitimate.

Use the current owner types to retain the relevant chain:

`Agent / Agency / World / purpose → AgentSession / composition revision → SessionSpace / Surface binding → addressed provider and material placement → native process/place observations → Activity / output`.

This is a required trace relation, not a mandate for a new aggregate record containing every field.

| Transition | What must be established |
|---|---|
| Open another view / remote access | Existing execution is still the target; no spawn or restart merely to show it |
| Detach/reconnect while host lives | Exact provider binding and process evidence; useful work progressed once while detached |
| Provider/server restart | Report what was restored: layout, screen history, native session or a newly prepared body |
| Rehydration | New runtime receives the selected permitted context/obligations; retained text alone proves nothing about uptake |
| Move execution to another host | New material placement and validated native continuation or explicit successor session/attempt |
| Same name, pane ID or numeric PID reappears | No continuity inference without namespace, generation/start and owner evidence |

A process identity is scoped by its material host and native start/generation evidence. Different machines can have the same numeric PID; the same machine can reuse one. Provider IDs can also be scoped to a server/socket/generation. The brief's demand that “PID must differ” is not a portable correctness rule.

Stable Agent/Project/Journey identity must survive presentation/material changes where its native law requires. Provider session continuity is conditional, and any AgentSession/body/attempt replacement must remain visible. Terminal output, a checkpoint and a native conversation token are different evidence.

### Working destination and placement

Central's machine roles declare intended relations; Workcell reports the material facts. Root/Project NOW owns bounded working material. Repository/worktree source, build output, provider state, credentials and task scratch keep their different existing destinations.

Resolve the actual human/World/Project, selected Agent or eligible participant, source revisions, context permission and task destination before preparation. An existing external repository without ProjectCentral is valid ground. Two concurrent tasks receive distinct writable task material; same-task retry reuses the intended allocation.

A default environment is a preference subject to capability/authority. A required environment/host is a constraint: no silent fallback. Herdr is the first rich Omarchy reference, tmux is the thin provider, cmux is optional where installed. Missing cmux on Omarchy neither fails tmux nor certifies cmux.

Do not bind all Agent work to one resident session. Workspace sharing, writable subject sharing and execution authority are different relations. Per-session/private context and permitted worktree writes must remain bounded even when the same provider server hosts several Agents.

### Material census and multi-Workcell placement

Use Workcell's existing discovery, placement, material-world, service and observation APIs. The “meta-workcell” concern is already substantially carried by discovery sources, placement decisions and Central machine relations. Extend these public readbacks only where needed; do not introduce a third Central-like register, global Agent store or compulsory control daemon.

For each accessible material field, establish:

- actual addressed Workcell/provider/server identity and fresh/failed/stale observation;
- process start/executable evidence and provider workspace/tab/pane/container relation;
- known canonical session/Surface/work correlations only from explicit owner bindings;
- pre-existing external/unclaimed work, with no fabricated Agent or Factory ancestry;
- lifecycle ownership, storage retention, reachability and supported recovery;
- limits of observation and permission.

A failed or partial scan does not mean everything disappeared. Aggregate executable identity must not collapse simultaneous executions. Workcell consumes provider observations at their material scope; AIKit continues to own SessionSpace/Surface bindings and Actuation owns actual Agency.

Multi-Workcell discovery can present several actual machines or nested material worlds. A network endpoint, hostname, `workcell:local` alias, terminal label or PID is insufficient global identity. Resolve aliases in the addressed context and preserve the owner's WorkcellRef and transport provenance.

Retain the existing distinction between desired placement, plan, prepared world and observed live material. A short-lived command cannot promise its own child service survives its exit. Select target-owned persistence or a supported persistent host where the task requires it. Explicit material confinement must be tested; shared tmux/Herdr panes alone are not a filesystem/security sandbox.

### Provider lifecycle and safe addressing

Opening an existing binding should reuse it. Creating or recreating is a deliberate operation. Crash between provider creation and binding persistence must reconcile the already-created material rather than duplicate the task. Foreign panes/processes and local configuration survive reconciliation.

Every input, interrupt or close addresses the exact current provider binding under its permitted operation. A stale target must not silently redirect to another session or newly recycled pane. Where atomic/native protection is unavailable, report that limitation and withhold operations whose required guarantee cannot be met.

Closing a view, closing a pane, interrupting an Agent turn, stopping a process, releasing a material world and ending a Factory attempt are separate operations. Preserve meaningful failures and supported recovery. In particular, Herdr's native status label “done” does not certify Factory evidence or Recognition.

### Authority, dispatch and service lifetimes

Central profiles, machine roles and Guardian formations do not issue runtime grants. Actuation #84 closes the scoped governing-authority join using existing grant/WorldBinding/determination contracts; AIKit #274/#275 composes and delivers through the actual supported body. Factory #221 correlates only the admitted execution that really acted.

Preserve addressed messages, session contribution, bounded delegation and independently grounded cooperation. Each child keeps subject/basis, effects, authority, independent verification, budgets, return route and lifecycle. One human unsent draft cannot become the dispatch buffer for machine messages.

Gateway application service, Workcell Control Service, provider multiplexer server and UI client retain their actual lifetimes. Restart one and observe precisely which relations survived. Supported communication and work continue while the desktop is closed; unresolved delivery must be reconciled before consequential retry.

Guardians are already specified in the O:I front-door/covenant and Central #137. Recover the real Field Guardian and product Agents, their authored expressions, formation/default relation, exact skill refs and current adoption. Their differentiation comes from enduring purpose, product Focus/Knowledge and work—not a new privileged profile class. Actuation Root Agency is relative to the enclosing World, not operating-system root.

### Remote access and moving execution

Remote access to a living host normally leaves work where it is. SSH/provider remote attachment and Gateway conversation are different routes to the same permitted work, not migration.

Deliberate re-placement follows this existing-owner sequence:

1. Resolve the target's real offers, storage/source availability, authority, credentials and required capabilities; retain explicit no-fallback constraints.
2. Account for in-flight requests, pending tools/permissions, uncommitted work and uncertain external effects. Quiesce or fence competing consequential execution where required.
3. Preserve bounded permitted context, native continuation artifacts where portable, exact Git/source basis, outstanding obligations and return route. Keep private source and secrets within their authorised transfer mechanisms.
4. Prepare the target material world; invoke supported native resume or explicit rehydration/successor creation. Revalidate grants, model policy and skills/context activation.
5. Prove actual target-side operation and correlate old/new material and any session/attempt change. Reconcile late source-host output against the current basis.
6. Release old material only according to its owner/lifecycle and after retained material and outstanding effects are accounted for.

Do not promise universal exactly-once delivery, portable hidden model state, or process migration. Same-host supported live service handoff can preserve processes; server reboot generally cannot. A two-directory test is not second-machine evidence.

The Mac and Omarchy are not two independent O:I installations conceptually. They are two material loci inside one personal Workcell/development world. The candidate receipt tells us what software cut each locus is running; canonical refs tell us what subject/Agency/session is continuing; material placement says where execution actually resides.

Remote access is not automatic execution migration. Moving/focusing a Surface does not mint a new session. The system must remain able to tell those differences. This GitHub planning/implementation contribution grants no connection to or mutation of either person's machine; actual machine actions remain separately authorised local work.
