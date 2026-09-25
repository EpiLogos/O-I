export const OPEN_AUTOMATIONS_EVENT = "oi:open-automations";
/** Presentation request only. The kernel admits the compiled surface and
 * AIKit checks every operation independently. */
export function openAutomations(project?: string) {
  window.dispatchEvent(new CustomEvent(OPEN_AUTOMATIONS_EVENT, {detail: {project}}));
}
