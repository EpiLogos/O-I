/** Native Agent creation controller. State here is a held form and a last
 * owner reading, never the authority or persistence of an Agent/session. */
import {readAgentScope,readAgentSkills,type NativeAgentScope,type NativeAgentSkill} from "./nativeAgentReadiness.ts";
export interface AgentDraftInput { name: string; purpose: string; skillRefs: string[]; skillSetRefs: string[]; scopeConfirmed: boolean }
export interface NativeReview {
 schema: "central.agent-profile-review/v1";
 profile: { ref: string; revision: string; agent_ref: string; name?: string; purpose?: string; intent_provenance?: {intent_expression: string}; skill_refs?: string[]; skill_set_refs?: string[] };
 scope_ref: string; content_digest: string; accepted: boolean; execution_authority_granted: false;
 acceptance: null | {schema: "central.agent-profile-acceptance/v1"; acceptance_ref: string; profile_ref: string; agent_ref: string; profile_revision: string; content_digest: string; scope_ref: string};
}
export interface NativePrepared {
 schema: "aikit.direct-agent-session/v1"; request_id: string; profile_ref: string; profile_revision: string;
 agent_ref: string; agent_session: string; space: string; project_ref: string; acceptance_ref: string;
 prepared: true; provider_started: false; execution_authority_granted: false;
 brokered_child_context: string; skill_sources?: {reference: string; content_digest: string}[];
}
/** `aikit set list` rows — the repertoire unit a creator selects FIRST.
 * A set is a request over installed capabilities; listing never activates. */
export interface NativeSkillSetRow { name: string; provenance: string; members: number; projected: number; withheld: number; summary: string }
/** `aikit set show` — the owner's reply: what projects, what does not, why. */
export interface NativeSkillSetDetail {
 name: string; provenance: string; description?: string; members: number;
 projected: string[]; withheld: {capability: string; reason: string}[];
 children: {name: string; ref: string; members: number; attached_by?: string}[];
}
export type AgentRequest =
 | {action: "roster" | "scope" | "skills" | "skillsets"}
 | {action: "skillset"; name: string}
 | {action: "session"; agent_session: string}
 | {action: "propose"; name: string; purpose: string; skill_refs: string[]; skill_set_refs: string[]; expected_scope_ref: string}
 | {action: "review"; profile_ref: string}
 | {action: "accept"; profile_ref: string; expected_revision: string; expected_content_digest: string}
 | {action: "prepare"; request_id: string; profile_ref: string; expected_revision: string; expected_content_digest: string; expected_acceptance_ref: string}
 | {action: "find"; request_id: string};
export type AgentOwner = (request: AgentRequest) => Promise<unknown>;
/** One composed save-and-start: every native sub-result is preserved and
 * shown; a stage that never ran is `skipped`, never silently collapsed. */
export interface CompoundStages {
 propose: "pending" | "ok" | "failed" | "skipped";
 accept: "pending" | "ok" | "failed" | "skipped";
 readiness: "pending" | "ok" | "failed" | "skipped";
 prepare: "pending" | "ok" | "failed" | "skipped";
}
export interface NativeAgentState {
 draft: AgentDraftInput; scopeRef?: string; profiles: NativeReview[]; review?: NativeReview; prepared?: NativePrepared;
 world?: NativeAgentScope; skills?: NativeAgentSkill[]; readinessError?: string; readinessPending?: boolean;
 skillSets?: NativeSkillSetRow[]; skillSetDetail?: NativeSkillSetDetail;
 compound?: CompoundStages;
 busy: boolean; error?: string; unknown?: "propose" | "accept" | "prepare"; requestId?: string;
}
/** A stage refused before any native write was attempted — an input problem,
 * not an uncertain outcome. */
class StagePrecondition extends Error {}
function record(value: unknown): Record<string, unknown> {
 if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Malformed native Agent reading");
 return value as Record<string, unknown>;
}
function text(value: unknown): value is string { return typeof value === "string" && value.length > 0; }
export function readSkillSets(value: unknown): NativeSkillSetRow[] {
 const v = record(value);
 if (!Array.isArray(v.sets)) throw new Error("The native SkillSet reading has no set list");
 return v.sets.map((row: unknown) => {
  const r = record(row);
  if (!text(r.name) || !text(r.provenance) || typeof r.members !== "number" || typeof r.projected !== "number" || typeof r.withheld !== "number") {
   throw new Error("Malformed native SkillSet row");
  }
  return {name: r.name, provenance: r.provenance, members: r.members, projected: r.projected, withheld: r.withheld, summary: typeof r.summary === "string" ? r.summary : ""};
 });
}
export function readSkillSetDetail(value: unknown): NativeSkillSetDetail {
 const v = record(value);
 if (!text(v.name) || !text(v.provenance) || typeof v.members !== "number"
     || !Array.isArray(v.projected) || !v.projected.every(entry => typeof entry === "string")
     || !Array.isArray(v.withheld) || !Array.isArray(v.children)) {
  throw new Error("The native SkillSet reply is not a set reading");
 }
 return {
  name: v.name, provenance: v.provenance, description: typeof v.description === "string" ? v.description : undefined,
  members: v.members, projected: v.projected as string[],
  withheld: v.withheld.map((entry: unknown) => {
   const w = record(entry);
   return {capability: typeof w.capability === "string" ? w.capability : "", reason: typeof w.reason === "string" ? w.reason : ""};
  }),
  children: v.children.map((entry: unknown) => {
   const c = record(entry);
   if (!text(c.name)) throw new Error("Malformed native SkillSet child");
   return {name: c.name, ref: typeof c.ref === "string" ? c.ref : c.name, members: typeof c.members === "number" ? c.members : 0, attached_by: typeof c.attached_by === "string" ? c.attached_by : undefined};
  }),
 };
}
export function validateReview(value: unknown, scope: string): NativeReview {
 const v = record(value), p = record(v.profile);
 if (v.schema !== "central.agent-profile-review/v1" || v.scope_ref !== scope || !text(v.content_digest)
     || !text(p.ref) || !text(p.agent_ref) || !text(p.revision) || typeof v.accepted !== "boolean"
     || v.execution_authority_granted !== false) throw new Error("Native Agent review has a different identity, scope or standing");
 if (v.accepted) {
  const a = record(v.acceptance);
  if (a.schema !== "central.agent-profile-acceptance/v1" || !text(a.acceptance_ref) || a.scope_ref !== scope
      || a.profile_ref !== p.ref || a.agent_ref !== p.agent_ref || a.profile_revision !== p.revision
      || a.content_digest !== v.content_digest) throw new Error("Native acceptance does not match the reviewed source");
 } else if (v.acceptance !== null) throw new Error("Unaccepted native source has contradictory acceptance data");
 return value as NativeReview;
}
export function validatePrepared(value: unknown, review: NativeReview, requestId: string): NativePrepared {
 const p=validatePreparationBasis(value,review,requestId);
 if(p.prepared!==true)throw Error("Native session preparation is not complete");
 return value as NativePrepared;
}
export function validatePartialPreparation(value: unknown, review: NativeReview, requestId: string): void {
 const p=validatePreparationBasis(value,review,requestId);
 if(p.prepared!==false||p.resume_preparation_allowed!==true)throw Error("Native preparation is not explicitly continuable");
}
function validatePreparationBasis(value: unknown, review: NativeReview, requestId: string): Record<string,unknown> {
 const p = record(value);
 if (!review.accepted || p.schema !== "aikit.direct-agent-session/v1" || p.provider_started !== false
     || p.execution_authority_granted !== false || p.request_id !== requestId || p.profile_ref !== review.profile.ref
     || p.profile_revision !== review.profile.revision || p.agent_ref !== review.profile.agent_ref
     || p.acceptance_ref !== review.acceptance?.acceptance_ref || !text(p.project_ref)
     || !text(p.space) || !p.space.startsWith("session-space/") || !text(p.agent_session)
     || !p.agent_session.startsWith("agent-session/") || !text(p.brokered_child_context)) {
  throw new Error("Native session preparation is incomplete or belongs to a different accepted Agent");
 }
 return p;
}
export class NativeAgentController {
 private state: NativeAgentState = {draft:{name:"",purpose:"",skillRefs:[],skillSetRefs:[],scopeConfirmed:false},profiles:[],busy:false};
 private listeners = new Set<() => void>();
 private generation = 0;
 private readinessGeneration = 0;
 private owner: AgentOwner;
 private correlation: () => string;
 constructor(owner: AgentOwner, correlation: () => string = () => crypto.randomUUID()) { this.owner=owner;this.correlation=correlation; }
 snapshot = (): NativeAgentState => this.state;
 subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => {this.listeners.delete(listener);}; };
 bind(owner: AgentOwner) { this.owner = owner; }
 private set(next: Partial<NativeAgentState>) { this.state = {...this.state,...next}; for (const listener of this.listeners) listener(); }
 edit(patch: Partial<AgentDraftInput>) {
  if (this.state.busy || this.state.unknown) return;
  ++this.generation;
  this.set({draft:{...this.state.draft,...patch},review:undefined,prepared:undefined,requestId:undefined,error:undefined,compound:undefined});
 }
 private async readRoster(): Promise<{scope: string; profiles: NativeReview[]}> {
  const value = record(await this.owner({action:"roster"}));
  if (value.schema !== "central.agent-profile-roster/v1" || !text(value.scope_ref) || !Array.isArray(value.profiles)
      || value.execution_authority_granted !== false) throw new Error("The native Agent roster is not available");
  return {scope:value.scope_ref,profiles:value.profiles.map(p => validateReview(p,value.scope_ref as string))};
 }
 refreshReadiness = async (includeSkills = true) => {
  const generation=++this.readinessGeneration;
  this.set({readinessPending:true,world:undefined,...(includeSkills?{skills:undefined}:{}),readinessError:undefined});
  const settled=(index:number)=>results[index].status==="rejected"?Promise.reject(results[index].reason):Promise.resolve(results[index].value);
  const results=await Promise.allSettled([this.owner({action:"scope"}),includeSkills?this.owner({action:"skills"}):Promise.resolve(undefined),this.owner({action:"skillsets"})]);
  if(generation!==this.readinessGeneration)return;
  const errors:string[]=[]; let world:NativeAgentScope|undefined,skills:NativeAgentSkill[]|undefined,skillSets:NativeSkillSetRow[]|undefined;
  try {world=readAgentScope(await settled(0));}catch(e){errors.push(String(e));}
  try {if(includeSkills){skills=readAgentSkills(await settled(1));}else{skills=this.state.skills;}}catch(e){errors.push(String(e));}
  try {skillSets=readSkillSets(await settled(2));}catch(e){errors.push(`Native SkillSets unavailable: ${String(e)}`);}
  let draft=this.state.draft;
  if(skillSets&&!skillSets.some(set=>draft.skillSetRefs.includes(set.name))){
   if(draft.skillSetRefs.length>0)errors.push("The native SkillSet field no longer lists a selected set; repair or remove that selection.");
   draft={...draft,skillSetRefs:[]};
  }
  const skillSetDetail=skillSets&&draft.skillSetRefs.includes(this.state.skillSetDetail?.name?? "")?this.state.skillSetDetail:undefined;
  this.set({world,skills,skillSets,draft,skillSetDetail,readinessPending:false,
   readinessError:errors.length?errors.join("; "):undefined});
 };
 refresh = async () => {
  if (this.state.busy) return;
  const generation = ++this.generation;
  this.set({busy:true,error:undefined});
  try {
   const roster = await this.readRoster();
   if (generation !== this.generation) return;
   const changed = this.state.scopeRef !== undefined && this.state.scopeRef !== roster.scope;
   this.set({scopeRef:roster.scope,profiles:roster.profiles,
    ...(changed ? {review:undefined,prepared:undefined,requestId:undefined,compound:undefined,draft:{...this.state.draft,scopeConfirmed:false}} : {})});
  } catch (error) { if (generation === this.generation) this.set({error:String(error)}); }
  finally { if (generation === this.generation) this.set({busy:false}); }
 };
 select = async (reference: string) => {
  if (this.state.busy || this.state.unknown === "prepare" || !this.state.scopeRef) return;
  const generation = ++this.generation, scope = this.state.scopeRef;
  this.set({busy:true,error:undefined});
  try {
   const review = validateReview(await this.owner({action:"review",profile_ref:reference}),scope);
   if (review.profile.ref !== reference) throw new Error("Central read a different Agent definition");
   const roster = await this.readRoster();
   const persisted = roster.profiles.find(p => p.profile.ref === reference);
   if (roster.scope !== scope || !persisted || persisted.content_digest !== review.content_digest
       || persisted.profile.revision !== review.profile.revision || persisted.accepted !== review.accepted
       || persisted.acceptance?.acceptance_ref !== review.acceptance?.acceptance_ref) {
    throw new Error("The exact reviewed Agent is not present in the current native roster");
   }
   if (generation === this.generation) this.set({review,profiles:roster.profiles,prepared:undefined,requestId:undefined,compound:undefined,unknown:undefined});
  } catch (error) { if (generation === this.generation) this.set({error:String(error)}); }
  finally { if (generation === this.generation) this.set({busy:false}); }
 };
 /** One SkillSet choice is one ref on the draft; the owner's own resolution
  * (nested sets, withheld members) is read back and shown, never replayed. */
 toggleSkillSet = async (name: string, include: boolean) => {
  if (this.state.busy || this.state.unknown) return;
  if (!include) {
   this.set({draft:{...this.state.draft,skillSetRefs:this.state.draft.skillSetRefs.filter(ref=>ref!==name)},
    skillSetDetail:this.state.skillSetDetail?.name===name?undefined:this.state.skillSetDetail});
   return;
  }
  const generation = ++this.generation;
  try {
   const detail = readSkillSetDetail(await this.owner({action:"skillset",name}));
   if (generation !== this.generation) return;
   const skillSetRefs = this.state.draft.skillSetRefs.includes(name)?this.state.draft.skillSetRefs:[...this.state.draft.skillSetRefs,name];
   this.set({draft:{...this.state.draft,skillSetRefs},skillSetDetail:detail});
  } catch (error) {
   if (generation === this.generation) this.set({error:`The native SkillSet could not be read; nothing was selected. ${String(error)}`});
  }
 };
 propose = async () => {
  const {busy,unknown} = this.state;
  if (busy || unknown) return;
  this.set({busy:true,error:undefined});
  try {
   await this.stagePropose();
  } catch (error) {
   if (error instanceof StagePrecondition) this.set({error:String(error.message)});
   else this.set({unknown:"propose",error:`Proposal outcome is unconfirmed. Read the native roster and review the matching source before proposing again. ${String(error)}`});
  } finally { this.set({busy:false}); }
 };
 private async stagePropose(): Promise<void> {
  const {draft,scopeRef} = this.state;
  if (!scopeRef || !draft.scopeConfirmed || !draft.name || !draft.purpose
      || draft.name !== draft.name.trim() || draft.purpose !== draft.purpose.trim()) {
   throw new StagePrecondition("Name the Agent, keep the purpose exactly as intended, and explicitly confirm its native scope.");
  }
  if (draft.skillRefs.some(ref=>!this.state.skills?.some(row=>row.ref===ref&&row.eligible))) {
   throw new StagePrecondition("A selected Skill is not currently eligible. Re-read the native catalogue and explicitly repair or remove that selection.");
  }
  if (draft.skillSetRefs.some(ref=>!this.state.skillSets?.some(set=>set.name===ref))) {
   throw new StagePrecondition("A selected SkillSet is not in the native set field. Re-read the repertoire and explicitly repair or remove that selection.");
  }
  const review = validateReview(await this.owner({action:"propose",name:draft.name,purpose:draft.purpose,
   skill_refs:[...draft.skillRefs],skill_set_refs:[...draft.skillSetRefs],expected_scope_ref:scopeRef}),scopeRef);
  if (review.accepted || review.profile.name !== draft.name || review.profile.intent_provenance?.intent_expression !== draft.purpose
      || JSON.stringify(review.profile.skill_refs??[])!==JSON.stringify(draft.skillRefs)
      || JSON.stringify(review.profile.skill_set_refs??[])!==JSON.stringify(draft.skillSetRefs)) {
   throw new Error("The native proposal differs from the submitted purpose/name or was accepted without this review");
  }
  this.set({review,prepared:undefined,requestId:undefined,compound:undefined});
 }
 accept = async () => {
  const {review,busy,unknown,scopeRef} = this.state;
  if (busy || unknown || !review || review.accepted || !scopeRef) return;
  this.set({busy:true,error:undefined});
  try {
   await this.stageAccept();
  } catch (error) { this.set({unknown:"accept",error:`Acceptance outcome is unconfirmed. Re-read this source; do not replay the write. ${String(error)}`}); }
  finally { this.set({busy:false}); }
 };
 private async stageAccept(): Promise<void> {
  const {review,scopeRef} = this.state;
  if (!review || review.accepted || !scopeRef) throw new StagePrecondition("Acceptance needs a reviewed, unaccepted source in the current scope.");
  await this.owner({action:"accept",profile_ref:review.profile.ref,expected_revision:review.profile.revision,expected_content_digest:review.content_digest});
  // A write acknowledgement is not sufficient. Read both the source and the
  // roster, independently, before offering session preparation.
  const current = validateReview(await this.owner({action:"review",profile_ref:review.profile.ref}),scopeRef);
  const roster = await this.readRoster();
  const persisted = roster.profiles.find(p => p.profile.ref === review.profile.ref);
  if (!current.accepted || current.content_digest !== review.content_digest || current.profile.revision !== review.profile.revision
      || roster.scope !== scopeRef || persisted?.acceptance?.acceptance_ref !== current.acceptance?.acceptance_ref) {
   throw new Error("Acceptance is not present on the exact native source and roster");
  }
  this.set({review:current,profiles:roster.profiles});
 }
 prepare = async () => {
  const {review,busy,unknown} = this.state;
  if (busy || unknown || !review?.accepted || !review.acceptance) return;
  this.set({busy:true,error:undefined});
  try {
   await this.stagePrepare();
  } catch (error) { this.set({unknown:"prepare",error:`Session preparation is unconfirmed. Inspect the original request; a replacement session will not be created. ${String(error)}`}); }
  finally { this.set({busy:false}); }
 };
 private async stagePrepare(): Promise<void> {
  const {review} = this.state;
  if (!review?.accepted || !review.acceptance) throw new StagePrecondition("Preparation needs the exact accepted source.");
  const requestId = this.state.requestId ?? this.correlation();
  this.set({requestId});
  const result = await this.owner({action:"prepare",request_id:requestId,profile_ref:review.profile.ref,
   expected_revision:review.profile.revision,expected_content_digest:review.content_digest,expected_acceptance_ref:review.acceptance.acceptance_ref});
  this.set({prepared:validatePrepared(result,review,requestId)});
 }
 /** The compound "Save and start Direct work": propose/save (CAS) → accept →
  * world-readiness → prepare. Each native sub-result is preserved in
  * `compound`; a failure after save reports Saved; not running with the
  * failing stage and leaves the per-stage affordances standing. It never
  * rewrites a running session (preparation is idempotent by the retained
  * request), never mints Factory ancestry and never grants authority. The
  * final open-conversation step stays in the surface: its outcome is the
  * opened conversation or the surface's own open error. */
 saveAndStart = async () => {
  const {busy,unknown,review} = this.state;
  if (busy || unknown) return;
  const stages: CompoundStages = {
   propose: review ? "skipped" : "pending",
   accept: review?.accepted ? "skipped" : "pending",
   readiness: review?.accepted ? "pending" : "pending",
   prepare: "pending",
  };
  this.set({busy:true,error:undefined,compound:stages});
  const fail = (stage:keyof CompoundStages,message:string,uncertain:boolean) => {
   const saved = stage==="propose" ? false : !!this.state.review;
   this.set({busy:false,compound:{...stages,[stage]:"failed"},
    ...(uncertain?{unknown:stage==="prepare"?"prepare":stage==="accept"?"accept":"propose"}:{}),
    error:saved?`Saved; not running — ${stage} did not complete. ${message}`:`Not saved — ${stage} did not complete. ${message}`});
  };
  try {
   if (stages.propose==="pending") { await this.stagePropose(); stages.propose="ok"; this.set({compound:{...stages}}); }
   if (this.state.review && !this.state.review.accepted) {
    await this.stageAccept();
    stages.accept="ok"; this.set({compound:{...stages}});
   } else if (!this.state.review) { throw new StagePrecondition("The reviewed source vanished before acceptance; re-read the roster."); }
   await this.refreshReadiness();
   if (this.state.world?.world_readiness.ready!==true) {
    this.set({busy:false,compound:{...stages,readiness:"failed"},
     error:`Saved; not running — world readiness failed. ${this.state.world?.world_readiness.reason??"The native World declaration is required before session preparation."}`});
    return;
   }
   stages.readiness="ok"; this.set({compound:{...stages}});
   await this.stagePrepare();
   this.set({busy:false,compound:{...stages,prepare:"ok"}});
  } catch (error) {
   const stage = stages.propose==="pending"?"propose":stages.accept==="pending"?"accept":stages.readiness==="pending"?"readiness":"prepare";
   if (error instanceof StagePrecondition) fail(stage,error.message,false);
   else if (stage==="readiness") fail(stage,String(error),false);
   else fail(stage,error instanceof Error?error.message:String(error),true);
  }
 };
 recover = async () => {
  if (this.state.busy) return;
  const {unknown,review,requestId} = this.state;
  if (unknown === "accept" && review) { await this.select(review.profile.ref); return; }
  if (unknown !== "prepare" || !review || !requestId) { await this.refresh(); return; }
  this.set({busy:true,error:undefined});
  try {
   const result = await this.owner({action:"find",request_id:requestId});
   if (result === null) {
    // The next explicit prepare is idempotent at the native owner and uses
    // this SAME retained correlation, never a replacement session identity.
    this.set({unknown:undefined,error:"No completed preparation was found. Continue preparation explicitly with the retained request."});
   } else if(record(result).prepared===false) {
    validatePartialPreparation(result,review,requestId);
    this.set({unknown:undefined,prepared:undefined,error:"Native preparation is incomplete. Continue explicitly using this same retained request; no provider was started."});
   } else this.set({prepared:validatePrepared(result,review,requestId),unknown:undefined});
  } catch (error) { this.set({error:`Original preparation still needs native repair; no work was replayed. ${String(error)}`}); }
  finally { this.set({busy:false}); }
 };
}
