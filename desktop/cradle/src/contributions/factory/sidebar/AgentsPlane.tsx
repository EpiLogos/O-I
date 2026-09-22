/**
 * The Factory sidebar's Agents plane (FACTORY-UI-INTEGRATION-HANDOFF §2/§3):
 * a working roster — creation, teams and assignment, the selected agent's
 * Skills / Capabilities / routines / setup, and the explicit bounded
 * Suggest-skills flow. Real project conversations are the live roster rows;
 * the labelled dev fixture supplies the durable-worker shapes no native
 * roster operation exposes yet (named gap), and every fixture control
 * mutates the fixture, never native data.
 */
import {useMemo, useState} from "react";
import {Glyph} from "../../../workspace/Glyph";
import {EncounterList} from "../../../encounter/EncounterList";
import {handToPanelInspect} from "../../../agent/planes/panelInspect";
import type {DeskPlaneProps} from "../../../agent/desk/deskTypes";
import {
  applyProposal, createFixtureKind, discardProposal, markProposalStale, proposeSkills, removeTeamMember,
  assignTeamWork, toggleProposalSkill, toggleRoutine, useFactoryFixture,
  type FactoryPanelHost, type FixtureAgent,
} from "./sidebarModel";
import "./sidebar.css";
import {ScenarioBar} from "./ScenarioBar";
import {SideRow,SideRows,SideSection} from "../../../shared/SideSection";

/** The six Product Guardians are responsibilities over maintained product
 * repertoires — navigation and honest absence only: no roster read reaches
 * the desktop seam yet, so no identities are minted here. */
const GUARDIAN_PRODUCTS = ["Central", "Actuation", "AIKit", "Software Factory", "Workcell", "Quaternal Logic"] as const;

export function AgentsPlane({subject, project: modeProject, host, withScenarioBar=true}: DeskPlaneProps & {host?: FactoryPanelHost; withScenarioBar?: boolean; /** The mode's own grounded project (Factory's navigator picker). The canvas subject in Factory carries no project, so the roster situates by this. */ project?: string}) {
  const fixture = useFactoryFixture();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string>();
  const [teamOpen, setTeamOpen] = useState<string>();
  const [creating, setCreating] = useState<false | "agent" | "team">(false);
  const agents = fixture?.agents ?? [];
  const teams = fixture?.teams ?? [];
  const agent = agents.find(entry => entry.ref === selected);
  const team = teams.find(entry => entry.ref === teamOpen);
  const filtered = useMemo(() => agents.filter(entry => !query.trim() || `${entry.name} ${entry.purpose} ${entry.assignment ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())), [agents, query]);
  // The roster read situates by the canvas subject's project when it carries
  // one; Factory's canvas subject carries none, so the mode's own grounded
  // project (the navigator picker) situates it — the real kernel read, not a
  // second roster source.
  const project = subject.project ?? modeProject;

  return <div className="desk-plane oi-side-plane" data-plane="Agents" data-fixture={agents.length ? fixture?.scenario : undefined}>
    {withScenarioBar && <ScenarioBar />}
    {agent
      ? <AgentDetail agent={agent} fixtureOn={!!fixture} host={host} onBack={() => setSelected(undefined)} />
      : team
        ? <TeamDetail team={team} agents={agents} fixtureOn={!!fixture} host={host} onBack={() => setTeamOpen(undefined)} />
        : <>
          <div className="oi-side-head">
            <div className="oi-action-group">
              <button className="oi-action" onClick={() => setCreating("agent")}><Glyph name="agent" size={12} />New Agent</button>
              <button className="oi-action" onClick={() => setCreating("team")}><Glyph name="plus" size={12} />New Team</button>
            </div>
            <input className="oi-input oi-side-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search the roster…" aria-label="Search agents" />
          </div>
          {creating && <CreationForm kind={creating} fixtureOn={!!fixture} onClose={() => setCreating(false)} />}

          {!!teams.length && <SideSection label="Teams">
            <SideRows>
              {teams.map(entry => <li key={entry.ref}>
                <SideRow glyph="rows" title={entry.name} meta={`${entry.members.length} members`} onClick={() => setTeamOpen(entry.ref)} />
              </li>)}
            </SideRows>
          </SideSection>}

          <SideSection label="Roster">
            {filtered.length
              ? <SideRows>
                {filtered.map(entry => <li key={entry.ref}>
                  <SideRow leading={<span className="encounter-dot" aria-hidden="true" />} title={entry.name}
                    meta={[entry.availability, entry.assignment].filter(Boolean).join(" · ")}
                    data-availability={entry.availability} onClick={() => setSelected(entry.ref)}>
                    {entry.needsInput && <span className="oi-side-needs" role="status">needs you</span>}
                  </SideRow>
                </li>)}
              </SideRows>
              : <p className="oi-empty">{query ? "No matches." : "No agents yet."}</p>}
          </SideSection>

          <SideSection label="Project conversations">
            {host?.onOpenEncounterRow && project
              ? <EncounterList project={project} variant="panel" onOpen={row => host.onOpenEncounterRow?.(row)} />
              : <p className="oi-note">Choose a project.</p>}
          </SideSection>

          <SideSection label="Product Guardians">
            <ul className="oi-side-guardians">{GUARDIAN_PRODUCTS.map(name => <li key={name}><Glyph name="factory" size={11} />{name}</li>)}</ul>
            <p className="oi-note">Roster read not exposed at the desktop seam yet.</p>
          </SideSection>
        </>}
  </div>;
}

/** Creation begins with the exact human intent-expression. In the fixture it
 * lands a labelled worker; without native create authority the form says so. */
function CreationForm({kind, fixtureOn, onClose}: {kind: "agent" | "team"; fixtureOn: boolean; onClose: () => void}) {
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  return <form className="oi-side-create" onSubmit={event => event.preventDefault()}>
    <h4>{kind === "agent" ? "New Agent" : "New Team"}</h4>
    <label>Name<input className="oi-input" value={name} onChange={event => setName(event.target.value)} placeholder={kind === "agent" ? "A durable worker's name" : "A reusable team's name"} /></label>
    <label>Intent — what is this for, in your words<textarea className="oi-input" rows={3} value={purpose} onChange={event => setPurpose(event.target.value)} placeholder="The outcome this worker or team owns…" /></label>
    <div className="oi-action-group">
      {fixtureOn
        ? <button className="oi-action" disabled={!name.trim()} onClick={() => { createFixture(kind, name.trim(), purpose.trim()); onClose(); }}>Create (fixture)</button>
        : <small className="oi-side-gap">Native create not exposed yet.</small>}
      <button className="oi-action" onClick={onClose}>Close</button>
    </div>
  </form>;
}

/** The selected agent's local detail: back route, progressive disclosure,
 * Skills (with the bounded suggest flow), Capabilities, routines, setup. */
function AgentDetail({agent, fixtureOn, host, onBack}: {agent: FixtureAgent; fixtureOn: boolean; host?: FactoryPanelHost; onBack: () => void}) {
  const fixture = useFactoryFixture();
  const [purposeOpen, setPurposeOpen] = useState(false);
  const [intent, setIntent] = useState("");
  const [skillQuery, setSkillQuery] = useState("");
  const proposal = fixture?.proposal;
  const stale = proposal?.stale;
  const manualMatches = agent.skills.filter(skill => !skillQuery.trim() || skill.name.toLowerCase().includes(skillQuery.trim().toLowerCase()));
  return <div className="oi-side-detail" data-agent={agent.ref}>
    <div className="oi-side-back"><button className="oi-action" onClick={onBack}><Glyph name="back" size={12} />Roster</button></div>
    <header className="oi-side-detail-head">
      <Glyph name="agent" size={14} />
      <strong>{agent.name}</strong>
      <span className="oi-side-step-meta" data-availability={agent.availability}>{agent.availability}</span>
      {agent.needsInput && <span className="oi-side-needs" role="status">needs you</span>}
    </header>
    <SideSection label="Purpose">
      <p className="oi-side-purpose" data-open={purposeOpen || undefined} onClick={() => setPurposeOpen(value => !value)}>{purposeOpen ? agent.purpose : agent.purpose.length > 120 ? `${agent.purpose.slice(0, 119)}…` : agent.purpose}</p>
      {agent.assignment && <p className="oi-note">Assigned: {agent.assignment}</p>}
    </SideSection>

    <SideSection label="Skills">
      <ul className="oi-side-skills">
        {manualMatches.map(skill => <li key={skill.name} data-skill-state={skill.state}>
          <span>{skill.name}</span>
          <small>{[skill.state, skill.scope, skill.revision, skill.source].filter(Boolean).join(" · ")}</small>
        </li>)}
        {!manualMatches.length && <li className="oi-note">No skills match.</li>}
      </ul>
      <div className="oi-side-suggest">
        <input className="oi-input" value={skillQuery} onChange={event => { setSkillQuery(event.target.value); markProposalStale(); }} placeholder="Search skills manually…" aria-label="Search skills" />
        {fixtureOn
          ? <button className="oi-action" disabled={!intent.trim()} onClick={() => proposeSkills(agent.ref, intent.trim())}>Suggest skills</button>
          : <small className="oi-side-gap">Native AIKit search not exposed yet.</small>}
      </div>
      {fixtureOn && <label className="oi-side-intent">Intent for suggestions<textarea className="oi-input" rows={2} value={intent} onChange={event => { setIntent(event.target.value); markProposalStale(); }} placeholder="What should this worker be able to do?" /></label>}
      {proposal && <div className="oi-side-proposal" data-stale={stale || undefined} role="group" aria-label="Skill proposal">
        <h5>{stale ? "Proposal (stale — the intent or sources moved)" : "Proposed setup — review before applying"}</h5>
        <p className="oi-note">Intent: {proposal.intent}</p>
        {proposal.skills.map(skill => <label key={skill.name} className="oi-side-proposal-row">
          <input type="checkbox" checked={!skill.excluded} onChange={() => toggleProposalSkill(skill.name)} />
          <span>{skill.name}<small>{[skill.reason, skill.source, skill.revision ? `rev ${skill.revision}` : undefined, skill.scope, skill.prerequisites?.length ? `needs: ${skill.prerequisites.join(", ")}` : undefined].filter(Boolean).join(" · ")}</small></span>
        </label>)}
        {proposal.gaps.map(gap => <p key={gap} className="oi-side-gap">{gap}</p>)}
        <div className="oi-action-group">
          <button className="oi-action" disabled={!!stale} onClick={() => applyProposal(agent.ref)}>Apply selected</button>
          <button className="oi-action" onClick={() => useFactoryFixtureDiscard()}>Discard</button>
        </div>
      </div>}
    </SideSection>

    <SideSection label="Capabilities">
      <ul className="oi-side-skills">
        {agent.capabilities.map(capability => <li key={capability.name} data-capability-state={capability.state} data-permission={capability.permission}>
          <span>{capability.name}{capability.target ? <small> → {capability.target}</small> : null}</span>
          <small>{["permission " + capability.permission, capability.availability, capability.state].join(" · ")}</small>
        </li>)}
        {!agent.capabilities.length && <li className="oi-note">Nothing disclosed.</li>}
      </ul>
    </SideSection>

    {!!agent.routines.length && <SideSection label="Routines">
      <ul className="oi-side-skills">
        {agent.routines.map(routine => <li key={routine.ref} data-routine-enabled={routine.enabled}>
          <span>{routine.purpose}</span>
          <small>{[routine.trigger, routine.enabled ? "enabled" : "paused", routine.last ? `last: ${routine.last}` : undefined, routine.next ? `next: ${routine.next}` : undefined].filter(Boolean).join(" · ")}</small>
          {fixtureOn && <div className="oi-action-group">
            <button className="oi-action" onClick={() => toggleRoutine(agent.ref, routine.ref)}>{routine.enabled ? "Pause future" : "Resume"}</button>
            {host?.onOpenPlane && <button className="oi-action" onClick={() => host.onOpenPlane?.("run")}>Open an occurrence in Run</button>}
          </div>}
          {routine.inFlight && <small className="oi-side-barrier">In flight — pausing spares it.</small>}
        </li>)}
      </ul>
    </SideSection>}

    {!!agent.conversations.length && <SideSection label="Work and conversations">
      <ul className="oi-side-rows">
        {agent.conversations.map(conversation => <li key={conversation.ref}>
          <button className="oi-side-row" onClick={() => handToPanelInspect({kind: "agent-conversation", ref: conversation.ref, title: conversation.title, payload: conversation, source: "Agents"})}>
            <Glyph name="chat" size={12} /><span className="oi-side-row-title">{conversation.title}</span>
            <span className="oi-side-step-meta">{conversation.state}</span>
          </button>
        </li>)}
      </ul>
    </SideSection>}

    <SideSection label="Setup">
      <dl className="oi-side-setup">
        <dt>Model</dt><dd>{agent.setup.model ?? "not set"}</dd>
        <dt>Harness</dt><dd>{agent.setup.harness ?? "not set"}</dd>
        <dt>Environment</dt><dd>{agent.setup.environment ?? "not set"}</dd>
      </dl>
    </SideSection>
  </div>;
}

/** Team detail: members, responsibility and assignments. */
function TeamDetail({team, agents, fixtureOn, host, onBack}: {team: {ref: string; name: string; purpose: string; lead?: string; members: string[]; assignments: {agentRef: string; work: string; scope: string}[]}; agents: FixtureAgent[]; fixtureOn: boolean; host?: FactoryPanelHost; onBack: () => void}) {
  const [assignment, setAssignment] = useState("");
  const [assignee, setAssignee] = useState(agents[0]?.ref ?? "");
  const nameOf = (ref: string) => agents.find(entry => entry.ref === ref)?.name ?? ref;
  return <div className="oi-side-detail" data-team={team.ref}>
    <div className="oi-side-back"><button className="oi-action" onClick={onBack}><Glyph name="back" size={12} />Teams</button></div>
    <header className="oi-side-detail-head"><Glyph name="rows" size={14} /><strong>{team.name}</strong></header>
    <SideSection label="Purpose"><p className="oi-side-purpose">{team.purpose}</p>
      {team.lead && <p className="oi-note">Outcome owner: {nameOf(team.lead)} (lead)</p>}
    </SideSection>
    <SideSection label="Members">
      <ul className="oi-side-rows">
        {team.members.map(ref => <li key={ref}>
          <span className="oi-side-row"><span className="encounter-dot" aria-hidden="true" /><span className="oi-side-row-title">{nameOf(ref)}</span>{ref === team.lead && <span className="oi-side-step-meta">lead</span>}</span>
          {fixtureOn && ref !== team.lead && <button className="oi-action" onClick={() => removeMember(team.ref, ref)}>Remove</button>}
        </li>)}
      </ul>
    </SideSection>
    <SideSection label="Assignments">
      {team.assignments.map(entry => <p key={entry.agentRef + entry.work} className="oi-side-assignment">{nameOf(entry.agentRef)} — {entry.work} <small>({entry.scope})</small></p>)}
      {fixtureOn && <div className="oi-side-assign">
        <select className="oi-input" value={assignee} onChange={event => setAssignee(event.target.value)} aria-label="Assign to">
          {agents.map(entry => <option key={entry.ref} value={entry.ref}>{entry.name}</option>)}
        </select>
        <input className="oi-input" value={assignment} onChange={event => setAssignment(event.target.value)} placeholder="The bounded work…" aria-label="Assignment" />
        <button className="oi-action" disabled={!assignment.trim()} onClick={() => { assignWork(team.ref, assignee, assignment.trim()); setAssignment(""); }}>Assign</button>
      </div>}
    </SideSection>
    {host?.onOpenPlane && <div className="oi-action-group"><button className="oi-action" onClick={() => host.onOpenPlane?.("run")}>See the team's run</button></div>}
  </div>;
}

// --- fixture mutations local to this plane (labelled, dev-only in effect) ---
function createFixture(kind: "agent" | "team", name: string, purpose: string) { createFixtureKind(kind, name, purpose); }
function useFactoryFixtureDiscard() { discardProposal(); }
function removeMember(teamRef: string, memberRef: string) { removeTeamMember(teamRef, memberRef); }
function assignWork(teamRef: string, agentRef: string, work: string) { assignTeamWork(teamRef, agentRef, work); }
