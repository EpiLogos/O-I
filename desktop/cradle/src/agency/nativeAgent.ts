/** Native Agent creation controller. State here is a held form and a last
 * owner reading, never the authority or persistence of an Agent/session. */
export interface AgentDraftInput { name: string; purpose: string; skillRefs: string[]; scopeConfirmed: boolean }
export interface NativeReview {
 schema: "central.agent-profile-review/v1";
 profile: { ref: string; revision: string; agent_ref: string; name?: string; purpose?: string; intent_provenance?: {intent_expression: string}; skill_refs?: string[] };
 scope_ref: string; content_digest: string; accepted: boolean; execution_authority_granted: false;
 acceptance: null | {schema: "central.agent-profile-acceptance/v1"; acceptance_ref: string; profile_ref: string; agent_ref: string; profile_revision: string; content_digest: string; scope_ref: string};
}
export interface NativePrepared {
 schema: "aikit.direct-agent-session/v1"; request_id: string; profile_ref: string; profile_revision: string;
 agent_ref: string; agent_session: string; space: string; project_ref: string; acceptance_ref: string;
 prepared: true; provider_started: false; execution_authority_granted: false;
 brokered_child_context: string; skill_sources?: {reference: string; content_digest: string}[];
}
export type AgentRequest =
 | {action: "roster"}
 | {action: "propose"; name: string; purpose: string; skill_refs: string[]; expected_scope_ref: string}
 | {action: "review"; profile_ref: string}
 | {action: "accept"; profile_ref: string; expected_revision: string; expected_content_digest: string}
 | {action: "prepare"; request_id: string; profile_ref: string; expected_revision: string; expected_content_digest: string; expected_acceptance_ref: string}
 | {action: "find"; request_id: string};
export type AgentOwner = (request: AgentRequest) => Promise<unknown>;
export interface NativeAgentState {
 draft: AgentDraftInput; scopeRef?: string; profiles: NativeReview[]; review?: NativeReview; prepared?: NativePrepared;
 busy: boolean; error?: string; unknown?: "propose" | "accept" | "prepare"; requestId?: string;
}
function record(value: unknown): Record<string, unknown> {
 if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Malformed native Agent reading");
 return value as Record<string, unknown>;
}
function text(value: unknown): value is string { return typeof value === "string" && value.length > 0; }
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
 const p = record(value);
 if (!review.accepted || p.schema !== "aikit.direct-agent-session/v1" || p.prepared !== true || p.provider_started !== false
     || p.execution_authority_granted !== false || p.request_id !== requestId || p.profile_ref !== review.profile.ref
     || p.profile_revision !== review.profile.revision || p.agent_ref !== review.profile.agent_ref
     || p.acceptance_ref !== review.acceptance?.acceptance_ref || !text(p.project_ref)
     || !text(p.space) || !p.space.startsWith("session-space/") || !text(p.agent_session)
     || !p.agent_session.startsWith("agent-session/") || !text(p.brokered_child_context)) {
  throw new Error("Native session preparation is incomplete or belongs to a different accepted Agent");
 }
 return value as NativePrepared;
}
export class NativeAgentController {
 private state: NativeAgentState = {draft:{name:"",purpose:"",skillRefs:[],scopeConfirmed:false},profiles:[],busy:false};
 private listeners = new Set<() => void>();
 private generation = 0;
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
  this.set({draft:{...this.state.draft,...patch},review:undefined,prepared:undefined,requestId:undefined,error:undefined});
 }
 private async readRoster(): Promise<{scope: string; profiles: NativeReview[]}> {
  const value = record(await this.owner({action:"roster"}));
  if (value.schema !== "central.agent-profile-roster/v1" || !text(value.scope_ref) || !Array.isArray(value.profiles)
      || value.execution_authority_granted !== false) throw new Error("The native Agent roster is not available");
  return {scope:value.scope_ref,profiles:value.profiles.map(p => validateReview(p,value.scope_ref as string))};
 }
 refresh = async () => {
  if (this.state.busy) return;
  const generation = ++this.generation;
  this.set({busy:true,error:undefined});
  try {
   const roster = await this.readRoster();
   if (generation !== this.generation) return;
   const changed = this.state.scopeRef !== undefined && this.state.scopeRef !== roster.scope;
   this.set({scopeRef:roster.scope,profiles:roster.profiles,
    ...(changed ? {review:undefined,prepared:undefined,requestId:undefined,draft:{...this.state.draft,scopeConfirmed:false}} : {})});
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
   if (generation === this.generation) this.set({review,profiles:roster.profiles,prepared:undefined,requestId:undefined,unknown:undefined});
  } catch (error) { if (generation === this.generation) this.set({error:String(error)}); }
  finally { if (generation === this.generation) this.set({busy:false}); }
 };
 propose = async () => {
  const {draft,scopeRef,busy,unknown} = this.state;
  if (busy || unknown) return;
  if (!scopeRef || !draft.scopeConfirmed || !draft.name || !draft.purpose
      || draft.name !== draft.name.trim() || draft.purpose !== draft.purpose.trim()) {
   this.set({error:"Name the Agent, keep the purpose exactly as intended, and explicitly confirm its native scope."}); return;
  }
  this.set({busy:true,error:undefined});
  try {
   const review = validateReview(await this.owner({action:"propose",name:draft.name,purpose:draft.purpose,skill_refs:[...draft.skillRefs],expected_scope_ref:scopeRef}),scopeRef);
   if (review.accepted || review.profile.name !== draft.name || review.profile.intent_provenance?.intent_expression !== draft.purpose) {
    throw new Error("The native proposal differs from the submitted purpose/name or was accepted without this review");
   }
   this.set({review,prepared:undefined,requestId:undefined});
  } catch (error) { this.set({unknown:"propose",error:`Proposal outcome is unconfirmed. Read the native roster and review the matching source before proposing again. ${String(error)}`}); }
  finally { this.set({busy:false}); }
 };
 accept = async () => {
  const {review,scopeRef,busy,unknown} = this.state;
  if (busy || unknown || !review || review.accepted || !scopeRef) return;
  this.set({busy:true,error:undefined});
  try {
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
  } catch (error) { this.set({unknown:"accept",error:`Acceptance outcome is unconfirmed. Re-read this source; do not replay the write. ${String(error)}`}); }
  finally { this.set({busy:false}); }
 };
 prepare = async () => {
  const {review,busy,unknown} = this.state;
  if (busy || unknown || !review?.accepted || !review.acceptance) return;
  const requestId = this.state.requestId ?? this.correlation();
  this.set({busy:true,error:undefined,requestId});
  try {
   const result = await this.owner({action:"prepare",request_id:requestId,profile_ref:review.profile.ref,
    expected_revision:review.profile.revision,expected_content_digest:review.content_digest,expected_acceptance_ref:review.acceptance.acceptance_ref});
   this.set({prepared:validatePrepared(result,review,requestId)});
  } catch (error) { this.set({unknown:"prepare",error:`Session preparation is unconfirmed. Inspect the original request; a replacement session will not be created. ${String(error)}`}); }
  finally { this.set({busy:false}); }
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
   } else this.set({prepared:validatePrepared(result,review,requestId),unknown:undefined});
  } catch (error) { this.set({error:`Original preparation still needs native repair; no work was replayed. ${String(error)}`}); }
  finally { this.set({busy:false}); }
 };
}
