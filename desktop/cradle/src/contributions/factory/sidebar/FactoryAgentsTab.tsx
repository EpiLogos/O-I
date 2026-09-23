/**
 * The right panel's Agents tab in Factory (11-FACTORY §5, 10-SIDEBARS §4.5):
 * the roster from REAL identities only — Central's agent profile roster for
 * the scope (`agent-profile.roster` through the kernel's agent_definition
 * read). Agents working on the selected run come first (the run's attempt
 * participants and unit agent requirements), then Guardians (the roster's
 * guardian identities). Each row: avatar, name, one purpose line; clicking
 * opens the agent's page in the centre. No hardcoded lists; no markdown
 * dumps. If the roster cannot be read it says so, with Retry.
 */
import {useCallback, useEffect, useMemo, useState} from "react";
import {useKernel} from "../../../kernel/KernelProvider";
import {kernelOp} from "../../../kernel/bridge";
import type {KernelTransportStatus} from "../../../kernel/types";
import {useScope, scopeProject} from "../../../workspace/scope";
import {openObject} from "../../../agent/objects";
import {runEntry, useDeskReading, useSelectedRun} from "../desk/deskStore";
import {firstSentence, initials, refTail} from "../desk/runModel";
import "../desk/fdesk.css";

export interface RosterProfile {agentRef: string; name?: string; purpose?: string; accepted: boolean; skillRefs: string[]}

export async function readRoster(transport: KernelTransportStatus, project: string | undefined): Promise<RosterProfile[]> {
  const result = await kernelOp(transport, {op: "agent_definition", project: project ?? null, request: {action: "roster"}});
  if (result.error || result.outcome?.result !== "agent_definition_reading") throw new Error(result.error ?? "The agent roster did not answer");
  const data = result.outcome.data as {profiles?: {accepted?: boolean; profile?: {agent_ref?: string; name?: string; purpose?: string; skill_refs?: string[]}}[]};
  return (data.profiles ?? []).filter(row => row.profile?.agent_ref).map(row => ({
    agentRef: row.profile!.agent_ref!, name: row.profile!.name, purpose: row.profile!.purpose, accepted: row.accepted === true, skillRefs: row.profile!.skill_refs ?? [],
  }));
}

/** A readable name for an agent ref when its profile carries none:
 * `agent/central-guardian` → "Central guardian". */
export function agentName(profile: RosterProfile | undefined, ref: string): string {
  if (profile?.name) return profile.name;
  const tail = (refTail(ref) ?? ref).replace(/^expressed-[0-9a-f]+$/, "Agent").replace(/-/g, " ");
  return tail.charAt(0).toUpperCase() + tail.slice(1);
}
export const isGuardian = (ref: string) => /-guardian$/.test(ref);

export function FactoryAgentsTab() {
  const kernel = useKernel();
  const scope = useScope();
  const project = scopeProject(scope);
  useDeskReading();
  const entry = runEntry(useSelectedRun());
  const [profiles, setProfiles] = useState<RosterProfile[]>();
  const [error, setError] = useState<string>();
  const [query, setQuery] = useState("");
  const read = useCallback(() => {
    setError(undefined);
    void readRoster(kernel.transport, project).then(setProfiles, reason => { setProfiles(undefined); setError(String(reason instanceof Error ? reason.message : reason)); });
  }, [kernel.transport, project]);
  useEffect(() => { read(); }, [read]);

  const working = useMemo(() => {
    if (!entry) return [];
    const refs = new Set<string>();
    for (const attempt of entry.inspection?.attempts ?? []) if (attempt.participant?.agentRef) refs.add(attempt.participant.agentRef);
    for (const unit of entry.inspection?.units ?? []) for (const ref of unit.agentRequirements?.agentRefs ?? []) refs.add(ref);
    for (const agency of entry.run.agencies ?? []) if (agency.agentRef) refs.add(agency.agentRef);
    return [...refs];
  }, [entry]);
  const byRef = new Map((profiles ?? []).map(profile => [profile.agentRef, profile]));
  const matches = (ref: string) => { const q = query.trim().toLowerCase(); if (!q) return true; const profile = byRef.get(ref); return `${agentName(profile, ref)} ${profile?.purpose ?? ""}`.toLowerCase().includes(q); };
  const guardians = (profiles ?? []).filter(profile => isGuardian(profile.agentRef) && !working.includes(profile.agentRef)).map(profile => profile.agentRef);
  const shownWorking = working.filter(matches), shownGuardians = guardians.filter(matches);
  const open = (ref: string) => openObject({kind: "factory-agent", ref, title: agentName(byRef.get(ref), ref), ...(project ? {project} : {})});

  const row = (ref: string) => {
    const profile = byRef.get(ref);
    const name = agentName(profile, ref);
    return <button key={ref} type="button" className="fagent-row" data-agent={ref} onClick={() => open(ref)}>
      <span className="fdesk-avatar fagent-avatar" aria-hidden="true">{initials(name)}</span>
      <span className="fagent-text"><strong>{name}</strong><small>{profile?.purpose ? firstSentence(profile.purpose) : "No profile in this scope's roster."}</small></span>
    </button>;
  };
  return <div className="fagents" data-agents-tab>
    <label className="fdesk-search fagents-search"><input aria-label="Search agents" placeholder="Search agents" value={query} onChange={event => setQuery(event.target.value)} spellCheck={false}/></label>
    {error && <p className="frtab-empty" role="alert">Couldn't load agents. <button type="button" className="fdesk-link" onClick={read}>Retry</button></p>}
    {!error && !profiles && <p className="frtab-empty" role="status">Reading agents…</p>}
    {profiles && !working.length && !guardians.length && <p className="frtab-empty">Create an agent to work with.</p>}
    {profiles && query && !shownWorking.length && !shownGuardians.length && (working.length + guardians.length) > 0 && <p className="frtab-empty">No agents match “{query}”. <button type="button" className="fdesk-link" onClick={() => setQuery("")}>Clear</button></p>}
    {shownWorking.length > 0 && <section aria-label="Working on this run"><h3 className="fagents-head">Working on this run</h3>{shownWorking.map(row)}</section>}
    {shownGuardians.length > 0 && <section aria-label="Guardians"><h3 className="fagents-head">Guardians</h3>{shownGuardians.map(row)}</section>}
  </div>;
}
