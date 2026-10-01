/**
 * Human presentation for native contributed material (DESKTOP-LANGUAGE
 * ruling 2, 10-SIDEBARS §2 law 7): no raw JSON where a person reads. Three
 * pieces shared by the surfaces that render native returns —
 *
 *   - `changeLine`: one EX1 `Change` as one human line, named from the
 *     change's own fields.
 *   - `ContributionText`: one attached contribution's visible body — prose
 *     as its text, a structured body as a named summary with the exact
 *     content behind "Show exact contribution".
 *   - `RawDisclosure`: the collapsed "Show raw" disclosure itself; verbatim
 *     owner material appears only inside one of these.
 */
import type {Change,ExpressionDocument} from "../expression/types";
import type {HostedContribution} from "../knowledge/shared-field";
import {PortableProse} from "../explore/presentation";
// @ts-ignore -- renderer-neutral SharedField contract, covered by node tests.
import {contributionBody} from "../../../../shared-field/contribution-return.mjs";
// @ts-ignore -- names from the admitted owner reading, never an identity store.
import {subjectLabel} from "../../../../shared-field/presentation-text.mjs";
// @ts-ignore -- the same portable HTML admission used by the owning projection.
import {sanitiseEntryHtml} from "../../../../shared-field/html-material.mjs";

/** One EX1 Change as a human line — what changes, and where — named only
 * from the change's fields and optional native Expression reading. Unknown
 * operations remain inspectable without turning their discriminant into prose. */
export function changeLine(change:Change,document?:ExpressionDocument):string {
 const scene=(ref:string)=>{const index=document?.scenes.findIndex(row=>row.scene_ref===ref)??-1;return index<0?"the unnamed scene":`scene “${subjectLabel(document?.scenes[index],`Unnamed scene ${index+1}`)}”`;};
 const entity=(ref:string)=>{const rows=Object.values(document?.entities??{}),index=rows.findIndex(row=>row.entity_ref===ref);return index<0?"the unnamed entity":`entity “${subjectLabel(rows[index],`Unnamed entity ${index+1}`)}”`;};
 const relation=(ref:string)=>{const row=document?.relations[ref];return row?`the relation between ${entity(row.from_entity_ref)} and ${entity(row.to_entity_ref)}`:"the unnamed relation";};
 const title=(value:string,fallback:string)=>subjectLabel(value,fallback);
 switch(change.change){
  case "rename":return `Rename the Expression to “${title(change.title,"Unnamed Expression")}”`;
  case "composition_set":return change.presentation.description?`Set the composition: ${change.presentation.description}`:"Set the composition presentation";
  case "scene_create":return `Create scene “${title(change.title,"Unnamed scene")}”`;
  case "scene_rename":return `Rename ${scene(change.scene_ref)} to “${title(change.title,"Unnamed scene")}”`;
  case "scene_remove":return `Remove ${scene(change.scene_ref)}`;
  case "scene_material_clear":return `Clear the material in ${scene(change.scene_ref)}`;
  case "scene_material_set":return `Replace the material in ${scene(change.scene_ref)}`;
  case "scene_reorder":return `Reorder the scenes (${change.scene_refs.length} in the new order)`;
  case "scene_compose":return `Compose ${change.entity_refs.length} ${change.entity_refs.length===1?"entity":"entities"} into ${scene(change.scene_ref)}`;
  case "scene_blueprint_bind":return `Bind a scene blueprint to ${scene(change.scene_ref)}`;
  case "scene_blueprint_transform":return `Move the blueprint in ${scene(change.scene_ref)}`;
  case "scene_blueprint_release":return `Release the blueprint in ${scene(change.scene_ref)}`;
  case "entity_add":return `Add entity “${title(change.title,"Unnamed entity")}” to ${scene(change.scene_ref)}`;
  case "entity_remove":return `Remove ${entity(change.entity_ref)}`;
  case "subject_bind":return `Bind a native subject to ${entity(change.entity_ref)}`;
  case "subject_unbind":return `Unbind the subject from ${entity(change.entity_ref)}`;
  case "focus":return change.entity_ref?`Focus ${entity(change.entity_ref)} in ${scene(change.scene_ref)}`:`Clear the focused entity in ${scene(change.scene_ref)}`;
  case "relation_focus":return `Focus ${relation(change.binding_ref)} in ${scene(change.scene_ref)}`;
  case "parameter_set":return `Set ${change.parameter} of ${entity(change.entity_ref)} to ${String(change.value)}`;
  case "parameter_automate":return `Automate ${change.parameter} of ${entity(change.entity_ref)}`;
  case "parameter_manual":return `Return ${change.parameter} of ${entity(change.entity_ref)} to manual control`;
  case "relation_bind":return `Bind the relation between ${entity(change.binding.from_entity_ref)} and ${entity(change.binding.to_entity_ref)}`;
  case "relation_remove":return `Remove ${relation(change.binding_ref)}`;
  case "representation_bind":return `Bind a ${change.binding.kind} representation`;
  case "scene_body_set":return `Set the body of ${scene(change.scene_ref)}`;
  case "scene_body_clear":return `Clear the body of ${scene(change.scene_ref)}`;
  case "scene_trigger_attach":return `Attach a trigger to ${scene(change.scene_ref)}`;
  case "scene_trigger_detach":return "Detach the selected trigger";
  case "profile_adopt":return "Adopt the selected presentation profile";
  case "profile_release":return "Release the selected presentation profile";
  case "collections_set":return `Set the collections (${change.collections.length})`;
  case "reuse_set":return `Make “${title(change.reuse.title,"Unnamed material")}” reusable`;
  case "reuse_clear":return "Clear the reusable material definition";
 }
 // A newly admitted operation remains exact in the call site's disclosure.
 return "Change the Expression; inspect the exact proposal for its operation";
}

/** law: raw only behind an explicit collapsed disclosure. The one place the
 * verbatim owner payload still appears. */
export function RawDisclosure({value,label="Show raw"}:{value:unknown;label?:string}) {
 return <details className="oi-disclosure" data-show-raw><summary>{label}</summary><pre>{JSON.stringify(value,null,2)}</pre></details>;
}

export type ContributionSubject={ref?:string;subject_ref?:string;title?:string;label?:string;name?:string};
const readingRefText=(value:unknown,subjects:ContributionSubject[],fallback:string):string=>{
 const item=(value??{}) as {ref?:unknown};
 return subjectLabel(subjects.find(subject=>(subject.ref??subject.subject_ref)===item.ref),fallback);
};

/** A structured contribution body as one human line, named from its own
 * fields. `kind` is the body's oi.contribution-body/v1 kind. */
function contentSummary(kind:string,content:unknown,subjects:ContributionSubject[]):string {
 const body=(content??{}) as Record<string,unknown>;
 if(kind==="relation-proposal")return typeof body.summary==="string"?body.summary:`Proposes ${readingRefText(body.relation,subjects,"a relation")} from ${readingRefText(body.from,subjects,"an unnamed starting subject")} to ${readingRefText(body.to,subjects,"an unnamed destination subject")}`;
 if(kind==="thing")return `Attaches ${readingRefText(body.thing,subjects,"an unnamed subject")}`;
 if(kind==="expression-revision"||kind==="expression-scene"){const changes=Array.isArray(body.changes)?body.changes:[];return `${typeof body.summary==="string"?body.summary:"Expression change"} · ${changes.length} ${changes.length===1?"change":"changes"}`;}
 if(kind==="file"||kind==="reference"||kind==="method")return `Attaches ${readingRefText(content,subjects,kind==="file"?"an unnamed file":kind==="method"?"an unnamed Method":"an unnamed reference")}`;
 return "Contributed material";
}

/** One contribution's visible body: prose as its text, anything structured
 * as a named summary with the exact content behind "Show exact
 * contribution" (law: no raw JSON where a person reads). */
export function ContributionText({contract,subjects=[]}:{contract:HostedContribution["contract"];subjects?:ContributionSubject[]}) {
 try{
  const body=contributionBody(contract) as {kind:string;content:unknown};
  if(typeof body.content==="string")return <p>{body.content}</p>;
  if(body.kind==="source-proposal"&&typeof (body.content as {html?:unknown})?.html==="string"){
   const content=body.content as {html:string;operation:string};
   const title=content.operation==="entry.add"?"Proposed new entry":content.operation==="entry.append"?"Proposed addition to the entry":"Proposed addition to the field";
   return <><p>{title}</p><PortableProse html={sanitiseEntryHtml(content.html)} title={title}/><RawDisclosure value={contract} label="Show exact contribution"/></>;
  }
  return <><p>{contentSummary(body.kind,body.content,subjects)}</p><RawDisclosure value={contract} label="Show exact contribution"/></>;
 }catch{
  return <><p>Unsupported contributed material</p><RawDisclosure value={contract} label="Show exact contribution"/></>;
 }
}
