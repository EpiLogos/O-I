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

/** The six Product Guardians are responsibilities over maintained product
 * repertoires — navigation and honest absence only: no roster read reaches
 * the desktop seam yet, so no identities are minted here. */
const GUARDIAN_PRODUCTS = ["Central", "Actuation", "AIKit", "Software Factory", "Workcell", "Quaternal Logic"] as const;

export function AgentsPlane({subject, accompanying, host}: DeskPlaneProps & {host?: FactoryPanelHost}) {
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
  const project = subject.project;

  return <div className="desk-plane factory-side" data-plane="Agents" data-fixture={agents.length ? fixture?.scenario : undefined}>
    <ScenarioBar />
    {agent
      ? <AgentDetail agent={agent} fixtureOn={!!fixture} host={host} onBack={() => setSelected(undefined)} />
      : team
        ? <TeamDetail team={team} agents={agents} fixtureOn={!!fixture} host={host} onBack={() => setTeamOpen(undefined)} />
        : <>
          <div className="factory-side-head">
            <div className="oi-action-group">
              <button className="oi-action" onClick={() => setCreating("agent")}><Glyph name="agent" size={12} />New Agent</button>
              <button className="oi-action" onClick={() => setCreating("team")}><Glyph name="plus" size={12} />New Team</button>
            </div>
            <input className="oi-input factory-side-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search the roster…" aria-label="Search agents" />
          </div>
          {creating && <CreationForm kind={creating} fixtureOn={!!fixture} onClose={() => setCreating(false)} />}

          {!!teams.length && <section className="factory-side-group" aria-label="Teams">
            <h4>Teams</h4>
            <ul className="factory-side-rows">
              {teams.map(entry => <li key={entry.ref}>
                <button className="factory-side-row" onClick={() => setTeamOpen(entry.ref)}>
                  <Glyph name="rows" size={12} /><span className="factory-side-row-title">{entry.name}</span>
                  <span className="factory-side-step-meta">{entry.members.length} members</span>
                </button>
              </li>)}
            </ul>
          </section>}

          <section className="factory-side-group" aria-label="Roster">
            <h4>Roster</h4>
            {filtered.length
              ? <ul className="factory-side-rows">
                {filtered.map(entry => <li key={entry.ref}>
                  <button className="factory-side-row" onClick={() => setSelected(entry.ref)} data-availability={entry.availability}>
                    <span className="encounter-dot" aria-hidden="true" />
                    <span className="factory-side-row-title">{entry.name}</span>
                    <span className="factory-side-step-meta">{[entry.availability, entry.assignment].filter(Boolean).join(" · ")}</span>
                    {entry.needsInput && <span className="factory-side-needs" role="status">needs you</span>}
                  </button>
                </li>)}
              </ul>
              : <p className="oi-empty">{query ? "No roster member matches." : "No durable workers yet. Create one above, or work through the project's conversations below."}</p>}
          </section>

          <section className="factory-side-group" aria-label="Project conversations">
            <h4>Project conversations</h4>
            {host?.onOpenEncounterRow && project
              ? <EncounterList project={project} variant="panel" onOpen={row => host.onOpenEncounterRow?.(row)} />
              : <p className="oi-note">The project's attached conversations list needs the browsed project; it is named in the left navigator and the panel head.</p>}
            {accompanying && <p className="oi-note">Bound conversation: <code className="oi-ref">{accompanying.ref}</code></p>}
          </section>

          <section className="factory-side-group" aria-label="Product Guardians">
            <h4>Product Guardians</h4>
            <ul className="factory-side-guardians">{GUARDIAN_PRODUCTS.map(name => <li key={name}><Glyph name="factory" size={11} />{name}</li>)}</ul>
            <p className="oi-note">Six maintained product repertoires, each resolved at its owner. No roster read reaches the desktop seam yet, so no identities or inventories are minted here (handoff §2 — named gap).</p>
          </section>
        </>}
  </div>;
}

/** Creation begins with the exact human intent-expression. In the fixture it
 * lands a labelled worker; without native create authority the form says so. */
function CreationForm({kind, fixtureOn, onClose}: {kind: "agent" | "team"; fixtureOn: boolean; onClose: () => void}) {
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  return <form className="factory-side-create" onSubmit={event => event.preventDefault()}>
    <h4>{kind === "agent" ? "New Agent" : "New Team"}</h4>
    <label>Name<input className="oi-input" value={name} onChange={event => setName(event.target.value)} placeholder={kind === "agent" ? "A durable worker's name" : "A reusable team's name"} /></label>
    <label>Intent — what is this for, in your words<textarea className="oi-input" rows={3} value={purpose} onChange={event => setPurpose(event.target.value)} placeholder="The outcome this worker or team owns…" /></label>
    <div className="oi-action-group">
      {fixtureOn
        ? <button className="oi-action" disabled={!name.trim()} onClick={() => { createFixture(kind, name.trim(), purpose.trim()); onClose(); }}>Create (fixture)</button>
        : <small className="factory-side-gap">Creating a durable named worker needs the native create operation — not exposed to the desktop seam yet (named gap). Existing conversations remain the live roster.</small>}
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
  return <div className="factory-side-detail" data-agent={agent.ref}>
    <div className="factory-side-back"><button className="oi-action" onClick={onBack}><Glyph name="back" size={12} />Roster</button></div>
    <header className="factory-side-detail-head">
      <Glyph name="agent" size={14} />
      <strong>{agent.name}</strong>
      <span className="factory-side-step-meta" data-availability={agent.availability}>{agent.availability}</span>
      {agent.needsInput && <span className="factory-side-needs" role="status">needs you</span>}
    </header>
    <section className="factory-side-group"><h4>Purpose</h4>
      <p className="factory-side-purpose" data-open={purposeOpen || undefined} onClick={() => setPurposeOpen(value => !value)}>{purposeOpen ? agent.purpose : agent.purpose.length > 120 ? `${agent.purpose.slice(0, 119)}…` : agent.purpose}</p>
      {agent.assignment && <p className="oi-note">Assigned: {agent.assignment}</p>}
    </section>

    <section className="factory-side-group" aria-label="Skills"><h4>Skills</h4>
      <ul className="factory-side-skills">
        {manualMatches.map(skill => <li key={skill.name} data-skill-state={skill.state}>
          <span>{skill.name}</span>
          <small>{[skill.state, skill.scope, skill.revision, skill.source].filter(Boolean).join(" · ")}</small>
        </li>)}
        {!manualMatches.length && <li className="oi-note">No skills match.</li>}
      </ul>
      <div className="factory-side-suggest">
        <input className="oi-input" value={skillQuery} onChange={event => { setSkillQuery(event.target.value); markProposalStale(); }} placeholder="Search skills manually…" aria-label="Search skills" />
        {fixtureOn
          ? <button className="oi-action" disabled={!intent.trim()} onClick={() => proposeSkills(agent.ref, intent.trim())}>Suggest skills</button>
          : <small className="factory-side-gap">Suggest skills needs AIKit search and a bounded inference at the desktop seam — not exposed yet (named gap). Manual search and select work without a model.</small>}
      </div>
      {fixtureOn && <label className="factory-side-intent">Intent for suggestions<textarea className="oi-input" rows={2} value={intent} onChange={event => { setIntent(event.target.value); markProposalStale(); }} placeholder="What should this worker be able to do?" />{intent.trim() && <small className="oi-note">Explicit only — no inference per keystroke. Changing the intent marks an existing proposal stale.</small>}</label>}
      {proposal && <div className="factory-side-proposal" data-stale={stale || undefined} role="group" aria-label="Skill proposal">
        <h5>{stale ? "Proposal (stale — the intent or sources moved)" : "Proposed setup — review before applying"}</h5>
        <p className="oi-note">Intent: {proposal.intent}</p>
        {proposal.skills.map(skill => <label key={skill.name} className="factory-side-proposal-row">
          <input type="checkbox" checked={!skill.excluded} onChange={() => toggleProposalSkill(skill.name)} />
          <span>{skill.name}<small>{[skill.reason, skill.source, skill.revision ? `rev ${skill.revision}` : undefined, skill.scope, skill.prerequisites?.length ? `needs: ${skill.prerequisites.join(", ")}` : undefined].filter(Boolean).join(" · ")}</small></span>
        </label>)}
        {proposal.gaps.map(gap => <p key={gap} className="factory-side-gap">{gap}</p>)}
        <div className="oi-action-group">
          <button className="oi-action" disabled={!!stale} onClick={() => applyProposal(agent.ref)}>Apply selected</button>
          <button className="oi-action" onClick={() => useFactoryFixtureDiscard()}>Discard</button>
        </div>
      </div>}
    </section>

    <section className="factory-side-group" aria-label="Capabilities"><h4>Capabilities</h4>
      <ul className="factory-side-skills">
        {agent.capabilities.map(capability => <li key={capability.name} data-capability-state={capability.state} data-permission={capability.permission}>
          <span>{capability.name}{capability.target ? <small> → {capability.target}</small> : null}</span>
          <small>{["permission " + capability.permission, capability.availability, capability.state].join(" · ")}</small>
        </li>)}
        {!agent.capabilities.length && <li className="oi-note">No capabilities disclosed for this worker.</li>}
      </ul>
      <p className="oi-note">Permission, availability and projection state are distinct; one green badge is never shown.</p>
    </section>

    {!!agent.routines.length && <section className="factory-side-group" aria-label="Routines"><h4>Routines</h4>
      <ul className="factory-side-skills">
        {agent.routines.map(routine => <li key={routine.ref} data-routine-enabled={routine.enabled}>
          <span>{routine.purpose}</span>
          <small>{[routine.trigger, routine.enabled ? "enabled" : "paused", routine.last ? `last: ${routine.last}` : undefined, routine.next ? `next: ${routine.next}` : undefined].filter(Boolean).join(" · ")}</small>
          {fixtureOn && <div className="oi-action-group">
            <button className="oi-action" onClick={() => toggleRoutine(agent.ref, routine.ref)}>{routine.enabled ? "Pause future" : "Resume"}</button>
            {host?.onOpenPlane && <button className="oi-action" onClick={() => host.onOpenPlane?.("run")}>Open an occurrence in Run</button>}
          </div>}
          {routine.inFlight && <small className="factory-side-barrier">An occurrence is in flight — pausing future triggers does not cancel it.</small>}
        </li>)}
      </ul>
    </section>}

    {!!agent.conversations.length && <section className="factory-side-group" aria-label="Work and conversations"><h4>Work &amp; conversations</h4>
      <ul className="factory-side-rows">
        {agent.conversations.map(conversation => <li key={conversation.ref}>
          <button className="factory-side-row" onClick={() => handToPanelInspect({kind: "agent-conversation", ref: conversation.ref, title: conversation.title, payload: conversation, source: "Agents"})}>
            <Glyph name="chat" size={12} /><span className="factory-side-row-title">{conversation.title}</span>
            <span className="factory-side-step-meta">{conversation.state}</span>
          </button>
        </li>)}
      </ul>
    </section>}

    <section className="factory-side-group" aria-label="Setup"><h4>Setup</h4>
      <dl className="factory-side-setup">
        <dt>Model</dt><dd>{agent.setup.model ?? "not set"}</dd>
        <dt>Harness</dt><dd>{agent.setup.harness ?? "not set"}</dd>
        <dt>Environment</dt><dd>{agent.setup.environment ?? "not set"}</dd>
      </dl>
      <p className="oi-note">Values shown are the worker's declared defaults; the active session's values can differ until its next turn or reload. Open conversation/activity/computer stay Agent-local actions where the app already has them.</p>
    </section>
  </div>;
}

/** Team detail: members, responsibility, assignments — and the four distinct
 * actions (add / address / assign / delegate) kept visibly different. */
function TeamDetail({team, agents, fixtureOn, host, onBack}: {team: {ref: string; name: string; purpose: string; lead?: string; members: string[]; assignments: {agentRef: string; work: string; scope: string}[]}; agents: FixtureAgent[]; fixtureOn: boolean; host?: FactoryPanelHost; onBack: () => void}) {
  const [assignment, setAssignment] = useState("");
  const [assignee, setAssignee] = useState(agents[0]?.ref ?? "");
  const nameOf = (ref: string) => agents.find(entry => entry.ref === ref)?.name ?? ref;
  return <div className="factory-side-detail" data-team={team.ref}>
    <div className="factory-side-back"><button className="oi-action" onClick={onBack}><Glyph name="back" size={12} />Teams</button></div>
    <header className="factory-side-detail-head"><Glyph name="rows" size={14} /><strong>{team.name}</strong></header>
    <section className="factory-side-group"><h4>Purpose</h4><p className="factory-side-purpose">{team.purpose}</p>
      {team.lead && <p className="oi-note">Outcome owner: {nameOf(team.lead)} (lead)</p>}
    </section>
    <section className="factory-side-group"><h4>Members</h4>
      <ul className="factory-side-rows">
        {team.members.map(ref => <li key={ref}>
          <span className="factory-side-row"><span className="encounter-dot" aria-hidden="true" /><span className="factory-side-row-title">{nameOf(ref)}</span>{ref === team.lead && <span className="factory-side-step-meta">lead</span>}</span>
          {fixtureOn && ref !== team.lead && <button className="oi-action" onClick={() => removeMember(team.ref, ref)}>Remove</button>}
        </li>)}
      </ul>
    </section>
    <section className="factory-side-group"><h4>Assignments</h4>
      {team.assignments.map(entry => <p key={entry.agentRef + entry.work} className="factory-side-assignment">{nameOf(entry.agentRef)} — {entry.work} <small>({entry.scope})</small></p>)}
      {fixtureOn && <div className="factory-side-assign">
        <select className="oi-input" value={assignee} onChange={event => setAssignee(event.target.value)} aria-label="Assign to">
          {agents.map(entry => <option key={entry.ref} value={entry.ref}>{entry.name}</option>)}
        </select>
        <input className="oi-input" value={assignment} onChange={event => setAssignment(event.target.value)} placeholder="The bounded work…" aria-label="Assignment" />
        <button className="oi-action" disabled={!assignment.trim()} onClick={() => { assignWork(team.ref, assignee, assignment.trim()); setAssignment(""); }}>Assign</button>
      </div>}
      <div className="oi-action-group factory-side-team-actions">
        <span className="factory-side-step-meta">Add to team</span><small className="factory-side-gap">{fixtureOn ? "pick a roster member" : "native membership op not exposed"}</small>
        <span className="factory-side-step-meta">Address / invite</span><small className="factory-side-gap">opens the centre chat with To:</small>
        <span className="factory-side-step-meta">Assign work</span><small className="factory-side-gap">scoped, above</small>
        <span className="factory-side-step-meta">Delegate bounded task</span><small className="factory-side-gap">authority op not exposed yet</small>
      </div>
      <p className="oi-note">Selecting or grouping a member dispatches nothing; addressing is not membership, and membership is not an authority grant.</p>
    </section>
    {host?.onOpenPlane && <div className="oi-action-group"><button className="oi-action" onClick={() => host.onOpenPlane?.("run")}>See the team's run</button></div>}
  </div>;
}

// --- fixture mutations local to this plane (labelled, dev-only in effect) ---
function createFixture(kind: "agent" | "team", name: string, purpose: string) { createFixtureKind(kind, name, purpose); }
function useFactoryFixtureDiscard() { discardProposal(); }
function removeMember(teamRef: string, memberRef: string) { removeTeamMember(teamRef, memberRef); }
function assignWork(teamRef: string, agentRef: string, work: string) { assignTeamWork(teamRef, agentRef, work); }
