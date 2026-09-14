# Factory Arrangement ↔ Ta-Onta / Agency Composition Amendment — 2026-09-14

**Status:** authoritative amendment to `FACTORY-ARRANGEMENT-WAYFINDER-2026-09-14.md` for O:I #289. Read both; where this file refines F0/F1/F4/F5/F6, this later returned-reality amendment governs.  
**Planning cut:** O:I `main` `75c59be94926ca5597a2b0c538f3a789ddc09c3c` after #288 and #287.  
**Cross-field inputs:** QL-MEF #42/#47/#74/#94/#133/#134/#135; QL-MEF PRs #188/#189; O:I PR #286.  
**Purpose:** make the Factory arrangement the second real consumer of a reusable O:I desktop composition/inhabitation seam, so the same foundation can later host Ta-Onta operative formations without collapsing Factory, Anima, Aletheia, AgentSet, Agency or presentation into one object.

## 1. Returned reality that changes the Factory plan

The original Factory Wayfinder correctly treated Factory as an arrangement rather than a new application, but it still described F1 as if Factory might be the first owner of that arrangement mechanism.

O:I PR #286 has now made the first concrete privileged composition:

```text
active instrument SurfaceBinding
    ↓
FocusedInstrumentComposition
    ├─ portal source-qualified Bimba navigation into the existing left host
    ├─ portal the focused Epi/Nara instrument into the existing centre host
    └─ leave the canonical right AgentLayer mounted by Cradle

leave instrument binding
    ↓
remove portals
    ↓
ordinary desktop is revealed unchanged
```

That is an implementation fact of the active K9 branch, not yet a merged general contract. It nevertheless gives #289 the correct integration direction: **Factory should become the second consumer of the same host/composition grammar, not create a parallel `FactoryMode` controller.**

A second returned fact also matters. O:I #287 merged after #286's base and replaced the old Cradle point-cloud host with the native Expressions engine *behind the existing Global Expression Stage*. The Stage contract remains the presentation aperture. Therefore #286 must reconcile its renderer-facing implementation to current main, and #289 must consume the current Stage/engine surface rather than copying #286's pre-#287 `ParticleField` / point-cloud-host mechanics.

## 2. The reusable thing is arrangement/composition, not a new semantic ontology

The common host-level relation is approximately:

```text
canonical owner state + SurfaceBindings + current shell regions
    ↓
selected inhabitation / arrangement
    ↓
which existing Surfaces are foregrounded in which existing hosts
    + which ordinary regions remain present
    + which semantic presentation cues/targets are emitted
    ↓
restorable ordinary shell
```

Call this an **arrangement** or **composition policy** in design language. Do not mint a new durable canonical `Arrangement` domain object merely because two UIs share geometry. Persist only the minimum presentation/focus binding that the desktop genuinely owns; reconstruct semantic content from native refs.

Generalisation must be earned by the two real consumers:

1. Epi/Nara focused instrument from #286;
2. Factory arrangement from #289.

Extract only the smallest shared host primitive demonstrated by both. Do not pause Factory to design a universal mode framework in advance.

## 3. Sibling compositions over one shell

The intended relation is now:

```text
ordinary Cradle
    │
    ├─ Epi/Nara focused arrangement
    │    left   = Bimba/source field
    │    centre = focused living instrument
    │    right  = canonical Epii AgentSession
    │
    ├─ Factory arrangement
    │    top    = live developmental activity horizon
    │    left   = World/Projects + ambient work cues
    │    centre = encounter or exact working Surface
    │    right  = attributable Return/Evidence material
    │
    └─ later operative arrangements
         composed from the same native Surface/Agent/Agency/SessionSpace field
```

Switching arrangement does not create a new Project, Agent, Agency, AgentSession, SessionSpace, Run, Nara event or Ta-Onta identity. It changes the experienced composition of the same authorised world.

The Global Expression Stage can make those transitions perceptible, but visual state remains presentation rather than semantic truth.

## 4. Ta-Onta relation: foundation, not identity collapse

QL-MEF's accepted fourfold remains load-bearing:

```text
M4 Nara  ↔ S4 Workcell ↔ S4′ Anima     → M4′
M5 Epii  ↔ S5 QL-MEF  ↔ S5′ Aletheia  → M5′
```

QL-MEF #42/#74 also preserve the distinction:

```text
canonical Guardian Agent
    !=
Ta-Onta operative form
    !=
AgentSet
    !=
situated Agency
    !=
Execution
```

The new desktop/Factory foundation should make those distinctions *operable together*.

### 4.1 Anima

Anima is the operative animation/dispatch/situated-agency form. In a concrete occasion it may be carried by:

```text
one selected Agent
or an authored AgentSet
or a temporary multi-Agent formation
or invocation-scoped differentiated subagents
        ↓
situated Agency / authority / Context / praxis
        ↓
AgentSession / SessionSpace / Workcell material body
```

That carrier can feel like an Anima "set" or constellation in the system, and the UI should support that naturally. But the set is a native carrier of the Anima operation; it is not the complete semantic identity of Anima.

The intent-expression work in #289 is therefore foundational for Anima: the same expressive grammar can select/create durable Agents and differentiate bounded task-local loci, then compose them into native formations with exact scope, return address and lifecycle.

### 4.2 Aletheia

Aletheia is the operative disclosure/crystallisation/truth-return/evidence-handoff form. In a concrete occasion it may be carried by one or more attributable Agencies, reviewers/interpreters, evidence-producing operations and human/guardian Recognition relations.

Factory's Return/Evidence rail is a **developmental manifestation** of this larger relation when the occasion is a Factory Commission/Run. It is not Aletheia's universal store or runtime.

Preserve:

```text
Activity / provider result / evidence
    ↓
provenance-bearing Return / interpretation / candidate disclosure
    ↓
Aletheia operative disclosure where applicable
    ↓
guardian / human / native-owner Recognition or refusal
```

Direct and non-developmental Ta-Onta acts can pass through Anima → Aletheia without manufacturing a Factory Run.

## 5. Shared execution relation for future Anima/Aletheia formations

The reusable system foundation should support this whole path without a parallel runtime:

```text
source / human intent / operative concern
    ↓
Agent Expression or invocation-scoped intent expression
    ↓
Agent / AgentSet / temporary formation
    ↓
Actuation Agency + authority
    ↓
AIKit Context / praxis / body / AgentSession / SessionSpace
    ↓
Factory Run only when the work is developmental/commissioned
    ↓
Workcell material actuality
    ↓
Activity / output / evidence / Return
    ↓
Aletheia disclosure / proposal / interpretation where applicable
    ↓
Recognition / repair / re-entry
```

Factory contributes developmental meaning and orchestration only where that relation is actually present. O:I contributes arrangement/presentation only. Neither owns Ta-Onta semantics.

## 6. Consequences for #289 implementation sequence

### F0 — add the live K9/Stage reconciliation

In addition to the existing F0 list:

- inspect O:I PR #286 and its exact current conflict/rebase state before touching shell composition;
- inspect current main after #287; treat the Global Expression Stage + native Expressions engine as the renderer/presentation owner;
- identify which parts of #286 are genuinely generic host composition (`SurfaceBinding` activation, region portals/focus/restoration) and which are K9 domain-specific (Bimba source, focused-instrument snapshot/commands, retained QL state);
- consume generic shape only. Do not copy K9 domain adapters into Factory.

### F1 — second consumer, then smallest shared arrangement seam

Replace the old "add a Factory arrangement state" reading with:

1. continue/consume the current shell composition mechanism demonstrated by #286;
2. make Factory the second real privileged composition over the same shell;
3. factor the smallest reusable host primitive only where Epi/Nara and Factory demonstrably share it;
4. preserve entry/exit restoration and existing surfaces for both;
5. route transition expression through the current Global Expression Stage / native Expressions engine.

Avoid both extremes:

```text
BAD: bespoke EpiMode + bespoke FactoryMode + later bespoke AnimaMode
BAD: giant universal arrangement framework before the second consumer works
GOOD: two concrete compositions → extract the proven common host seam
```

### F2 — activity horizon must retain formation standing

Where available, a Factory lane should retain attributable relations not only to an Agent but to the acting formation:

```text
Agent / AgentSet source where present
situated Agency
parent/child/delegation relation
AgentSession / SessionSpace
Factory Execution / workflow-unit relation
```

Do not present every formation as a durable AgentSet. Temporary participants, invocation-scoped subagents and authored sets keep distinct standing.

### F4 — Return rail as a reusable host for attributable returned material

Implement Factory-specific Candidate/Evidence/Recognition bindings, but keep the shell-side right-region hosting primitive generic enough to host other owner-returned material later.

Do not generalise Factory `Candidate`, `Claim`, `Evidence` or `Recognition` into O:I or Aletheia types. The reusable part is the ability to foreground attributable returned Surfaces and invoke their native Actions.

### F5 — expression and formation vertical is now a first-class foundation

F5 must prove all of:

```text
express/propose durable Agent
select existing Agent(s)
compose/use authored AgentSet where appropriate
create bounded invocation-scoped differentiated child
carry temporary formation without false durable authorship
Keep as Agent → Central proposal/Recognition path
one/many Agents → situated Agency → real SessionSpace/work
attributable Return to the correct parent/formation
```

Implement this generically enough that QL/Ta-Onta can later ask for an Anima/Aletheia operative formation through the same native relations, without Factory-specific Agent classes.

### F6 — add composition parity to the joined walk

When #286/current successor is available on the execution base, extend acceptance with:

```text
ordinary shell
→ enter Epi/Nara focused arrangement
→ leave; ordinary work survives
→ enter Factory arrangement
→ open exact persisted AgentSession/SessionSpace
→ leave; work survives
→ re-enter Epi/Nara or ordinary work
```

Prove that arrangement switching changes presentation/focus only and preserves canonical owner refs. If #286 is still unmerged/conflicted, do not block the first Factory vertical; record the cross-arrangement parity case for the first common-base integration cut.

## 7. Consequences for current QL-MEF parallel lanes

### #133 / K9 + O:I #286

K9 is the **first concrete privileged composition** and should remain domain-specific. Do not make K9 itself own a universal arrangement framework.

After #286 is reconciled to current O:I main/#287, expose/retain only the narrow host-facing facts #289 needs: active SurfaceBinding, region placement/portal relation, clean withdrawal/restoration, exact AgentSession/source refs. Factory consumes the same O:I seam; it does not import the focused-instrument source contract.

### #134 / K10 Nara

Keep the current `ql.nara-expression-projection/v1` boundary: stable semantic/source/host refs and cues without raw protected Personal bodies. A Factory/Anima arrangement may reference a protected Nara only through current authority and disclosure; arrangement activation grants no new access.

### #94 / AW2–AW3 / #191 closure

Do not reopen repository-native Ta-Onta implementation merely because the desktop foundation is clearer. AW2's C′/Oikonomia execution and AW3's T/T′/Aletheia return semantics remain owner evidence.

The new relation is downstream composition:

```text
accepted C′ / Anima operative contracts
+ native Factory/AIKit/Actuation/Workcell owners
+ #289 expression/formation/SessionSpace arrangement
    ↓
inhabitable multi-Agent occasion in the installed system
```

Repository-native #94 closure does not wait on #289 human/desktop acceptance.

### #47 inhabitation contract

The existing `disclose → receive → recompose → query` pattern remains a semantic/provider contract. The arrangement substrate supplies an inhabitable human/Agent composition in which those seams can be encountered; it does not replace the contract.

### #42 / #74 guardian law

Use canonical guardians as enduring identities and native AgentSets/Agencies as formations. Anima/Aletheia operative formations may include guardians, labouring Agents or bounded children as authorised by the occasion; do not mint `agent:anima` / `agent:aletheia` merely because the operation is named Anima/Aletheia unless authored source independently establishes those Agents.

### #135 local whole-system integration

The later owner-machine harmonisation should now include **arrangement parity** as an integration concern alongside sensory/renderer/provider parity: Epi/Nara focused composition, Factory developmental composition and future Ta-Onta operative formations must inhabit one current shell/Stage/SessionSpace ecology without duplicate state authorities.

## 8. Point-field / Expressions relation

#287 changes the implementation fact but strengthens the original architectural law:

```text
semantic owner state
    ↓
O:I arrangement cue / target / named presentation
    ↓
Global Expression Stage
    ↓
native Expressions engine
```

Factory, Epi/Nara, Anima or Aletheia application code must not reach around the Stage to manipulate engine physics as semantic state.

Expressions can distinguish entry, gathering, differentiation, attention, convergence and Return as authored presentation material. The warrant for those expressions comes from the native owner state/Activity/Return, not from the visual field itself.

## 9. Non-goals added by this amendment

- no `AnimaMode` or `AletheiaMode` as substitute for their QL/Ta-Onta semantics;
- no equation `Anima = AgentSet` or `Aletheia = reviewer set`;
- no requirement that every Ta-Onta act become a Factory Run;
- no O:I-owned Agent formation ontology;
- no universal arrangement framework before two concrete compositions demonstrate the common seam;
- no reuse of #286's QL-specific source/state adapters inside Factory;
- no reuse of #286's pre-#287 renderer internals after current Stage/engine ownership changed;
- no arrangement activation granting authority or protected Personal disclosure.

## 10. Revised closure relation

#289 closes only when Factory is a genuine second inhabitation of the current O:I shell, not an isolated desktop feature:

```text
Agent Expression / formation
→ real Agency / AgentSession / SessionSpace
→ commissioned Factory work where applicable
→ exact live working Surface
→ attributable Return / evidence / Recognition
→ ordinary shell continuity
```

and the implementation leaves a small proven composition seam that the current Epi/Nara arrangement and future Anima/Aletheia operative formations can share without semantic collapse.
