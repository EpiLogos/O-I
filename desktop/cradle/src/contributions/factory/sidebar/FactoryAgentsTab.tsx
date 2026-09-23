/**
 * The right panel's Agents tab in Factory — the Position population aperture
 * (10-SIDEBARS §4.5 "who am I working with", as amended by the World-rooted
 * inhabitation contract, WORLD-INHABITATION-V1 §4 and CROSSWALK §15).
 *
 * Rows are Positions — stable addresses in this World — from AIKit's
 * population reading (`aikit gateway who --json`): each with its occupancy
 * (occupied / vacant / unavailable, presence only as the owner states it)
 * and its current work (none / one / ambiguous), never a profile list and
 * never a name heuristic. When a run is selected, the Positions Factory
 * holds on it lead ("On this run", from `factory development inhabitation`).
 * A failed read is one named line with the owner's words and Retry; an
 * unknown is drawn as `?`, never as present. Clicking a row opens the
 * Position's page (the joined `aikit whoami` reading) in the centre.
 *
 * The agent PROFILE roster (Central's `agent-profile.roster`) stays reachable
 * as secondary detail under "Agent profiles" — read only when opened.
 */
import {useCallback, useMemo, useState} from "react";
import {useKernel} from "../../../kernel/KernelProvider";
import {kernelOp} from "../../../kernel/bridge";
import type {KernelTransportStatus} from "../../../kernel/types";
import {useScope, scopeProject} from "../../../workspace/scope";
import {openIntent, openObject} from "../../../agent/objects";
import {runEntry, titleOfRun, useDeskReading, useSelectedRun} from "../desk/deskStore";
import {firstSentence, initials, refTail} from "../desk/runModel";
import {populationAperture, rowMatches, type PositionRow} from "../inhabitation/model";
import {usePopulation} from "../inhabitation/reads";
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
/** Profile-page kind label only (the Agents aperture no longer sorts by it). */
export const isGuardian = (ref: string) => /-guardian$/.test(ref);

export function openPosition(row: {positionRef: string; name: string}, project: string | undefined, event?: {altKey: boolean}) {
  openObject({kind: "factory-position", ref: row.positionRef, title: row.name, ...(project ? {project} : {})}, event ? openIntent(event) : {});
}

export function FactoryAgentsTab() {
  const kernel = useKernel();
  const project = scopeProject(useScope());
  useDeskReading();
  const entry = runEntry(useSelectedRun());
  const {state, retry} = usePopulation(kernel.transport, project);
  const [query, setQuery] = useState("");
  const aperture = useMemo(() => populationAperture(state?.read, entry?.inhabitation, runRef => titleOfRun(runRef)), [state?.read, entry?.inhabitation]);
  const reading = !state || (state.status === "reading" && !state.read);
  const filter = (rows: PositionRow[]) => rows.filter(row => rowMatches(row, query));
  const onRun = filter(aperture.onRun), world = filter(aperture.world), inherited = filter(aperture.inherited);
  const total = aperture.onRun.length + aperture.world.length + aperture.inherited.length;
  const row = (position: PositionRow) => <button key={position.positionRef} type="button" className="fagent-row fpos-agent" data-position={position.positionRef} data-occupancy={position.occupancy.state} data-work={position.work.outcome}
    onClick={event => openPosition(position, project, event)} title={position.occupancy.attention ? `Attention: ${position.occupancy.attention}` : undefined}>
    <span className="fdesk-avatar fagent-avatar" aria-hidden="true">{initials(position.handle?.replace(/^@/, "") ?? position.name)}</span>
    <span className="fagent-text">
      <strong>{position.name}{position.handle && position.handle !== position.name ? <small className="fpos-handle"> {position.handle}</small> : null}</strong>
      <small data-occupancy-words><span className="fpos-mark" data-mark={position.occupancy.mark} aria-hidden="true">{position.occupancy.mark}</span> {position.occupancy.words}{position.occupancy.agent ? ` · ${position.occupancy.agent}` : ""}{position.occupancy.workcell ? ` · ${position.occupancy.workcell}` : ""}</small>
      <small data-work-words data-attention={position.work.attention ? "true" : undefined}>{position.work.attention ? "? " : ""}{position.work.words}</small>
    </span>
    {position.undelivered > 0 && <span className="fdesk-needs" data-undelivered={position.undelivered} title={`${position.undelivered} undelivered message${position.undelivered === 1 ? "" : "s"}`}>{position.undelivered}</span>}
  </button>;
  const section = (label: string, rows: PositionRow[]) => rows.length > 0 && <section aria-label={label}><h3 className="fagents-head">{label}</h3>{rows.map(row)}</section>;

  return <div className="fagents" data-agents-tab data-population-state={reading ? "reading" : aperture.state}>
    <label className="fdesk-search fagents-search"><input aria-label="Search Positions" placeholder="Search Positions" value={query} onChange={event => setQuery(event.target.value)} spellCheck={false}/></label>
    {reading && <p className="frtab-empty" role="status">Reading who is here…</p>}
    {!reading && aperture.state === "unavailable" && <p className="frtab-empty" role="alert" data-population-absence>
      Couldn't read who is here — {aperture.reason} <small>({aperture.source})</small>. <button type="button" className="fdesk-link" onClick={retry}>Retry</button>
    </p>}
    {entry && aperture.runAbsence && <p className="frtab-empty" data-run-positions-absence>{aperture.runAbsence}</p>}
    {section("On this run", onRun)}
    {section("In this world", world)}
    {section("Inherited", inherited)}
    {!reading && aperture.state === "read" && total === 0 && <p className="frtab-empty" data-population-empty>No Positions in this world yet.</p>}
    {query && total > 0 && !onRun.length && !world.length && !inherited.length && <p className="frtab-empty">No Positions match “{query}”. <button type="button" className="fdesk-link" onClick={() => setQuery("")}>Clear</button></p>}
    {aperture.absences.length > 0 && <section aria-label="Not read" data-population-absences>
      {aperture.absences.map((absence, index) => <p key={index} className="fslice-note">{absence.facet ? `${absence.facet.replace(/_/g, " ")}: ` : ""}{absence.reason ?? "not read"}{absence.source ? ` (${absence.source})` : ""}</p>)}
    </section>}
    <AgentProfiles project={project}/>
  </div>;
}

/** Secondary detail: Central's agent profile roster, read only when opened. */
function AgentProfiles({project}: {project: string | undefined}) {
  const kernel = useKernel();
  const [profiles, setProfiles] = useState<RosterProfile[]>();
  const [error, setError] = useState<string>();
  const read = useCallback(() => {
    setError(undefined);
    void readRoster(kernel.transport, project).then(setProfiles, reason => { setProfiles(undefined); setError(String(reason instanceof Error ? reason.message : reason)); });
  }, [kernel.transport, project]);
  return <details className="fagents-profiles" data-agent-profiles onToggle={event => { if ((event.target as HTMLDetailsElement).open && !profiles) read(); }}>
    <summary className="fagents-head">Agent profiles</summary>
    {error && <p className="frtab-empty" role="alert">Couldn't load agent profiles. <button type="button" className="fdesk-link" onClick={read}>Retry</button></p>}
    {!error && !profiles && <p className="frtab-empty" role="status">Reading agent profiles…</p>}
    {profiles && !profiles.length && <p className="frtab-empty">No agent profiles in this scope.</p>}
    {profiles?.map(profile => <button key={profile.agentRef} type="button" className="fagent-row" data-agent={profile.agentRef}
      onClick={event => openObject({kind: "factory-agent", ref: profile.agentRef, title: agentName(profile, profile.agentRef), ...(project ? {project} : {})}, openIntent(event))}>
      <span className="fdesk-avatar fagent-avatar" aria-hidden="true">{initials(agentName(profile, profile.agentRef))}</span>
      <span className="fagent-text"><strong>{agentName(profile, profile.agentRef)}</strong><small>{profile.purpose ? firstSentence(profile.purpose) : "No purpose recorded."}</small></span>
    </button>)}
  </details>;
}
