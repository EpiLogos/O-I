import type {CentralLocation} from "../kernel/types";
export interface ReadingRef {ref:string;revision:string;availability:"available"|"unavailable"|"withheld"|"stale"}
export interface SubjectBinding {subject_ref:string;native_owner:string;presentation_role:"being"|"thing";sources:ReadingRef[];readings:ReadingRef[];actions:{action_ref:string;target_ref:string;authority_requirement:string}[]}
export interface Automation {min:number;max:number;rate_hz:number;waveform:"sine"|"triangle"|"square"|"saw"}
export interface Parameter {value:string|number;automation:Automation|null}
export interface Entity {entity_ref:string;revision:number;title:string;subject:SubjectBinding|null;parameters:Record<string,Parameter>}
/** ES1A scene-body native carrier relation (#352). */
export type CarrierKind = "engine_composition"|"text_source"|"glyph_form"|"image_media"|"file_thing"|"knowledge_whole"|"html_surface"|"agent_surface"|"expression_ref";
export type BodyPresentation = "live"|"inline"|"preview"|"degraded";
export type BodyCapability = {state:"renderable"}|{state:"degrades_to_thing";reason:string}|{state:"unavailable";reason:string};
export interface SceneBody {carrier:CarrierKind;subject_ref:string;native_owner:string;reading:ReadingRef;provenance:ReadingRef[];actions:{action_ref:string;target_ref:string;authority_requirement:string}[];presentation:BodyPresentation;capability:BodyCapability;span?:{start:number;end:number}|null;recursion?:{host_expression_ref:string;max_depth:number}|null}
/** ES1B declarative triggers — never executable script bodies. */
export type PortalPlacement = "preview"|"overlay"|"beside"|"full"|"detached"|"re_dock";
export type TriggerTarget =
 | {kind:"expression_operation";operation:"inspect"|"list"|"export";expression_ref:string}
 | {kind:"portal";placement:PortalPlacement;subject_ref:string;scene_ref?:string|null}
 | {kind:"native_action";action_ref:string;target_ref:string;authority_requirement:string}
 | {kind:"navigate";scene_ref?:string|null;entity_ref?:string|null};
export type TriggerOccasion = "scene_enter"|"scene_leave"|"activate"|"select"|"sequence_transition";
export interface SceneTrigger {trigger_ref:string;occasion:TriggerOccasion;target:TriggerTarget}
/** ES3 profile adoption with explicit, legible overrides. */
export interface ProfileAdoption {profile_ref:string;revision:number;overridden_parameters?:Record<string,Parameter>}
export interface Scene {scene_ref:string;revision:number;title:string;entity_refs:string[];body?:SceneBody|null;triggers?:SceneTrigger[]}
export interface Relation {binding_ref:string;relation:ReadingRef;from_entity_ref:string;to_entity_ref:string;provenance:ReadingRef[]}
export interface Representation {kind:"live"|"image"|"video"|"html"|"embed"|"projection";representation:ReadingRef;provenance:ReadingRef[]}
export interface RefinementDecision {state:"accepted"|"rejected";actor:string;reason:string;decided_at_revision:number;corrections:Change[]}
export interface Refinement {proposal_ref:string;basis_revision:number;proposed_by:string;activity_ref:string|null;continues_proposal_ref:string|null;summary:string;changes:Change[];method_refs:ReadingRef[];evidence_refs:ReadingRef[];decision:RefinementDecision|null}
export interface ExpressionDocument {schema:"oi.expression/v1";expression_ref:string;revision:number;title:string;scenes:Scene[];entities:Record<string,Entity>;relations:Record<string,Relation>;selection:{scene_ref:string;entity_ref:string|null};provenance:ReadingRef[];representations:Representation[];refinements:Refinement[];collections?:string[];profiles?:ProfileAdoption[]}
export type Change =
 | {change:"scene_create";scene_ref:string;title:string}
 | {change:"scene_reorder";scene_refs:string[]}
 | {change:"scene_compose";scene_ref:string;entity_refs:string[]}
 | {change:"entity_add";scene_ref:string;entity_ref:string;title:string}
 | {change:"entity_remove"|"subject_unbind";entity_ref:string}
 | {change:"subject_bind";entity_ref:string;binding:SubjectBinding}
 | {change:"focus";scene_ref:string;entity_ref:string|null}
 | {change:"parameter_set";entity_ref:string;parameter:string;value:string|number}
 | {change:"parameter_automate";entity_ref:string;parameter:string;automation:Automation}
 | {change:"parameter_manual";entity_ref:string;parameter:string}
 | {change:"relation_bind";binding:Relation}
 | {change:"relation_remove";binding_ref:string}
 | {change:"representation_bind";binding:Representation}
 /* Substrate changes (#352): ES1A carriers, ES1B triggers, ES3 profiles/collections. */
 | {change:"scene_body_set";scene_ref:string;body:SceneBody}
 | {change:"scene_body_clear";scene_ref:string}
 | {change:"scene_trigger_attach";scene_ref:string;trigger:SceneTrigger}
 | {change:"scene_trigger_detach";trigger_ref:string}
 | {change:"profile_adopt";adoption:ProfileAdoption}
 | {change:"profile_release";profile_ref:string}
 | {change:"collections_set";collections:string[]};
export type ExpressionRequest =
 | {operation:"capabilities"|"list"|"index"}
 | {operation:"inspect";expression_ref:string}
 | {operation:"create";expression_ref:string;title:string;actor:string}
 | {operation:"open";document:ExpressionDocument;actor:string}
 | {operation:"open_file";location:CentralLocation;actor:string}
 | {operation:"fork";expression_ref:string;expected_revision:number;new_expression_ref:string;actor:string}
 | {operation:"edit";expression_ref:string;expected_revision:number;actor:string;changes:Change[]}
 | {operation:"propose";expression_ref:string;expected_revision:number;proposal_ref:string;actor:string;activity_ref:string|null;continues_proposal_ref:string|null;summary:string;changes:Change[];method_refs:ReadingRef[];evidence_refs:ReadingRef[]}
 | {operation:"review";expression_ref:string;expected_revision:number;proposal_ref:string;actor:string;decision:"accepted"|"rejected";reason:string;corrections:Change[]}
 | {operation:"export";expression_ref:string;expected_revision:number}
 | {operation:"save";expression_ref:string;expected_revision:number;location:CentralLocation;expected_file_revision:string;actor:string;actor_kind:"human"|"agent"}
 | {operation:"invoke";expression_ref:string;expected_revision:number;entity_ref:string;action_ref:string;input:unknown;project:string|null}
 /* Substrate requests (#352): ES3 profiles/editions/index, ES3A asset index. */
 | {operation:"profile_define";profile:unknown;actor:string}
 | {operation:"profile_inspect";profile_ref:string}
 | {operation:"profile_resolve";native_owner:string;carrier:CarrierKind}
 | {operation:"edition_create";edition:unknown;actor:string}
 | {operation:"edition_inspect";edition_ref:string}
 | {operation:"asset_admit";asset:unknown;actor:string}
 | {operation:"asset_traverse";asset_ref:string}
 | {operation:"asset_subject";subject_ref:string};
export interface ExpressionResult {state?:string;document?:ExpressionDocument;dirty?:boolean;file?:{location:CentralLocation;revision:string}|null;expressions?:{expression_ref:string;revision:number;title:string;dirty:boolean}[];[key:string]:unknown}
