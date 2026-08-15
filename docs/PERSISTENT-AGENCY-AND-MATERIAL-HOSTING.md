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
