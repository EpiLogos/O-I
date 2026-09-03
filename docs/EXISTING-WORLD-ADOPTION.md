# Existing-world adoption

Status: O:I whole-level implementation for closed #93, developed through #158/#173 and admitted through #97.

O:I starts from the technological World that already exists. The current implementation now gives that position one reusable setup mechanism: **World recognition is adapter-driven, package-extensible, source-preserving and shared by `oi adopt` and first-suite installation.**

The core relation is:

```text
existing World
    ↓
built-in + accumulated recognition adapters
    ↓
native systems / faculties / relations / evidence
    ↓
owner-native O:I participation where supported
    ↓
missing or incomplete support
    ↓
owner SDK + authoring Skill + conformance
    ↓
package/register
    ↓
rediscover the same World
```

The collective reusable result is the growing corpus of verified adapters/connectors/providers. A later installation can consume support already returned by earlier Worlds; a new technology/version/configuration can produce the next adapter refinement through the same public owner paths.

## One recognition engine, two immediate projections

Read-only inspection:

```sh
oi adopt PATH
oi adopt PATH --json
```

Direct recognition inspection:

```sh
oi recognition inspect PATH
oi recognition inspect PATH --json
```

`oi adopt` is the adoption-oriented read-only projection of the same recognition engine. It retains the existing owner-handoff account while including the full `oi.world-recognition-account/v1` reading.

First-suite `oi install` consumes the same engine around material setup:

```text
recognise World before setup
    ↓
perform current native suite establishment
    ↓
recognise World after setup
    ↓
write O:I-managed before/after recognition receipt
```

The current receipt is written under:

```text
<personal-ground>/.central/oi/managed/receipts/world-recognition-latest.json
```

with schema `oi.setup-world-recognition-receipt/v1`.

## Recognition contributions are ordinary O:I package contributions

The existing `oi.package/v1` envelope already carries independently owned contributions. World recognition uses that same package system; it does not introduce a second package ontology.

A recognition contribution targets:

```text
target_product  = oi
target_contract = oi.world-recognition/v1
```

Its executable/probe returns `oi.world-recognition-result/v1`, containing as applicable:

```text
native system identity / kind / name
version / locator / source revision
native faculties
native relations
technology-native facts
owner participation bindings
observation evidence / provenance
extension requests
```

The language-neutral result schema is:

```text
schemas/oi.world-recognition-v1.schema.json
```

Recognition identity remains distinct from both the encountered native technology and any AIKit/Central/Workcell/etc. contribution attached to it.

## Accumulated adapter registry

The local recognition registry is deliberately separate from the six-product composition store.

```text
composition.json
    six O:I product registrations / whole-suite command composition

world-recognition-registry.json
    locally registered technology-recognition contributions
```

The registry is located beside the normal O:I composition state. Embedded first-party recognisers and locally registered package contributions are read together as one effective recognition set.

Commands:

```sh
oi recognition list [--json]
oi recognition register PACKAGE.json
oi recognition unregister CONTRIBUTION_REF
```

External recogniser artifacts must prove their own recognition contract before registration. O:I invokes:

```text
recogniser verify --json
```

and requires a successful `oi.world-recognition-verification/v1` receipt. Discovery then invokes the registered artifact as:

```text
recogniser discover --target PATH --json
```

and validates its returned `oi.world-recognition-result/v1` account.

Registration therefore changes what the next World reading can recognise without changing the six-product composition store.

## Built-in source recognition

The previous `inspect_existing_world()` aperture scan is retained as the first built-in recognition provider rather than the whole adoption mechanism.

It notices source/configuration apertures such as:

```text
ProjectCentral/user
ProjectCentral/agents/governance
ProjectCentral/skills
ProjectCentral/methods
skills
.claude/skills
.agents/skills
.hermes/skills
AGENTS.md
CLAUDE.md
.aikit
```

A location is evidence of presence, not automatic source authority. ProjectCentral apertures retain Central ownership where the ProjectCentral contract is conformant. Other Skill/instruction locations remain native candidates retained in place and offered to the proper native owner. `.aikit` remains AIKit state and is never promoted to canonical Skill/Method source by location alone.

## Owner-native participation

Recognition can identify the encountered technology as a whole while O:I participation remains attached through native owners.

```text
Central
  authored Ground / machines / source / system connectors

Actuation
  realised Agency / Actuation / Stream readings

AIKit
  harness / environment / SessionSpace / Component / Surface adapters

Software Factory
  Commission / Journey / Run / evidence when adapter development needs durable continuity

Workcell
  material/provider bindings and public provider SDK

Quaternal Logic
  optional formal/reflexive readings through its native product field
```

The recognition account can preserve technology-native faculties which have no current O:I owner binding yet. That is useful setup knowledge and the starting evidence for extension work.

## Missing support is an executable extension path

When a recogniser can establish that an encountered technology/facet needs support, it can return an extension request carrying:

```text
native system ref
actual encountered version/source/faculties
owner product
reason
public SDK / contract
Agent/human authoring Skill
conformance operation
O:I package target
```

The intended execution is the already-authored #93 path:

```text
missing support
    ↓
owner SDK + authoring Skill
    ↓
human or authorised Agent implements/refines adapter
    ↓
native conformance
    ↓
O:I package/register
    ↓
rerun World recognition
    ↓
verify / explain the deeper mapped World
```

Current native routes include AIKit #114 for harness adapters, Workcell #23 for material providers and Central connector-authoring paths. Factory may carry the work as a Commission/Journey when persistent developmental continuity and evidence are useful.

The deterministic #173 fixture proves the important mechanical fact already: a conformant recognition package can be registered and the next reading of the same World gains the newly supplied technology observation. A separate unsupported-harness fixture returns the AIKit adapter SDK/Skill/conformance path.

## Herdr is the first rich whole-technology recogniser

`packages/examples/herdr-recognition.json` is the first embedded recognition package. It is source-locked to:

```text
herdrdev/herdr@facf0aafca011d147e798ad37e83799bdd29b75e
```

When `herdr` is present, O:I consumes its public native API:

```text
herdr api snapshot
herdr api schema --json     where supported by the installed revision
```

The recogniser accounts for the native environment rather than only the already-developed AIKit SessionSpace facet. Its reading can include the server/protocol and the native structural field exposed by snapshot/schema, including workspaces, tabs, panes, layouts, worktrees, processes, Agents, integrations, plugins and their surrounding automation/persistence/remote faculties where the native schema supplies them.

Native relations remain native:

```text
Herdr workspace contains native tab
Herdr tab contains native pane
Herdr Agent is observed in native pane
```

The same observation then carries the accepted AIKit owner binding:

```text
aikit.herdr-working-environment/v1
```

with provenance back to AIKit's accepted `crates/aikit-adapters/src/herdr.rs`. HerdR IDs do not become `SessionSpaceRef`, `SurfaceRef`, `AgentRef` or `AgentSessionRef` merely because the technology is recognised.

This gives setup one coherent account of HerdR as an encountered technology while the detailed O:I meanings remain with their native owners.

## Recognition and native command/application surfaces

#172 completes the six-product callable field:

```text
ctrl · actuation · aikit · factory · workcell · ql
        ↓
oi central|actuation|aikit|factory|workcell|ql
```

#173 consumes that field for owner capability/verification/extension work. The native CLI/application descriptor is the ordinary public route used by humans, Agents, setup, `oi` and the desktop; setup does not acquire a second semantic execution plane.

Where an owner publishes an extension faculty, the command/application surface should disclose enough to resolve the actual SDK, authoring Skill, conformance and install/register entry. The SDK semantics remain in the owner.

## Source and mutation law

Recognition observes and attributes; it does not make discovered native configuration into O:I source.

Preserve:

```text
native technology identity != recognition contribution identity
package identity != native contribution identity
existing source != generated projection
native config != O:I config
provider observation != canonical semantic identity
available integration != active integration
```

`oi adopt` remains non-mutating. `oi install` performs only its existing authorised native setup operations and records recognition before/after. Adapter creation or host/provider changes proceed through the relevant native public Actions/SDKs and their authority rules.

## QL relation

Ordinary World recognition and adoption require no QL provider. QL may subsequently read/reffract the same recognised and owner-bound field through its native operations where useful. A formal reading remains provenance-bearing derived return, not setup authority.

## #97 / physical return

The deterministic boundary proves the portable machinery before the physical candidate is frozen:

```text
recognition contract
package registration + verification
built-in + external recognition execution
adopt/install shared engine
Herdr source-locked recogniser
unsupported → owner extension request
register → rediscover proof
```

Accepted deterministic work belongs on native main before the #97 exact-main snapshot.

The physical #65/#97 campaign then supplies the actual returned World evidence:

```text
primary owner machine
  → recognise the real Mac/Central/O:I/harness/tool/service World

Omarchy reference machine
  → recognise Omarchy + Herdr + Hyprland + real plugins/harnesses/services

one genuinely new or changed target
  → owner SDK/Skill
  → authorised Agent/human authors/refines adapter
  → native conformance
  → package/register
  → rescan
  → richer mapped World
```

That verified adapter/refinement is then eligible for the ordinary SharedField/Explore contribution path and subsequent installations.