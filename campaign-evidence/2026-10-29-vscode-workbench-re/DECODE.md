# VS Code workbench RE — decode of record

**Landed:** 2026-10-29, DLW build run, lane AF (map O-I #706, ticket #741 "Reverse engineering into the product"). The manual
(`ProjectCentral/docs/1-vision/dlw/DLW.md`) names VS Code's workbench as the source of Central's code-editor side (§5 line 296,
§18 line 4620, the sources of §17.9 Terminal, §18.3 Packet, §18.4 Search, §18.5 Docs and the shell kit §23.2–23.7). No decode of it
was kept before this one; the search line (#820) ported the manual's words only.

## What was read

| | |
|---|---|
| Application | `/Applications/Visual Studio Code.app` (Microsoft's build), version **1.141.0**, commit `2a59476c9bfcb90b3ddc372c36762471b7dfad1c` |
| Licence | the workbench's source is MIT (microsoft/vscode, "Code - OSS"); the shipped build carries Microsoft's product licence (`LICENSE.rtf`). Nothing was copied: the build was read on this machine to identify rules, and each rule was written again in O-I's own code |
| Files | `Contents/Resources/app/out/nls.keys.json` (sha256 `d6e6531c…75cf`), `nls.messages.json` (`6a5dff7c…6035`) — every UI string keyed by its source module; `out/vs/workbench/workbench.desktop.main.js` (`631c1d79…d905`) — the minified workbench, read for defaults and handlers by grepping each setting's or string's key |
| Method | a 20-line reader zips `nls.keys.json` (module → keys) with `nls.messages.json` (messages, in the same order) and prints `module :: key :: message` for a pattern; the setting registry (`"<setting>":{type:…,default:…}`) and the handler beside a key were read from the bundle with `grep -o '.{N}<key>.{M}'`. Nothing was downloaded, run, or decompiled |

## The rules taken, and where they landed

### Editor tabs and groups

| Rule (VS Code 1.141) | Evidence | O-I |
|---|---|---|
| Double-clicking a tab toggles its group. `workbench.editor.doubleClickTabToToggleEditorGroupSizes`: `enum ["maximize","expand","off"]`, `default:"expand"`; `maximize`: "All other editor groups are hidden and the current editor group is maximized to take up the entire editor area." The handler (multiEditorTabsControl) listens for `DBLCLICK` (and a two-tap) on the tab: a pinned editor's group toggles, a preview editor is pinned instead | `vs/workbench/browser/workbench.contribution :: workbench.editor.doubleClickTabToToggleEditorGroupSizes.maximize`; bundle `…doubleClickTabToToggleEditorGroupSizes){case"maximize":this.groupsView.toggleMaximizeGroup(this.groupView);break;case"expand":…` | DLW §10.2 says "fills the main area … the other panes come back": `maximize` is the rule taken (DLW has no preview editors and no `expand`). `desktop/cradle/src/surface/Workbench.tsx` `Tab` onDoubleClick → `surface.maximize` with the tab's own surface id (the pane it stands in toggles) |
| A tab of an editor with unsaved changes carries a dot; its label reads "{0}, unsaved changes"; `workbench.editor.highlightModifiedTabs` (default false) adds a top border | `vs/workbench/browser/parts/editor/editorQuickAccess :: entryAriaLabelDirty`; `workbench.contribution :: highlightModifiedTabs` | DLW §18.1 "Draft, Saved or Edited since save", §17.8 "The save state shows next to the page": a Central document's tab is marked while its face holds a draft — `packages/live-shell/ui/src/central/documents/paneDrafts.ts`, noted by `documentDoor.ts` publishDocument / withdrawDocument, read through `WorkbenchProps.draftOf`; the mark's title is the manual's "Edited since save" |
| An editor opened twice is revealed, not duplicated (`workbench.editor.revealIfOpen`) | `workbench.contribution` | already so: `central/documents/centralDocuments.ts` documentBinding ("one document, one pane") |
| Split right / down, a 2×2 grid, drop on a group's edge to split, on its centre to move | editor group layout actions | already so: the ⊞ menu (Beside, Below, Four ways), `surface/dropEdge.ts`, `surface.drop` / `surface.drop-edge` |
| A click into an editor activates its group | editor group focus | DLW §10.2 "Focus a pane": a press inside a hosted page now focuses its pane, as a material frame's did — `surface/Workbench.tsx` PANE_FOCUS_FRAMES (`.inhabitant-document-frame` added; found by the walk) |

### Find in the file in front

DLW §18.4: "in a pane it finds in the instrument in front, as VS Code's ⌘F finds in the file in front".

| Rule | Evidence | O-I |
|---|---|---|
| The find widget: "Find" input, "{0} of {1}", "No results", "Previous Match", "Next Match", "Close" | `vs/editor/contrib/find/browser/findWidget :: placeholder.find, label.matchesLocation, label.noResults, label.previousMatchButton, label.nextMatchButton, label.closeButton` | `packages/live-shell/ui/src/central/documents/DocumentFind.tsx` (the line, at the pane's top right) and `documentFindModel.ts` (words, keys) |
| It finds as you type (`find.findOnType`); case-insensitive and literal until told otherwise | `editor/common/config/editorOptions :: find.findOnType`; find state defaults | `desktop/cradle/src/context/document-find.js` `matches` (escaped words, `giu`) |
| Next / Previous wrap round: `loop:!0` | bundle `…seedSearchStringFromSelection:"always",autoFindInSelection:"never",…,loop:!0,…` | page `step` wraps; walked in both engines |
| Seeded from the selection: `seedSearchStringFromSelection:"always"`; a multi-line selection does not seed | same object | the page answers a one-line selection on ⌘F; without one, the last words stand (VS Code keeps the last search) |
| Enter → Next Match, ⇧Enter → Previous Match; ⌘G / ⇧⌘G from the editor (`NextMatchFindAction … mac:{primary:2085}` = ⌘G) | bundle `id:…NextMatchFindAction,label:…"Find Next",…mac:{primary:2085,secondary:[61]}` | `documentFindModel.ts` findKeyOf; the page steps on ⌘G typed inside it |
| At most 19999 matches are decorated: "Only the first {0} results are highlighted, but all find operations work on the entire text." | `findWidget :: title.matchesCountLimit`; bundle `=19999` | page `LIMIT = 19999`; the count reads "n of 19999+" past it |
| Escape closes the widget and the editor takes the focus back | bundle `CloseFindWidgetCommand:"closeFindWidget"`, `…CloseFindWidgetCommand,precondition:…,handler:s=>s.closeFindWidget(),kbOpts:{…,primary:9,…}` (9 = Escape) | the line's Escape (and Escape typed in the page) closes it, clears the marks and focuses the page's frame |
| ⌘F in the Explorer finds in the tree, not in the editor | Explorer's own find | the browser keeps ⌘F where the focus stands in it (`frame/paneFind.ts` paneFinderInFront) |

How the page is marked is O-I's own: a hosted document is a sandboxed frame of another origin, so its find is a page script every
document frame carries (`document/frame.ts` useDocumentFrame → `withFrameScript`), answering its host by message, and it marks with
the CSS Custom Highlight API — no node of the page is added or changed, so the page's payload, its draft fact and its selection stay
as they were; the marks are the system's colours (every match in `Mark`, the one in front in `Highlight`), since the page is paper the
shell's theme tokens do not reach. ⌘F reaches it from the window (`frame/keys/planKey.ts` 'search' → the pane's finder,
`frame/paneFind.ts`) and from inside the page (the page hands its host `oi:document-find-key`). Where you are is the focus, or the last
press when it came after the focus moved: WebKit, the candidate's engine, leaves a pressed button unfocused, so a page can keep the focus
while the hand has moved to the browser (walked).

### Saving (read; not built in this lane)

| Rule | Evidence | Where it stands in O-I |
|---|---|---|
| Closing a dirty editor asks: "Do you want to save the changes you made to {0}?", "Your changes will be lost if you don't save them.", Save / Don't Save / Cancel | `vs/workbench/services/dialogs/browser/abstractFileDialogService :: saveChangesMessage, saveChangesDetail, save, dontSave` | missing: closing a Central document pane drops its draft without a word (`surface/engine.ts` closeSurface; no document checkpoint is registered for Central documents). The manual names no confirm — proposed |
| Auto save: `files.autoSave` off · afterDelay · onFocusChange · onWindowChange (no default in the registry entry; off), `files.autoSaveDelay` `default:1e3` ms | `vs/workbench/contrib/files/browser/files.contribution :: files.autoSave.*, autoSaveDelay`; bundle `"files.autoSaveDelay":{type:"number",default:1e3,…}` | missing: the Document's Metronome ("Saves as you go") and Quantize ("Sets when a save lands", §17.8) are refused (`central/devices/pageBindings.ts` autosave). Proposed |
| ⌘S saves the active editor to its file | keybinding of `workbench.action.files.save` | in a hosted page ⌘S is the form's own portable copy (`desktop/cradle/documents/ql-flow.html:1330` exportCopy); the manual gives ⌘S to the set (§10.8). Recorded, not changed |

### Quick Open, the Command Palette and the history (read; the search line's files were another lane's in this run)

| Rule | Evidence | Where it stands in O-I |
|---|---|---|
| Quick Open with nothing typed lists "recently opened"; a recently opened pick has ✕ "Remove from Recently Opened" | `vs/workbench/contrib/search/browser/anythingQuickAccess :: recentlyOpenedSeparator, closeEditor` | the line lists what AIKit counted (`central/searchLine.tsx` useOpened); no ✕ (gap 25) |
| History is kept per workspace: `history.entries` in StorageScope.WORKSPACE (`HISTORY_STORAGE_KEY,1`), `MAX_HISTORY_ITEMS=200`; `search.quickOpen.includeHistory` `default:!0` | bundle `static{this.MAX_HISTORY_ITEMS=200}static{this.HISTORY_STORAGE_KEY="history.entries"}`, `…HISTORY_STORAGE_KEY,1)` | AIKit keeps the line's counts per project context (aikit-core `familiarity.rs`, 14-day half-life; `knowledge history` receipts per context). "Each world … in its own folder" and History Off are not built (gaps 23, 26) |
| The Command Palette lists commands with their keybindings, recently used first, each "Remove from Recently Used" | `vs/platform/quickinput/browser/commandsQuickAccess :: recentlyUsed, removeFromRecentlyUsed` | `>` on the line: the menu bar's acts with the host's accelerators (`central/searchLineModel.ts` actsOf, MENU_ACCELERATORS) |

## Not taken

- Preview editors (italic tabs replaced by the next open) and `expand` sizing: DLW has neither.
- The find widget's Replace, Match Case, Whole Word, Regular Expression and Find in Selection toggles: the manual's ⌘F finds; it
  names no replace and no options.
- Find history per workspace (`find.history:"workspace"`): the line keeps only its last words while the pane stands.
- Breadcrumbs as a bar over the editor: the manual's title line already names the selection, its world and its day
  (`components/TransportBar.tsx` TransportTitle), and the Files place walks the ground's path (`shell/ModeBrowser.tsx`
  mode-browser-crumbs).

## Verification

`packages/live-shell/ui/tests/af741-workbench-tabs.test.mjs` and `af741-pane-find.test.mjs` (each failed before the change it
covers), and the headless walk `packages/live-shell/ui/tests/af741-central-editor.browser.mjs` — the real App bundle over a
walk-bridge on a scratch Central root, in Chromium and WebKit. The native window is unverified (#821).
