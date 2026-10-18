/** Where a Nara turn stands in Nara's map (manual §24.9; T-WORLDS §6, W4): the branch of M4 a turn belongs to follows the
 * practice it comes from, never one constant.
 *
 *   journal                       M4.4.4.2 Temporal sedimentation (context)
 *   dreams                        M4.4.4.3 Symbolic body (context)
 *   a journey                     M4.2 Divinatory frameworks (oracle)
 *   a sitting, or the centres     M4.1 Sympathetic medicine (embodied)
 *   identity                      M4.0 Mahamaya identity matrix (identity)
 *   a container                   M4.3-2.0 Bohmian dialogue · M4.3-2.1 Native talking circle · M4.3-2.2 Diamond Approach inquiry
 *                                 (transformation)
 *   a return                      M4.5 Epii integration (integration)
 *   an open conversation          M4.4.4.4 Personal Pratibimba (context)
 *   a spoken turn                 M4.1 (embodied): speech is the body's (the voice gate, kernel/src/nara_voice.rs)
 *
 * The coordinates are the Bimba map's (QL `c/registry/m-tree-source-v1.json`; the ticket's Appendix A), named, never invented,
 * and the map is never adjudicated here: M4.3-2.0–2.2 carry the dot after a non-4 that QL's defect record names, and stand as the
 * map has them. Each branch's coordinate begins with its branch's own (QL `M4Branch::coordinate`), as the dialogue context's
 * validation requires (dialogueContext.ts validateDialogueContext). Pure. */
import type {M4Branch, MFocus, NaraDialogueContext} from "./dialogueContext";

export type ContainerForm = "dialogue" | "circle" | "inquiry";
export type Practice =
  | {readonly kind: "journal"}
  | {readonly kind: "dreams"}
  | {readonly kind: "journey"}
  | {readonly kind: "sitting"}
  | {readonly kind: "centres"}
  | {readonly kind: "identity"}
  | {readonly kind: "container"; readonly container: ContainerForm}
  | {readonly kind: "return"}
  | {readonly kind: "conversation"}
  | {readonly kind: "spoken"};

export interface PracticeBranch {
  readonly coordinate_ref: string;
  readonly m4_branch: M4Branch;
  readonly active_m_focus: MFocus;
}

const CONTAINER_COORDINATE: Readonly<Record<ContainerForm, string>> = {dialogue: "M4.3-2.0", circle: "M4.3-2.1", inquiry: "M4.3-2.2"};

const at = (coordinate_ref: string, m4_branch: M4Branch): PracticeBranch => ({coordinate_ref, m4_branch, active_m_focus: "m4"});

/** The branch of M4 a turn from this practice stands in. */
export function practiceBranch(practice: Practice): PracticeBranch {
  switch (practice.kind) {
    case "journal": return at("M4.4.4.2", "context");
    case "dreams": return at("M4.4.4.3", "context");
    case "journey": return at("M4.2", "oracle");
    case "sitting": case "centres": case "spoken": return at("M4.1", "embodied");
    case "identity": return at("M4.0", "identity");
    case "container": {
      const coordinate = CONTAINER_COORDINATE[practice.container];
      if (!coordinate) throw new Error("A container is a dialogue, a circle or an inquiry.");
      return at(coordinate, "transformation");
    }
    case "return": return at("M4.5", "integration");
    case "conversation": return at("M4.4.4.4", "context");
  }
}

/** The context a spoken turn carries: whatever practice the conversation stands in, speech stands with the body (M4.1). */
export function spokenContext(context: NaraDialogueContext): NaraDialogueContext {
  return {...context, ...practiceBranch({kind: "spoken"})};
}

/** The practice a Flow page keeps, by its own meta: its container (dialogue, circle, inquiry), its journey, or the practice the page
 * was made for (`meta.practice`: journal, dreams, sitting); a Flow with none of these is an open conversation. */
export function practiceOfFlow(meta: {readonly container?: unknown; readonly journey?: unknown; readonly practice?: unknown}): Practice {
  if (meta.container === "dialogue" || meta.container === "circle" || meta.container === "inquiry") return {kind: "container", container: meta.container};
  if (meta.journey && typeof meta.journey === "object") return {kind: "journey"};
  if (meta.practice === "journal" || meta.practice === "dreams" || meta.practice === "sitting") return {kind: meta.practice};
  return {kind: "conversation"};
}
