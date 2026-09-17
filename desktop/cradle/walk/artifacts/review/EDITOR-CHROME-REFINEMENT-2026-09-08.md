# Editor and chrome refinement — 2026-09-08

Standing: implementation and observed evidence, authored by codex-shell-lead for the user's final refinement request.

## Implemented

- Shared window/tab row, continuous sidebar grounds, cursor-only resize hit areas on both sides. One geometry animation drives panel bounds and the chrome mask; dragging writes those same values directly. A bounded completion timer settles geometry when WebKit suspends animation frames in an occluded window. Compact and overlay widths remain adjustable.
- Focused pane footers reveal from their own bottom edge, including keyboard focus. Global footer is similarly summonable and has a retained pin preference. Native browser bounds leave those DOM edges reachable.
- Tab-specific focus and destination-pane movement actions; content right-click no longer opens tab-management actions. Focus folds the tab bar away and Escape restores it. Menu subject follows the actual clicked tab.
- CodeMirror editing for Central sources, ordinary text files and Flow. Undo/redo, search/replace, Markdown commands, language support, indentation/comment commands, JSON formatting through the existing file toolbar, standard selections, local highlight decorations and explicit @context attachment. Existing source-owner saves, conflict handling and draft recovery remain the persistence path. Editor history and scroll state are retained in a bounded in-session cache; highlights are retained locally on surface unmount when the document basis still matches.
- Editing toolbar physically folds to its edge, yielding space. Fresh canvas keeps Write, Search and Terminal, with a configurable rotating phrase component. Rotation pauses for focus/editing, hidden windows and reduced motion.

## Evidence

- `walk/artifacts/refinement.json`: 27/27 real-owner/browser checks, covering source saves, selection highlighting without source mutation, formatting and undo, search, physical toolbar folding, bottom-edge footer behavior, tab focus/movement, real Central Flow save, right-panel full/restore, compact and narrow resizing, and overflow.
- `walk/artifacts/context-draft.json`: 7/7 real AIKit conversation-owner checks through the new editor selection path, including exact source/revision quotation, preservation of the existing draft, no provider send, and stale-selection refusal.
- Native rebuilt app: entered and saved `Native editor refinement verified.` in the existing isolated Flow fixture; filesystem content agreed. Native keyboard selection exposed the highlight palette; blue highlighting left the saved source unchanged. Native right-region expansion reached the full remaining canvas after the frame-suspension fix.
- Production TypeScript/Vite and Tauri app bundle succeeded. Production assets contain no `__cradle` walk channel.
- Screenshots: `refinement-fresh-canvas-refined.png` and `refinement-editor-and-chrome-refined.png` in `walk/artifacts/`.

## Limits and continuity

Highlights are local reading annotations, not authored document markup or a synced annotation owner. Welcome customization is exposed by component props and stable phrase records, not yet a settings screen. Git operations and semantic browser-element picking remain the previously recorded owner integration contracts. Legacy walks that assume a textarea need migration to the editor's contenteditable/selection surface; their earlier receipts are not new CodeMirror verification. The bounded refinement and real context-owner walks above are the verification for this tranche.

Concurrent System, point-cloud, governance and NOW/DAY work was not included in this change. The shared day had already been closed by its active owner; this session adds its own bounded project NOW return without rolling that shared day again.
