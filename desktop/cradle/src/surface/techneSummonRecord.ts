/**
 * The composition root's summon-record DECISION, extracted from CradleFrame so
 * the production routing has automated coverage — the §41 fail-on-disconnect
 * seam an independent review flagged: the join browser proof stubs the recorder,
 * so the mode gate and the presented-centre target resolution had none.
 *
 * A construction summon becomes a field-open only in the Technē cut, and it
 * names the presented Technē centre by the SAME `centreBindingOf(ws, "techne",
 * "techne")` call the stage slot uses to MOUNT that centre (CradleFrame's
 * `stageCentres`), so the recorded target is always exactly the presented
 * host's binding id — never a concealed one.
 *
 * `resolveCentre` is a REQUIRED parameter (production passes the real
 * `centreBindingOf`; the unit test stubs it) so this module imports nothing at
 * runtime — only erased types — and stays loadable by `node --test` without the
 * retention/React/CSS chain `centreBindingOf` otherwise drags in.
 */
import type {Workspace} from "../workspace/store";
import type {WorkspaceMode} from "../workspace/mode";

/** The presented-centre resolver: the production caller passes `centreBindingOf`,
 * the unit test a stub. Only the binding id is read. */
export type CentreResolver = (workspace: Workspace, activeMode: WorkspaceMode, mode: WorkspaceMode) => {id: string} | undefined;

export interface TechneFieldOpenRequest { ref: string; target: string | null }

export function techneFieldOpenRequest(
  workspace: Workspace,
  mode: WorkspaceMode,
  expressionRef: unknown,
  resolveCentre: CentreResolver,
): TechneFieldOpenRequest | null {
  if (mode !== "techne") return null;
  if (typeof expressionRef !== "string" || !expressionRef.startsWith("expression:")) return null;
  return {ref: expressionRef, target: resolveCentre(workspace, "techne", "techne")?.id ?? null};
}
