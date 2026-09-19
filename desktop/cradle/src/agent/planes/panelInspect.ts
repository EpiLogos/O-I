/**
 * The centre → panel hand-off seam.
 *
 * A centre surface (Factory development, a build trajectory, anything that
 * lists work) does not draw its own inspector: it hands the selected thing to
 * the accompanying panel's Inspect plane by dispatching
 *
 *     window.dispatchEvent(new CustomEvent("oi:panel-inspect", {detail}))
 *
 * with `detail = {kind, ref, title, payload}`. The panel (AgentLayer) listens,
 * keeps the item in its bounded "handed here" list, selects it and shows the
 * Inspect plane. The panel's own Activity plane uses the same seam when a row's
 * "Inspect" is pressed, so there is one path in.
 *
 * The payload is shown verbatim. The panel never enriches it, never fetches on
 * its behalf and never treats it as an owner record of its own — `source`
 * names who handed it over.
 *
 * Counterpart: src/contributions/factory/FactoryDevelopmentSurface.tsx and
 * BuildSurface.tsx dispatch; src/agent/AgentLayer.tsx listens.
 */
export const PANEL_INSPECT_EVENT="oi:panel-inspect";

export interface PanelInspectDetail {
 /** What the thing is, in the handing surface's own vocabulary:
  * "operation" | "kernel-receipt" | "factory-journey" | "factory-run" |
  * "factory-execution" | "factory-span" | … — shown as a label, not switched on. */
 kind:string;
 /** The thing's own ref. Identity for de-duplication: same kind + ref replaces. */
 ref:string;
 title:string;
 /** The material itself, rendered verbatim (text as text, anything else as JSON). */
 payload?:unknown;
 /** Who handed it over, e.g. "Factory development", "Activity". */
 source?:string;
}

export function isPanelInspectDetail(value:unknown):value is PanelInspectDetail {
 const detail=value as Partial<PanelInspectDetail>|null;
 return !!detail&&typeof detail==="object"&&typeof detail.kind==="string"&&typeof detail.ref==="string"&&!!detail.ref&&typeof detail.title==="string";
}
/** Hand one thing to the accompanying panel's Inspect plane. */
export function handToPanelInspect(detail:PanelInspectDetail) {
 window.dispatchEvent(new CustomEvent<PanelInspectDetail>(PANEL_INSPECT_EVENT,{detail}));
}
export const panelInspectKey=(detail:{kind:string;ref:string})=>`${detail.kind}:${detail.ref}`;
