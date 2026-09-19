/**
 * The Canvas lane's presentation stores (L5 Technē M1′, QL-MEF #214) —
 * module-level singletons for the two explicit presentation artifacts:
 * saved Canvas Views and typed relation proposals. Cradle-seam state, never
 * a native owner's store: a view/proposal ref is minted in the
 * ql.techne:view:canvas: / ql.techne:canvas-proposal: namespaces and no
 * entry here can carry semantic relations. The component subscribes; tests
 * build their own instances from the factory functions.
 */
import { createCanvasViewStore, type CanvasViewStore } from "./view.ts";
import { createProposalStore, type ProposalStore } from "./proposal.ts";

export const canvasViews: CanvasViewStore = createCanvasViewStore();
export const canvasProposals: ProposalStore = createProposalStore();
