import type { AgentProfile, AgentSet } from "./client";

export function AgentDetail({ profile, set }: { profile?: AgentProfile; set?: AgentSet }) {
  if (!profile && !set) return <p className="agents-detail-empty">Select a profile or team to inspect its authored details.</p>;
  return <aside className="agents-detail" aria-label="Selected Agent details">
    <h3>{profile ? "Selected Agent" : "Selected AgentSet"}</h3>
    {profile && <>
      <p className="agents-detail-purpose">{profile.purpose || profile.role || "No purpose authored."}</p>
      <dl>
        <dt>Agent</dt><dd>{profile.agent_ref}</dd>
        <dt>Profile</dt><dd>{profile.profile_ref}</dd>
        <dt>World</dt><dd>{profile.world_ref}</dd>
        <dt>Standing</dt><dd>{profile.intent_provenance?.recognition ?? "Recognition not disclosed"}</dd>
      </dl>
      <details><summary>Profile refs · revision {profile.revision}</summary>
        <dl>
          <dt>Source</dt><dd>{profile.source_path}</dd>
          <dt>Ratified Worlds</dt><dd>{profile.ratified_world_refs.join(", ") || "None disclosed"}</dd>
          <dt>Skills</dt><dd>{profile.skill_refs.join(", ") || "None authored"}</dd>
          <dt>SkillSets</dt><dd>{profile.skill_set_refs.join(", ") || "None authored"}</dd>
          <dt>Methods</dt><dd>{profile.method_refs.join(", ") || "None authored"}</dd>
          <dt>Knowledge</dt><dd>{profile.knowledge_source_refs.join(", ") || "None authored"}</dd>
        </dl>
      </details>
    </>}
    {set && <>
      <p className="agents-detail-purpose">Authored team membership</p>
      <dl>
        <dt>AgentSet</dt><dd>{set.ref}</dd>
        <dt>Revision</dt><dd>{set.revision}</dd>
        <dt>Source</dt><dd>{set.source_path}</dd>
        <dt>Orchestrator</dt><dd>{set.orchestrator_agent_ref ?? "None authored"}</dd>
      </dl>
      <details><summary>Declared members</summary>
        <ul>{set.members.map((member) => <li key={member.kind === "agent" ? member.agent_ref : member.agent_set_ref}>{member.kind === "agent" ? "Agent: " + member.agent_ref : "AgentSet: " + member.agent_set_ref}</li>)}</ul>
      </details>
    </>}
  </aside>;
}
