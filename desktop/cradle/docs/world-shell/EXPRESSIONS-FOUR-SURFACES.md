# Expressions: fifth places (WORLD-SHELL-DESIGN section 16)

Audit, 8 October 2026. Read-only: no product code was edited and nothing was committed.

Paths are relative to `/Users/admin/Central/worktrees/env-1/o-i` (the seat `agent/o-i-20261007-1639`) unless shown as absolute. Line numbers are from the working tree as read; the seat has uncommitted work from other lanes, which this audit did not touch.

## The rule being audited

Design section 16 says a family appears in four places and nowhere else: the browser, the rack, the projections, and the inspectors. Plus its time bindings and telemetry declarations. Section 16 adds: "A family needing a fifth place is a design smell: either the projection set or the family boundary is wrong."

Two things need separating before a verdict:

- **Family surface.** A place where a family's own material or device is shown. A fifth one is a smell by section 16.
- **Projection or shell chrome.** Controls that belong to the Expressions projection itself (camera, capture), or to shell help. These are not family appearances. They can be legitimate, but they still need a proper home.

Verdict words used below: **legitimate** (fits the design), **design smell** (fails it), or **legitimate with a smell** (fits in kind, has a specific defect).

## The five named surfaces

| # | Surface | Where it lives | Family? | Verdict | Proposed home |
|---|---|---|---|---|---|
| 1 | Stage toolbar row | `packages/live-shell/ui/src/components/NativeStageTools.tsx:14`, mounted at `packages/live-shell/ui/src/panels/expressions.tsx:319` | No. Projection chrome | Legitimate with a smell (Export and Import) | Camera, view and capture verbs stay in the projection's pane header. Export and Import move to a file-level surface. |
| 2 | Guide popover | `packages/live-shell/ui/src/components/NativeExpressionGuide.tsx:7`. Opened at `NativeTransportBar.tsx:225-226`, mounted at `:234` | No. Shell help | Legitimate with a smell (copy describes the retained app, not the shell) | Keep as help. Regenerate its copy from the shell's real controls. Its entry point sits in the top bar (report only). |
| 3 | Transport Save | `packages/live-shell/ui/src/components/NativeTransportBar.tsx:211-212`, action at `:119`, Ctrl/Cmd+S at `:70-80`, gate in `nativeExpressionCommands.ts:18-25` | No. Document commit | Legitimate in kind; smell in placement (top bar, report only) | Report only. See the note below. |
| 4 | Takes tab | `packages/live-shell/ui/src/components/NativeWorldDetail.tsx:156` (tab), `:165` (surface). `NativeTakes.tsx:12` | Time material, not a device | **Design smell** | Timeline lanes (the W5 expressions track adapter), with this tab reduced to a selected-take inspector. |
| 5 | Scene panel in the Clip view | `NativeWorldDetail.tsx:156` (tab), `:165` (surface) → `NativeSceneEditor.tsx:15` | Yes: the Scene family | **Design smell** (duplicate host with separate drafts) | One host for the Scene editor. See details below. |

### 1. Stage toolbar row: legitimate with a smell

What it is: one row above the hosted application. Groups: Camera (2D, 3D, face plane), Guides and snap (grid, snap, guides), View (fit, keep, restore), Capture and present (capture PNG, record video, save video, present), a capture-options menu, an Orbit disclosure that says orbit is a pointer drag, Export, and Import (`NativeStageTools.tsx:53-81`).

Verdict. The camera, view and capture verbs belong to the Expressions projection itself. No family's material is shown here, so this is projection chrome, not a fifth family place. The component says so (`NativeStageTools.tsx:11`): the tool rail is in the top bar at `NativeBarControls.tsx:78` (`BarTools`), and this row is the view and capture verbs. There is no duplicate command between the two.

The smell: Export (`NativeStageTools.tsx:75`) and Import (`:80`) are file-level acts in a projection toolbar. Import also just opens the legacy file input (ledger row 34). Those belong with file-level acts.

Proposed home: camera, view and capture verbs in the projection pane's own header. Export and Import under a file-level surface, once the owner admits file acts (ledger rows 24, 25, 34).

### 2. Guide popover: legitimate with a smell

What it is: a dialog with the quick guide, the bound shortcuts, and About. Opened from the transport's Guide button (`NativeTransportBar.tsx:225-226`) and rendered at `:234`.

Verdict. Help is not a family surface, so this is legitimate. The smell is in the content:

- The copy is the retained app's copy, copied into `nativeExpressionCommands.ts:54-59` (`QUICK_GUIDE`). It refers to things the shell does not show: "the framed image icon at top right", "the expression's shared toolbelt on the right", "Open Scenes ... then Save scene". The shell's Save is "Save Expression" (`NativeTransportBar.tsx:211`).
- `BOUND_SHORTCUTS` (`nativeExpressionCommands.ts:63`) hard-codes `source: 'NativeTransportBar.tsx'` on every row, so the source field does not say where a shortcut is really bound.
- The Guide button is inside the transport's "…" overflow (`NativeTransportBar.tsx:191`, panel opened at `:194`). Help is one click deeper than the top-level bar.

Proposed home: keep the popover as shell help. Regenerate `QUICK_GUIDE` from the shell's actual controls. The entry point is top-bar territory, so it is reported only.

### 3. Transport Save: legitimate in kind; placement is a top-bar matter (report only)

What it is: "Save Expression" (`NativeTransportBar.tsx:211-212`), which calls the owner's `save` operation (`:119`), and Ctrl or Cmd+S (`:70-80`, key check at `:74`). `saveState` (`nativeExpressionCommands.ts:18-25`) enables it only when the owner reports a dirty, idle draft. "Saved" is shown only from the owner's reply reading (`saveNotice`).

Verdict. Not a family surface. It commits the open Expression's working edit to the native owner, which is the right authority. Its honesty is good: it does not claim a save it did not get.

Two things for the top-bar lane to weigh (not proposed here):

- The button sits inside the transport overflow (`NativeTransportBar.tsx:191`). The only one-step path is Ctrl or Cmd+S.
- "Save" here is an owner commit, not a Central file write. The shell has no file save: ledger row `native-save-file` is owner-op-required. The name "File Save" in the replay brief should be read as this owner commit.

### 4. Takes tab: design smell

What it is: the "Takes" clip surface (`NativeWorldDetail.tsx:156`, shown at `:165`). It lists the Scene's recorded property tracks from `readNativeTakeTracks(reading.scene)`. Preview is a frame host-command (`NativeTakes.tsx:26-33`). Delete is one owner `track-remove` apply (`NativeTakes.tsx:35-41`).

Verdict. Takes are not a device. Design section 15 puts them in the transport stratum (takes are "transport material"), and W1 says a family's `time` contributes "scenes, automation, and takes as transport material". So takes are time material, and a Clip-view tab is a fifth place for them.

The same takes are already controlled from three places:

- the transport's Arm, record and take-mode controls (`NativeTransportBar.tsx:177-181`, and the take-mode select inside the overflow);
- this Takes tab;
- the planned Timeline lanes (W5, `expressionsTrackAdapter.ts`, not yet in the tree I read).

The tab also shows only one Scene at a time, because it reads `reading.scene`. Across Scenes, takes are a timeline question.

Proposed home: the Timeline projection. A take is a clip in a lane. Keep this tab as a selected-take inspector (name, points, duration, Delete). Preview becomes a lane gesture.

### 5. Scene panel in the Clip view: design smell (duplicate host)

What it is: the Scene tab in the Clip view (`NativeWorldDetail.tsx:156`, surface at `:165`) mounts `NativeSceneEditor` (name, duration, transition, Save and next, loop, scene list, add, duplicate, remove).

Verdict. The Scene family appears in the Clip view, and the same editor is mounted a second time in the device pool. The pool's Scene device, `ScenePanel`, renders `<NativeSceneEditor reading={reading} request={request}/>` at `packages/live-shell/ui/src/components/NativeSceneFace.scene.tsx:55`, under the Expression title and description. The pool host is `NativeDevicePoolView.tsx:45` and `:64-65`. A third Scene surface sits under Configure › Scene (`NativeWorldDetail.tsx:175`, see "Other fifth places").

The defect is not only placement. `NativeSceneEditor` keeps its own draft map per instance (`NativeSceneEditor.tsx:16`: `const drafts = useRef(new Map...)`). Two mounted instances therefore keep two independent drafts. A duration or title typed in one is not visible in the other until it is committed. Owner state converges after commit, but the uncommitted drafts can disagree.

Contrast, which is the right pattern: `GlyphSequenceEditor` is also mounted twice, in the Clip view's States tab (`NativeWorldDetail.tsx:165`) and in the compact device chain (`:167`). Both receive one shared draft map, `drafts={drafts.current}` (map created at `NativeWorldDetail.tsx:36`, passed at `:165` and `:167`). That dual hosting is legitimate because the drafts are shared.

Proposed home: one host for the Scene editor. The Clip view is the natural host for Scene craft (duration, transition, loop, scene list): the design's own analogy is Live's clip view (section 12). The pool's Scene device would then keep the Expression title and description and link to the Clip view. The reverse (editor in the pool, Clip view shows only the clip summary) also fits section 16. Either way, one owner for the drafts.

## Other fifth places found

Ordered by how clearly they fail section 16.

1. **Configure › Scene: a full second Scene transport.** `NativeWorldDetail.tsx:175` mounts `NativeSceneTransport` without `compact`. Non-compact mode renders Play, Scene select, saved sequence, scrub, time readouts and Scene ↗ (`packages/live-shell/ui/src/components/NativeSceneTransport.tsx:10` and the non-compact branch below it). This copies the top bar's transport (`NativeTransportBar.tsx`). **Design smell.** Proposed home: Configure › Scene keeps Scene settings only. Transport lives once, in the top bar and in the Timeline projection.

2. **Configure › Devices: a handoff with hard-coded families.** `NativeWorldDetail.tsx:174` opens the pool with `family: selected ? 'force' : 'physics'`. The button is a fifth door to the pool, and it names two families in core shell code. That runs against section 13's neutrality test ("The core never says Central or Factory"). **Design smell.** Proposed home: remove the Devices tab. The pool is already reached from the rack titles (`NativeDeviceRack.tsx:141`), the Browser's Devices list (`NativeDeviceBrowser.tsx:28`), and the Parameters "Open device" button (`NativePropertyBrowser.tsx:123`).

3. **Scene devices cannot be opened from the rack.** `NativeDeviceRack.tsx:139-140` renders a scene widget's title as a plain `<span>`. Every other widget's title is a button that opens its panel (`:141`). A scene device's only doors are the Browser and the pool. **Inconsistency**, not a fifth place. Proposed home: make the scene title open the pool like the others, or record why not.

## Checked and legitimate

- **Glyph sequence editor, dual-hosted.** Clip view States tab and compact device chain, with one shared draft map (see item 5 above). This is the pattern the Scene editor should follow.
- **Session and Arrangement transport.** `SessionView.tsx:91` and `ArrangementView.tsx:130` mount `NativeSceneTransport` with `compact` set, from `App.tsx:274-275` (`compactTransport={workspace.mode === 'expressions'}`). Compact mode shows only Scene ↗ and Acts (`NativeSceneTransport.tsx`, compact branch). No second playback control.
- **Chosen controls in Configure › Controls** (`NativeWorldDetail.tsx:169`, `NativeChosenControls`). This is the rack's own chosen-control surface, not a fifth place.
- **Starters in the Objects browser** (`NativeObjectBrowser.tsx`). Browser category content.

## Top bar: reported, not proposed

Per the brief, the top bar is owned by another agent. These are reported only:

- Transport Save (item 3 above).
- The Guide entry point inside the transport overflow (item 2 above).
- Arm, record and take-mode controls in the transport (`NativeTransportBar.tsx:177-181`, overflow at `:191`). Takes are time material, so this is part of the takes finding (item 4).
- The pin and chosen-control strip, `BarStrip` (`NativeTransportBar.tsx:230`). Chosen controls then appear in three places: this strip, Configure › Controls, and the Browser's "Add to toolbelt".

## Not audited

- The Fold state flow (ledger rows 48 and 49) and the Objects starters flow were not opened beyond their ledger notes.
- Live behaviour. Everything above is from reading code, not from running the shell. The replay checklist (`EXPRESSIONS-LIVE-REPLAY.md`) is where that check goes.
