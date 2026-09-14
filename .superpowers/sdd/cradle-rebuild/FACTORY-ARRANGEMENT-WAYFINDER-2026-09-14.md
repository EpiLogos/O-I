# O:I Cradle — Factory Arrangement Wayfinder — 2026-09-14

**Standing:** owner-directed execution map for the existing Cradle programme.  
**Base:** O:I `main` at `c08f1e30976eee8af1c0e53642e507cf77d4cd64`.  
**Desktop owner:** O:I / Cradle.  
**Development owner:** Factory #195 and current native Factory contracts.  
**Agency/runtime owners:** Actuation + AIKit SessionSpace/AgentSession/composition.  
**Material owner:** Workcell.  
**Authored Agent ground:** Central.  
**Presentation transition substrate:** O:I Global Expression Stage / point-field expression layer.  

## 0. Purpose

Finish the missing experiential layer between the already-developed Factory semantic/read-model system and the Cradle as an inhabited working environment.

The target is not a new Factory application, a desktop-local Factory/session store, or a second orchestration system. It is a **Factory arrangement** of the existing Cradle: entering Factory recomposes the same live Project, Agent, AgentSession, SessionSpace, Run, Activity, Evidence and Surface relations around developmental work.

The human should be able to move from authored intent into one or many real Agents, watch their work without turning logs into the product language, enter the exact persisted working session carrying an execution, inspect what the work returned, and recognise/repair/continue it through native owner Actions.

The arrangement is a presentation/inhabitation state over canonical owner objects. It must be reconstructable from those objects after restart; layout persistence is not semantic ownership.

## 1. Governing relation

Ordinary Cradle remains valid:

```text
LEFT                  CENTRE                     RIGHT
World / Projects      authored work / Surface    accompanying Agent
                                                  Conversation
                                                  Activity
                                                  Context
                                                  Inspect
```

Factory arrangement becomes:

```text
                         FACTORY ACTIVITY HORIZON
             consequential live work / attention / return

LEFT                  CENTRE                     RIGHT
World / Projects      active Agent encounter     Return / Evidence
+ quiet work cues     or exact working Surface   Candidate / Artifact
across the World      (SessionSpace-resolved)    Diff / Preview / Inspect
```

Entering Factory does not create a Run, AgentSession or SessionSpace. Exiting Factory does not stop one. The arrangement changes what is foregrounded.

## 2. Ownership lock

Preserve the existing owner boundaries:

```text
Central
  authored Agent expressions / durable Agent ground / Project world

Actuation
  Agent / Agency / authority / Activity / Return actuality

AIKit
  expression/profile resolution where owned
  capabilities / praxis / harness composition
  AgentSession / SessionSpace / Surface resolution

Factory
  Commission / Journey / Run / RunMap / workflow unit / Execution
  Candidate / Claim / Evidence / developmental Return / Recognition

Workcell
  material environment / process / service / placement actuality

O:I Cradle
  arrangement, focus, disclosure, Surface hosting, point-field expression
```

Do not add desktop-local canonical truth for any owner object. Do not put tmux-specific business semantics into Factory or the desktop. tmux/Herdr/cmux/IDE/remote surfaces are provider realizations of SessionSpace/Surface relations.

## 3. Agent Expression is the authored entrance, not a new minting ontology

Recover and consume the current Agent Expression path already present in the suite. The intended relation is:

```text
human intent expression
    ↓
authored Agent expression / ground
    ↓
resolution into effective profile/body/praxis/capabilities
    ↓
Actuation actualisation
    ↓
AgentSession / SessionSpace
```

The Factory arrangement adds no alternate Agent creator.

The same expression path must be usable in three scopes:

```text
A. durable Agent creation
   "I want an agent oriented like this"

B. Factory commission/formation
   select existing and/or newly expressed Agents for developmental work

C. bounded subagent invocation
   use a task-local Agent expression as an explicit source for a delegated leg,
   retaining provenance to the parent Agency/Run and without silently promoting
   the temporary expression into durable authored Agent ground
```

Durable authored Agent creation and task-local subagent expression are therefore related but distinct transitions. Promotion from temporary/task-local expression to durable authored Agent ground requires the native authored-source acceptance path where current owners require it.

The UI should keep the expressive interaction lightweight — one sentence can be sufficient — while the actual resolution remains inspectable afterwards. Model/harness selection is not the primary authored identity.

## 4. Agent and team composition UX

Use the existing Agent/AgentSet/Agency relations rather than desktop classes such as ManagerBot/WorkerBot.

The Factory arrangement should support:

```text
express new Agent
select existing Agent(s)
combine them into a formation / AgentSet where current owner contracts permit
state the developmental concern / Commission
inspect effective resolution and authority
start or continue the real work
```

The interaction may feel like "minting" or assembling a constellation, but every node and relation must resolve to native owner identities.

Subagent creation from an active Agent/Run should reuse the same Agent Expression language. The parent can express a needed differentiated locus such as "review this from a Rust safety perspective"; the system resolves a bounded child Agent/Agency according to current owner law, with explicit scope, authority, return address and lifecycle. Do not create a second prompt-only subagent mechanism when a native expression/resolution path exists.

## 5. Factory activity horizon

The top activity horizon is the principal spatial disclosure of active developmental agency.

A lane is **not** a worker card and is not necessarily a percentage bar. It is a presentation over correlated owner refs, approximately:

```text
Project
  ↳ Journey / Run / workflow unit
      ↳ Execution
          ↳ Agency / Agent
              ↳ AgentSession
                  ↳ SessionSpace / Surface
```

Required lane states include, where owner evidence exists:

```text
working
waiting
permission / attention owed
blocked
returning
returned
failed
cancel requested / cancelled / quiesced where distinguishable
```

Never fabricate task percentage. If the owner exposes phases/spans/barriers or a meaningful bounded progression, the lane may express progression; otherwise use motion/state without a scalar completion claim.

Each lane retains enough stable correlation to answer:

```text
what developmental subject is this carrying?
who/what Agency is acting?
which AgentSession is carrying it?
where can I encounter its current working Surface?
what Activity / Return / Evidence belongs to it?
```

Direct and external work remains visible where useful but marked truthfully as Direct/external and must never acquire fabricated Factory ancestry.

## 6. Click-through to the exact persisted working world

Selecting an active lane should resolve through AIKit/SessionSpace public operations to the Surface currently carrying the work.

First proving provider: **tmux**, because persistence is obvious and materially testable.

Target behaviour:

```text
click active lane
→ resolve correlated AgentSession / SessionSpace
→ find/open/focus provider Surface
→ exact persisted tmux session appears in the Cradle
→ leaving that Surface does not stop the session
→ re-entry resolves the same session while it remains valid
```

The desktop must not issue provider-specific attach commands as Factory business logic. Provider-specific mechanics stay inside the current SessionSpace/provider implementation.

A second provider should later prove that the same Factory lane interaction works without changing Factory semantics.

## 7. Centre: encounter first, exact working Surface on demand

On entering Factory arrangement, the existing real Agent encounter should be promotable from the ordinary right region into the centre. Do not duplicate its transcript or observer.

The central region can then switch among correlated live Surfaces such as:

```text
Conversation / group encounter
terminal / tmux / Herdr / IDE Surface
preview / browser Surface
other owner-contributed working Surface
```

The transition is one focus/composition change over the same refs, not a migration of canonical state.

## 8. Right region: Return material

Factory arrangement liberates the right region for material returned by the selected work.

The region may host native/read-model Surfaces for:

```text
Candidate
Evidence / Claims
artifact / generated document
changed files / diff
preview
verification
contradictions / trade-offs
telemetry / cost / material observations where genuinely known
Return / Recognition state
Inspect / provenance
```

These are owner objects presented through the Cradle; the right region is not their store.

Substantial Return material should support the ordinary Cradle Surface grammar:

```text
open in right region
→ move to centre / split where supported
→ detach into a native window
→ redock
```

Recognition, return-for-repair, request-more-evidence and continuation invoke canonical Factory/native Actions. "Agent finished" never means "human recognised".

## 9. Left region: keep the World, add ambient work cues only

The Central/World navigator remains structurally the same.

Project/repo rows may disclose low-noise derived cues such as:

```text
active work present
number of consequential active loci
attention owed
returned work waiting
```

The left region must not become a duplicate trajectory dashboard. Detailed execution state belongs in the Factory horizon and selected surfaces.

## 10. Arrangement and point-field transition expression

The Global Expression Stage / point-field layer now owns whole-window presentation expression. Use it for the **felt transition** into and out of Factory arrangement without coupling application code to particle/physics parameters.

The application should emit semantic transition cues / named recipes equivalent to:

```text
factory.enter
factory.ready
factory.leave
factory.attention
factory.return
```

Exact recipe names may follow the current expression registry conventions after source inspection.

The point field may spatially disclose the recomposition — e.g. ordinary sidecar relation opening into a broader active field — but the visual expression is not semantic truth. Factory/SessionSpace/Activity owner state determines what is present; the expression layer only presents the transition.

Preserve the current law: application code names semantic expressions/targets; the stage owns their visual realization.

## 11. Existing Factory development surface disposition

The current `FactoryDevelopmentSurface` is valuable truthful depth but remains an operator/debug/inspection surface, not the final Factory entrance.

Preserve its native owner reads and honest refusals, but move normal Factory arrangement entry toward automatic current-Project/current-Run/current-SessionSpace resolution as owner contracts permit.

Manual developmental-state-path and explicit-ref entry may remain as advanced/debug depth until the owner publishes a better composed state locator. Do not invent one in O:I.

## 12. Minimal implementation sequence

### F0 — source reconciliation and contract lock

Inspect actual current mains and active PRs for O:I, Factory, AIKit, Actuation, Central and Workcell. Reconfirm:

- current Agent Expression source and durable-vs-ephemeral semantics;
- current subagent/delegation path and whether it can consume Agent Expression directly;
- current Factory public developmental read/Action contracts;
- current Activity correlations;
- current AgentSession/SessionSpace focus/open provider Actions;
- current tmux provider capability;
- current Cradle arrangement/layout/focus/detach APIs;
- current Expression Stage point-field cue/recipe APIs.

Write only the smallest missing shared contracts at their native owners.

### F1 — Factory arrangement shell

Add a restorable arrangement state to the existing Cradle composition layer:

- enter/leave Factory without destroying current surfaces;
- promote the existing Agent encounter into the centre;
- reserve right region for Return material;
- preserve/restore prior geometry/focus;
- emit semantic Expression Stage cues for the transition.

No live activity horizon yet beyond a fixture/read model needed to prove layout.

### F2 — live activity horizon

Build the correlated activity reading over current owner refs. Render lanes with honest state and no fabricated progress. Include Direct/external distinction.

### F3 — exact working-Surface entry

Click lane → resolve AgentSession/SessionSpace → focus/open exact provider Surface. Prove tmux persistence first, including provider unavailable/degraded behaviour.

### F4 — Return/evidence region + detach

Bind selected Run/Execution/Candidate/Return to right-region surfaces and extend ordinary detach/redock support to required Factory/artifact surface kinds. Invoke native recognition/repair/evidence Actions.

### F5 — Agent Expression + formations + subagents

Expose the existing intent-based Agent Expression path in Factory arrangement:

- create/use a durable Agent through native authored ground;
- select existing Agents;
- compose a native formation/AgentSet where supported;
- commission it;
- invoke one bounded subagent from an active Agent/Run through the same expression path;
- prove temporary vs durable expression standing and provenance.

### F6 — human/computer-use acceptance

Run the joined experiential walk in the installed app against real providers and capture exact refs/receipts plus screenshots at experiential gates.

## 13. Computer-use acceptance walk

A single coherent walk should cover the feature rather than independent screenshots.

1. Start in ordinary Cradle with a real Project and writing Surface; note exact layout/focus.
2. Have one existing persisted tmux-backed AgentSession available.
3. Enter Factory arrangement. Verify the shell recomposes through the Expression Stage without destroying the writing Surface or session.
4. Confirm the existing encounter is central; left World remains; Return rail is available.
5. Commission a small real Factory work item. Observe an activity lane from actual owner state.
6. Click the lane. The exact persisted tmux Surface opens/focuses. Prove session continuity from inside it.
7. Return to Conversation; work continues.
8. Start a second real locus on another Project/repo. Verify ambient cue in left World and distinct activity lane.
9. Run one unrelated Direct AgentSession and verify it appears, if presented, without Factory ancestry.
10. Create/express one new Agent from intent through the native Agent Expression path; inspect its resolved effective body.
11. Compose it with an existing Agent into a supported formation/team and commission real work.
12. From one active Agent/Run, invoke a bounded subagent using the same expression language; prove scope/parent/return provenance and temporary-vs-durable standing.
13. Trigger one real attention/permission state. Verify it is visually distinct from ordinary working and that authority is revalidated at the owner seam.
14. Let work Return. Open the actual Candidate/Evidence/artifact in the right rail.
15. Detach substantial Return material into a native window, inspect it, then redock.
16. Invoke a real repair/additional-evidence or Recognition Action and verify owner receipt/state change.
17. Make tmux/provider unavailable for one lane; verify truthful degradation and no fake terminal/session.
18. Request genuinely absent telemetry; verify absence remains absence.
19. Leave Factory arrangement. Verify prior writing geometry/focus is restored and work is not stopped.
20. Re-enter Factory. Verify active state reconstructs from native refs rather than desktop-local remembered Factory truth.

Evidence must distinguish deterministic/contract, provider, material and human-experience standing. Screenshots prove the encounter; exact refs/receipts prove that the encounter was connected to the owner reality it claimed to show.

## 14. Performance / optimisation hooks

This surface can become dense. Preserve the current optimisation programme while implementing it:

- activity horizon uses bounded/streaming updates rather than polling full histories;
- long trajectories stay lazy/virtualised;
- opening Factory does not eagerly load every artifact/result body;
- inactive Project cues aggregate cheaply from owner readings;
- point-field transition expression must not block interaction readiness;
- record model/token/cost/resource observations only where owners report them;
- include the Factory arrangement in full-scale optimisation measurement once the first real vertical is operative.

## 15. Non-goals

- no new Factory ontology;
- no desktop-owned Agent/session/run/activity store;
- no manager/worker Agent classes;
- no universal progress percentage;
- no tmux-specific Factory semantics;
- no second Agent minting/profile system;
- no prompt-only subagent mechanism if current Agent Expression/resolution can carry it;
- no model selector as primary Agent identity;
- no automatic Recognition on completion;
- no new giant desktop programme or shell rewrite;
- no visual particle state treated as semantic state.

## 16. Closure

This feature is complete when the installed Cradle can be entered as a genuine Factory working arrangement over current owner contracts: intent can become durable or bounded task-local Agent expression; one or many real Agents can carry Factory work; live activity is spatially legible; a lane opens the exact persisted working Surface through provider-neutral SessionSpace resolution; returned material is encounterable, detachable and actionable; Direct work stays distinct; and leaving/re-entering the arrangement preserves both human workspace continuity and native Agent/Run continuity.
