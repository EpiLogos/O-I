/**
 * GuardianRepertoire — the six EXISTING Product Guardians (Central,
 * Actuation, AIKit, Software Factory, Workcell, Quaternal Logic) are
 * RESOLVED here, never minted (COMMON-BRIEF §handoff 2). `agency_read`
 * carries no field that marks a session as a Guardian, so absent a
 * registered GuardianSource every product renders the named receiving
 * row — never a guess from a name match.
 */
import { useEffect, useState } from "react";
import { Loading } from "../shared/Loading";
import { getGuardianSource, subscribeGuardianSource } from "./agencySources";
import { GUARDIAN_PRODUCTS } from "./agencyTypes";
import type { GuardianProduct, GuardianRecord } from "./agencyTypes";

export function GuardianRepertoire({ project }: { project?: string }) {
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

  const byProduct = new Map<GuardianProduct, GuardianRecord>();
  for (const guardian of guardians ?? []) byProduct.set(guardian.product, guardian);

  return <div className="agency-guardians" aria-label="Product Guardians">
    <p className="oi-note">
      Skill bodies stay with their native product owners; composition and projection stay with AIKit. A Guardian is the stewardship and accumulation locus, never an exclusive tool owner or a six-copies manual.
    </p>
    {!bound && <p className="oi-refusal" data-agency-guardians-unresolved>
      No GuardianSource is registered — the six existing Guardians are not recognisable in the current `agency_read` reading (it carries no field marking a session as a Guardian). Recognition of the six durable Agent/Agency identities lands with O:I #220; nothing here mints a replacement.
    </p>}
    {bound && !guardians && !error && <Loading label="Reading Guardian repertoires…" scope="surface"/>}
    {error && <p className="oi-refusal" role="alert">{error}</p>}
    <ul className="agency-guardian-list">
      {GUARDIAN_PRODUCTS.map((product) => {
        const guardian = byProduct.get(product);
        return <li key={product} className="agency-guardian-row oi-row">
          {guardian ? <ResolvedGuardian guardian={guardian}/> : <UnresolvedGuardian product={product}/>}
        </li>;
      })}
    </ul>
  </div>;
}

function UnresolvedGuardian({ product }: { product: GuardianProduct }) {
  return <div className="agency-guardian-body">
    <div className="oi-ref-row"><strong>{product}</strong><span className="oi-state">Unknown</span></div>
    <p className="oi-note">Guardian identity not resolved — no owner reading discloses it yet (O:I #220).</p>
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
