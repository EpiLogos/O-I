# Expressions: devices and the encounter spine (WORLD-SHELL-DESIGN section 2)

Audit, 8 October 2026. Read-only: no code was edited and nothing was committed.

Paths are relative to `/Users/admin/Central/worktrees/env-1/o-i` unless shown as absolute. Line numbers are from the working tree as read.

## What the spine is in code today

Design section 2 says devices read selection, subject and trail from one spine, and that no second selection store exists. In the live shell the spine's selection is this chain:

1. **The retained application owns it.** `desktop/cradle/expressions-app/field-studies-journeys/src/app.ts:127` declares `let selected: string[]`. Clicks write it through `selectEntity(id, multi)` (`app.ts:341`), which accepts multi-selection.
2. **The owner's `select` operation writes it, one object at a time.** `packages/expressions-boundary/src/editor.ts:182` types `select` as one `entity_id`. `hostEditor.ts:395-411` handles it and calls `selectLocal(entity.id, index)`, which is implemented at `app.ts:1197` as `selected = [entityId]`.
3. **The reading publishes it.** `app.ts:1193` returns `selection: {entity_ids: [...selected], step_id}`. The shell reads `reading.selection` everywhere.

So the shell's spine is a projection of one owner-side array. The array can hold more than one object (path 1), while the owner's write path only ever writes one (path 2). That mismatch drives several findings below.

The design's **trail** is not in the live shell. A search of `packages/live-shell/ui/src` for "trail" finds only a CSS comment. The shell has no trail store, so nothing here can read one. The shell does have a file selection, `selectedRef` (`shell/workspace.tsx:48`, `:236`), which is Central file selection, not Expression subject. Two "subject" concepts exist, but only the Expression subject is in scope here.

> **Re-pinned 12 Oct 2026 (P0-V2 item 23).** The "finds only a CSS comment" search result is stale. "Trail" now appears as a dock tile name in `packages/live-shell/ui/src/shell/ModeContextDock.tsx:42`, and in the live and base tile lists (`:54-55`). Whether a trail store backs that tile was not checked, so "the shell has no trail store" is not re-verified here.

## Encounter transitions used below

- **T1 Subject select.** Changes which object is selected. Must go through the owner's `select`.
- **T2 Presentation open.** Shows a device or Studio section. Carries no subject.
- **T3 Subject-bound write.** Reads the selected object and sends an apply on the reading's basis.
- **T4 Batch subject.** Acts on several objects at once. The owner has no operation for it.

## Audit table

| # | Surface | Reads | Transition | Keeps its own selection? | Verdict |
|---|---|---|---|---|---|
| A | Rack entity widgets | `reading.selection` via `selectedEntityOf` (`nativeDeviceRackModel.ts:76`, `:112`) and `selectedEntity` (`NativeDeviceRack.tsx:77`, from `nativeDeviceStripModel.ts:31-35`) | T3 | No | Aligned. Duplicate resolver (see D2). |
| B | Browser pool | `reading` from workspace; `selectEntity` sends owner `select` (`NativePropertyBrowser` not involved; `NativeDevicePool.tsx:28-31`) | T1 for its select; T2 for open | The pool itself: no. Its child editor: **yes** (see S1) | Partly aligned. S1 is the defect. |
| C | Typed open-device event | Payload `{scope, family}` only (`nativeDrag.ts:70`, `parseOpenDevice`) | T2 | No | Aligned. |
| D | Typed open-studio event | Payload `{section}` only (`native/openStudio.ts:4`, `nativeDrag.ts:11`) | T2 | No | Aligned. Three constants for one string (D3). |
| E | Arrange local checklist | `reading.selection.entity_ids` once, at mount (`NativeSceneFace.arrange.tsx:24`) | T4 | **Yes** (see S2) | Duplicate store, needed by the owner's gap. |

Detail for each follows.

### A. Rack entity widgets: aligned

The rack reads one object through `selectedEntityOf` (`packages/live-shell/ui/src/components/nativeDeviceCatalogue.ts:28-31`, which requires exactly one id). Entity widgets build their target from that object. The Force card uses `selectedEntity` from `nativeDeviceStripModel.ts:31-35`, which has the same body. Writes use `apply` on `reading.basis` (`NativeDeviceRack.tsx`, the `send` helper near `:36-50`). The rack keeps no selection.

The rack's "Open settings" for an entity widget (`NativeDeviceRack.tsx:141`) sends `{scope:'entity', family}`. The pool then reads the same spine. Good.

### B. Browser pool: the container is aligned; its child is not

`NativeDevicePool.tsx:28-31`: `selectEntity` sends `{operation:'select', basis, entity_id}` to the owner, and only when `presented()` (`:30`). The container keeps no selection of its own. That is the right transition (T1 through the owner).

The defect is one level down, in the editor the pool hosts (`NativeDeviceEditors.tsx`, see S1). `NativeDevicePoolView.tsx:67-68` mounts it with `onSelectEntity`.

### C. Typed open-device event: aligned

`nativeDrag.ts:9` defines `OPEN_DEVICE_EVENT`. `parseOpenDevice` (`:70-79`) admits only `{scope, family}`, and `dispatchOpenDevice` (`:83-86`) sends only that. The listener `WorldBrowser.tsx:69-75` stores `{...request, nonce}` as presentation state. `App.tsx:117` only reveals the Browser. Nothing in the payload is a subject, so this is a clean T2.

Emitters: the rack title (`NativeDeviceRack.tsx:141`), the Browser's device rows (`NativeDeviceBrowser.tsx:28`), the Parameters "Open device" button (`NativePropertyBrowser.tsx:123`), and the Configure › Devices handoff (`NativeWorldDetail.tsx:174`, which hard-codes `'force'` or `'physics'`, see the fifth-places audit).

### D. Typed open-studio event: aligned, with a drift risk

Emitters:
- `NativeDevicePoolView.tsx:59` sends `{section: device.studio}`.
- `GlyphSequenceEditor.tsx:285` sends `{section:'formations'}`.

Listener: `panels/expressions.tsx:219-226` parses with `parseNativeOpenStudio` (`native/openStudio.ts:8`), holds the section as `pendingStudio`, and flushes it once the panel is presented (`flushStudio`, around `:214`). `host.ts:336` posts `{command:'open-studio', section}` to the application. The payload has no subject. The Studio opens on the application's own selection (`app.ts:127`), which is the spine's source. So D is a T2 that correctly leaves subject to the owner.

**D3, drift.** The same string is defined three times: `nativeDrag.ts:11` (`OPEN_STUDIO_EVENT`), `native/openStudio.ts:4` (`NATIVE_OPEN_STUDIO`), and `nativeGlyphSource.ts:14` (`GLYPH_OPEN_STUDIO_EVENT`, with a comment that it "Equals NATIVE_OPEN_STUDIO ... (drift-tested)"). A test guards it, but there is no single source. Proposed fix: one constant, imported by the other two.

### E. Arrange local checklist: a second selection store

`packages/live-shell/ui/src/components/NativeSceneFace.arrange.tsx:24`:

```
const [checked, setChecked] = useState<ReadonlySet<string>>(() => new Set(reading.selection.entity_ids))
```

The set is seeded once, from the spine, at mount. Nothing re-syncs it: there is no `useEffect` on `reading.selection`. The checkboxes and quick selects (`toggle` at `:63`, `quick` at `:67`) write only this set. The panel says so itself, at `NativeSceneFace.arrange.tsx:91`: "checking here does not change the native selection."

> **Re-pinned 12 Oct 2026 (P0-V2 item 23).** The seed and the no-re-sync finding hold: `useState` seeds the set at `NativeSceneFace.arrange.tsx:26`, and the file has no `useEffect`. The quoted line has moved to `:99` (not `:91`), and `toggle` and `quick` are at `:71` and `:75` (not `:63` and `:67`). The owner's `select` still takes one `entity_id` (`packages/expressions-boundary/src/editor.ts:182`), so the gap stands.

The reason it exists is real: the owner's `select` takes one object (`editor.ts:182`), so a multi-object batch cannot be a spine selection today. That makes it a T4 gap, not a casual copy. It is still a second store, and it is not bounded: it is not cleared on Scene change while the panel is mounted.

## Duplicate stores and rule splits

### S1. `NativeDeviceEditors.selected`: the defect

`packages/live-shell/ui/src/components/NativeDeviceEditors.tsx:328`:

```
const [selected, setSelected] = useState<string | null>(null), ...
```

It is used in three ways that matter:

- `:337` (`readPresentation`): `id = now.selected ?? now.reading?.selection.entity_ids[0] ?? null`. The local value wins over the spine.
- `:371`: `currentEntityId = selected ?? reading?.selection.entity_ids[0]`. The entity the editor shows and writes to comes from here.
- `:378`: the "Device target entity" `<select>` calls `setSelected(event.target.value)` and then `onSelectEntity?.(event.target.value)`. The local value is set before the owner answers, and the owner's answer is not checked.

The only resync is an effect at `:350-353`, which runs when `reading.selection.entity_ids` or the Scene changes. So:

- If the owner refuses the `select`, or the pool is not presented (`NativeDevicePool.tsx:30`, which silently skips the send), the local value stays.
- The editor then shows and builds changes around the local object, while the rack and Force card show the spine's object. Two objects on screen, and the write path follows the editor.

This is not a live-verified bug. It is what the code does, read carefully. The live replay step B-6 and the spine step E-2 in `EXPRESSIONS-LIVE-REPLAY.md` are the check.

Proposed fix: the editor derives its object from the spine only. A pending target can be held for the duration of one request, and cleared on the reply, not kept as state.

### S2. `ArrangePanel.checked`: a batch set, not a selection

See E above. Named precisely: `NativeSceneFace.arrange.tsx:24`, `checked`. Proposed fix: either an owner multi-select operation (then `checked` becomes a view of the spine), or name it as a batch set and clear it on Scene change.

### S3. `NativePropertyBrowser.selected`: parameter focus

`packages/live-shell/ui/src/components/NativePropertyBrowser.tsx:24`:

```
const [selected, setSelected] = useState<{expression: string; scene: string; target: string} | null>(null)
```

This is which parameter row is focused, not which object is selected. It is keyed to the basis: it counts only while `selected.expression` and `selected.scene` match the reading. So it goes stale safely. It is a legitimate local focus, but the name `selected` invites confusion with the encounter. Proposed fix: rename to `focusedParameter`.

### S4. Object scope reads the first id

`NativePropertyBrowser.tsx:29`: `const entityId = reading?.selection.entity_ids[0]`. The Object scope of the Parameters browser follows the first selected id, even when more than one is selected. This rule differs from the rack's (see R1).

## Rule splits: one concept, two definitions

The shell and the owner disagree about "the selected object" when more than one object is selected.

**Rule R1: exactly one, otherwise none.** Used by:
- `nativeDeviceCatalogue.ts:30` (`selectedEntityOf`)
- `nativeDeviceStripModel.ts:33` (`selectedEntity`, a copy)
- `NativeChosenControls.tsx:232`
- `NativeSceneFace.automation.tsx:110`
- `NativeRackEditor.tsx:124`
- `NativeWorldDetail.tsx:149` (the Object header select's displayed value)

**Rule R2: the first id.** Used by:
- `NativeDeviceEditors.tsx:337`, `:371` (the pool editor; see S1)
- `NativePropertyBrowser.tsx:29` (see S4)
- `NativeObjectBrowser.tsx:30` (starter target: `reading.selection?.entity_ids?.[0]`)
- `App.tsx:69` (the Canvas return check)
- `nativePinMode.ts:34`, `:68`
- **the owner side**: `packages/expressions-boundary/src/chosenControls.ts:16`, `:32`, `:55`, and `packages/expressions-boundary/src/editorHost.ts:47`

The owner-side rows matter most. A chosen control in "Follow" (scope `selected`) resolves to `ids[0]` in the owner, at `chosenControls.ts:55` and `editorHost.ts:47`. So with two objects selected, the rack shows no target ("Select one object to act on it"), but a Follow control drives the first object. This is a real, specific split. It needs an owner ruling.

Can two objects be selected at all? Yes, through the retained application's multi-select at `app.ts:341`, which the shell does not block. The owner's `select` op cannot create that state, but the app can.

## Summary of findings

1. **S1 is a second selection store that can diverge.** `NativeDeviceEditors.tsx:328`, with the three uses at `:337`, `:371` and `:378`. It must go.
2. **E is a second store, justified by a real owner gap.** `NativeSceneFace.arrange.tsx:24`. It is an honest batch set, but it is not reset on Scene change.
3. **R1 and R2 are two rules for one concept.** The owner's Follow controls drive the first object while the shell shows none. Needs an owner ruling: exactly one, or a defined rule for many.
4. **Duplicate resolver.** `selectedEntityOf` (`nativeDeviceCatalogue.ts:28`) and `selectedEntity` (`nativeDeviceStripModel.ts:31`) are the same function, and the rack imports both.
5. **D3 drift.** Three constants for one event string.
6. **Trail is not built.** Nothing in the live shell reads or writes a trail.

## Proposed owner rulings (for the integrator)

- Decide whether the owner supports multi-select. If not, the app should stop writing more than one id (`app.ts:341`), and `checked` (E) can stay a documented batch set.
- If it does, add one owner multi-select operation, and make `checked` a view of the spine.
- Pick one rule for "the selected object" and apply it in `chosenControls.ts` and `editorHost.ts` as well as in the shell.

## Not verified

- The divergence in S1 is from reading code. It has not been run. `EXPRESSIONS-LIVE-REPLAY.md` steps B-6 and E-2 are the way to check it.
- Whether the retained application's own `selected` is reset on every native reload. I read the write paths (`app.ts:341`, `:1197`) and the read path (`:1193`), but not every load path.
