/** Your elemental map (manual §22.5 Chakra's personal layer; §24.9 M4.1; T-WORLDS §6, W4): the kernel's `nara_elemental`
 * (kernel/src/nara_elemental.rs) over QL's `nara.elemental-map` (`ql.nara-elemental-reading/v1`), from the elements your saved identity
 * carries — its natal composition, or its birthdate encoding — at the revision you chose. Each element is a contribution strength with
 * no confidence claimed; a layer your identity lacks is absent with its reason. A reading: nothing is written. */
import {kernelOp} from "../kernel/bridge";
import type {KernelTransportStatus} from "../kernel/types";

export type ElementName = "fire" | "water" | "earth" | "air";
export type NaraElementalRequest = {operation: "map"; source_ref: string; expected_revision: string; basis?: "natal" | "birthdate"};
export interface ElementReading {contribution_strength: number; confidence: number | null}
export interface NaraElementalResult {
  schema: "oi.nara-elemental/v1";
  source: {source_ref: string; revision: string};
  person_ref: string;
  basis: "natal" | "birthdate";
  elemental: {
    schema: "ql.nara-elemental-reading/v1"; contributions: Record<ElementName, ElementReading | null>; unknown_elements: ElementName[];
    raw_quaternion: {w: number; x: number; y: number; z: number} | null; normalized_quaternion: {w: number; x: number; y: number; z: number} | null;
    source: {source_ref: string; revision: string; standing_ref: string}; consent: string; standing: string; [field: string]: unknown;
  };
  /** The seven centres' natal counts, Root to Crown (natal basis only). */
  natal_counts: number[] | null;
}

/** The map through the kernel; a refusal comes back in its owner's words. */
export async function naraElemental(transport: KernelTransportStatus, request: NaraElementalRequest): Promise<NaraElementalResult> {
  const response = await kernelOp(transport, {op: "nara_elemental", request});
  if (response.error || response.outcome?.result !== "nara_elemental") throw new Error(response.error ?? "The elemental map did not answer.");
  const data = response.outcome.data;
  if (data.schema !== "oi.nara-elemental/v1" || data.source?.source_ref !== request.source_ref || data.source?.revision !== request.expected_revision
    || data.elemental?.schema !== "ql.nara-elemental-reading/v1") throw new Error("The elemental map belongs to another identity or revision.");
  return data;
}
