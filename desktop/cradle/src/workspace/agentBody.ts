import type {WorkspaceMode} from "./mode";

export const EPI_PRIME_QL_BODY_REF="agent-body/epi-prime-ql" as const;

/** The Epi world keeps its constituted agent while the person moves between
 * its reading surface, Expressions and Technē, and in Base, where the Epi lens
 * turns the field on (the field's companion is that body, not the ordinary
 * agent). Merely entering Expressions or Technē outside that world does not
 * acquire the body, and lens OFF leaves the ordinary agent. */
export function modeDefaultAgentBody(world:string|undefined,mode:WorkspaceMode):string|undefined {
  return world==="epi-logos" && (mode==="epi-logos"||mode==="expressions"||mode==="techne"||mode==="base")
    ? EPI_PRIME_QL_BODY_REF
    : undefined;
}
