import type {WorkspaceMode} from "./mode";

export const EPI_PRIME_QL_BODY_REF="agent-body/epi-prime-ql" as const;

/** The Epi world keeps its constituted agent while the person moves between
 * its reading surface, Expressions and Technē. Merely entering Expressions or
 * Technē outside that world does not acquire the body. */
export function modeDefaultAgentBody(world:string|undefined,mode:WorkspaceMode):string|undefined {
  return world==="epi-logos" && (mode==="epi-logos"||mode==="expressions"||mode==="techne")
    ? EPI_PRIME_QL_BODY_REF
    : undefined;
}
