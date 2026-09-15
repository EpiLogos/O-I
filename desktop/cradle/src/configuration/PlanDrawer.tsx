/**
 * The plan/diff/apply drawer (#299 §21): owner authority and expected
 * effect are visible BEFORE any apply; the result renders the frozen
 * ChangeSet document — per-operation truth, receipts, re-read
 * verification — with partial failure shown exactly as the contract
 * records it (no fake rollback, no faked success, §8/§9).
 */
import {useEffect,useState} from "react";
import type {
  ChangeSetDocument,
  ConfigErrorDocument,
  PlanDocument,
  ReceiptDocument,
  SettingSpec,
} from "./contracts";
import {compactScope} from "./contracts";
import type {ChangeRequest, ConfigPlaneSource, PlanBundle} from "./source";
import {formatValue} from "./viewUtils";

export interface PlanDrawerProps {
  source: ConfigPlaneSource;
  requests: ChangeRequest[];
  settings: Record<string, SettingSpec>;
  onClose: () => void;
  onApplied: () => void;
}

export function PlanDrawer({source, requests, settings, onClose, onApplied}: PlanDrawerProps) {
  const [bundle, setBundle] = useState<PlanBundle | null>(null);
  const [changeset, setChangeset] = useState<ChangeSetDocument | null>(null);
  const [receipts, setReceipts] = useState<ReceiptDocument[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [planning, setPlanning] = useState(true);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    let live = true;
    setPlanning(true);
    source.plan(requests).then((result) => {
      if (!live) return;
      setBundle(result);
      setPlanning(false);
    }).catch((cause) => {
      if (!live) return;
      setError(String(cause));
      setPlanning(false);
    });
    return () => {live = false;};
  }, [source, requests]);

  const apply = async () => {
    if (!bundle || bundle.plans.length === 0) return;
    setApplying(true);
    setError(null);
    try {
      const document_ = await source.apply(bundle.plans);
      setChangeset(document_);
      if (source.receipts) setReceipts(await source.receipts(document_.changeset_id));
      onApplied();
    } catch (cause) {
      setError(String(cause));
    } finally {
      setApplying(false);
    }
  };

  return <div className="config-drawer" role="dialog" aria-label="Plan and apply" data-config-drawer>
    <header>
      <h4>{changeset ? "ChangeSet result" : "Plan"}</h4>
      <button type="button" className="config-mini" onClick={onClose}>close</button>
    </header>
    {planning && <p className="config-muted">Planning with the owners…</p>}
    {error && <p role="alert" className="config-error">{error}</p>}
    {bundle && !changeset && <>
      {bundle.plans.map((plan) => <PlanView key={plan.plan_id} plan={plan} setting={settings[plan.setting_ref]}/>)}
      {bundle.errors.map((planError, index) => <ErrorView key={index} error={planError}/>)}
      <div className="config-drawer-actions">
        <button type="button"
          data-config-apply
          disabled={applying || bundle.plans.length === 0}
          onClick={() => void apply()}
        >Apply {bundle.plans.length > 0 ? `${bundle.plans.length} operation${bundle.plans.length === 1 ? "" : "s"}` : ""}</button>
        <span className="config-muted">authority is the owner's decision at apply — this plan discloses what it will ask for</span>
      </div>
    </>}
    {changeset && <ChangeSetView changeset={changeset} receipts={receipts}/>}
  </div>;
}

/** One owner-minted plan (`oi.config-plan/v1`): what changes, what it
 * will do, who decides. */
function PlanView({plan, setting}: {plan: PlanDocument; setting?: SettingSpec}) {
  const effect = plan.expected_effect;
  return <details className="config-plan" data-plan-id={plan.plan_id} open>
    <summary>
      <strong>{setting?.title ?? plan.setting_ref}</strong>
      <span className="config-mono config-ref">{plan.setting_ref}</span>
      <span className="config-muted">@ {compactScope(plan.scope)}</span>
      <span className="config-chip is-effect">{effect.kind}</span>
    </summary>
    <dl className="config-plan-facts">
      <div><dt>Plan</dt><dd className="config-mono">{plan.plan_id} · digest {plan.plan_digest}</dd></div>
      {plan.authority && <div><dt>Authority</dt><dd>{plan.authority.requires?.length ? `requires ${plan.authority.requires.join(", ")}` : "owner-native"}{plan.authority.granted_by ? ` · granted by ${plan.authority.granted_by}` : ""}</dd></div>}
      <div><dt>Expected effect</dt><dd>{effect.kind}{effect.summary ? ` — ${effect.summary}` : ""}{effect.ref ? <span className="config-mono"> ({effect.ref})</span> : null}</dd></div>
      {plan.changes.map((change, index) => <div key={index}><dt>Change</dt><dd>{change.summary}{change.native_ref ? <span className="config-mono"> · {change.native_ref}</span> : null}</dd></div>)}
      {plan.expires_at_unix_ms ? <div><dt>Plan expires</dt><dd>{new Date(plan.expires_at_unix_ms).toLocaleTimeString()}</dd></div> : null}
    </dl>
  </details>;
}

function ErrorView({error}: {error: ConfigErrorDocument}) {
  return <p className="config-error" role="alert" data-error-code={error.error_code}>
    <span className="config-chip is-error">{error.error_code}</span>
    {error.setting_ref ? <span className="config-mono config-ref">{error.setting_ref}</span> : null}
    {error.message}
  </p>;
}

/** The frozen ChangeSet document, rendered as it stands — per-operation
 * status, receipts, and the re-read verification. */
export function ChangeSetView({changeset, receipts}: {changeset: ChangeSetDocument; receipts: ReceiptDocument[]}) {
  return <div className="config-changeset" data-changeset-status={changeset.status}>
    <p className="config-changeset-head">
      <strong>{changeset.changeset_id}</strong>
      <span className={`config-chip is-changeset status-${changeset.status}`}>{changeset.status}</span>
    </p>
    <table className="config-table config-ops">
      <thead><tr><th>Operation</th><th>Owner</th><th>Setting</th><th>Scope</th><th>Status</th><th>Receipt</th></tr></thead>
      <tbody>
        {changeset.operations.map((operation) => (
          <tr key={operation.op_id} data-op-status={operation.status}>
            <td className="config-mono">{operation.op_id}</td>
            <td>{operation.owner_ref}</td>
            <td className="config-mono config-ref">{operation.setting_ref || "—"}</td>
            <td className="config-mono">{compactScope(operation.scope)}</td>
            <td>
              <span className={`config-chip is-op-${operation.status}`}>{operation.status}</span>
              {operation.error && <span className="config-error-inline">{operation.error.code}: {operation.error.message}{operation.error.retryable ? " (retryable)" : ""}</span>}
            </td>
            <td className="config-mono">{operation.receipt_ref ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
    {changeset.verification && <div className="config-verification">
      <strong>Re-read verification</strong>
      <span className="config-muted"> reading {changeset.verification.reading_digest ?? "—"}</span>
      <ul>
        {changeset.verification.reconciliations.map((row) => (
          <li key={row.setting_ref}><span className="config-mono config-ref">{row.setting_ref}</span> <span className={`config-status is-${row.status}`}>{row.status}</span></li>
        ))}
        {changeset.verification.reconciliations.length === 0 && <li className="config-muted">nothing to reconcile</li>}
      </ul>
    </div>}
    {receipts.length > 0 && <details className="config-receipts">
      <summary>Receipts ({receipts.length})</summary>
      {receipts.map((receipt) => (
        <p key={receipt.receipt_id} className="config-receipt">
          <span className="config-mono">{receipt.receipt_id}</span> {receipt.outcome}
          {receipt.expected_effect?.kind ? <span className="config-muted"> · effect: {receipt.expected_effect.kind}</span> : null}
          {receipt.error ? <span className="config-error-inline"> · {receipt.error.error_code}: {receipt.error.message}</span> : null}
        </p>
      ))}
    </details>}
    {changeset.status === "partially_applied" && (
      <p className="config-error" role="alert">Partially applied — the failed owner operation is recorded as it failed. There is no implicit rollback; the change can be retried or the desired entry discarded.</p>
    )}
    <p className="config-muted">requested: {changeset.requested.map((request) => `${request.setting_ref}${request.value !== undefined ? ` = ${formatValue(request.value)}` : request.secret_reference ? ` → ${request.secret_reference.ref}` : ""}`).join("; ") || "—"}</p>
  </div>;
}
