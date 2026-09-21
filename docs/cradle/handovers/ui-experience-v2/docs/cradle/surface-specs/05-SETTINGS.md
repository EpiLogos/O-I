# Settings — the next useful choice, in the existing v2 frame

**Version 2.** The local v2 Settings architecture remains: search, per-owner rail, authored/effective/active axes, staged plan → apply → receipt/readback. Do not replace it with the older census layout. The new work is discoverability and control detail for Harness, Models, Skills and Gateway.

## 1. Recurring job

Change the conditions under which future work runs, understand a current mismatch, maintain real repertoire sources or repair a connection. Routine Agent/team skill choice belongs with that working object in Desk/Agents; global defaults and sources belong here.

## 2. Composition and control hierarchy

```text
Search settings…
----------------------------------------------------------
<existing owner rail>    Models
AIKit                     <existing scope selector>
  Harness                 Selection policy    <actual> v
  Models                  <actual owner explanation>
  Skills
                        <existing authored/effective/active detail>
Workcell
  Gateway               <only after change: actual staged summary>
                                                [Review changes]
```

The four first-class destinations live under their native owners, not a new global category rail. AIKit contributes Harness/Models/Skills; Gateway consumes Workcell configuration/status and preserves distinct authority/attach ownership where relevant. Search result activation selects the section and focuses the exact control/heading. Keep the query until explicitly cleared.

Use the existing v2 field layout. Normally a label at left and a compact value/control at right; long value/source wraps without causing a horizontal page scroll. No extra System/Registry/About header above the section. Authored/effective/active remain in their current successful presentation—this pass neither hides a relevant mismatch nor forces every value into another three-column table.

A picker appears only with real selectable options. A single known readonly value renders text and actual source disclosure, not a disabled select. Use one local `…` for secondary source/history/reset actions, each backed by its actual operation. Existing invalid/submitting controls may be disabled briefly; missing capabilities are a scoped obligation instead of controls.

## 3. Harness and Models: choices, not inventories

**Harness.** A compact native harness selector with current value; choosing it reveals admitted editions only if multiple real editions exist. Posture and faculties appear as meaningful actual disclosure below, not an empty matrix. Hover/focus on a faculty may expose its owner-reported explanation. One obligation line addresses missing fuller harness-profile disclosure; current registry content remains usable.

**Models.** Show a native policy/model selector with actual selected label. If Auto is supplied, its row reads **Auto** with the owner's concise policy explanation beneath; do not select the first configured model and call it Auto. Selecting a model/policy stages the real desired change. Harness/scope changes re-resolve eligibility without silently applying a new choice.

The catalogue opens in an anchored searchable picker, not an in-page wall of model cards. Row anatomy: actual model/policy name, one useful supplied description, selected check. Optional route details stay in row disclosure. No desktop-authored catalogue or price/quality rankings. Missing catalogue retains the known configured value and a single native roster obligation; not an empty search widget.

**Credentials.** Native provider name with **Configured** / **Not configured** presence only. No masked token field, eye icon, copy-token button or clipboard exposure. Manage credentials is one link only when a real native path exists. A credential reference is not the credential material; even collapsed raw detail cannot leak it.

## 4. Skills and Gateway

**Skills.** Sources and pins are readonly rows at this cut where native mutation is not exposed. Source name leads; native path/pin is secondary and copyable as a reference only. No Remove button per uneditable source. **Review skills** opens the same shared working Skills body for a chosen real scope—no second catalogue or installation system.

**Gateway.** One actual workcell/connection identity row with a small status marker and a real Refresh icon. Relevant native configuration uses the existing contribution controls. Service/runtime detail goes behind **Connection details**, not a permanent process table. Attach/stream is one named native obligation until supplied. Configured endpoint, reachable service and attached session are different states; no fabricated Connect success from a status read.

## 5. Staging and applying: no permanent action shelf

At rest with no changes, render no Apply/Discard bar. When the existing desired state changes, reveal one anchored local review strip in the current section: `{n} pending changes` with **Review changes** and quiet **Discard changes**. Preserve the current v2 placement rather than add a global bottom dock.

Review opens the existing plan surface: exact scope, affected settings and current/new values; actual activation consequence. **Apply changes** is the single primary action. Refusal/partial result stays with the plan; desired state is not silently cleared. A receipt does not certify active loading if readback has not done so. Escape closes review while keeping the staged changes; Discard is explicit.

**Zero capability deltas** are exactly **No capability changes.** No table, headers, scaffolded remove rows or detached Blocked pill. This is not a no-change message for a plan that has not been read or failed. Real nonzero deltas get one row each; no row is invented from an unchanged setting.

## 6. States and copy

| State | Composition |
|---|---|
| Empty successful read | One appropriate source/path or sentence, not an empty grid |
| Working / planning | Local spinner on the invoked Review/Apply; no fake percentage |
| Needs-you | Actual drift/conflict beside the affected choice; real review route |
| Error | **Couldn’t load these settings.** + safe Retry/details, unrelated owners usable |
| Refused | **This change wasn’t applied.** at the plan; desired choices retained |
| Live/readback | Update actual effective/active values without rewriting authored draft |
| Stale plan | **These settings changed. Review the plan again.**; old apply invalidated |
| Activation pending | Actual owner effect such as next-session activation; not a green Active claim |

Exact controls: **Harness**, **Models**, **Skills**, **Gateway**, **Search settings**, **Review changes**, **Apply changes**, **Discard changes**, **No capability changes.**, **Configured**, **Not configured**, **Review skills**, **Connection details**. Source/native details preserve exact owner labels where required.

## 7. Subtraction list

Remove blank capability tables; repeated Remove rows; a permanent Apply bar with zero staged changes; redundant settings/registry banners; disabled unknown-value pickers; invented model/harness lists; secret-material controls; editable-looking readonly Skills rows; unsupported Attach/Stream buttons; status paragraphs; automatic dev fixtures. Keep v2's successful architecture and the exact plan/receipt/native scope semantics.


## Retained binding inventory

The following inventory is retained from v1 as source-qualified implementation reference. It is not a rendering prescription. Reconcile it with the active local tree; this version's interaction and preservation rules govern presentation.

## Appendix A — element → binding

| Element | Existing owner / native operations | Files and implementation boundary |
|---|---|---|
| v2 architecture | Current local settings state and contribution host | `workspace/SystemPanel.tsx`, `configuration/v2/SettingsHome`, `SystemHome`, `VisualsView`, `ProfilesView`; preserve local files rather than replacing them from remote main. |
| Registry and resolutions | `config_registry_read`, `config_resolutions_read` | Current `configuration/sourceHost.ts` and live source. Use actual owner refs and scopes. |
| Desired state and plan | `config_desired_hold`, `config_desired_discard`, `config_plan` | Current v2 machinery; do not make a parallel forms store. |
| Apply / receipt | `config_apply`, `config_receipts`, fresh resolution read | Existing owner validation and refusal. No fabricated plan ID/CAS field if not in the contract. |
| Profiles / working Skills | `profile_list`, `profile_read`, `profile_use_plan`, `profile_use_apply` | Revived `SkillsToolsPlane`; verify target scope and preserve local complete pipeline. |
| Harness | Existing AIKit config contributions; future harness-profile disclosure | Generic config registry is verified; complete editions/posture/faculties schema remains a local/native reconciliation obligation. |
| Models / credentials | Native config presence/ref values and AIKit roster/policy seam | No catalogue is established by the inspected KernelOp alone; do not invent one. |
| Skills sources / pins | Actual AIKit-contributed registry/source records | Readonly unless owner publishes a mutation; native locator shown. |
| Gateway | Workcell config contributions; `workcell_status_read`; distinct attach/stream owners | Status read verified; attach/stream not implied. |
| Fixture selection | `sourceHost.ts`, existing compile-time dev/walk gate | Require explicit `?fixtures=1` as well. Shipping build excludes fixture modules altogether. |

## Acceptance — interaction and visual proof


S01 — All four sections appear in the existing owner rail and search. Search focuses the real destination; no competing settings taxonomy.

S02 — No staged changes means no new action shelf. Change → Review → Apply → actual receipt/readback, with scope and active/future effect intact.

S03 — Zero capability deltas is one line and zero table/remove rows. Unread/failed plans are not reported as zero changes.

S04 — Pickers contain only actual options. Auto retains its policy identity; changing harness/scope invalidates dependent review through the native resolver.

S05 — No secret material crosses the renderer, attributes, copied content, logs or fixture screenshots. Presence/reference only.

S06 — Global Skills opens the existing shared working plane; Gateway reads actual Workcell status without fabricated attach/stream. Keyboard and Escape preserve staged choices.

S07 — Existing Visuals, profile, adoption, authored/effective/active and configuration live/composition tests remain passing on the exact local cut.
