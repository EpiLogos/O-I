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
import type {Change} from "../expression/types";
import type {HostedContribution} from "../knowledge/shared-field";
import {htmlToText} from "../flow/instance";
// @ts-ignore -- renderer-neutral SharedField contract, covered by node tests.
import {contributionBody} from "../../../../shared-field/contribution-return.mjs";

/** One EX1 Change as a human line — what changes, and where — named only
 * from the change's own fields. A kind added to the union before this line
 * learns it falls back to its kind name, with the raw object one disclosure
 * away at the call site. */
export function changeLine(change:Change):string {
 switch(change.change){
  case "rename":return `Rename the Expression to “${change.title}”`;
  case "composition_set":return change.presentation.description?`Set the composition: ${change.presentation.description}`:"Set the composition presentation";
  case "scene_create":return `Create scene “${change.title}” (${change.scene_ref})`;
  case "scene_rename":return `Rename scene ${change.scene_ref} to “${change.title}”`;
  case "scene_remove":return `Remove scene ${change.scene_ref}`;
  case "scene_material_clear":return `Clear scene ${change.scene_ref}’s material`;
  case "scene_material_set":return `Replace scene ${change.scene_ref}’s material`;
  case "scene_reorder":return `Reorder the scenes (${change.scene_refs.length} in the new order)`;
  case "scene_compose":return `Compose ${change.entity_refs.length} ${change.entity_refs.length===1?"entity":"entities"} into scene ${change.scene_ref}`;
  case "scene_blueprint_bind":return `Bind a scene blueprint to scene ${change.scene_ref}`;
  case "scene_blueprint_transform":return `Move scene ${change.scene_ref}’s blueprint`;
  case "scene_blueprint_release":return `Release scene ${change.scene_ref}’s blueprint`;
  case "entity_add":return `Add entity “${change.title}” (${change.entity_ref}) to scene ${change.scene_ref}`;
  case "entity_remove":return `Remove entity ${change.entity_ref}`;
  case "subject_bind":return `Bind a native subject to entity ${change.entity_ref}`;
  case "subject_unbind":return `Unbind the subject from entity ${change.entity_ref}`;
  case "focus":return change.entity_ref?`Focus entity ${change.entity_ref} in scene ${change.scene_ref}`:`Clear the focused entity in scene ${change.scene_ref}`;
  case "relation_focus":return `Focus relation ${change.binding_ref} in scene ${change.scene_ref}`;
  case "parameter_set":return `Set ${change.parameter} of ${change.entity_ref} to ${String(change.value)}`;
  case "parameter_automate":return `Automate ${change.parameter} of ${change.entity_ref}`;
  case "parameter_manual":return `Return ${change.parameter} of ${change.entity_ref} to manual control`;
  case "relation_bind":return `Bind relation ${change.binding.relation.ref}`;
  case "relation_remove":return `Remove relation ${change.binding_ref}`;
  case "representation_bind":return `Bind a ${change.binding.kind} representation (${change.binding.representation.ref})`;
  case "scene_body_set":return `Set scene ${change.scene_ref}’s body (${change.body.carrier})`;
  case "scene_body_clear":return `Clear scene ${change.scene_ref}’s body`;
  case "scene_trigger_attach":return `Attach a trigger to scene ${change.scene_ref}`;
  case "scene_trigger_detach":return `Detach trigger ${change.trigger_ref}`;
  case "profile_adopt":return `Adopt profile ${change.adoption.profile_ref} at revision ${change.adoption.revision}`;
  case "profile_release":return `Release profile ${change.profile_ref}`;
  case "collections_set":return `Set the collections (${change.collections.length})`;
 }
 // Exhaustive over the union; a kind not yet named here falls back to its
 // discriminant, with the raw object one disclosure away at the call site.
 return String((change as {change?: unknown}).change ?? "change");
}

/** law: raw only behind an explicit collapsed disclosure. The one place the
 * verbatim owner payload still appears. */
export function RawDisclosure({value,label="Show raw"}:{value:unknown;label?:string}) {
 return <details className="oi-disclosure" data-show-raw><summary>{label}</summary><pre>{JSON.stringify(value,null,2)}</pre></details>;
}

const readingRefText=(value:unknown):string=>{
 const item=(value??{}) as {kind?:unknown;ref?:unknown};
 return [typeof item.kind==="string"?item.kind:"reading",typeof item.ref==="string"?item.ref:""].filter(Boolean).join(" ");
};

/** A structured contribution body as one human line, named from its own
 * fields. `kind` is the body's oi.contribution-body/v1 kind. */
function contentSummary(kind:string,content:unknown):string {
 const body=(content??{}) as Record<string,unknown>;
 if(kind==="relation-proposal")return `Proposes the relation ${readingRefText(body.relation)} from ${readingRefText(body.from)} to ${readingRefText(body.to)}${typeof body.summary==="string"?` — ${body.summary}`:""}`;
 if(kind==="source-proposal")return `${typeof body.operation==="string"?body.operation:"source proposal"}${typeof body.html==="string"?`: ${htmlToText(body.html)}`:""}`;
 if(kind==="thing")return `Attaches ${readingRefText(body.thing)}`;
 if(kind==="expression-revision"||kind==="expression-scene"){const changes=Array.isArray(body.changes)?body.changes:[];return `${typeof body.summary==="string"?body.summary:"Expression change"} · ${changes.length} ${changes.length===1?"change":"changes"}`;}
 if(kind==="file"||kind==="reference"||kind==="method")return `Attaches ${readingRefText(content)}`;
 return `${kind} material`;
}

/** One contribution's visible body: prose as its text, anything structured
 * as a named summary with the exact content behind "Show exact
 * contribution" (law: no raw JSON where a person reads). */
export function ContributionText({contract}:{contract:HostedContribution["contract"]}) {
 try{
  const body=contributionBody(contract) as {kind:string;content:unknown};
  if(typeof body.content==="string")return <p>{body.content}</p>;
  return <><p>{contentSummary(body.kind,body.content)}</p><RawDisclosure value={body.content} label="Show exact contribution"/></>;
 }catch{
  return <p>Unsupported contributed material</p>;
 }
}
