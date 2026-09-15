import type {CentralLocation} from "../kernel/types";
export interface ReadingRef {ref:string;revision:string;availability:"available"|"unavailable"|"withheld"|"stale"}
export interface SubjectBinding {subject_ref:string;native_owner:string;presentation_role:"being"|"thing";sources:ReadingRef[];readings:ReadingRef[];actions:{action_ref:string;target_ref:string;authority_requirement:string}[]}
export interface Automation {min:number;max:number;rate_hz:number;waveform:"sine"|"triangle"|"square"|"saw"}
export interface Parameter {value:string|number;automation:Automation|null}
export interface Entity {entity_ref:string;revision:number;title:string;subject:SubjectBinding|null;parameters:Record<string,Parameter>}
export interface Scene {scene_ref:string;revision:number;title:string;entity_refs:string[]}
export interface Relation {binding_ref:string;relation:ReadingRef;from_entity_ref:string;to_entity_ref:string;provenance:ReadingRef[]}
export interface Representation {kind:"live"|"image"|"video"|"html"|"embed"|"projection";representation:ReadingRef;provenance:ReadingRef[]}
export interface ExpressionDocument {schema:"oi.expression/v1";expression_ref:string;revision:number;title:string;scenes:Scene[];entities:Record<string,Entity>;relations:Record<string,Relation>;selection:{scene_ref:string;entity_ref:string|null};provenance:ReadingRef[];representations:Representation[]}
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
 | {change:"representation_bind";binding:Representation};
export type ExpressionRequest =
 | {operation:"capabilities"|"list"}
 | {operation:"inspect";expression_ref:string}
 | {operation:"create";expression_ref:string;title:string;actor:string}
 | {operation:"open";document:ExpressionDocument;actor:string}
 | {operation:"open_file";location:CentralLocation;actor:string}
 | {operation:"fork";expression_ref:string;expected_revision:number;new_expression_ref:string;actor:string}
 | {operation:"edit";expression_ref:string;expected_revision:number;actor:string;changes:Change[]}
 | {operation:"export";expression_ref:string;expected_revision:number}
 | {operation:"save";expression_ref:string;expected_revision:number;location:CentralLocation;expected_file_revision:string;actor:string;actor_kind:"human"|"agent"}
 | {operation:"invoke";expression_ref:string;expected_revision:number;entity_ref:string;action_ref:string;input:unknown;project:string|null};
export interface ExpressionResult {state?:string;document?:ExpressionDocument;dirty?:boolean;file?:{location:CentralLocation;revision:string}|null;expressions?:{expression_ref:string;revision:number;title:string;dirty:boolean}[];[key:string]:unknown}
