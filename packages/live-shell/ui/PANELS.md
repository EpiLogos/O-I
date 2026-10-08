# Shell panel contract

The five-region frame keeps a data-driven panel registry in `src/shell/panels.ts`. Existing registrations retain their ids, ordering and `PanelContext`. Import registration modules through `src/panels/index.ts`.

| Slot | Surface |
| --- | --- |
| `center` | Persistent application frame; an icon in the top-right strip selects it. Concealing it preserves its document and renderer. |
| `right-dock` | Optional collapsible native context/agent panels. |
| `bottom` | Additional panels beside the selected track chain or clip detail. |
| `browser-section` | Additional native material in the browser. |

`registerPanel({id,title,slot,component,order?,icon?,note?})` registers a `ComponentType<PanelContext>`. `icon` names an original glyph from `components/Icon.tsx`; `note` is a tooltip. `getPanels(slot)` sorts by order, then title. `unregisterPanel(id)` removes a registration. Duplicate ids replace their registration with a warning.

`PanelContext` carries `{set,loading,error,openSet}`. `set` is the stable `/api/summary` reading. Deep audio readings come from `/api/document`, owned by the document lane. An extension may read its native owner; the registry does not own, edit or save a document.

The built-in `world.expressions` inhabitant mounts the candidate's real Expressions application through `@epilogos/expressions-boundary`. Expressions and Technē are two disclosures of that single retained frame. Only kernel references, selection readings, routed operations and owner receipts cross its boundary. The `native.context` right panel and contextual bottom surface read real Agency, Agent Card, Day, selected source and expression owners. Presentation context in `src/shell/workspace.tsx` holds these readings, never a second document store.

Session/Arrangement are selected by the two view icons in the transport strip. Their bottom-bar Clip/Device controls open the selected clip details or track effect chain. The Arrangement overview owns traversal and zoom; there is no duplicate navigation bar.

Use measured geometry and tokens in `styles.css`, original assets, and normal package imports. Never present fabricated data or playback/editing controls as operative before their native owner is attached. Milestones and diagnostics belong in tooltips/status, not prose on the canvas. Reference captures are research evidence and are never shipped.

Run the backend with a real `.als` file. For a candidate beside the owner's server, use `LIVE_SHELL_BIND=127.0.0.1:8788`, an explicit `LIVE_SHELL_KERNEL_BRIDGE`, and the candidate Vite configuration. Production UI builds with `npm run build` in this directory and is served under `/app/` by that backend. Each hosted asset comes from this candidate's Expressions build; no fallback checkout is used.
