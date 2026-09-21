/** Read-only native prerequisites. A catalogue row is not activation evidence. */
export interface NativeAgentScope {
 schema: "aikit.direct-agent-scope/v1"; project_ref: string;
 world_readiness: {ready: boolean; world_ref?: string; owner?: string; action?: string; reason?: string};
 execution_authority_granted: false; provider_started: false;
}
export interface NativeAgentSkill {ref: string; name: string; description: string; revision: unknown; source: unknown; eligible: boolean; reason_code: string | null}
function object(v: unknown): Record<string,unknown> {
 if (!v || typeof v !== "object" || Array.isArray(v)) throw Error("Unreadable native prerequisite response");
 return v as Record<string,unknown>;
}
export function readAgentScope(value: unknown): NativeAgentScope {
 const v=object(value), w=object(v.world_readiness);
 if(v.schema!=="aikit.direct-agent-scope/v1" || typeof v.project_ref!=="string" || !v.project_ref
   || v.execution_authority_granted!==false || v.provider_started!==false || typeof w.ready!=="boolean"
   || (w.ready && (typeof w.world_ref!=="string" || !w.world_ref))) throw Error("Native World readiness is absent or incompatible; no launch is implied");
 return value as NativeAgentScope;
}
export function readAgentSkills(value: unknown): NativeAgentSkill[] {
 const v=object(value);
 if(v.schema!=="aikit.direct-agent-skills/v1" || v.activation_performed!==false
   || v.brokered_child_activation_observed!==false || !Array.isArray(v.rows) || v.rows.length>10000) throw Error("Native effective Skill discovery is unavailable");
 const seen=new Set<string>();
 return v.rows.map(value=>{
  const r=object(value);
  if(typeof r.ref!=="string" || !r.ref.startsWith("skill/") || r.ref.length>1024 || seen.has(r.ref)
    || typeof r.name!=="string" || typeof r.description!=="string" || typeof r.eligible!=="boolean"
    || (r.reason_code!==null && typeof r.reason_code!=="string")) throw Error("Malformed or duplicate native Skill reading");
  seen.add(r.ref);return r as unknown as NativeAgentSkill;
 });
}
