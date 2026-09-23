/**
 * GuardianRepertoire — the Guardians are the identities Central's roster
 * names with a guardian role, RESOLVED here, never minted and never listed
 * from a hardcoded table (10-SIDEBARS §4.5). A registered GuardianSource adds
 * each one's repertoire.
 */
import { useEffect, useState } from "react";
import { Loading } from "../shared/Loading";
import { getGuardianSource, subscribeGuardianSource } from "./agencySources";
import type { GuardianRecord } from "./agencyTypes";
import { isGuardian, useAgentRoster } from "./roster";

export function GuardianRepertoire({ project }: { project?: string }) {
  // The guardians are real identities: Central's agent-profile roster, by
  // role (agency/roster.ts). A registered GuardianSource adds their
  // repertoires; without one, a guardian still shows as the identity it is.
  const roster = useAgentRoster(project);
  const [bound, setBound] = useState(() => getGuardianSource() !== undefined);
  useEffect(() => subscribeGuardianSource(() => setBound(getGuardianSource() !== undefined)), []);
  const [guardians, setGuardians] = useState<GuardianRecord[]>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    const source = getGuardianSource();
    if (!source) { setGuardians(undefined); return; }
    let live = true;
    setError(undefined);
    source.list(project).then((list) => { if (live) setGuardians(list); }).catch((cause) => { if (live) setError(String(cause)); });
    return () => { live = false; };
  }, [project, bound]);
  const byRef = new Map<string, GuardianRecord>();
  for (const guardian of guardians ?? []) byRef.set(guardian.agentRef, guardian);
  const identities = roster.agents.filter(isGuardian);

  return <div className="agency-guardians" aria-label="Guardians">
    <p className="oi-note">
      Skill bodies stay with their native product owners; composition and projection stay with AIKit. A Guardian is the stewardship and accumulation locus, never an exclusive tool owner.
    </p>
    {roster.state === "reading" && !identities.length && <Loading label="Reading guardians…" scope="surface"/>}
    {roster.state === "error" && <p className="oi-refusal" role="alert">Couldn&apos;t load guardians. <button type="button" className="oi-action" onClick={roster.retry}>Retry</button></p>}
    {roster.state === "ready" && !identities.length && <p className="oi-note">No guardians are defined in this scope.</p>}
    {bound && !guardians && !error && identities.length > 0 && <Loading label="Reading Guardian repertoires…" scope="surface"/>}
    {error && <p className="oi-refusal" role="alert">{error}</p>}
    <ul className="agency-guardian-list">
      {identities.map((identity) => {
        const guardian = byRef.get(identity.ref);
        return <li key={identity.ref} className="agency-guardian-row oi-row">
          {guardian ? <ResolvedGuardian guardian={guardian}/> : <div className="agency-guardian-body">
            <div className="oi-ref-row"><strong>{identity.name}</strong><span className="oi-state">{identity.accepted ? "Accepted" : "Not accepted yet"}</span></div>
            {identity.purpose && <p className="oi-note">{identity.purpose}</p>}
          </div>}
        </li>;
      })}
    </ul>
  </div>;
}

function ResolvedGuardian({ guardian }: { guardian: GuardianRecord }) {
  return <div className="agency-guardian-body">
    <div className="oi-ref-row">
      <strong>{guardian.product}</strong>
      <span>{guardian.name}</span>
      <span className="oi-ref">{guardian.agentRef}</span>
      <span className="oi-state">{guardian.readiness}</span>
    </div>
    <div className="oi-kv">
      <dt>Repertoire source</dt><dd>{guardian.repertoireSourceRef ? <span className="oi-ref">{guardian.repertoireSourceRef}</span> : "Withheld"}</dd>
      <dt>Pending practice proposals</dt><dd>{guardian.pendingPracticeProposals.length > 0
        ? <ul>{guardian.pendingPracticeProposals.map((proposal) => <li key={proposal.ref}>{proposal.summary} <span className="oi-state">{proposal.state}</span></li>)}</ul>
        : "None pending"}</dd>
      <dt>Verified changes</dt><dd>{guardian.verifiedChanges.length > 0
        ? <ul>{guardian.verifiedChanges.map((change) => <li key={change.ref}>{change.summary}{change.evidenceRef ? <> — <span className="oi-ref">{change.evidenceRef}</span></> : null}</li>)}</ul>
        : "None recorded"}</dd>
    </div>
  </div>;
}
