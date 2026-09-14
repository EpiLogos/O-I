import { useState } from "react";
import type { AgentProfile, AgentSet } from "./client";

type DetailTab = "overview" | "skills" | "sessions" | "knowledge";

function RefList({ label, values }: { label: string; values: string[] }) {
  return <div className="agents-detail-list">
    <h4>{label}</h4>
    <p>{values.length ? values.join(", ") : "None disclosed"}</p>
  </div>;
}

export function AgentDetail({ profile, set }: { profile?: AgentProfile; set?: AgentSet }) {
  const [tab, setTab] = useState<DetailTab>("overview");
  if (!profile && !set) return <p className="agents-detail-empty">Select a profile or team to inspect its authored details.</p>;
  const tabs: DetailTab[] = profile ? ["overview", "skills", "sessions", "knowledge"] : ["overview"];
  return <aside className="agents-detail" aria-label="Selected Agent details">
    <header className="agents-detail-header">
      <div>
        <p className="agents-detail-kicker">{profile ? "Agent profile" : "Agent team"}</p>
        <h3>{profile?.purpose || profile?.role || (set ? "Authored AgentSet" : "Selected Agent")}</h3>
      </div>
      <span className="agents-detail-scope">{profile?.source_scope ?? set?.source_scope}</span>
    </header>
    <nav className="agents-detail-tabs" aria-label="Agent detail sections">
      {tabs.map((value) => <button key={value} type="button" className={tab === value ? "is-active" : ""} onClick={() => setTab(value)}>
        {value === "skills" ? "Skills & tools" : value[0].toUpperCase() + value.slice(1)}
      </button>)}
    </nav>
    {profile && tab === "overview" && <>
      <p className="agents-detail-purpose">{profile.purpose || "No purpose authored."}</p>
      <dl>
        <dt>Role</dt><dd>{profile.role || "Not disclosed"}</dd>
        <dt>Ownership</dt><dd>{profile.source_scope === "personal" ? "Personal Agent available to this Project" : "Project Agent"}</dd>
        <dt>Standing</dt><dd>{profile.intent_provenance?.recognition ?? "Recognition not disclosed"}</dd>
        <dt>Owning World</dt><dd>{profile.world_ref}</dd>
      </dl>
    </>}
    {profile && tab === "skills" && <div className="agents-detail-columns">
      <RefList label="Authored skill refs" values={profile.skill_refs} />
      <RefList label="Authored SkillSet refs" values={profile.skill_set_refs} />
      <RefList label="Authored method refs" values={profile.method_refs} />
      <RefList label="Authored routine refs" values={profile.routine_refs} />
    </div>}
    {profile && tab === "sessions" && <p>Current Project sessions are listed separately. Central does not disclose an Agent-to-AgentSession relation in this reading.</p>}
    {profile && tab === "knowledge" && <div className="agents-detail-columns">
      <RefList label="Knowledge sources" values={profile.knowledge_source_refs} />
      <RefList label="Governance" values={profile.governance_refs} />
      <RefList label="Access intent" values={profile.computer_access_intent_refs} />
    </div>}
    {set && tab === "overview" && <>
      <p className="agents-detail-purpose">Declared membership</p>
      <dl>
        <dt>Members</dt><dd>{set.members.length}</dd>
        <dt>Orchestrator</dt><dd>{set.orchestrator_agent_ref ?? "None disclosed"}</dd>
      </dl>
      <ul className="agents-detail-members">{set.members.map((member) =>
        <li key={member.kind === "agent" ? member.agent_ref : member.agent_set_ref}>
          {member.kind === "agent" ? "Agent" : "AgentSet"} · {member.kind === "agent" ? member.agent_ref : member.agent_set_ref}
        </li>
      )}</ul>
    </>}
    <details className="agents-detail-provenance">
      <summary>Exact refs and provenance · revision {profile?.revision ?? set?.revision}</summary>
      <dl>
        <dt>Ref</dt><dd>{profile?.profile_ref ?? set?.ref}</dd>
        {profile && <><dt>Agent</dt><dd>{profile.agent_ref}</dd><dt>Ratified Worlds</dt><dd>{profile.ratified_world_refs.join(", ") || "None disclosed"}</dd></>}
        {set && <><dt>Schema</dt><dd>{set.schema}</dd></>}
        <dt>Source</dt><dd>{profile?.source_path ?? set?.source_path}</dd>
      </dl>
    </details>
  </aside>;
}
