/**
 * The ES1 stage-focus plan (#336 follow-up): reduce a resolved
 * `ql.nara-deixis/v1` DeixisResolution into the real operations that move
 * the LIVE Expression stage presentation.
 *
 * The plan is pure: it reads only the resolution and the live Expression
 * document, and names operations — it never executes anything. The surface
 * executes each operation through its own authority seam:
 *
 *   - `kernel-focus`  — the committed, reversible Expression edit (the
 *     document's selection is semantic; the kernel owns it);
 *   - `stage-select`  — the live presentation's selection follows the
 *     committed focus (presentation decoration on top of the kernel fact);
 *   - `stage-highlight` — a pure presentation movement: the stage's
 *     selection decoration moves with no document change (reversible —
 *     the next document projection or a cleared highlight restores it);
 *   - `unavailable`   — a focus action the stage does not carry (today:
 *     `open`, the ES1/ES4 portal open/close operation this cradle has not
 *     built). Honesty law: named as unavailable, never faked as a select.
 *
 * A deictic focus ref no bound entity carries is `unmapped`: the stage
 * renders bound entities only, and nothing is invented in its place.
 *
 * When a PersonalProjectionBinding stands, centre locus_refs may resolve
 * through the same Expression body used by speech (#336 co-ref).
 */

import type {DeixisResolution} from "./dialogueContext";
import type {ExpressionDocument} from "../expression/types";
import type {PersonalProjectionBinding} from "./personalProjection";

export type StageFocusOperation =
  |{op:"kernel-focus";subject_ref:string;entity_ref:string}
  |{op:"stage-select";subject_ref:string;entity_ref:string}
  |{op:"stage-highlight";subject_ref:string;entity_ref:string}
  |{op:"unavailable";action:"open";subject_ref:string;reason:string};

export interface StageFocusPlan {
  operations:StageFocusOperation[];
  /** Deictic focus refs no bound entity in the live document carries. */
  unmapped:string[];
}

function resolveEntity(
  document:ExpressionDocument,
  refId:string,
  personal:PersonalProjectionBinding|null|undefined,
):{entity_ref:string}|null {
  const entity=Object.values(document.entities).find(candidate=>candidate.subject?.subject_ref===refId);
  if(entity)return {entity_ref:entity.entity_ref};
  const centre=personal?.profile?.centres.find(c=>c.locus_ref===refId);
  if(centre){
    const bound=Object.values(document.entities).find(candidate=>
      candidate.subject?.subject_ref===centre.locus_ref
      ||candidate.title===centre.label
      ||candidate.entity_ref.includes(`centre-${centre.ordinal}`)
      ||candidate.entity_ref.includes(`centre:${centre.ordinal}`),
    );
    if(bound)return {entity_ref:bound.entity_ref};
  }
  if(personal?.profile?.earth_body.locus_ref===refId){
    const earth=Object.values(document.entities).find(candidate=>
      candidate.title==="EarthBody"
      ||candidate.subject?.subject_ref===personal.profile!.earth_body.locus_ref
      ||candidate.subject?.subject_ref?.includes("earth"),
    );
    if(earth)return {entity_ref:earth.entity_ref};
  }
  return null;
}

export function stageFocusPlan(
  resolution:DeixisResolution,
  document:ExpressionDocument,
  personal?:PersonalProjectionBinding|null,
):StageFocusPlan {
  if(resolution.outcome.outcome!=="focused")return {operations:[],unmapped:[resolution.outcome.ref_id]};
  const operations:StageFocusOperation[]=[];
  const unmapped:string[]=[];
  for(const focus of resolution.outcome.focus){
    const entity=resolveEntity(document,focus.ref_id,personal);
    if(!entity){
      unmapped.push(focus.ref_id);
      continue;
    }
    switch(focus.focus_action){
      case "highlight":
        operations.push({op:"stage-highlight",subject_ref:focus.ref_id,entity_ref:entity.entity_ref});
        break;
      case "select":
        operations.push({op:"kernel-focus",subject_ref:focus.ref_id,entity_ref:entity.entity_ref});
        operations.push({op:"stage-select",subject_ref:focus.ref_id,entity_ref:entity.entity_ref});
        break;
      case "open":
        operations.push({op:"unavailable",action:"open",subject_ref:focus.ref_id,
          reason:"open is the ES1/ES4 portal surface operation; this cradle does not carry a portal surface for this subject yet, and a select is not staged in its place"});
        break;
    }
  }
  return {operations,unmapped};
}
