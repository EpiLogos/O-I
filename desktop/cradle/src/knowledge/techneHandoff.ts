/** The ordinary graph hands the SAME native subject to Technè through the ONE
 * Wiki projection state's selection ask (origin "external") — the identical
 * act a wiki-map row or a Library scene chip performs. No export, no second
 * canvas: the standing native Expression is focused, and the frame's own
 * cross-mode hop (`oi:epi-examine`) enters the instrument. Moving or editing
 * there lands through the existing owner-backed construction operations and
 * returns to the graph by reference, never by re-import. */
import {ensureWikiProjectionReading,getWikiProjectionState,wikiProjectionOf,requestWikiSelection} from "../techne/wikiProjectionStore";
import {wikiNativeRegisters} from "../techne/wikiNativeExpression";
import type {KernelTransportStatus} from "../kernel/types";
import type {GraphNode,GraphFormation} from "./graph";
import {isHostedNode} from "./graph";

export async function openSubjectInTechne(transport:KernelTransportStatus,project:string|undefined,node:GraphNode,formations:readonly GraphFormation[]):Promise<void> {
  if(isHostedNode(node))throw new Error("This subject lives in the hosted Shared Field; Technè projects the local Wiki registers.");
  const registerKey=project??"central";
  const register=wikiNativeRegisters().find(row=>row.key===registerKey);
  if(!register)throw new Error(`Technè does not disclose the ${registerKey} register in the current World.`);
  await ensureWikiProjectionReading(register,transport);
  const projection=wikiProjectionOf(getWikiProjectionState().standings[register.key]);
  if(!projection)throw new Error("The register's Wiki projection did not stand up, so its subject cannot be opened in Technè.");
  const formation=formations.find(row=>row.ref===node.ref);
  // A constellation opens whole (its own Scene, Canvas lens); a subject opens
  // inside the constellation Scene that carries it — exact refs throughout.
  // A space resolves through its own ref (its whole may be anchored elsewhere).
  const constellation=projection.constellations.find(row=>row.wholeRef===node.ref)
    ??projection.constellations.find(row=>row.spaceRef===node.ref)
    ??(formation?projection.constellations.find(row=>row.members.some(member=>formation.members.some(own=>own.ref===member.subjectRef))):undefined)
    ??projection.constellations.find(row=>row.members.some(member=>member.subjectRef===node.ref));
  if(constellation) {
    const whole=constellation.wholeRef===node.ref||constellation.spaceRef===node.ref;
    const member=constellation.members.find(row=>row.subjectRef===node.ref);
    requestWikiSelection({
      registerKey,
      sceneRef:constellation.sceneRef,
      entityRef:whole?null:(member?.entityRef??null),
      subjectRef:whole?constellation.wholeRef:(member?.subjectRef??null),
      title:node.label,
      origin:"external",
      ...(whole?{lens:"canvas" as const}:{}),
    });
  } else throw new Error("Technè's standing projection carries no Scene with this subject; open a Wiki space or constellation that holds it.");
  window.dispatchEvent(new CustomEvent("oi:epi-examine",{detail:{}}));
}
