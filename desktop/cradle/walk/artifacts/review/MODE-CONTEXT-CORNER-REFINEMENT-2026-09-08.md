# Mode, context and canvas-corner refinement — 2026-09-08

Standing: implementation and observed evidence, codex-shell-lead. This is a bounded implementation receipt, not human visual acceptance.

## User direction and implementation

The pen and @ are the two modes; no additional Text/Components selector. Selecting the pen reveals the document's writing toolkit in the header. Selecting @ reveals attachment tools and enables component bounds picking. Editing commands also remain in the shared-style writing right-click menu, including standard granular selection and four highlight colours. A previously selected passage can be attached after switching to @. Header collapse has a 36 × 26 CSS-pixel target and yields actual document height.

Focused pane footers open from their bottom edge and reclaim layout height, with a 420 ms eased transition. The global footer also expands layout and retains its pin option. Canvas scrollbar chrome is hidden while scrolling remains functional. The first visible top-left pane alone reserves the Mac controls, with a real corner cutout that follows the live sidebar geometry; the area around the traffic lights has no canvas top/left border. Side and bottom margins are reduced and the top gains four pixels. The My O:I heading alignment is adjusted.

Text editors, rendered HTML/Markdown, and native browser pages now have context observations. A page component is outlined and picked without invoking its click action. A granular page text selection is preserved independently. Observations carry text, a selector/role, measured bounds and their actual source/page origin. Inclusion revalidates the live DOM (or source revision/range) and appends through the real conversation draft owner with CAS; it does not send to a provider. Opaque material frames use source-checked request/response messages; native pages expose no shell IPC. A native notification requests a host-side reading only. Navigation invalidates pending readings. The material script is explicitly hash-allowed by native CSP; its hash is checked by the page-context walk.

## Evidence

- `../refinement.json`: 31/31 checks. Real Central source/Flow saves, granular highlight/format/undo, header toolkit and two-mode controls, right-click commands, physical footer and toolbar expansion, tab operations and sidebar resizing.
- `../context-draft.json`: 12/12 checks. Exact seven-character source selection, real AIKit-owned draft preservation and CAS, structural observations, source-stale refusal and rendered-page mutation refusal without owner draft changes.
- `../page-context.json`: 11/11 checks. Real HTML interaction, granular selection, opaque-frame observation, component picking without activation, scroll movement with hidden bars, sandbox preservation and exact native CSP hash.
- Native Tauri app build succeeded with the production bundle; no walk channel is shipped. Native browser selected precisely `Precise` (7 characters) with its HTTP URL and measured bounds. Native component selection produced `Increment`, `html > body > button`, 121 × 48 bounds, while the counter stayed at zero. Native rendered Markdown selected `bold` as its real `strong` element, with Central path provenance and bounds.

## Boundaries

DOM observations are untrusted observed page content, not canonical source revisions. PDF internals, inaccessible cross-origin nested frame contents and arbitrary non-DOM drawing primitives are not claimed as semantic pickable elements. Local highlight decorations retain the previous matching-document persistence contract; no new synced annotation owner or Git owner workflow is claimed. Legacy textarea-based walks have not been represented as new editor acceptance.

Concurrent System, expression study, governance and shared NOW/DAY work remains with its existing owners. This session adds one named project NOW return; the shared day was already closed by its active owner and is not rolled again here.
