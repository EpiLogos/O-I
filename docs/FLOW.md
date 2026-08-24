# Flow — live linguistic source relation

**Status:** developed design relation · implementation tracked by [#137](https://github.com/EpiLogos/O-I/issues/137)  
**Authored ground:** [`docs/positions/FOUNDING-POSITIONS.md`](positions/FOUNDING-POSITIONS.md)  
**Living Wiki:** [#134](https://github.com/EpiLogos/O-I/issues/134)

## Why Flow exists

O:I treats agency as model capacity acting in relation with a World whose durable structures can become operative again in later acts. Human-authored language is one important part of that World: purpose, questions, judgements, distinctions and developing formulations can remain in ordinary source rather than being reconstructed from prompt history on every invocation.

**Flow** is the smallest general source form developed for the continuity of that living linguistic work.

> **A Flow is the continuity of one developing linguistic or conceptual thread whose retained language can become standing context for later acts when that Flow is deliberately active or bound.**

A Flow is normally an ordinary editable Markdown file. It can begin completely blank. The surrounding system supplies stable identity, revision, provenance, context and knowledge relations without requiring the person to write through a special schema.

This is a concrete Objective Internality relation:

```text
human / Agent articulation
        ↓
ordinary persistent Flow source
        ↓ authorised disclosure
operative context for a later act
        ↓
new articulation / encounter / returned difference
        ↓
revised Flow + wider knowledge return
        ↺
```

The file is physically external to the model. When deliberately disclosed into an act, its current language is part of the conditions from which that act proceeds.

## Core distinctions

Flow gains its meaning through its relations to existing O:I objects.

```text
FLOW
    continuity of a developing linguistic/conceptual thread

AGENTSESSION
    continuity of a particular conversational/execution relation

NOW
    moving temporal horizon in which current work is present

DAY
    dated closure/readback of what passed through that horizon

WIKIREADING
    attributable semantic/integrative knowledge maintained by the system

CLAIM
    addressable epistemic assertion whose evidence/standing matters

RUN
    durable developmental execution

GROUND
    durable authored meaning / authority
```

One Flow can survive several AgentSessions because conceptual continuity and acting-session continuity are different relations. One Flow can remain live across several DAY boundaries because conceptual continuity and civil-time closure are different relations. One DAY can contain several Flows. A Flow can cultivate propositions without every sentence becoming a Claim, and it can provide source/basis for Wiki knowledge without becoming the Agent Wiki.

These distinctions let the system connect the objects strongly without making one replace the others.

## General file convention

Flow is a semantic/source role rather than one universal directory path.

A first-party material convention is deliberately small:

```text
<owner-defined flow container>/
    YYYY-MM-DD-HHMM[-optional-title].md
```

The filename provides immediate temporal orientation for a person. Semantic identity belongs to a stable `FlowRef` or equivalent native owner identity rather than to the path alone. Renaming a Flow or adding a human title therefore need not manufacture a new thread.

No visible frontmatter is required merely to create a Flow. Native owner metadata may retain the minimum structured facts required for operation, such as:

```text
FlowRef
current SourceRef/path
created-at provenance
current revision
lifecycle / currentness where useful
optional title
scope / Project / world relation
privacy / authority relation
```

The ordinary file remains the human-facing source.

### Native placement follows the world

The same Flow role can inhabit different existing source arrangements.

A Project-local temporal implementation may use:

```text
ProjectCentral/now/flows/
    2026-08-23-2014.md
```

A research source house may later use:

```text
sources/<source-house>/notes/
    2026-08-23-2014.md
```

A protected Personal/Nara implementation may place the file in its own governed source field.

These are provider/domain placements of the same source relation. AIKit and O:I should consume stable source capabilities and refs rather than requiring every Flow to move into one path.

## Collaborative authorship and revision

A Flow may be written by a human, an Agent, or both over time. Its whole-file source role is therefore not automatically identical with durable human-authored Ground.

The owner should preserve truthful revision/change provenance sufficient to distinguish where genuinely known:

```text
human canonical edit
Agent / Agency / AgentSession edit
external edit with actor unknown
system-derived edit only where genuinely authorised
```

Source role and actor identity are independent facts. An externally edited Flow can remain a Flow while the actor for that revision is unknown.

Prefer revision/caller provenance over inserting speaker labels into the prose. Exact span authorship should only be claimed when the underlying source/revision system can actually preserve it.

Agent edits are real source mutations and therefore use the native owner's revision-aware write path:

```text
FlowRef @ revision N
        ↓ authorised edit expecting N
current still N
        ↓
FlowRef @ revision N+1

current moved
        ↓
explicit conflict / re-read / reconcile
```

A stale Agent act must not silently overwrite a newer human revision.

## Current Flow and history

The current Flow is the operative linguistic field. It should be free to become clearer as understanding develops.

Language can be revised, condensed or removed when it no longer contributes. Exact history belongs in source revisions, change receipts, Git or equivalent native history, and DAY snapshots where those owners provide it.

```text
current Flow
    clean current linguistic field

revision / ChangeHorizon / DAY history
    attributable prior states and returned difference
```

This matters because retained language can influence later cognition. Historical sediment does not need to remain in the active file merely to preserve provenance elsewhere.

## Flow and situated agency

For an explicitly Flow-bound act, the current authorised Flow revision can become distinguished standing context.

```text
FlowRef @ current revision
        ↓
AIKit ContextResolution
        +
smallest sufficient Ground / Wiki / Claims / Sources / Praxis
        ↓
Agent / Agency / AgentSession
```

The exact Flow revision disclosed to the act should remain attributable in its invocation/return provenance.

This relation does not weaken O:I's disclosure ladder:

```text
available != retrieved != loaded != disclosed
```

A Flow being present on disk does not place it in every prompt. The stronger cognitive law applies when the person or authorised system has made that Flow the active thread for the act.

A fresh AgentSession can therefore attach to an existing Flow and enter through the current thread instead of reconstructing conceptual continuity from a provider transcript. AgentSession remains the acting/conversational instance; Flow remains the linguistic thread.

## Flow and Living Knowledge

Flow gives the Living Wiki programme a human-facing foreground object.

```text
Flow / related source changes
        ↓
Source Change Horizon
        ↓
knowledge impact / reading freshness
        ↓
current Flow remains usable
        ↓ explicit intent
Contemplate(FlowRef)
        ↓
bounded whole + Ground + changes + Claims/Evidence + relations
        ↓
Agent reasoning
        ↓
revised Flow + Agent-Wiki / WikiReading return
        ↓
proposal only where durable human Ground is implicated
```

No model invocation occurs merely because a Flow or related source changed.

The system can instead make a useful distinction available to the human: *what changed that matters to what I am currently thinking through?*

`Contemplate(FlowRef)` is the intentional potentially-expensive operation that can integrate that returned difference.

## Flow and Claims

Flow is a Claim-development medium rather than a Claim database.

A proposition may begin as ordinary language, become clearer through dialogue and source encounter, and later become consequential enough to receive a canonical Claim identity.

Where the Factory/cross-system contract supports it, the relation can retain an external source anchor such as:

```text
FlowRef + Flow revision + bounded source anchor
        ↕
ClaimRef
        ↕
Evidence / Assessment
```

Changing the Flow passage changes its linguistic/source basis. It does not automatically determine the Claim's truth, confidence, standing or verification.

Factory remains the owner of Claim/Evidence/Assessment semantics.

## Flow, NOW and DAY

Flow and temporal closure compose cleanly:

```text
Flow
    continuity of the conceptual thread

NOW
    current moving working horizon

DAY
    dated account/snapshot of what passed through that horizon
```

Several Flows can be live in one NOW. One Flow can continue tomorrow. DAY can snapshot the exact Flow revision present at close without creating a new Flow identity simply because the date changed.

A deterministic DAY reading can report which Flows began, continued or closed. Any model-backed daily synthesis remains an explicit Agent act rather than an automatic midnight invocation.

## Flow and the desktop

The O:I workbench can make Flow the simplest default entry form for open-ended live thought:

```text
new thought
    → new blank Flow
    → Canvas
    → attach/create AgentSession

continue thought
    → reopen existing Flow
    → Canvas
    → attach/resume/new AgentSession
```

Ordinary source and code files remain direct Canvas objects. Flow is not a wrapper around every file.

The same FlowRef should be able to co-refer across:

```text
Navigator / NOW
Canvas editor
Agency sidecar / AgentSession
Inspector
Ground / Knowledge
Claims / Sources
Changed / Affected
History / Explain
Contemplate
```

The sophistication surrounds the ordinary act of writing rather than becoming a ceremony the person must enter first.

## Praxis

AIKit's accepted praxis grammar gives Flow a small positive behavioural layer:

```text
Guidance
→ Skill
→ UsageOverlay
→ Method
→ SkillSet
→ ContextResolution
```

The standing Guidance is simple: language retained in a Flow may condition later cognition, so intervention into that language is consequential. Preserve the person's authorship and Project meaning, contribute what is useful, ground source-bearing assertions, revise prior Agent articulation when understanding improves, and keep the current field worth re-entering.

A reusable Flow Skill can supply the file/revision/provenance practice. A situated Flow Method can compose that Skill with Knowledge Navigation, Project/domain praxis, Claims/Evidence and optional QL/MEF refraction.

## Personal / Epi relation

The generic Flow relation gives the current Personal 4/5/0 work a reusable substrate:

```text
M4′ Nara
    protected/lived specialised Flow in Canvas

M5′ Epii
    canonical Agent through the Agency sidecar / AgentSession

M0′ Anuttara / Bimba
    source-ground through Navigator / Knowledge
```

Epi owns the Personal/Nara meaning, privacy and domain Actions. It does not need to own the generic Flow mechanism.

This M4 application reading is distinct from the Living Wiki's optional `5→0→1` entry-aperture research proposition. Each belongs to its own established relation/context.

## Ownership

```text
Central
    Flow source identity/material convention
    revision/write/conflict/provenance
    Project NOW/DAY lifecycle
    Source Change Horizon participation

AIKit
    Flow source/provider consumption
    Flow ↔ AgentSession/context binding
    Flow praxis
    knowledge impact/freshness
    Contemplate(FlowRef)

O:I desktop
    Canvas/Navigator/sidecar composition
    Flow-first human experience

Software Factory
    Claim/Evidence/Assessment and developmental refs
    only extended if an actual owner-contract gap is returned

Quaternal Logic
    optional formal/refraction methods through existing provider contracts
    no new Flow primitive

Epi / domain products
    specialised Flow meanings, privacy and source placement
```

Actuation and Workcell receive no new Flow semantics merely for product symmetry. Existing Agency and material-world mechanisms participate where the concrete act requires them.

## Current development

As of 23 August 2026 the design is being materialised through:

- O:I [#137](https://github.com/EpiLogos/O-I/issues/137) — suite Flow relation;
- Central [#93](https://github.com/EpiLogos/Central/issues/93) — Flow source identity + NOW/DAY lifecycle;
- AIKit [#122](https://github.com/EpiLogos/ai-kit/issues/122) — standing context, praxis and `Contemplate(FlowRef)`;
- O:I [#138](https://github.com/EpiLogos/O-I/issues/138) — Flow-first desktop experience;
- Return of Zero [#35](https://github.com/EpiLogos/Antykathera-Essay-Work/issues/35) — deferred source-house `notes/<timestamp>.md` proving case.

The current Central NOW/DAY and Source Change Horizon implementations are inputs to this work; they are not redefined by this document. Implementation and accepted evidence remain the authority for what works now.
