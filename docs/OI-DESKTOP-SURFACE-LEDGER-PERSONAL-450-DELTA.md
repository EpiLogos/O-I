# O:I Desktop Surface Ledger — `epi.personal.450` Prompt-C delta

**Programme:** O:I #112 / Epi #18  
**Parent ledger:** O:I #104 / PR #113 `OI-DESKTOP-AGENT-NATIVE-SURFACE-LEDGER.md`  
**Desktop design:** PR #102  
**Inherited workbench floor:** PR #99  
**Status:** implementation-branch delta; fold into final #111/P7 parity ledger after accepted ancestry is selected

This delta records only the new Personal 4/5/0 application cut. It does not replace the #104 ledger and does not treat an implementation branch as accepted main.

## 1. Host composition

`epi.personal.450` is now represented as an Epi-native parent application Reading hosted by O:I. O:I owns presentation/composition only; the Personal semantic subject remains Epi-owned.

```text
Epi personal-application Reading
        │
        ├─ Canvas       → protected Nara journal / DAY-NOW
        ├─ Inspector    → bounded Explain/Review/provenance + Central NOW
        ├─ Navigator / Knowledge → Epi Bimba/source refs through shared Knowledge
        ├─ Agent sidecar → existing AIKit AgentSession only when it identifies canonical Epii
        ├─ Command/Action → governed selection + proposal/return
        └─ Deep-open descriptors → epi.deep.m0 / m4 / m5 (no fabricated body)
```

The implementation deliberately does **not** add Epi-owned generic tabs/splits/Search/terminal/SessionSpace code. It reuses the #99 workbench primitives already present on the branch.

## 2. Surface/readiness ledger

| Activity / projection | Native owner | Host region | Current branch state | Authority / absence law |
|---|---|---|---|---|
| journal / writing / notes | Epi M4/Nara | Canvas | **implemented** | protected body comes only from `epi.nara-daily-provider/v1`; body is not copied into contribution metadata |
| DAY / NOW | Epi + Central relation | Canvas / Inspector | **implemented for Epi current handles**; Central history conditional on configured native provider | Epi current handles orient the episode; Central remains durable temporal-return owner |
| governed selected passage | Epi | shared Selection / Inspector | **implemented** | exact episode + revision + UTF-8 byte range; selection is explicitly not Agent Context disclosure |
| Epii dialogue | Actuation + AIKit AgentSession; Epi supplies canonical identity relation | root Agent sidecar | **conditional native binding** | O:I scans current native SessionSpaces for an AgentSession whose identity/purpose/provenance names Epii; otherwise degraded. It never substitutes the first session |
| Explain / Review | Epi bounded Reading/Action | Inspector | **implemented** | semantic review over exact governed range; does not replace the journal canvas or become the chat runtime |
| Bimba / source / canon | Epi refs; shared Knowledge presentation | Navigator / Knowledge / Inspector | **implemented ref route; Knowledge resolution conditional** | native Bimba ref retained if shared Knowledge cannot currently resolve it; no Epi-local generic graph app |
| History / provenance | Central / shared Inspector | Inspector | **implemented command path; provider conditional** | reads Central NOW/DAY rather than copying a Personal history store into O:I |
| proposal / return | Epi proposal + Central return | Command / Inspector | **implemented proposal path; Central return conditional** | `proposal != adopted human source`; Central receives refs/lineage only; promotion requires human-owned source and explicit acceptance |
| flow / kanban | Epi M4 when a real native provider exists | Canvas | **explicit absence** | no task/kanban state inferred from journal text |
| oracle / reading | Epi M4 | Canvas | **explicit absence at parent body level** | M4 authority supports oracle activity; no current native Oracle provider is invented here |
| deep `epi.deep.m0` | Epi | host-selected deep Surface later | **descriptor implemented, body absent** | preserves Personal subject; full M0′ graph belongs to deep product |
| deep `epi.deep.m4` | Epi | host-selected deep Surface later | **descriptor implemented, body absent** | preserves Personal subject; complete psychoid/quaternion/chakra/Hopf/cymatic renderer is out of C |
| deep `epi.deep.m5` | Epi | host-selected deep Surface later | **descriptor implemented, body absent** | preserves Personal subject; complete Epii/Logos Atelier is out of C |
| D event relation | future/current D owner | same subject | **socket implemented, unbound** | `eventRef` absent; bindable true; no parallel `PersonalEvent` state |

## 3. Same-subject and privacy checks

The O:I host validates the Epi parent reading before admitting it as a native contribution:

- `productId == epi.personal.450`;
- `subject.protectedBodyDisclosed == false`;
- `selectionIsAgentContextDisclosure == false`;
- `proposalIsAdoptedHumanSource == false`;
- canonical Epii identity is `epi:agent:epii`;
- D socket is bindable and declares no parallel PersonalEvent state;
- every deep-open descriptor retains the same parent `subjectRef`.

For bounded Personal operations the Tauri host passes only episode/revision/range coordinates back to Epi. Epi re-resolves the exact saved range. The host rejects any returned subject whose episode, revision, start byte or end byte differs.

The protected journal body is available only to the explicit root-shell Nara command and Canvas. It is absent from the generic `NativeContributionReading`. `SandboxedContribution` remains denied at the root bridge, including the new protected Personal/Central call classes.

## 4. `.0/.5` expression

The Epi producer's application reading carries the current parent expression as data; O:I exposes it in summonable detail rather than making `.1-.4` permanent dashboard fields:

| Domain | `.0` ground | `.5` return | C law |
|---|---|---|---|
| M4/Nara | `M4-0'` protected identity/quintessence ground, bound at parent scale to current protected episode | `M4-5'` Epii/Sophia review/recognition gate | `.1-.4` summon only when lived activity crosses them; full deep instrument → `epi.deep.m4` |
| M5/Epii | `M5-0'` Bimba/Gnosis/library ground | `M5-5'` Logos/return | parent uses canonical AgentSession + governed proposal; full M5 IDE → `epi.deep.m5` |
| M0/Anuttara | `M0-0'` source-provenanced Anuttara/Bimba language ground | `M0-5'` pedagogy route into Epii | shared Knowledge over native refs; full graph → `epi.deep.m0` |

## 5. Prior Prompt-C disposition

Relative to O:I PR #89:

| Prior artifact | Disposition | Current relation |
|---|---|---|
| `desktop/core/src/local_epi.rs` | **REFACTOR** | now validates/hosts parent application and native bounded operations rather than primitive+depth UI modes |
| `desktop/core/src/local_central.rs` | **KEEP** | narrow Central Action adapter remains the right authority boundary; carried forward onto #99 stack |
| `desktop/core/src/bridge.rs` | **REFACTOR** | protected Personal call classes added to the inherited #99 bridge policy; sandbox authority remains denied |
| `desktop/core/src/lib.rs` | **REFACTOR** | exports Epi/Central adapters beside #99 SessionSpace/AgentSession/Knowledge primitives |
| `desktop/src-tauri/src/main.rs` | **REFACTOR** | Personal native commands added without removing #99 workbench commands |
| `desktop/ui/src/NaraSurface.tsx` | **REPLACE** | enum-driven whole-canvas depth router replaced by activity-first `PersonalSurface` composed with shared Inspector/Knowledge/Agent regions |
| `desktop/ui/src/nara.css` | **REPLACE** | styling now follows parent Personal activity surface rather than a monolithic Nara depth viewer |
| `desktop/core/tests/personal_return.rs` | **EVIDENCE** | prior same-subject/authority results remain useful proof; current stack adds parent/bridge checks |
| `desktop/ui/src/__tests__/nara-presentation.test.tsx` | **EVIDENCE / REPLACE** | useful evidence of old behavior, but presentation contract is superseded |
| `.github/workflows/epi-pratibimba-integration.yml` | **REFACTOR** | integration must test the new Epi producer branch + #99-based O:I host stack |

## 6. Relation to the wider desktop programme

This C cut consumes the real #99 workbench floor exactly as #104 instructed. It does not claim #105 professional shell/Search/Command completion or #111 whole-application physical acceptance. Those remain desktop-programme concerns rather than reasons to push generic workbench implementation into Epi.

Accordingly, C can become semantically and compositionally ready for D on this stack while the final desktop programme still has independent P1–P7 convergence/physical work to complete.
