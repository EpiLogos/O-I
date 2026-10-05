# Expression World Substrate → Epi Paradigm Wayfinder

**Standing:** owner-directed architecture and development lock, 15 September 2026.  
**Programme relation:** extends O:I #306 Expression Field, #18 Explore/SharedField, #289 Factory/Agency, #65 lived experience, Personal Web #279 and the current desktop UI convergence; consumed by QL-MEF #135 and the Ta-Onta / M / M′ line.  
**Purpose:** distinguish and build the **general machinery beneath the paradigm** from the **Epi-Logos paradigm which inhabits that machinery**, then reconnect them deliberately. This is not another product, renderer, graph store, document system or acceptance campaign.

---

## 0. Why this clarification exists

The Expression Field work established the correct material direction: a native world, source, Wiki subject, Agent, M-coordinate or Nara state can become a living Expression while its canonical identity and authority remain with its real owner. The later SharedField work established that such presentations can cross between independently grounded worlds without moving source truth into the hosted transport.

The next development cut must separate two levels which have often appeared together in the Epi work:

1. **the substrate required for any O:I world to become expressible and inhabitable**; and
2. **the Epi-Logos paradigm which uses that substrate to articulate Bimba, M/M′, Ta-Onta, Nara and Epii.**

This distinction is load-bearing.

Ordinary O:I must remain able to open a text file, project a Wiki neighbourhood, place a page beside a live visual field, converse with an Agent, detach a Surface, publish a WorldPresentation and return a Contribution **without QL-MEF being installed or understood**.

Conversely, QL-MEF must be able to say much more than “render these particles”. It needs an exact domain SDK/API through which a Bimba coordinate, its M/M′ determinations, its source standing, the Ta-Onta agent-world, Nara and Epii can inhabit the same general Expression machinery without rebuilding that machinery inside QL.

The relation is therefore:

```text
GENERAL / PARADIGM-NEUTRAL SUBSTRATE

Central       source · World · revisions · Day/NOW · authored ground
Actuation     Agent · Agency · authority · Activity · Return
AIKit         knowledge · context · capabilities · Skills · Sessions · Surfaces
Factory       development · Journey/Run · evidence · Candidate · Recognition
Workcell      material runtime · placement · service actuality
O:I           Surface host · Expression · WorldPresentation · SharedField
                          │
                          │ stable refs / Readings / Actions / Surfaces
                          ↓
                  EXPRESSION-WORLD SUBSTRATE
                          │
                          │ domain profile / SDK / bindings
                          ↓
EPI PARADIGM

QL-MEF / Bimba / M / M′ / Vāk
Ta-Onta S′ agent-world
Nara dialogical presence
Epii depth / enrichment / development
```

The substrate is not “pre-paradigmatic reality”. It is technological machinery with its own explicit abstractions, contracts and provenance. The distinction is narrower and practical: **the substrate must not presuppose the Epi interpretation which will later operate through it.**

Likewise, the paradigm is not a theme painted over generic software. It supplies real semantics, forms, operations, profiles, source relations, Agents and developmental laws through the native extension surface.

The desired architecture makes this relation visible instead of collapsing either side into the other.

---

# I — THE PARADIGM-NEUTRAL EXPRESSION WORLD

## 1. The Expression is a world object, not only a particle document

`oi.expression/v1` already establishes a revisioned document/application state with scenes, entities, subject bindings, representations, provenance, selection, parameter state and structured human/Agent operations.

The next substrate increment should generalise the lived object around that document without changing its ownership law.

An Expression has two conjugate human-facing aspects:

```text
FRONT
    the living expressive body
    particles · forms · images · glyphs · text · geometry · motion · sound relations
    scene · focus · material state · transitions

VERSO / BACK
    the structured object-world from which this presentation can be understood and acted upon
    page · source · Wiki reading · files · provenance · relations · Actions
    notes / explanation / captures / related Beings and Things where admitted
```

These are **not two canonical documents**.

They are two presentations over the same Expression identity and its bound native subjects.

`front ↔ verso` is therefore a Surface/presentation relation, not a storage duplication.

The front can be extremely simple: one glyph, one sentence, one image or a blank field. It can also be an authored sequence with many scenes and live bindings.

The verso can likewise be minimal: perhaps only source and provenance. Or it can be a rich WorldPresentation containing an essay, Wiki reading, files, Methods, related subjects and Actions.

The person should be able to move between these without leaving the Expression's identity or losing selection, scene, subject or history.

### 1.1 The current Library becomes a view, not the ontology

The current Expressions Library remains useful as a human collection/gallery surface. It should not become the only canonical home of Expression identity.

Expressions are addressable Things in the wider O:I world. They may be:

- found through Wiki/Knowledge;
- linked from files and pages;
- embedded in WorldPresentations;
- collected in Personal Web galleries;
- published to Explore;
- linked to Projects, Agents, Runs or contributions;
- referred to from another Expression;
- indexed by source/subject/profile/coordinate.

The Library therefore becomes one **collection/index reading over Expression refs**, alongside search, Wiki, Personal Web, collections and SharedField.

No migration needs to destroy the existing Library UI. The change is semantic: the Library ceases to be the world boundary around Expressions.

---

## 2. Expression Profile: reusable expressive grammar, not semantic truth

The current point-cloud engine already supports shapes, entities, materials, physics, colour, automation, scenes, toolbelts and source-state workflows.

Promote the reusable portion into a paradigm-neutral **Expression Profile** contract.

An Expression Profile says how a class of subject *may be materially expressed*. It does not determine what the subject means.

Representative shape:

```text
ExpressionProfile {
    profile_ref
    revision
    lineage / parent_profile_refs[]

    material_defaults
    formation / shape vocabulary
    glyph / image / text target rules
    physics defaults
    colour / material defaults
    transition families
    automation defaults
    scene seeds / scene roles
    camera / framing defaults where authored

    accepted binding kinds
    accepted Surface/portal kinds
    permitted parameter domains
    fallback representation policy
    provenance
}
```

Profiles can be very small. A plain editorial text profile need not load the whole physical vocabulary. A highly dynamic visual profile may carry deep physics and transition defaults.

The important distinction is:

```text
profile = presentation grammar
subject Reading = meaning / current native truth
Expression = instantiated presentation over that truth
```

Later, the Epi domain can define `M2`, `M4.1`, `oracle`, `Bimba coordinate`, `essay`, etc. profiles **without changing the generic profile contract**.

---

## 3. Native content projection into Expressions

The missing generic capability is not another renderer. It is a family of adapters from already-owned objects into **Expression-addressable presentation bindings**.

An Expression entity should be able to bind a real subject and optionally a real Surface/presentation capability:

```text
ExpressionEntityBinding {
    expression_entity_ref
    subject_ref
    subject_revision / Reading refs
    presentation_role: Being | Thing | neutral

    visual_target?           # glyph/image/form/text target for the field
    surface_ref?             # actual richer Surface which can be summoned
    world_presentation_ref?  # page/body reading where present
    source_ref?
    provenance[]
    relation_bindings[]
    disclosed_action_refs[]
}
```

The foundational adapters should cover the ordinary O:I world before any Epi-specific binding is required.

### 3.1 Text and Markdown

A text/Markdown source can participate in several ways without becoming a second file:

- a selected span or heading sampled into a glyph/text target;
- an entity representing the document as a Thing;
- an inline readable excerpt where the current scene calls for one;
- a portal to the real editor/source Surface;
- a full verso/page reading of the same source;
- source-bearing links from another entity.

The authoritative bytes remain Central/native source.

Expression save never silently saves source content unless the person explicitly invokes the source owner Action.

### 3.2 Glyph / symbol / SVG / generated form

A glyph or symbol can be a direct target with exact source/identity metadata. QL is not required for the generic carrier.

Later QL glyph identity and Vāk standing may specialise that carrier through refs/provenance.

### 3.3 Image / media

Images and media retain source/asset identity. The Expression engine may sample or materialise them, but the sampled particle state is not the asset's identity.

Video/audio inclusion follows the host/media lifecycle and permission model; the Expression engine does not invent a second media library.

### 3.4 HTML / page / WorldPresentation

A WorldPresentation or admitted HTML body may be represented as:

- a link/Thing in the field;
- a preview/card;
- an inline contained Surface where lifecycle and performance permit;
- the Expression's verso/back;
- a summoned overlay/split;
- a full/native detached Surface.

The same page ref/revision survives every placement.

### 3.5 Wiki / Knowledge

The landed EX3/SF2 bounded-local-whole projection remains the knowledge path.

The generic law is:

```text
native bounded local whole
    → stable Expression entities + relation presentation bindings
    → living field
```

No QL constellation is required for correctness. A QL layout/profile may later organise the same refs.

### 3.6 Generic files and unsupported formats

Every file does not need a bespoke Expression renderer.

A generic file can still appear as a bound Thing with:

- stable source/file ref;
- type and revision;
- appropriate icon/glyph/thumbnail if available;
- native open Action;
- safe preview where a renderer exists;
- explicit unavailable/degraded state otherwise.

This means the Expression world can hold links to the actual technological world without flattening that world into one visual engine.

---

## 4. Reciprocal embedding: page contains Expression; Expression contains page/file/Surface

EX5 and WorldPresentation already establish one direction:

```text
WorldPresentation
    → Expression binding
    → live renderer or explicit fallback
```

The substrate now needs the reciprocal relation:

```text
Expression
    → bound subject / Surface / WorldPresentation
    → inline preview / portal / verso / split / pop-out
```

These are **not recursive document ownership rules**. They are placements of existing objects.

### 4.1 Required anti-recursion law

A page containing Expression A may itself be linked or summoned from Expression A's verso, but the host must not recursively instantiate unlimited active copies.

Define bounded embedding behaviour:

- identity recursion is allowed and visible;
- active renderer recursion is depth/budget bounded;
- same-expression same-host embedding resolves to a link/portal rather than another live engine instance;
- hidden/offscreen contained renderers suspend/release resources;
- promotion/focus moves or reuses the existing live host where possible rather than cloning it.

### 4.2 Pop-out is the existing O:I Surface/window grammar

The point-cloud engine does not own operating-system windows.

Selecting a bound source/page/file/graph/Agent should be able to request:

```text
preview
open overlay
open beside
open full
open detached
pin
return / re-dock
```

through the current O:I Surface host.

The canonical ref remains the same through all placements.

This is important for the final lived experience: the person can be inside an Expression and call up the actual source, actual Wiki page, actual file or actual Agent without the Expression turning into a menu that navigates them away from the world.

---

## 5. The verso/back is a composition, not a universal inspector

Do not make the back of every Expression a fixed database-property panel.

The verso is itself a **WorldPresentation/Surface composition** over the Expression and its bound subjects.

A simple Expression might have:

```text
Back
  source
  provenance
  open file
```

A research Expression might have:

```text
Back
  authored explanation
  claims / evidence
  sources
  Wiki neighbourhood
  related people / works
  current Methods
  Actions
```

A Nara Expression might have a deliberately private verso containing permitted personal/contextual readings and separate outward/public forms.

The back therefore has the same source and audience discipline as every other presentation.

It should be authorable.

It can be sparse.

It can be styled.

It can be projected differently for different audiences.

---

## 6. Epi-Card becomes legible as a specialised two-sided Expression edition

The existing Epi-Card intent should be preserved, not collapsed into a generic card widget.

The new substrate explains its proper office.

The Card is a **compressed, curated, portable Expression / WorldPresentation edition**:

```text
EPI-CARD

Front
    art-directed concentrated Expression
    symbol · image · typography · motion · sound / capture

Back / reverse / deep reading
    structured explanation
    paired / nested depth
    sources and audit
    exact subjects / relations
    Return / breadcrumb

Edition
    expression/profile refs
    source revisions
    assets
    live renderer eligibility
    frozen/captured fallback
    digest / QR / publication identity
```

This preserves the Personal Web requirement that the reverse/deep reading be as usable as the front and that the Card retain exact source/audit/edition identity.

It also removes pressure to make “Card” the universal content model.

The general substrate should introduce a portable **Expression Edition** relation; Epi-Card becomes one highly authored Epi-specific profile of that relation.

Representative generic edition envelope:

```text
ExpressionEdition {
    edition_ref
    expression_ref + revision
    profile_ref + revision
    subject_refs[]
    front_representation
    verso_presentation_ref?
    captures / fallbacks
    admitted assets
    provenance
    publication / integrity metadata
}
```

A full private portable edition and an audience-filtered Projection remain different operations.

---

# II — THE EPI PARADIGM OVER THE SUBSTRATE

## 7. Ta-Onta is the Epi agent-world SDK/API into the Expression system

The generic O:I Expression application API remains the substrate contract.

**Ta-Onta is the Epi-specific SDK/API and agent-world composition which teaches native Agents how Bimba, M/M′, Vāk, Nara and Epii participate in that generic world.**

It should not own:

- the renderer;
- the generic Expression document;
- the O:I Surface/window system;
- Central files;
- AIKit's generic knowledge/capability resolution;
- Actuation's generic authority loop;
- Factory's generic developmental model;
- SharedField transport.

It should provide the Epi semantics which operate those things.

The six S′ organs become a clean SDK/runtime composition:

| Ta-Onta organ | Expression-world SDK responsibility |
|---|---|
| **S0′ Khora** | Resolve and instantiate the actual Epi world position: World, subject, Bimba coordinate/branch, sources, Expression Profile, current Expression, session/material readiness and continuation. |
| **S1′ Hen** | Resolve the appropriate forms: coordinate profile lineage, glyphs, page/verso forms, typed relations, source standing, authored variants, template/form birth and lawful Return. |
| **S2′ Pleroma** | Resolve the available operative body: M′ instruments, Expression operations, models, voice body, Epii, source/graph faculties, tools/Skills/Methods and material providers under current authority. |
| **S3′ Chronos** | Bind occasion and currentness: source revision, world event, Day/NOW, M1/M2/M3 time, Expression scene/timeline/checkpoints, AgentSession/voice lineage and replay. |
| **S4′ Anima** | Compose the situated act: Nara dialogue, attention/deixis, selected M focus, voice, participant relation, consent, capabilities, ExpressiveAct, authority and intended Return. |
| **S5′ Aletheia** | Receive actuality: Expression/Action/Activity evidence, mismatch, human response, Epii enrichment/evaluation, T/T′ consumption, named praxis candidate, Recognition/Return and changed ground. |

This is not a reinterpretation of the ratified Ta-Onta field. It is its concrete relation to the Expression substrate.

### 7.1 Ta-Onta Expression API surface

Exact names should follow current QL/AIKit conventions, but the SDK needs structured operations equivalent to:

```text
epi.world.enter(subject / coordinate / continuation)
epi.world.restore(occasion / encounter)

epi.expression.profile.resolve(coordinate / branch / mode)
epi.expression.instantiate(profile, subject refs)
epi.expression.refraction.set(M focus / M′ instrument)
epi.expression.scene.perform(...)
epi.expression.focus(subject / relation)
epi.expression.source.open(...)
epi.expression.checkpoint / hold / resume / restore

epi.nara.dialogue.bind(...)
epi.nara.deixis.resolve(...)
epi.nara.voice.connect / disconnect / interrupt

epi.epii.enrich(...)
epi.epii.propose-variation(...)
epi.epii.develop(...)

epi.return.receive(...)
epi.return.recognise / refuse / continue(...)
```

Every request resolves through the generic native products. Ta-Onta never obtains ambient authority merely because the SDK operation exists.

---

## 8. Bimba Expression Atlas: every meaningful coordinate/branch has an expressive address

The Bimba map is no longer only a graph which an Expression can project.

It becomes the **semantic address-space from which Epi Expression-spaces are derived**.

The aim is not to hand-author 1,875 scene files.

The aim is:

> every eligible Bimba coordinate and branch can resolve a deterministic derived Expression Profile, and selected coordinates may acquire authored variants over time.

Profile inheritance:

```text
O:I Expression substrate defaults
        ↓
Epi global profile grammar
        ↓
M-family profile
        ↓
Bimba branch profile
        ↓
coordinate-derived profile
        ↓
optional authored human/Epii variant
        ↓
current encounter overlay
        ↓
instantiated live Expression
```

The Atlas is therefore a **derived read model / profile resolver**, not another canonical graph store.

Representative coordinate binding:

```text
CoordinateExpressionBinding {
    coordinate_ref
    coordinate_revision / registry revision
    branch_path
    family / face / direct-conjugate standing

    profile_ref / inherited profile chain
    source_refs[]
    property_readings[]
    typed relation grammar refs[]

    glyph / form bindings
    layout grammar refs[]
    permitted M′ bindings[]
    permitted Ta-Onta faculties[]

    available page/verso bindings[]
    available source/Action refs[]
    authored_variant_refs[]
}
```

### 8.1 Branches become places

A Bimba branch should be able to supply a coherent inherited expressive world before the final leaf is selected.

This is especially important for Nara.

M4 branch spaces can become real dialogical places:

```text
M4.0 identity field
M4.1 embodied / seven-centre field
M4.2 oracle field
M4.3 transformation field
M4.4 Jungian / phenomenological / Trika depth fields
M4.5 pedagogy / integration field
```

Nara can converse *from inside* those spaces rather than explaining their contents from a generic chat panel.

### 8.2 Derived vs authored Atlas forms

Derived profile:

```text
current coordinate
+ current source/property/relation readings
+ inherited Epi presentation grammar
→ reproducible profile
```

Authored variant:

```text
derived basis
+ human/Epii scene composition
+ selected imagery / media / transitions
+ pedagogical or artistic decisions
→ attributable authored variant
```

Authored variation never silently becomes the meaning of the coordinate.

---

## 9. M/M′ are dynamic dimensions of one coordinate-space

The Atlas should not turn each coordinate into an isolated picture.

Every Epi Expression-space can expose the six M dimensions as available determinations of the same whole:

| M | Expression-space role |
|---|---|
| **M0 Anuttara / M0′ Bimba** | address, source, coordinate, relation neighbourhood, property standing, provenance, Wiki ground |
| **M1 Paramaśiva / M1′** | topology, formal relation, harmonic carrier, phase, toroidal/winding/geometric organisation |
| **M2 Paraśakti / M2′** | resonance, colour, materiality, music, correspondences, planetary/tattva/lens conditions, cymatic medium |
| **M3 Mahāmāyā / M3′** | glyph, image/form, clock, transcription, sequence, codon/oracle/form packets, temporal presentation |
| **M4 Nara / M4′** | situated personal reception, seven centres, EarthBody, personal activity, oracle/transformation/context and dialogue |
| **M5 Epii / M5′** | investigation, synthesis, pedagogy, comparison, enrichment, developmental variation, Return |

Changing M focus is a refraction of the same subject unless an explicit Action changes domain state.

A person may enter a Bimba coordinate in a quiet M0/Hen reading, ask Nara for the M2 dimension, move into resonance/material/musical expression, then ask what the current relation means personally and bring M4 forward—all while the coordinate, source lineage and Expression identity remain continuous.

---

# III — AGENTS: NARA IN FRONT, EPII IN DEPTH

## 10. Nara is the foreground dialogical / voice Agent

The foreground relationship must now be explicit:

```text
PERSON ⇄ NARA
            │
            │ situated dialogue / joint attention / simple expressive acts
            ↓
        Expression-space
```

Nara is the Being with whom the person talks in the immediate encounter.

Nara's active context is bounded and structured. It should receive exactly the relevant current state, for example:

```text
NaraDialogueContext {
    nara_ref
    person / protected subject ref
    expression_ref + revision
    profile_ref + revision
    active_scene_ref

    bimba_coordinate_ref?
    branch_path?
    active_m_focus?

    selected_entity_ref?
    selected_subject_ref?
    selected_relation_ref?
    pointed_ref?
    pinned_refs[]

    disclosed source/readings
    available local Actions
    current shared-field / participant relation if any
    current expressive_act_ref?
    occasion / currentness refs
}
```

Nara's responsibilities include:

- full-duplex immediate dialogue;
- joint attention and deictic reference;
- conversational pacing;
- immediate explanation tied to the present field;
- directing focus and simple scene/presentation movement;
- hold / back / resume / continue;
- personal consent and protected-state boundaries;
- selecting or requesting an M/M′ refraction;
- deciding when deeper Epii work is required;
- mediating returned Epii enrichment back into the current human encounter.

Nara is not reduced to the realtime provider session. It remains the canonical Nara/Agent identity across voice reconnects and provider/body changes.

---

## 11. Realtime voice is a replaceable body over canonical Nara

Define a provider-neutral `NaraVoiceBinding` beneath the dialogical Agent.

Representative contract:

```text
NaraVoiceBinding {
    nara_ref
    agent_session_ref
    provider_ref
    provider_session_ref
    transport
    voice/body configuration
    connected_at
    turn_detection / interruption capabilities
    current_status
}
```

Hard identity law:

```text
NaraRef != AgentSessionRef != provider realtime session != microphone stream
```

A voice connection may disconnect and reconnect while the same Nara and Expression-space remain.

### 11.1 First provider adapter: OpenAI Realtime

The first adapter should support the capabilities available from the current OpenAI realtime stack while keeping native O:I business logic outside the browser voice layer:

- browser WebRTC for low-friction speech I/O;
- server-side WebSocket where control/event topology requires it;
- VAD/barge-in and explicit manual interrupt;
- `audio_interrupted` coupling to the Expression act lifecycle;
- typed tool/delegation requests;
- reconnect/degraded state;
- no browser possession of ambient native Actions merely because the Realtime session can call tools.

The preferred topology is:

```text
Browser / Tauri WebView
    microphone + playback
          │
          │ WebRTC audio / realtime events
          ↓
OpenAI Realtime voice body
          │
          │ bounded structured requests
          ↓
O:I / Gateway / canonical Nara AgentSession
          │
          ├─ Expression application operations
          ├─ Ta-Onta SDK
          ├─ Epii delegation
          ├─ Central / AIKit / Actuation / Factory
          └─ native Action authority
```

If a client-side RealtimeSession is used for audio convenience, native consequential tool execution must still cross the local/native authority boundary. Browser-visible tool availability is not authority.

### 11.2 Deixis is a first-class native relation

The system owns the referential field. Do not make Nara infer pointer reference from a screenshot when the application already knows it.

Human deixis:

```text
pointer / selection / hover / pin
        ↓
stable Expression entity / subject / relation ref
        ↓
Nara turn context
```

Nara deixis:

```text
spoken "this relation"
        + exact referenced ref
        ↓
Expression focus / highlight / aperture
```

Language and pointing operate on one identity substrate.

### 11.3 Interruption must stop the expressive act

A Nara response may combine:

```text
speech
+ focus changes
+ scene/transition choreography
+ source/verso opening
+ other reversible presentation acts
```

Represent this as an attributable **ExpressiveAct** with an interruption handle/checkpoint relation:

```text
ExpressiveAct {
    expressive_act_ref
    actor_ref
    basis_expression_revision
    basis_scene_ref
    speech_turn_ref?
    operations[]
    checkpoint_before
    current_checkpoint?
    interruptibility / atomic boundaries
    Activity refs
}
```

When the person interrupts Nara:

```text
voice interruption
    → stop/cancel provider output
    → cancel or hold pending expressive choreography
    → finish only the currently atomic safe presentation operation
    → retain meaningful checkpoint
    → await next direction
```

The field must not continue a stale choreography after the person says “stop”.

`go back` restores a meaningful authored/checkpoint state; it does not pretend the GPU simulation can always be bit-exactly rewound.

---

## 12. Epii is the deeper M5 enrichment and developmental Agent

Epii is not the default voice persona in the foreground encounter.

Nara invokes Epii when more depth, precision, comparison or generativity is required.

Epii handles work such as:

- deeper Bimba/source traversal;
- cross-coordinate relation reconstruction;
- precise source/evidence comparison;
- M1/M2/M3/M4 refraction proposals;
- richer symbolic or pedagogical scene composition;
- alternative expressive profiles/variations;
- method/evidence analysis;
- previous-Return comparison;
- research;
- discrepancy diagnosis;
- Factory commissioning/development;
- proposed reusable praxis.

Epii should return a structured object, not just prose:

```text
EpiiEnrichment {
    enrichment_ref
    basis_expression_ref + revision
    basis_coordinate_refs[]
    source_refs[]
    method_refs[]
    evidence_refs[]
    standing

    synthesis / explanation
    proposed_focus_refs[]
    proposed_scene_changes[]
    proposed_profile_variant?
    proposed_expressive_actions[]
    proposed native Actions[]
    continuing_questions[]
}
```

Nara remains present while Epii works.

A long Epii task can finish after the live dialogue has moved elsewhere. Such a result is **revision-bound** and may not auto-apply to a later Expression state. It returns as a pending enrichment which Nara/human may inspect, apply, adapt or discard.

The behind-the-scenes Agent structure is therefore:

```text
Person
  ⇄ Nara               foreground voice / joint attention
       ↓ when required
     Epii               depth / precision / pedagogy / development
       ↓ composed through Ta-Onta Pleroma + Anima
     specialist Agents / models / instruments / Factory
       ↓
     evidence / Return
       ↓
     Epii / Aletheia
       ↓
     Nara mediates the returned difference to the person
```

Specialist Agents do not become visible personas merely because they contributed.

---

# IV — SHARED WORLDS AND DEVELOPMENT

## 13. SharedField: same Expression-space, distinct internality

SharedField projects the same generic Expression/WorldPresentation objects already used locally.

The Epi specialisation adds a strong multi-Nara case:

```text
            shared Expression / semantic world
                      │
          ┌───────────┴───────────┐
          │                       │
      Person A                Person B
       Nara A                  Nara B
          │                       │
 protected M4 A             protected M4 B
```

Shared by explicit policy:

- projected Expression/profile refs;
- scenes where deliberately shared;
- safe semantic entities/relations;
- shared focus where explicitly part of the encounter;
- Contributions;
- presented Beings/Things;
- WorldPresentation/Projection relations;
- invited shared Agent participation.

Not shared merely by co-presence:

- raw PersonalFieldState;
- private journal/NOW/source context;
- seven-centre raw scalar bodies;
- private Nara voice transcript/context;
- private Epii enrichment;
- credentials/authority.

The landed K10 protected multi-Nara and SharedPresenceConsent contracts remain the semantic floor.

SF5 proves the first safe Nara projection; a later Ta-Onta/Atlas pass should make the shared object a true coordinate Expression-space rather than a generic Nara scene only.

---

## 14. Factory: develop the world from inside the world

Factory remains the native developmental owner. It does not become the conversational brain or the Expression semantic owner.

Once the substrate and Epi adapter are joined, an inhabitable Expression-space can expose a discrepancy in itself and return that discrepancy into Factory.

Canonical development loop:

```text
person inhabits an Expression-space with Nara
        ↓
problem / possibility becomes visible
        ↓
Nara asks Epii for deeper evaluation
        ↓
Epii compares source / Bimba / intent / implementation / evidence
        ↓
Factory Commission / Journey / Run
        ↓
AgentSet operates native source and runtime
        ↓
actual code/profile/document change + tests/evidence
        ↓
new running state appears through the same Expression world
        ↓
person + Nara encounter the returned difference
        ↓
Epii/Aletheia evaluate; human Recognition accepts/refuses/reorients
```

This is the target **self-inhabiting development phase**.

It relies on the existing Factory/Agency workbench, real Git/worktrees, native Actions, evidence, returned artifacts and Recognition. It must not be simulated by an Agent editing generated Expression state while the underlying product remains unchanged.

---

## 15. Universal self-testing uses the existing #65 C0–C5 campaign

Do not create a new testing ontology.

The existing experience campaign already has the right return structure:

```text
C0 source-to-operation readiness
C1 prepare actual test world
C2 ordinary useful work
C3 compose/stress the field
C4 repair and replay
C5 independent proof + human Return
```

The mature inhabited system can use that same campaign recursively on itself.

Example:

```text
vision/UX story
    → bind current owners / Actions / practices
    → instantiate realistic world
    → Nara/person/Agents perform real activity
    → observe technical/material/UX discrepancy
    → Epii diagnoses against source/intention/evidence
    → Factory repairs the native owner
    → rebuild/re-enter same activity
    → independent verifier repeats
    → human H/EX Recognition
    → accepted Return
```

Human phenomenological/creative judgement remains human evidence. Universal self-testing means the system can carry every other part of the cycle coherently up to that boundary, not that it can certify its own human experience.

---

# V — PARALLEL UI TRACK

## 16. Current desktop UI convergence remains a separate implementation lane

The active UI refinement branch/PR should continue to refine visual language, component CSS, dark/light defaults, footer behaviour, lifecycle/performance and contextual panes.

It must consume the contracts in this map rather than defining competing semantics.

Its convergence target is a small set of reusable UI primitives:

1. **Expression front / world body** — canvas-first, world-dominant.
2. **Verso/back** — composable page/source/depth reading of the same Expression.
3. **Portal** — open a bound file/page/Wiki/Agent/Surface inline, overlay, split, full or detached.
4. **Joint focus/deixis** — exact shared selection/pointer/focus state.
5. **Nara voice presence** — minimal persistent voice/mute/interruption state; optional transcript/depth.
6. **ExpressiveAct controls** — hold/back/continue/leave guided sequence.
7. **Epii Activity cue** — attributable depth work without chain-of-thought theatre.
8. **Resource lifecycle** — hidden Expressions/webviews/media/graph bodies suspend and release correctly.

The invariant is not one fixed layout.

Factory legitimately has a centre/right working arrangement. An essay can be mostly page-like. Nara can be full-field. Explore can be an open constellation.

The invariant is:

> the world/subject remains primary; apparatus occupies only the space required by the present act; every movement preserves the same native refs and application identity.

---

# VI — EXECUTION MAP

## 17. Substrate units — paradigm-neutral and safe for ordinary O:I

### ES0 — boundary and contract lock

**Owner:** O:I architecture/docs.  
**This document is the first lock.**

Freeze:

- substrate vs Epi paradigm distinction;
- Expression Profile generic role;
- front/verso identity law;
- SurfacePortal/reciprocal embedding law;
- generic Expression Edition law;
- generic/QL ownership boundaries;
- no Library-as-canonical-store assumption;
- mapping into existing EX/SF/PW/UI/Factory plans.

No runtime success is claimed by this planning unit.

### ES1 — generic content → Expression projection and portals

**Primary owner:** O:I consuming Central/AIKit/native Surface owners.

Implement the paradigm-neutral binding layer for:

- text/Markdown source and selected spans;
- glyph/symbol/SVG targets;
- images/media;
- generic file Things;
- Wiki/Knowledge bounded local whole via current adapter;
- HTML / WorldPresentation;
- Agent/Being/profile refs;
- another Expression ref.

Each binding retains stable native identity, revision, provenance, available Actions and degradation.

Implement `SurfacePortal` placement through the existing Surface/window host: preview/overlay/beside/full/detach/re-dock.

**Acceptance:** an ordinary non-QL Project opens an Expression containing a text file, image, Wiki node and HTML page; each can be focused and opened through its real native Surface without semantic copy or second store.

### ES2 — two-sided Expression and reciprocal embedding

**Primary owner:** O:I Expression + WorldPresentation + Personal Web.

Implement front/verso as two presentations over one Expression identity.

- front = current living Expression body;
- verso = authored/composed WorldPresentation or minimal generated reading;
- page → Expression remains current EX5 path;
- Expression → page/source/file/Surface becomes first-class;
- flip/open-back/return preserve scene, selection and subject;
- recursion/resource budget prevents duplicate active engines/webviews;
- authoring distinguishes front design, verso content and underlying source operations.

**Acceptance:** page embeds Expression → focus Expression → flip to its verso → open original file in pop-out → return to front → return to parent page, with exact refs/revisions unchanged and no duplicate live engine.

### ES3 — generic Expression Profile, Edition and collection/index

**Primary owner:** O:I.

Publish/implement:

- `ExpressionProfile` and inheritance;
- Expression profile resolution against ordinary subject kinds;
- `ExpressionEdition` portable relation;
- live/capture/fallback forms;
- exact asset/provenance/integrity metadata;
- Library as a collection/index over Expression refs rather than sole identity store;
- Personal Web gallery/collections consuming same refs.

Migrate current preset/mode material into profile/scene language where it is still product-significant.

**Acceptance:** create two distinct profile-derived Expressions over ordinary subjects, save/reopen through non-Library navigation, produce one portable Edition and re-open it without converting the edition into canonical source.

### ES4 — agent-native world operations and joint focus substrate

**Primary owner:** O:I + AIKit/Actuation application seams.

Extend the existing `oi.expression/v1` structured operations with generic world operations needed by Ta-Onta and other future paradigms:

- portal inspect/open/close;
- front/verso change;
- profile inspect/instantiate;
- shared selection/deictic context;
- ExpressiveAct perform/interrupt/checkpoint/restore;
- explicit Activity correlation;
- capability/degradation disclosure.

No Nara/Epii names are required in the generic contract.

**Acceptance:** a generic Agent discovers and performs a cancellable scene/focus act over exact subjects, human interruption holds the act, and a source portal can be opened without DOM/canvas scraping.

### ES5 — lifecycle, UI and performance convergence

**Primary owner:** current O:I desktop UI refinement lane.

Join ES1–ES4 into the current visual/lifecycle work:

- one Global Expression Stage;
- no duplicate point-cloud layers;
- hidden/offscreen renderer suspension;
- WebGL/context recovery;
- contained page/media lifecycle;
- portal/popout/re-dock continuity;
- front/verso transitions;
- light/dark/reduced-motion;
- narrow/full/focused layouts;
- performance and memory receipts from actual repeated use.

This is the point where the generic substrate becomes an inhabitable ordinary application rather than a set of contracts.

---

## 18. Epi / Ta-Onta units — paradigm layer over accepted ES contracts

### TA0 — Ta-Onta Expression SDK/API lock

**Owner:** QL-MEF / #135 successor tranche; consumes ES0–ES4.

Publish the exact S′→Expression SDK binding for Khora/Hen/Pleroma/Chronos/Anima/Aletheia and current M×S′ capability records.

Preserve all existing Ta-Onta IDs and native owners. Do not create a second capability registry.

Prove one coordinate enters through Khora, obtains forms through Hen, faculties through Pleroma, currentness through Chronos, a situated act through Anima and an evidence-bearing Return through Aletheia.

### TA1 — Bimba Expression Atlas

**Owners:** QL-MEF semantic/profile resolver + O:I generic profile/renderer.

Implement inherited, lazily derived profile resolution for all eligible Bimba coordinates/branches.

Requirements:

- stable coordinate/branch address;
- exact Bimba registry/source revision;
- direct/conjugate/family identity;
- global→M-family→branch→coordinate inheritance;
- optional authored variants;
- source/property/relation bindings;
- no 1,875 hand-authored file requirement;
- no new graph store;
- export/page/SharedField safe fallbacks.

First acceptance should span at least one M0, M1, M2, M3, each M4 branch and one M5 coordinate.

### TA2 — full M/M′ expressive grammar

**Owner:** QL-MEF consuming current Expression engine hooks.

Bind the accepted M/M′ truths to reusable profile/refraction grammars:

- M0 source/Bimba/knowledge;
- M1 topology/harmonic geometry;
- M2 resonance/material/music/colour/cymatics;
- M3 glyph/form/clock/transcription;
- M4 personal branches/centres/EarthBody/oracle/transformation/depth;
- M5 Epii pedagogy/development.

Foregrounding an M determination must preserve the same coordinate/subject/occasion unless an explicit Action changes state.

### TA3 — Nara realtime dialogue, voice and deixis

**Owners:** QL Nara meaning; Actuation canonical Agent/authority; AIKit provider/body resolution; O:I voice/Expression adapter.

Implement:

- Nara as foreground dialogical Agent;
- provider-neutral NaraVoiceBinding;
- OpenAI Realtime as first adapter;
- browser WebRTC and/or server WebSocket topology selected deliberately;
- exact voice/body/provider disclosure;
- VAD/barge-in + manual interruption;
- `audio_interrupted` → ExpressiveAct hold/cancel;
- shared pointer/selection/deictic ref context;
- speech→focus and pointer→speech grounding;
- disconnect/reconnect preserving canonical Nara and Expression;
- permission/refusal and private-state boundaries.

Native Actions remain behind O:I/Gateway/Actuation authority, not ambient browser tools.

### TA4 — Epii enrichment and expressive variation

**Owners:** QL M5′ Epii + AIKit + Factory where development is required.

Implement structured Nara→Epii delegation and `EpiiEnrichment` results.

- deeper source/Bimba research;
- multi-M refraction;
- scene/profile variations;
- pedagogy;
- evidence/Method disclosure;
- discrepancy diagnosis;
- Factory Commission proposal where implementation must change;
- revision-bound late results;
- human/Nara accept/reject/adapt before applying presentation changes.

Nara stays the foreground voice unless an explicit experience deliberately introduces another Being.

### TA5 — Shared multi-Nara coordinate spaces

**Owners:** O:I SharedField + QL protected multi-Nara.

Consume completed SF/EX projection work and TA1–TA4:

- project a coordinate Expression-space;
- two independently grounded worlds enter it;
- each has its own Nara/private M4 state;
- shared Expression/semantic refs remain common;
- shared selection/contribution only when policy allows;
- Epii is invited explicitly as a shared Agent when desired;
- no private Nara context/state leakage;
- Contribution/Return/reprojection retain lineage.

### TA6 — self-inhabiting Factory and universal proving

**Owners:** Factory + O:I #65 composition.

Use the actual O:I/Epi world as the Thing under development.

Run a real discrepancy from lived Expression-space through:

```text
Nara → Epii → Factory Commission/Journey/Run
→ native code/profile/source change
→ rebuild/relaunch
→ same Expression-space encounter
→ independent proof
→ human Recognition
```

Bind this to the existing #65 C0–C5 campaign, not a new test registry.

### TA7 — returned praxis / EX7

Only after real ES/TA/SF/Factory use exists, feed authorised evidence into existing AIKit/T/T′/named praxis systems.

Reusable layouts, expressive Methods, voice/pedagogical sequences and source routes remain attributable proposals with revisions and retirement.

Aesthetic preference, conversational fluency or apparent resonance never becomes semantic truth automatically.

---

# VII — CURRENT PROGRAMME PLACEMENT

## 19. Relation to EX0–EX7

EX0–EX5 remain valid and largely constitute the first realised Expression body:

- EX0 engine intake;
- EX1 generic application operations;
- EX2 Nara binding;
- EX3 knowledge projection;
- EX4 Agent/Epii composition;
- EX5 page embedding.

The substrate units above **generalise the machinery those waves proved** rather than restarting them.

ES1–ES5 should reuse the landed EX code and remove any remaining assumption that Nara/QL or the Library is the boundary of the Expression world.

EX6 continues to close through the SF0–SF6 programme.

EX7 is aligned with TA7 and should remain after real use.

## 20. Relation to current SharedField SF0–SF6

Observed O:I `main` at this planning cut includes:

- SF0/SF1 hosting + Explore carrier;
- SF2 living knowledge encounter;
- SF5 protected Nara encounter;
- SF3 Agent Being encounter;
- the latest engine intake and EX2–EX5 integration.

SF4 Contribution/Return and SF6 final joined cut remain governed by the current SharedField Wayfinder and actual live branch state at execution time.

Do not hold SF completion for the entire new Atlas/voice programme. Complete the already-defined SF work on its present contracts.

TA5 later deepens the accepted SharedField into coordinate-specific multi-Nara co-inhabitation.

## 21. Relation to Personal Web / WorldPresentation

Personal Web stays the paradigm-neutral authored page world.

This map extends it by making Expression embedding reciprocal and by making the Epi-Card's front/reverse/deep-reading relation part of a general Expression Edition substrate.

Do not erase the six initial forms or their art-direction fidelity.

Beings/Things/Flow/Day/Cube/Card remain real authored forms which can embed or be embedded through the generic Surface/Expression bindings.

## 22. Relation to the active UI refinement track

The current desktop UI convergence work remains parallel and should not be stalled while all ES contracts are built.

Its existing performance/lifecycle, light/dark, footer and contextual-pane repairs are directly useful.

At its next convergence/rebase, consume the ES front/verso/portal/joint-focus primitives rather than inventing page/Expression/Agent-specific copies.

## 23. Relation to Factory/Agency #289/#292

Factory/Agency retains its accepted arrangement and native owner work.

TA6 is a later **use of that completed developmental workbench** from within the inhabited Expression world.

Do not redesign Factory around Nara. Nara/Epii may commission and inspect Factory work; Factory keeps Commission/Journey/Run/evidence/Recognition semantics and its specialised result Surfaces.

## 24. Relation to QL-MEF #135 / Ta-Onta

QL-MEF #94 completed the first full Ta-Onta implementation tranche and #135 remains the whole programme/lived acceptance owner.

Open a successor Ta-Onta/Expression SDK tranche under #135 rather than reopening K8/K9/K10 or rebuilding AW0–AW3.

The new work consumes:

- landed S′/M×S′ capability field;
- Bimba/property/Wiki bindings;
- K8 M1–M3;
- K10 Nara/M4;
- canonical M5′ Epii;
- current O:I Expression substrate.

Its new output is the **adapter/profile/agent-world layer between those accepted semantic truths and the general Expression world**.

## 25. Relation to #65 experience campaign

No new acceptance campaign.

Add the resulting inhabited-world episodes into the existing vision-level story field and test them through C0–C5 with the existing evidence ladder:

```text
specified UX
contract/native capability
controlled technical operation
real desktop/provider/material path
independent verification
human H/EX
multi-world acceptance where applicable
```

The final system lock is not green contracts alone. It is the actual person using Nara inside coordinate Expression-spaces, opening real source/pages, moving through M/M′ refractions, receiving Epii enrichment, sharing selected worlds and eventually developing the system through Factory from inside that same field.

---

# VIII — PARALLELISM AND FIRST DISPATCH

## 26. What can run in parallel

```text
CURRENT SF COMPLETION
SF4 / SF6 as their present contracts allow

CURRENT UI REFINEMENT
active desktop UI convergence

NEW SUBSTRATE
ES1 content/portal foundation ─────┐
ES3 profile/edition/index ─────────┼─ may begin together with disjoint files
                                  │
ES2 reciprocal/front-verso ───────┘ consumes their early contracts
                                  ↓
ES4 agent/world operations
                                  ↓
ES5 UI/lifecycle convergence

EPI PARADIGM
TA0 SDK lock ───────────────────────── may begin immediately as specification
TA1 Bimba Atlas ───────────── consumes ES profile contract
TA2 M/M′ grammars ─────────── can develop beside TA1 after TA0
TA3 Nara voice/deixis ─────── consumes ES4/TA0; provider adapter can prototype earlier
TA4 Epii enrichment ───────── can develop beside TA3 after TA0
                                  ↓
TA5 shared co-inhabitation
                                  ↓
TA6 Factory self-inhabitation / #65 proving
                                  ↓
TA7 returned praxis / EX7
```

### 26.1 First implementation dispatch

The first substrate development should not start with QL code.

Start with:

1. **ES1** — make an ordinary text file, Wiki subject, HTML page and image genuine Expression-bound Things with Surface portals/pop-outs.
2. **ES3 contract half** — freeze generic `ExpressionProfile` / `ExpressionEdition` / Library-as-index relation.
3. **ES2** — front/verso and reciprocal embedding once ES1/ES3 contracts are stable.
4. **TA0 specification** in QL-MEF in parallel, binding existing Ta-Onta cells to those new generic contracts without writing another renderer.

This creates the correct dependency direction:

```text
general machinery first
        ↓
Epi SDK binds it
        ↓
Bimba Atlas / Nara voice / Epii depth
```

---

# IX — ACCEPTANCE WALKS

## 27. Substrate walk — no QL installed

```text
open ordinary Project
→ open/create generic Expression
→ bind Markdown file as Thing
→ bind image
→ bind Wiki subject
→ bind authored HTML page
→ see all as stable objects in one Expression
→ click file → preview → detach editor
→ re-dock without losing Expression scene/selection
→ flip to Expression verso
→ page/source/provenance visible
→ embed same Expression in a page
→ promote it back to focused Expression
→ return to page
→ save/reopen by search/Wiki ref, not Library only
→ export Expression Edition
```

Pass only if no QL/Nara/Epi dependency is required and all canonical owners remain intact.

## 28. Epi Atlas walk

```text
select Bimba coordinate
→ Ta-Onta/Khora resolves coordinate world
→ inherited coordinate ExpressionProfile resolves
→ Expression instantiates
→ Hen/source/verso are inspectable
→ refocus M1
→ refocus M2
→ refocus M3
→ same coordinate/subject continues
→ enter appropriate M4 branch
→ Nara dialogue becomes available
→ Epii enrichment returns source-bearing variation
→ human rejects one proposed variation
→ original coordinate/Expression remains intact
```

## 29. Nara voice walk

```text
enter coordinate Expression-space
→ connect Nara realtime voice
→ point at one bound Thing
→ ask "what is this?"
→ exact subject ref reaches Nara
→ Nara verbally references another relation
→ same relation receives visual focus
→ Nara performs short expressive transition
→ user interrupts mid-turn
→ audio stops + ExpressiveAct holds
→ "go back"
→ previous meaningful checkpoint restored
→ ask deep source question
→ Nara delegates to Epii
→ dialogue remains available
→ Epii returns enrichment bound to basis revision
→ Nara offers it rather than auto-applying
→ disconnect voice
→ reconnect to same Nara / coordinate / Expression
```

## 30. Self-inhabiting Factory walk

```text
person + Nara inhabit an Epi coordinate
→ identify a concrete UX/semantic implementation defect
→ ask Epii to investigate
→ exact source/intent/implementation discrepancy formed
→ Factory Commission/Journey created
→ AgentSet repairs native owner in real worktree
→ tests/evidence return
→ rebuilt application opens same coordinate Expression-space
→ person/Nara experience returned difference
→ independent verifier repeats original activity
→ human Recognition accepts/refuses
→ accepted Return becomes new current ground
```

---

# X — NON-NEGOTIABLE DISTINCTIONS

```text
substrate != Epi paradigm
O:I Expression API != Ta-Onta SDK
ExpressionProfile != subject meaning
Expression front != canonical source
Expression verso != fixed inspector
ExpressionEdition != source
Library != Expression identity store
SurfacePortal != copied document
embedded Surface != ambient authority
page contains Expression != page owns Expression
Expression contains page != Expression owns page
Bimba Atlas != second graph
coordinate profile != coordinate truth
M focus != new app
Nara != realtime provider session
Nara != Epii
Epii enrichment != accepted change
voice tool availability != Action authority
interruption != reset
checkpoint != exact GPU replay
shared Expression != shared Personal state
Factory development != presentation-only edit
self-testing != self-certifying human experience
```

---

## 31. Closure

This programme reaches its intended whole when:

- ordinary O:I can use Expressions as real world spaces containing native files, Wiki subjects, pages, glyphs, media, Agents and linked Surfaces without QL;
- Expressions have a coherent front/verso relation and reciprocal embedding with WorldPresentation/HTML;
- portable Expression Editions exist and the Epi-Card is realised as one authored compressed form rather than a competing content ontology;
- Expression identity is discoverable through the wider world rather than trapped inside a special Library;
- Ta-Onta is the explicit Epi SDK/API over that substrate;
- every eligible Bimba coordinate/branch can resolve an inherited derived Expression Profile, with authored variants where developed;
- M/M′ can dynamically refract one coordinate-space without fragmenting it into six applications;
- Nara is the actual foreground dialogical/voice Agent with exact joint attention, interruption and consent;
- Epii supplies deeper source-bearing enrichment, pedagogy, variation and development behind Nara;
- SharedField can host coordinate Expression-spaces across distinct Naras without collapsing private internality;
- Factory can develop the same world from inside the world and return the implemented difference for renewed encounter;
- the existing #65 campaign can repeatedly exercise, repair and independently prove this field up to the irreducible human Recognition boundary;
- EX7 can then learn reusable, attributable expressive praxis from actual lived use rather than imagined preferences.

The architectural direction is therefore precise:

> **The O:I products supply a paradigm-neutral world substrate. Expression gives that world a living presentational body. Ta-Onta is Epi-Logos' SDK/API for inhabiting that body. Bimba supplies the paradigmatic address-space; M/M′ provide its dynamic determinations; Nara is the person's dialogical presence within those spaces; Epii supplies deeper M5 enrichment and developmental variation; SharedField opens selected spaces between worlds; and Factory lets the inhabited world develop its own implementation and test the returned difference.**


## 30 September 2026 source-bound Epi corrective delivery

Continue O:I #335/#375/#65/#220 with QL-MEF #135/#201/#258 through the source-led fidelity audit and dependency-ordered R0–R7/A0–A5 recovery carriers in QL-MEF `docs/kernel-rebuild/EPI-WORLD-{FIDELITY-AUDIT,RECOVERY-MAP,COORDINATE-COVERAGE}-2026-09-30`. The first delivery constructs actual native Expression material from the complete current Bimba source and one admitted cosmic/personal occasion. Profile adoption is the grammar entry; it is not multi-coordinate scene construction. Scene bodies and entity subjects retain distinct exact canonical identities and changing process readings. Shared Personal Pratibimba M4.4.4.4 remains separate from each saved person, protected native current and Expression instance.

The audited pre-correction installed cut exposed controls and native field transport without the promised composed Earth/planet/clock/register/personal world. Useful native transport/schema/provenance tests remain valid at their scope. Required objects must actually render, native determinants must affect the correct receiving body, unrelated bodies must retain their subjects/partitions, and wrong-locus/disconnected-consumer/removed-body cases must fail. Semantic, expressive and causal proof remain separate; a reference rendering is not managed installed acceptance.

The bounded implementation uses the existing native coordinate/content owner, Expression profiles and CAS, production scene loader, sparse retained partition mapping, protected Nara identity/current owner, native material files and ordinary Epi entrance. Full source inspection/relation traversal is focused depth with return to the same occasion. Current-form process identity, actual canonical codon/hexagram reading, containing personal profile and selected scene subject coexist; adopting the personal profile must not repaint or misdescribe selected cosmic entities.

Before closure, replay the original installed entrance at rest, actual two-person same-occasion reception, selected source/body inquiry, identity correction in the same world, save/reopen and restart. Preserve controlled authored reference material, actual producer/CAS output and installed screenshots/readback as distinct evidence. Complete deeper M0–M5 branches, continuing Day/Flow Tarot/I-Ching/deck, agency, pedagogy and Return remain executable packets inside the existing programme; the first composed world does not close that full scope. H/Recognition remains with the person.

## 1 October 2026 — source-bound delivery, native bounds and ordinary replay

Continue ES3/ES5 and TA0–TA2 through the [QL fidelity audit](https://github.com/EpiLogos/QL-MEF/blob/main/docs/kernel-rebuild/EPI-WORLD-FIDELITY-AUDIT-2026-09-30.md), [recovery map](https://github.com/EpiLogos/QL-MEF/blob/main/docs/kernel-rebuild/EPI-WORLD-RECOVERY-MAP-2026-09-30.json) and [coordinate coverage](https://github.com/EpiLogos/QL-MEF/blob/main/docs/kernel-rebuild/EPI-WORLD-COORDINATE-COVERAGE-2026-09-30.json). Their original 14-packet DAG carries all 185 existing capability obligations, 2,141 complete source subjects, 11,810 qualified relationships and 42 entrances. The whole-field remainder stays A0–A5. Publish the exact joined candidate source/receipts through [QL #135](https://github.com/EpiLogos/QL-MEF/issues/135)/[#201](https://github.com/EpiLogos/QL-MEF/issues/201)/[#258](https://github.com/EpiLogos/QL-MEF/issues/258) and [O:I #335](https://github.com/EpiLogos/O-I/issues/335)/[#375](https://github.com/EpiLogos/O-I/issues/375)/[#65](https://github.com/EpiLogos/O-I/issues/65)/[#220](https://github.com/EpiLogos/O-I/issues/220); source links and native component successes do not establish managed installed acceptance.

Ordinary route: Epi-Logos mode → Nara identity entrance → select/save the person's native identity → construct/open the same instance's cosmic/personal/branch Expressions → select a rendered body or source register → focused Source → Return to the same selected scene/occasion. The actual candidate construction owners are `kernel/src/nara_coordinate.rs`/`native_expression.rs`/`nara_identity.rs`/`nara_current.rs`, `src/nara/coordinateExpression.ts` and `expressions-app/field-studies-journeys/src/epiWorld{Source,Material,Production,Encounter}`. The native QL source/scene/current owners supply full qualified meaning and numerical readings; the browser authors presentation and consumes actual native profile defaults.

The [Application contract](contracts/EXPRESSION-APPLICATION-V1.md) and [material contract](contracts/EXPRESSION-ACT-MATERIAL-V1.md) retain the full typed native Expression while ordinary files may use exact SHA-qualified image reuse. Encoded Central inspect/fenced Open/same-file Save and atomic real fault refusals pass at their recorded scopes. Catalogue admission is bounded at 4,096 refs/16 MiB aggregate; individual profile/material/adoption/lineage bounds remain. Saved scenes retain complete authored/reset material and one qualified world receipt. Retained occasions carry explicit native admission with no fresh-current attestation; neither source stamps nor the saved-file revision may silently make an aged event current.

At the earlier dated 1 October 2026 cutoff, ordinary24 fixes the normalized-camera receiving break and passes real degree-body pointer selection, then fails Source/Return. Ordinary25 preserves that selection but fails the member-disclosure wait. Ordinary26 passes actual selection and qualified disclosure of all six native registers (360 degrees, 24 backbone governors, 36 decans, 64 codons, 72 skins and 18 apertures), then fails keyboard selection/source opening for the unvoiced sky body. These are actual Chromium/WebGL2 ordinary-app executions through a controlled native host; all three whole receipts are failures. At that earlier cutoff, independent recognition, completed Source/Return, continuing scene lifecycle, two-person live receiving, fresh Nara/Epii, managed installed before/after and physical audio remain pending.

Run the actual [production verifier](../desktop/cradle/tests/epi-world-production-native.mjs), [native file lifecycle verifier](../desktop/cradle/tests/expression-file-central-native.mjs), [selected-context verifier](../desktop/cradle/tests/nara-world-context-native.mjs) and the native tests named in the recovery subdivisions, using their real controlled native configuration inputs. Keep exact issued requests, paired owner replies, file revisions, source cut, browser/GPU and before-controls screenshots. Reference renderings, native CAS/readback, native audio samples, causal engine readback, installed observations and H remain separate. R6/R7 and EA5 close only on their full existing acceptance.

### Later 1 October replay — FULL28 native admission boundary

FULL27 is invalid as repair proof: typecheck/build exited 1 and its replay used the preceding bundle. The original rejection is retained; corrected typecheck and build exited 0 before FULL28. Actual FULL28 passes 37 bounded checks in the ordinary Chromium/WebGL2 application through the controlled native bridge. These include all six rendered register selections, complete qualified member disclosure and Source/Return; keyboard Uranus selection and Return without inventing a Bimba coordinate; the protected same-occasion personal seven-centre/nine-driver projection; exact M4.4.4.4 full-source opening and personal Return; and branch-scene entry. The saved person is controlled person A. These results do not claim the owner's autobiographical identity or H Recognition.

FULL28 remains a whole-experience failure. Its first native one-tick operation is refused before host/worker spawn: O:I's closed `Binding` parser admits only `schema`, `host` and `presentation`, while the qualified QL binding also carries `native_basis`, `scene` and `native_readback`. The bounded repair belongs to O:I `kernel/src/native_expression.rs`: admit the exact qualified binding against its retained world first, retain all original qualification and `PrepareWorld` output, then project the unchanged three-field worker envelope for that closed consumer. Arbitrary unknown-field acceptance, qualifier deletion or a numerical remapping would not repair this boundary. Actual worker launch, predicted native determinant effect/invariance and receiving-scene consumption must pass the original ordinary operation and meaningful missing/mismatched-qualifier negatives before this packet closes. Managed installed replay, physical audio, continuing file/scene lifecycle, two-person live causal reception, fresh Nara/Epii and H remain pending.

The actual FULL28 receipt is `51de1a0689167a3283d9e96d1461ac63656300e40d8828ea92d5d9070a3bb732` (`passed:false`, 37 bounded checks); the independent admission/source review is `4124c7763f2c68e5b8fdcf69328e24a0a408748e372d38c505219f1405abe96f`, and the original native refusal is `e2f25e3f3ecb9b24aa7e4ff44c4e1e001c9cb20e8754ec192867c219334467d1`. R7 must carry these exact source/operation references and later receiving evidence; no causal, installed, numerical-readiness or first-delivery completion claim follows from the preceding 37 checks.

## Epi-world corrective receiving return through FULL34 — 1 October 2026

Continue the existing [owner commission QL#135](https://github.com/EpiLogos/QL-MEF/issues/135), [#201](https://github.com/EpiLogos/QL-MEF/issues/201), [#258](https://github.com/EpiLogos/QL-MEF/issues/258) and O:I [#335](https://github.com/EpiLogos/O-I/issues/335)/[#375](https://github.com/EpiLogos/O-I/issues/375)/[#65](https://github.com/EpiLogos/O-I/issues/65)/[#220](https://github.com/EpiLogos/O-I/issues/220) from the current three source carriers: `docs/kernel-rebuild/EPI-WORLD-FIDELITY-AUDIT-2026-09-30.md`, `EPI-WORLD-RECOVERY-MAP-2026-09-30.json#/execution_return/ordinary31_34_native_rest_cursor_and_held_reception_return` and `EPI-WORLD-COORDINATE-COVERAGE-2026-09-30.json`. These are QL-MEF repository paths; the existing programme retains2141 identities/11810 relations/42 entrances/185 full capabilities and original14 parent DAG. No duplicate registry, numerical law or H promotion is introduced.

FULL31's older-file/openNativeDoc41 conflict is excluded from correction acceptance. FULL32 actually acknowledges share4→12/current/reset native CAS and guarded same-file save for the same original24 instance/person/sky/source, but FAILED14 because84,000 resident formation points retain old targets at time/steps0. App-owned production initial zero-time allocation admission is repaired; FULL33 genuinely matches all32 resident bodies to decoded targets, with10980 torus points covering4096 native sample identities and six register masks.37 earlier source/personal/branch checks pass, then nativeM1generation1→4 is falsely rejected by old adapter max2.

Canonical QL InstrumentSession commit `a0ca5590bf5557931f461cb614ca7c4ef22bfbf5` admits source-owned M1delta[2,3] and replace-eventdelta[1,2], retaining other strict cursor/sample/audio/refusal guards. Canonical760cb equals the O:I vendor; actualFULL34 bundlea6688d is frozen.18 controlled protocol tests are not native proof. Separate real16f host/C++worker21 cases demonstrate both M1branches and replacementbranches and all4 owned processes close0; this is not browser/GPU/installed proof.

FULL34 accepts the actual native+3/30° action after the same original24 cold-file/current reception, then FAILS37: ClockA's1281 actual resident points move0 while CPU targets differ275.000015, at time/steps0 before manual reseed. A target/metadata ACK is insufficient. Claim `R3-SCENE-EVENT-CURSOR` for actual browser AudioContext/queued PCM/native target-boundary and meaningful forged-copy regressions; claim `R3-ACKNOWLEDGED-POSE-RECEPTION` for native acknowledged clock/form/torus consequences in actual held body points/pixels, unrelated-input invariance and disconnected consumer failure. Existing `R3-PAUSED-SCENE-ADMISSION` and `R3-TORUS-MATERIAL-CAPACITY` retain the originalRED and32→33 bounded proof. The real saved-reset4-check native guard/restore proof is separate from a pure eighth mutation.

Execute current native owner tests from their packet source receipts: `node --test adapters/retained-field/instrument-session.test.mjs` is controlled transport; the independent actual stdio native suite is `T/independent-review/native-scene-operation-real-cases/replay.py` with actual receipt17bf0c. For ordinary receiving use the existing `desktop/cradle/tests/epi-world-production-native.mjs` and frozen34 configuration as preservedRED; a root-owned successor must retain exact original24 world/file/person/source/occasion while pinning its rebuilt entry/vendor/companion cut. Never mark a rerun of old bundle/config as repaired acceptance.

Sun PhaseA9 provider/native route/knownlegacy/contract/generator source files are integrated, with actual provider21/source-route2 and datedscene-native2 checks. Known e6d qualifiers preserve historical source/sky; new descriptor solar-parent does not authorize fresh-current attestation. Actual stage-A6e4e nativegeneration and PhaseC3source embedding/sourcechecker0 now supply v2 fixture0df; originalv1 31727/original24Sky untouched. Seven compiled default source tests pass at the sourceC cut; full successor companions, actual O:I generic-default host/browser reception and old24 replay with new source remain pending at this sourcecut. Kirdan spelled-TET material stays explicitly unavailable where source notes are absent. Source-only/current protocol proof does not promote broad numerical readiness/parity.

Every next repair carries failure→native owner→exact tests→original encounter→integrate→managed replay. First coherent corrective delivery remains pending until the real rendered native effect/invariance/consumer-cut, source/personal/correction/save&next/restart, two-person differential, fresh Nara/Epii and independent managed semantic/expressive/causal proof pass. Physical audio and the owner's private-person choice/Recognition/H remain their proper distinct matters. Authored references, headless software-GPU production and installed views stay separately labelled.

The separate output5 isolated browser successor now passes 13 cases executing 21 actual native operations; all 13 owned hosts close with exit0. Chrome154.0.8037.59, actual browser AudioContext/nativePCM scheduling and WebGL2/ANGLE SwiftShader target readback with subsequent shader integration are named exactly. Seven negative deliveries mutate or delay copies only after actual native replies; strict native owner refusals are separate. This component proof preserves actual FULL34's zero-step stationary ClockA failure; it does not claim ordinary world, installed software, physical speaker output or H. The exact canonical regression handoff remains to be included through its current owner.

The native O:I Project NOW record `fourfile-technical-release-for-held-native-2026-10-01` grants technical custody to the lead for BRIEF SHA52d57. Its four source/runtime fences cover only PointCloudField/GPGPUSimulator selective stationary position admission after an acknowledged qualified scene revision. All velocities, unselected positions, torus, seed/time/steps/native clocks/cursors/samples and unrelated renderer hunks remain invariant. Canonical source candidate and API-only runtime projection are prepared. Wholefile pre-existing runtimeMAX10/absent geometry-localized-volume versus canonicalTSMAX32 remains; the actual ordinary field imports canonicalTS. Only new API deltas are projected with inverse unchanged bytes. Real owner/whole-consumer tests, independent diff review, source/refreeze Return and broader fullrendererconvergence remain pending; this mismatch does not replace the product receiving audit. This is not Git custody, install authority, broader renderer permission or a repairpass.

The remaining-delivery acceptance map attached to the original R3 execution return keeps the first corrective delivery distinct from the full commission. Beyond any repaired clockhand, active personal two-person sourcepredicted consumer proof, complete samefile Save&next/Restore/Library/recompose/restart and immutableprofile rehydration, current selectedcontext/fresh Nara/Epii basis recovery, real managed computer-use semantic/expressive/causal replay, truthful hardware audio and actual repository/ticket/Human Return remain. A3/A4 continuing DayFlow/selecteddeck symbolic material/person-occasion fences and complete deepbranch coverage remain explicit next packets; their native journey positives do not close the retained crossperson admission gap. All original parent dependencies, source coverage, capability obligations, historical evidence and person-owned H are retained.

## Epi-world receiving successor: independent GPU API and genuine FULL35 failure


The released stationary-position API now has independent actual software-GPU proof at both owners:21 canonical field cases and21 older packaged field cases, plus6 direct GPU guards each. Selected actualRGBA equals transformed targets, all unselected positions and both velocity buffers remain unchanged, renderer bindings are restored, and admission adds zero time/steps/seeds to the prior moving scene.19 field API refusal cases and6 direct range/target guard cases per owner are atomic. Controlled authored targets and opaque admission tags test this primitive; they are not an invented native clock source. CanonicalMAX32 and older packagedMAX10 remain distinct; API-only inverse-byte preservation is not whole-file renderer parity or new localized/volume support.

Genuine FULL35 still FAILED37. The same original24 instance, controlled personA, exact source/sky/occasion and native file cold-open after actualDoc72 preservation/leaseclose. New entry703a9693 imports the qualified canonical primitive; actual native remains7dd/16f. Source inscription now reaches60° at tick2 and the native formAAT/Fu is correct. Actual ClockA1281 resident points nevertheless move0, with currenttargetgap201.313995 at steps/time0. There are no page errors. The app's persisted acknowledged-reading versus temporarily cleared controller influence/needsFrame is an investigation hypothesis, not an established cause. The next repair must make qualified acknowledged state reach the actual quiet body, with exactinstance/person/event/partition fences, invariant unrelated state and a disconnected-consumer negative. FULL34's original failure is retained; primitive green tests do not repair either ordinary encounter by implication.

QL source68d0401709811fba65a63ce79a754db11f02fd60 commits16 Sun/default/census source files and builds all5 qualified native binaries successfully. Currentlinked inventory2870, four census guards and two native-default source guards pass; historical ledger0d85/131decisions and broad numerical UNASSESSED standing remain. This cut is separate from FULL35's still-running16f and managed installed171. The first original24/newsource StageD wrapper raised KeyError texture before native operations; it is preserved as a harness precondition, with corrected native replay and genericnone/now worker proof pending. No fresh-current assertion is inferred from a historical source qualifier.

All6 first corrective delivery gates remain operative: live cosmic/body effect and invariance/consumer cut; actual protected personal/two-person receiving; same-file Save&next/Restore/Library/recompose/restart/profile rehydration; selected source and fresh Nara/Epii recovery; managed independent semantic/expressive/causal computer interaction with actual audio/render environment and chosen private identity; repository/ticket/curated Human Return. The complete S0–S5/deepbranch/DayFlow/selected-deck/cross-person journey/source-numerical recovery remains explicit beyond that first delivery. A clock-hand pass cannot close this whole scope or person-owned Recognition/H.

## Compiled default and retained-occasion replay: bounded successor to FULL35

The committed68d CLI, 7778 host and 937e C++ worker now pass33 native default cases. The actual omitted-event request preserves the declared authored determinants, ten source bodies and nine voices; an explicitly stale original-v1 request refuses. Provider admission, modal/PCM receiving and owned child shutdown are executed. The three-field worker envelope is extracted without changing it. This is not an invocation of the O:I projection: the ordinary generic none/now launch remains an explicit next test.

The corrected root original24 replay also has an independent14-case READ-review. Its full sky, entered controlled identity, event and instance remain exact; the old Sun descriptor is retained as qualified history while the current native Sun-to-centre7 relation governs reception. The actual worker emits512 finite nonzero PCM frames and is reaped. This review inspects the root's real requests and outputs rather than repeating its12 personal operations. Retained occasion is not relabelled fresh. Interpreted activity and composed current remain unavailable until an actual source-qualified M3 activity episode exists.

The three genuine GPU owner tests are now placed at the permanent O:I test paths, and the QL browser runner has its startup-only successor04fa8f33. Exact source and destination bytes match the retained placement receipt. Placement supplies future executable regression owners; it is not an additional run or whole-system success.

FULL35 remains a genuine37-check failure: native inscription60 degrees, actual held ClockA resident displacement0, target gap201.313995. The root has prepared an exact canonical-M3/mirrored-ref guard and an independent render invalidation on NativeField change; source typecheck/build passes were reported, but independent guard and FULL36 acceptance remain pending. Actual pre36 nativeDoc85 guarded save/readback preserves the same full typed file and closes the held lease. It supplements the dated pre35Doc72 transition and does not replace the complete Save&next/Restore/Library/restart gate. All six first-delivery gates, the full remaining S0–S5/branch/journey programme and person-owned H stay open.

## Actual held ClockA receiving and the next discriminating rule — FULL36

FULL36 executes41 preceding checks on the same original24 instance, controlled personA, sky/occasion and native file. It demonstrates the previously missing app effect: before any simulation or manual reseed,1281 actual ClockA resident points move275.000015 to the native target, with target gap0. Both velocity buffers, every unselected body/connection/torus particle, seed, time and steps remain unchanged. This is a real headless application receiving positive, beyond the isolated GPU API. FULL34 and35 remain genuine failed encounters.

The run then fails the assertion that the entire selected-aperture structure stays equal. Independent current/original source review distinguishes seven static aperture fields from the dynamic Fibonacci ground position: native degree60→90 preserves selected index9, reciprocal6,16 static/18 total lenses, divisions300/120 and Void orientation2025, while the60-position six-degree ground index lawfully advances10→15. Full sky, event and person remain exact. The root changes only the verifier from executed4e7d5c78 to1dd76da0; source/native/product numerical laws and the four renderer files are unchanged by that correction. The verifier now requires +30degrees/+5ground positions and must still refuse altered static fields, frozen/wrong ground phases or changed sky/person/event. The failed36 receipt is retained; FULL37 is pending. NativeDoc98 full same-file equality and lease close supplement the earlier72/85 controlled transitions without closing complete continuation.

A separate shared Factory source-body failure remains in the same renderer chain. The retained original enabled native7 ASCII carrier/publication7/projection6 is absent after5seconds, with the peer's measured7 pixels below100. The supplied glyph-only variation is native3→4, not7→8: it removes the ASCII source while keeping the◉ glyph. Its existing body scores8 versus fresh998; a later image has a cyan ring, which is not canonical ASCII acceptance or proof that every glyph view is absent. These exact11 source/image artifacts are read and hashed, with three retained images visually inspected. Canonical ASCII source is not replaced or declared fixed. A bounded R3 source attachment/lifecycle packet at the existing engineProjection/presentation owners must test original source marks and native revisions on the same body across remove/restore/enable/reopen; fresh mount is a comparator, not the repair. This is not a second architecture or a completed Factory/two-person delivery.

All six first-delivery gates remain open. Compiled68d native default33 and original24 READ-review14 remain bounded native positives; permanent browser startup source commit e0e9ca is separate from the five compiled68d companions and the actual36 native16f cut. No managed installed after-view, hardware/heard audio, full personal activity, fresh Nara/Epii or H claim follows from this clock effect.
