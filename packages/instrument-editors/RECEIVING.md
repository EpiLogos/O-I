# Receiving the contribution

All product writes are in this package. Shared owners consume these additive
ports in their normal integration lane; no new plugin runtime is required.

## Import into the current shell

The package is committed on the same env-1 branch as the shell. It needs no
cherry-pick. Add `"@epilogos/instrument-editors": "file:../../instrument-editors"`
to the shell UI's existing package dependencies. Its normal source exports
include each editor separately, the frame, presentation, panels, contribution
and native owner adapters. No development entrance is imported by those exports.

The adopted research source needs its existing module aliases and complete
MapLibre worker. The package exports their build adapter:

```ts
import {instrumentEditorBundler} from '@epilogos/instrument-editors/vite';
// In the existing Vite configuration:
plugins: [react(), instrumentEditorBundler()]
```

For source imports, the shell's existing `tsconfig.json` can extend
`../../instrument-editors/tsconfig.json` to receive its native module/type paths;
retain the shell's own `include` and compiler checks. The adapter preserves existing host React aliases; otherwise it resolves the
canonical React and react-dom installations from the receiving shell root. The
standalone entrance/build names Cradle as its explicit runtime root. React19
alias preservation is exercised, but full editor support currently retains its
React18 peer contract. `npm --prefix
packages/instrument-editors run build` compiles the public production entry,
without fixtures or the controlled native receiver. This proves bundling;
actual component mounting and native presentation acknowledgement still require
the following owner hooks.

## Bound receiving ports

1. **Current contribution registry / Browser / rack.** Register descriptors from
   `instrumentEditorContribution(definition, owner, Component)`. Its only extra
   descriptor fields are `editorPresentation` and `targetIds`. Close the
   component over the installed instance's real native owner and target; render
   `InstrumentFrame` plus its instrument component. Existing panel extensions
   can use `registerInstrumentEditorPanels` without changing the registry.
   The descriptor's current canvas region is the fallback receiving region;
   rack/dock placement remains the existing host's choice.
2. **Workspace and native window owner.** Close `instrumentSurfaceOwner` over
   the admitted Surface binding, workspace generation guard, checkpoint route,
   acknowledged `present`, `window_detach` and redock receipt. Set
   `detachedContributionSupported` only when DetachedFrame mounts this
   contributed editor and restores its current model/checkpoint. Transport
   availability alone is insufficient. Fullscreen uses `returnTo` to restore
   prior placement and bounded geometry. A missing adapter refuses relocation.
3. **Common field.** Feed deliberate selection into `presentation.selection`;
   default targets remain pinned. Provide active-instrument handle ownership,
   source opening and native selection through the current host. Do not route
   an unrelated field gesture through a hidden editor. Forward actual resize
   and visibility to the retained graphic implementation.
4. **Canvas / Timeline / Places.** Supply the existing ResearchInstrumentsHost
   over the captured Expression/Scene and its exact current revision, native
   DocumentStore transactions, production `readWikiSceneTechne`, source access
   and native save/readback. `dev/ResearchWorkbench.tsx` is the concrete local
   receiver. The shared Rust research material validator currently rejects
   the existing TypeScript owner's `frames` / `namedViews` material and card
   sizing. Native owner repair must admit its bounded existing schema and
   remap native refs on fork; the editor must not erase authored fields to
   force admission. Mature installer capture/restore/visibility/resize ports
   are also required for detached/restart view restoration. Timeline precision
   and MapLibre provider/temporal admission remain their existing owners.
5. **Journey / Clip.** Supply `JourneyPhraseOwner` from the existing retained
   Clip/native receiver and shared retained glyph-input Map. Reuse the exact
   GlyphSequenceEditor; no second sequence model. The owner must checkpoint
   that Map and the component's pending source text for native detached/restart
   recovery. Scene timing, split, reorder and branches consume published
   current native commands when available; absent commands remain disabled.
6. **Palace.** Supply `PalaceEditorHost` from actual expression read/list/edit,
   exact CAS and published native readback. Its current native contract also
   requires `authoredRevision` from the retained DocumentStore revision and
   `canCompose` from actual transaction/pending/draft standing. The editor
   retains that stamp with every room/name draft and refuses silent rebasing. Publish composition changes back
   through the state owner. Supply `PalaceIntegralHost` for disclosed integral
   reading/context and acknowledged native Return execution. A computed Return
   route is not execution or human acceptance.
7. **Modulation.** Close `modulationOwnerPort` over the existing retained native
   editor options. It writes one native DocumentStore transaction and preserves
   the owner's undo/journal/save route. Followers edit target range/blend/enable
   independently and cannot replace their shared source. Supply current native
   telemetry for effective readouts and optional fire/detach/remove/mapping
   commands only where the actual instance admits them. No telemetry is
   synthesized by the local entrance.

The view checkpoint contains instance, exact native target, source/revision,
depth, unfolded depth, placement, geometry, return geometry, following state and
instrument view/input. It never substitutes for the native document. Retarget
and presentation guards retain pending work and reject a retired owner basis.
Closing a view leaves native work intact; native enable, stop and remove remain
separate operations.

## Exact remaining receiving changes

These shared files remain untouched by this lane. Apply the hooks in the
existing owner's integration packet, against its current source.

| Owner source | Required receiving change | Available contribution |
| --- | --- | --- |
| `desktop/cradle/src/contributions/contracts.ts` and the compiled contribution admission path | Consume optional `editorPresentation` and `targetIds`; admit bound components through the current descriptor/manifests. Retain the mounted canvas fallback. Browser/rack supplies the installed native instance and owner ports. | `InstrumentEditorDescriptor`, `instrumentEditorContribution`, `TECHNE_EDITORS`, `MODULATION` |
| `packages/live-shell/ui/src/shell/panels.ts` and rack/dock receiver | Pass bound closures to `registerPanel`. Feed deliberate selection/transfer and active field-handle ownership; presentations stay pinned by default. | `registerInstrumentEditorPanels`, `InstrumentFrame`, `createInstrumentPresentation` |
| `desktop/cradle/src/workspace/DetachedFrame.tsx` | Resolve admitted contributed kinds through the hosted registry before its KnowledgeSurface fallback. Mount the same bound component and native owner. Connect `admitBinding`/`beforeRelease` to model/input checkpoint restoration and flushing before close/redock. Only then set `detachedContributionSupported`. | `instrumentSurfaceOwner` captures generation/binding, flushes checkpoints, waits for native detach/redock, and verifies placement. |
| Workspace state owner and `SurfaceBinding.view` checkpoint route | Retain editor view/input alongside the current native model. Map focus/return to existing focused/maximized layout with prior placement/geometry. No additional store or identity migration. | `EditorCheckpoint`, size constraints, presentation restore/retarget guards |
| `desktop/cradle/kernel/src/expression_scene.rs` research validator and current fork remap | Admit optional `frames`, `namedViews`, and bounded `cards[id].size` from `field-studies-journeys/src/researchMaterial.ts`. Preserve legacy absence and the 256 KiB budget. Frames: at most 64, label 1–160, memberRefs 1–64 admitted refs, integer z. Named views: at most 32, bounded viewport, selectedRefs/frameOrder at most 64. Remap native membership/selection refs on fork; never strip authored fields. | Real refusal and retained proposal in `tests/research-native-evidence.json`, `evidence/research-browser-result.json` |
| `desktop/cradle/expressions-app/field-studies-journeys/src/researchInstruments.tsx` installer return | Expose `setVisible`, `resize`, `captureView`, `restoreView` over existing retained view resources/lens state. Hidden graphics do not intercept unrelated input; native processing keeps its own lifecycle. | Compact/full hosts, mounted specialist components and operation guards |
| Clip/shared editor and workspace state owner | Checkpoint the retained glyph-input Map and component-local pending source text using stable occurrence/state IDs. Supply admitted native Scene timing/split/order/branch/clock operations. | `JourneyPhrase`, actual `GlyphSequenceEditor`, `JourneyEditor` optional ports |
| Native Palace, device and field owners | Supply acknowledged Return execution, telemetry and admitted mapping/fire/remove/enable commands. Publish composition readback through the retained owner. | `PalaceEditorHost`, `PalaceIntegralHost`, `modulationOwnerPort` |

The local receiver demonstrates composition publication through
`NativeWorking.advanceClean` with captured DocumentStore identity/revision,
then `acknowledge` without a false undo entry. Journal writes use the opening
record's CAS revision; a second aperture cannot overwrite newer pending input.
One operation lease spans response and checkpoint. Reads/refused overlapping
calls cannot release another operation's lease.

Restart reopens the actual `oi.native-working/v1` journal before inspection,
retains submitted input, and never retries pending operations automatically.
Native focus maps to the exact admitted occurrence; pending unknown occurrences
stay unknown. Stable local step selection and unsaved component text still need
the state owner's checkpoint.
