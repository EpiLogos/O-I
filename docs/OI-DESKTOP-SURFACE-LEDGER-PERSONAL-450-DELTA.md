# O:I Desktop Surface Ledger — `epi.personal.450` Prompt-C delta

**Programme:** O:I #112 / Epi #18  
**Parent ledger:** O:I #104 / PR #113 `OI-DESKTOP-AGENT-NATIVE-SURFACE-LEDGER.md`  
**Desktop design:** PR #102  
**Inherited workbench floor:** PR #99  
**Current Central NOW/DAY owner consumed:** PR #75 @ `ab354c1278396b0d50620bf8a43c40eedc26b907`  
**Status:** implementation-branch delta; fold into final #111/P7 parity ledger after accepted ancestry is selected

This delta records only the new Personal 4/5/0 application cut. It does not replace the #104 ledger and does not treat an implementation branch as accepted main.

## 1. Host composition

`epi.personal.450` is represented as an Epi-native parent application Reading hosted by O:I. O:I owns presentation/composition only; the Personal semantic subject remains Epi-owned.

```text
Epi personal-application Reading
        │
        ├─ Canvas       → protected Nara journal / DAY-NOW
        ├─ Inspector    → bounded Explain/Review/provenance + Central NOW
        ├─ Navigator / Knowledge → Epi Bimba/source refs through shared Knowledge
        ├─ Agent sidecar → existing AIKit AgentSession only when it identifies canonical Epii
        ├─ Command/Action → governed selection + proposal / recognised human return
        └─ Deep-open descriptors → epi.deep.m0 / m4 / m5 (no fabricated body)
```

The implementation deliberately does **not** add Epi-owned generic tabs/splits/Search/terminal/SessionSpace code. It reuses the #99 workbench primitives already present on the branch.

## 2. Surface/readiness ledger

| Activity / projection | Native owner | Host region | Current branch state | Authority / absence law |
|---|---|---|---|---|
| journal / writing / notes | Epi M4/Nara | Canvas | **implemented** | protected body comes only from `epi.nara-daily-provider/v1`; body is not copied into contribution metadata |
| DAY / NOW | Epi + Central relation | Canvas / Inspector | **implemented for Epi current handles**; Central history conditional on configured native provider | Epi current handles orient the episode; Central remains durable temporal-return owner |
| governed selected passage | Epi | shared Selection / Inspector | **implemented; invocation conditional on bounded native authority** | exact episode + revision + UTF-8 byte range; selection is explicitly not Agent Context disclosure; pre-issued Action+Capability grant is consumed before the child is published into shared focus |
| Epii dialogue | Actuation + AIKit AgentSession; Epi supplies canonical identity relation | root Agent sidecar | **conditional native binding** | O:I scans current native SessionSpaces for an AgentSession whose identity/purpose/provenance names Epii; otherwise degraded. It never substitutes the first session |
| Explain / Review | Epi bounded Reading/Action | Inspector | **implemented; invocation conditional on bounded native authority** | semantic review over exact governed range; does not replace the journal canvas or become the chat runtime |
| Bimba / source / canon | Epi refs; shared Knowledge presentation | Navigator / Knowledge / Inspector | **implemented ref route; Action authority + Knowledge resolution conditional** | the governed Personal selection remains shared focus while Epi's Bimba ref is resolved through Knowledge; no Epi-local generic graph app |
| History / provenance | Central / shared Inspector | Inspector | **implemented command path; provider conditional** | reads current `projectcentral.now.inspect`; no Personal history store is copied into O:I |
| proposal / Agent return | Epi proposal + Central return | Command / Inspector | **implemented; Epi Action authority + Central provider conditional** | Epi proposal remains `proposal/unreviewed`; Central Agent handoff preserves refs/lineage; Central failure is reported as degraded without destroying the already-formed Epi proposal |
| proposal resolution without adoption | Central | Inspector / Command | **implemented when a Central handoff exists** | `projectcentral.now.update` resolves the Agent handoff while preserving proposal provenance |
| recognised human return | Central | Inspector / Command | **implemented when human NOW scratch exists** | current Central contract accepts only `ProjectCentral/now/user/...` with `acceptance=human-accepted`; the Epi/Agent proposal itself is never promoted as human source |
| flow / kanban | Epi M4 when a real native provider exists | Canvas | **explicit absence** | no task/kanban state inferred from journal text |
| oracle / reading | Epi M4 | Canvas | **explicit absence at parent body level** | M4 authority supports oracle activity; no current native Oracle provider is invented here |
| deep `epi.deep.m0` | Epi | host-selected deep Surface later | **descriptor implemented, body absent** | preserves Personal subject; full M0′ graph belongs to deep product |
| deep `epi.deep.m4` | Epi | host-selected deep Surface later | **descriptor implemented, body absent** | preserves Personal subject; complete psychoid/quaternion/chakra/Hopf/cymatic renderer is out of C |
| deep `epi.deep.m5` | Epi | host-selected deep Surface later | **descriptor implemented, body absent** | preserves Personal subject; complete Epii/Logos Atelier is out of C |
| D event relation | future/current D owner | same subject | **socket implemented, unbound** | `eventRef` absent; bindable true; no parallel `PersonalEvent` state |

## 3. Same-subject, privacy and authority checks

The O:I host validates the Epi parent reading before admitting it as a native contribution:

- `productId == epi.personal.450`;
- `subject.protectedBodyDisclosed == false`;
- `selectionIsAgentContextDisclosure == false`;
- `proposalIsAdoptedHumanSource == false`;
- canonical Epii identity is `epi:agent:epii`;
- D socket is bindable and declares no parallel PersonalEvent state;
- every deep-open descriptor retains the same parent `subjectRef`.

For bounded Personal operations the root host asks Epi to re-resolve the exact protected episode/revision/range into its stable selection child. It then requires a **pre-issued native bounded Action grant** whose:

```text
ActionRef           = the exact Epi canonical Action
native owner        = epi
subjectRef          = the stable protected episode parent
binding revision    = the exact observed Epi contribution revision
Capability          = the advertised required Epi Capability
Capability grant    = explicit and present
operation id        = opaque and finite-use
```

Only after that grant is found and consumed does the shell publish the child selection into shared focus or invoke the semantic Epi operation. The Action emission names the exact `selectionRef`; the grant remains bounded to the stable protected episode parent because the child ref does not exist until the protected provider validates the private range. Generic exact-subject authorization still rejects this parent/child relation, so it cannot be inferred accidentally.

This preserves:

```text
Action advertised
    != Action authorised
    != Action invoked
    != returned result recognised/adopted
```

The host rejects any semantic result whose episode, revision, start byte or end byte differs from the governed selection. The protected journal body is available only to the explicit root-shell Nara command and Canvas; it is absent from generic contribution metadata. `SandboxedContribution` remains denied at the root bridge for Personal, Central, AgentSession and Knowledge privileged calls.

Bimba and deep-open presentation now keep the governed Personal subject/selection in shared focus; Bimba/deep refs are relations in Inspector/Knowledge rather than replacements for the Personal subject.

## 4. Current Central recognition law

The current native owner consumed here is Central PR #75 @ `ab354c1278396b0d50620bf8a43c40eedc26b907`.

It establishes two separate return classes which the Personal UI now preserves:

```text
Agent / Epi proposal
    → projectcentral.now.return
    → ProjectCentral/now/agents/<handoff>.json
    → waiting / in_progress / blocked / resolved
    → NOT human-authored project ground

Human-authored NOW scratch
    → ProjectCentral/now/user/...
    → projectcentral.now.promote
    + acceptance = human-accepted
    → ProjectCentral/user/<destination>
    → durable recognised human ground
```

The Personal Surface can resolve the proposal handoff without adoption and can recognise a human-owned NOW source when one exists. It deliberately cannot turn an Agent/Epi proposal into human scratch automatically.

## 5. `.0/.5` expression

The Epi producer's application reading carries the parent expression as data; O:I exposes it in summonable detail rather than making `.1-.4` permanent dashboard fields:

| Domain | `.0` ground | `.5` return | C law |
|---|---|---|---|
| M4/Nara | `M4-0'` protected identity/quintessence ground, bound at parent scale to current protected episode | `M4-5'` Epii/Sophia review/recognition gate | `.1-.4` summon only when lived activity crosses them; full deep instrument → `epi.deep.m4` |
| M5/Epii | `M5-0'` Bimba/Gnosis/library ground | `M5-5'` Logos/return | parent uses canonical AgentSession + governed proposal; full M5 IDE → `epi.deep.m5` |
| M0/Anuttara | `M0-0'` source-provenanced Anuttara/Bimba language ground | `M0-5'` pedagogy route into Epii | shared Knowledge over native refs; full graph → `epi.deep.m0` |

## 6. Prior Prompt-C disposition

Relative to O:I PR #89:

| Prior artifact | Disposition | Current relation |
|---|---|---|
| `desktop/core/src/local_epi.rs` | **REFACTOR** | validates/hosts the parent application and native bounded operations rather than primitive+depth UI modes |
| `desktop/core/src/local_central.rs` | **KEEP** | narrow Central Action adapter is the right authority boundary; reverified against current PR #75 |
| `desktop/core/src/bridge.rs` | **REFACTOR** | protected Personal call classes added to inherited #99 bridge policy; sandbox authority remains denied |
| `desktop/core/src/execution_authority.rs` | **REFACTOR** | preserves #99 generic exact-subject grant consumption and adds a narrow parent-bounded helper for protected provider-produced child refs |
| `desktop/core/src/lib.rs` | **REFACTOR** | exports Epi/Central adapters beside #99 SessionSpace/AgentSession/Knowledge primitives |
| `desktop/src-tauri/src/main.rs` | **REFACTOR** | Personal native commands added without removing #99 workbench commands |
| `desktop/ui/src/NaraSurface.tsx` | **REPLACE** | enum-driven whole-canvas depth router replaced by activity-first `PersonalSurface` composed with shared Inspector/Knowledge/Agent regions |
| `desktop/ui/src/nara.css` | **REPLACE** | styling now follows parent Personal activity/recognition surface rather than a monolithic Nara depth viewer |
| `desktop/core/tests/personal_return.rs` | **EVIDENCE** | prior same-subject/authority results remain useful proof; current stack adds parent/bridge/real-provider checks |
| `desktop/ui/src/__tests__/nara-presentation.test.tsx` | **EVIDENCE / REPLACE** | useful evidence of old behavior; presentation contract is superseded |
| `.github/workflows/epi-pratibimba-integration.yml` | **REPLACE** | new `epi-personal-450-integration.yml` tests corrected Epi parent + current Central owner + #99-based O:I host stack |

## 7. Evidence and wider programme relation

`desktop/core/tests/local_epi_personal_provider.rs` exercises `LocalEpiHost` against the real corrected Epi bridge when configured. `.github/workflows/epi-personal-450-integration.yml` pins the current corrected Epi producer (`8a9ed96101b579a7b27774fb96ffba94d410aaae`) and Central NOW/DAY owner (`ab354c1278396b0d50620bf8a43c40eedc26b907`), tests/builds both, runs the O:I real-provider acceptance and builds the Personal presentation.

This C cut consumes the real #99 workbench floor exactly as #104 instructed. It does not claim #105 professional shell/Search/Command completion or #111 whole-application physical acceptance. Those remain desktop-programme concerns rather than reasons to push generic workbench implementation into Epi.

Accordingly, C can become semantically and compositionally ready for D on this stack while final desktop P1–P7 convergence/physical work remains an independent programme concern.
