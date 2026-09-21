/** A bounded human form/flow, not a replacement System shell. */
import {useEffect, useId, useRef, useState, useSyncExternalStore} from "react";
import type {ChangeSetDocument, ConfigResolution, PlanDocument, ReceiptDocument, ScopeAddress, SettingSpec, ValueSchema} from "./contracts";
import type {ChangeRequest} from "./source";
import type {NativeDirectory, SourceBufferState, SourceListingState} from "../kernel/types";
import {compositionLine} from "./composition";
import {SetupFlowController, editableReason, requestKey, settingsOf, validateRequest} from "./setupFlowController";
import type {SetupNative} from "./setupNative";

export interface SetupFlowProps {
  controller: SetupFlowController;
  native?: SetupNative;
  /** Existing tray callers already chose settings: keep their direct review entry. */
  startAtReview?: boolean;
  onClose: () => void;
  onApplied: () => void;
}
const show = (value: unknown): string => value === undefined ? "Not disclosed" : JSON.stringify(value) ?? "Not disclosed";
const scopeLabel = (scope: ScopeAddress): string => scope.scope_ref ? `${scope.scope_kind}: ${scope.scope_ref}` : scope.scope_kind;

export function SetupFlow({controller, native, startAtReview = false, onClose, onApplied}: SetupFlowProps) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const heading = useRef<HTMLHeadingElement>(null);
  const notified = useRef<string | null>(null);
  const [picker, setPicker] = useState("");
  const [, tick] = useState(0);
  useEffect(() => {void controller.start(startAtReview);}, [controller, startAtReview]);
  useEffect(() => {heading.current?.focus();}, [state.step]);
  useEffect(() => {
    if (!state.changeset || notified.current === state.changeset.changeset_id) return;
    notified.current = state.changeset.changeset_id;
    onApplied();
  }, [state.changeset, onApplied]);
  useEffect(() => {
    if (state.step !== "review" || !state.bundle) return;
    const timer = setInterval(() => tick(value => value + 1), 1000);
    return () => clearInterval(timer);
  }, [state.step, state.bundle]);
  const mounts = state.registry?.mounts ?? [];
  const settings = settingsOf(mounts);
  const locked = state.busy === "applying" || state.busy === "readback";
  const close = () => {if (controller.cancel()) onClose();};
  // Escape closes the drawer wherever focus sits: a drawer-scoped handler
  // goes deaf when the platform moves focus outside it (WebKit after a
  // viewport resize), which reads as a dead Escape key.
  const lockedRef = useRef(false);
  lockedRef.current = locked;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.isComposing && !lockedRef.current) close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });
  const add = () => {
    const setting = settings[picker];
    const allowed = setting?.allowed_scopes[0];
    if (!setting || !allowed) return;
    const scope: ScopeAddress = {scope_kind: allowed.scope_kind, scope_ref: allowed.scope_ref ?? controller.source.scopeRefHint?.(allowed.scope_kind) ?? null};
    const current = state.resolutions.find(row => row.setting_ref === setting.setting_ref && scopeLabel(row.scope) === scopeLabel(scope));
    const request: ChangeRequest = {setting_ref: setting.setting_ref, scope};
    if (setting.value_schema.type === "secret") request.secret_reference = current?.desired?.secret_reference ?? null;
    else request.value = current?.desired?.value ?? current?.native.effective?.value ?? (setting.default_semantics === "constant" ? setting.default : undefined);
    controller.setRequests([...state.requests, request]);
    setPicker("");
  };
  return <div className="config-drawer" role="dialog" aria-label="Plan and apply" aria-busy={state.busy !== null} data-config-drawer>
    <header>
      <h4 ref={heading} tabIndex={-1}>{state.step === "result" ? "ChangeSet result" : state.step === "review" ? "Plan" : "Set up your world"}</h4>
      <button type="button" className="config-mini" disabled={locked} onClick={close}>close</button>
    </header>
    <nav aria-label="Setup steps" className="config-muted">
      <span aria-current={state.step === "discovery" ? "step" : undefined}>1 · Discover</span>{" → "}
      <span aria-current={state.step === "settings" ? "step" : undefined}>2 · Configure</span>{" → "}
      <span aria-current={state.step === "review" ? "step" : undefined}>3 · Review</span>{" → "}
      <span aria-current={state.step === "result" ? "step" : undefined}>4 · Read back and use</span>
    </nav>
    <p className="config-muted">{controller.source.label}</p>
    {state.busy && <p role="status">{state.busy === "applying" ? "Applying through native owners. This cannot be cancelled or rolled back by closing the form." : state.busy === "planning" ? "Planning with the owners…" : state.busy === "readback" ? "Reading native state and receipts…" : "Discovering owner contributions…"}</p>}
    {state.error && <p role="alert" className="config-error">{state.error}</p>}
    {state.warnings.map(warning => <p role="status" className="config-error" key={warning}>{warning}</p>)}

    {state.step === "discovery" && <section aria-label="Discovered composition">
      <p>{compositionLine(state.registry?.composition) ?? "Composition has not been disclosed. Installed, effective and ready are different facts."}</p>
      {state.registry?.composition?.warnings.map(warning => <p key={warning} className="config-muted">{warning}</p>)}
      <ul>{mounts.map(mount => <li key={mount.owner_ref}>
        <strong>{mount.owner_ref}</strong> — {mount.availability.state}; {mount.composition?.standing ?? "unknown standing"}
        {mount.availability.reason && <span> · {mount.availability.reason}</span>}
        {!mount.document && <span> · no configuration contribution available</span>}
      </li>)}</ul>
      {state.registry && mounts.length === 0 && <p>No configuration owners are available here. Use native installation/recognition first, then retry discovery. No product or Context Frame is inferred from an empty registry.</p>}
      <p className="config-muted">Choose the settings for your intended composition next. This form does not install a product, activate a profile or equate an application mode with an installation form. Read-only owner disclosures stay read-only.</p>
      <button type="button" disabled={!!state.busy} onClick={() => void controller.discover()}>Retry discovery</button>{" "}
      <button type="button" data-setup-next disabled={!!state.busy || !state.registry || !mounts.length} onClick={() => controller.continueToSettings()}>Choose settings</button>
    </section>}

    {state.step === "settings" && <form aria-label="Setup settings" onSubmit={event => {event.preventDefault(); void controller.plan();}}>
      <label>Add a setting from an owner
        <select className="config-input" value={picker} onChange={event => setPicker(event.target.value)} disabled={!!state.busy}>
          <option value="">Choose a setting…</option>
          {mounts.map(mount => <optgroup label={mount.owner_ref} key={mount.owner_ref}>
            {(mount.document?.sections ?? []).flatMap(section => section.settings).map(setting => {
              const reason = editableReason(mount, setting);
              return <option key={setting.setting_ref} value={setting.setting_ref} disabled={!!reason || state.requests.some(request => request.setting_ref === setting.setting_ref)}>{setting.title}{reason ? " — read-only here" : ""}</option>;
            })}
          </optgroup>)}
        </select>
      </label>{" "}<button type="button" disabled={!picker || !!state.busy} onClick={add}>Add setting</button>
      <p className="config-muted">Edits remain in this draft until you review and apply. Back and Cancel preserve the draft for this app session; neither resets native state.</p>
      {state.requests.map((request, index) => {
        const setting = settings[request.setting_ref];
        const resolution = state.resolutions.find(row => requestKey(row) === requestKey(request));
        const mount = mounts.find(owner => owner.document?.sections.some(section => section.settings.some(spec => spec.setting_ref === request.setting_ref)));
        const readonly = setting && mount ? editableReason(mount, setting) : "Not disclosed";
        return <fieldset key={`${request.setting_ref}:${index}`} disabled={!!state.busy}>
          <legend>{setting?.title ?? request.setting_ref}</legend>
          {setting ? <>
            <p>{setting.description}</p>
            {readonly ? <p className="config-muted">{readonly} Native reference: {setting.native_ref}</p> : <>
            <ScopePicker setting={setting} request={request} hint={kind => controller.source.scopeRefHint?.(kind) ?? null}
              onChange={scope => controller.setRequests(state.requests.map((row, i) => i === index ? {...row, scope} : row))}/>
            <DraftValue setting={setting} request={request} resolution={resolution} native={native}
              onChange={next => controller.setRequests(state.requests.map((row, i) => i === index ? {...row, ...next} : row))}/>
            </>}
            {validateRequest(request, setting) && <p className="config-muted">{validateRequest(request, setting)}</p>}
            <p className="config-muted">Expected effect: {setting.effect.kind}{setting.effect.summary ? ` — ${setting.effect.summary}` : ""}. The native plan confirms the actual effect.</p>
            <Axes request={request} resolution={resolution} setting={setting}/>
          </> : <p>This setting is no longer disclosed. Remove it or return to discovery; it cannot be applied here.</p>}
          <button type="button" className="config-mini" onClick={() => controller.setRequests(state.requests.filter((_, i) => i !== index))}>Remove from draft</button>
        </fieldset>;
      })}
      <div className="config-drawer-actions">
        <button type="button" disabled={!!state.busy} onClick={() => controller.back()}>Back</button>
        <button type="submit" data-setup-plan disabled={!!state.busy || !state.requests.length}>Validate and plan</button>
        <button type="button" disabled={locked} onClick={close}>Cancel</button>
      </div>
    </form>}

    {state.step === "review" && <section aria-label="Reviewed native plan">
      {state.bundle?.plans.map(plan => <PlanView key={plan.plan_id} plan={plan} setting={settings[plan.setting_ref]}/>)}
      {state.bundle?.errors.map((error, index) => <p key={index} role="alert" className="config-error" data-error-code={error.error_code}>{error.error_code}: {error.message}</p>)}
      {!state.busy && state.bundle && !controller.canApply() && <p className="config-muted">Apply is unavailable: the plan is incomplete, refused or expired. A fresh plan and explicit application are required; a successful subset is never silently applied.</p>}
      <div className="config-drawer-actions">
        <button type="button" disabled={locked} onClick={() => controller.back()}>Back to settings</button>
        <button type="button" disabled={!!state.busy} onClick={() => void controller.plan()}>Retry planning</button>
        <button type="button" data-config-apply disabled={!controller.canApply()} onClick={() => {controller.authorise(true); void controller.apply();}}>Apply {state.bundle?.plans.length ?? 0} operation{state.bundle?.plans.length === 1 ? "" : "s"}</button>
        <button type="button" disabled={locked} onClick={close}>Cancel</button>
      </div>
      <p className="config-muted">Apply authorises holding these reviewed desired entries and asking the native owners to apply them. Owner authority is checked natively; a plan or button is not a grant. Running sessions, providers and services keep their old active values until the disclosed restart/reconnect actually occurs.</p>
    </section>}

    {state.step === "result" && <section aria-label="Native result and recovery">
      {state.previousChangesets.length > 0 && <p>Earlier native ChangeSets retained in owner history: {state.previousChangesets.join(", ")}</p>}
      {state.changeset && <ChangeSetView changeset={state.changeset} receipts={state.receipts}/>}
      {state.held.length > 0 && <p className="config-muted">{state.held.length} desired entries were held through O:I's existing intent operation. This alone does not mean native or active state changed.</p>}
      <h5>Independent native readback</h5>
      {!state.readbackComplete && <p>Readback is incomplete. Do not infer readiness or retry an uncertain write.</p>}
      {state.requests.map(request => <section key={requestKey(request)}>
        <h5>{settings[request.setting_ref]?.title ?? request.setting_ref} · {scopeLabel(request.scope)}</h5>
        <Axes request={request} setting={settings[request.setting_ref]} resolution={state.resolutions.find(row => requestKey(row) === requestKey(request))}/>
      </section>)}
      <button type="button" data-setup-readback disabled={!!state.busy} onClick={() => void controller.readback()}>Re-read native state</button>{" "}
      {controller.retryableRequests().length > 0 && <button type="button" data-setup-retry onClick={() => controller.prepareRetry()}>Prepare a fresh plan for failed operations only</button>}
      {state.outcomeUnknown && <p className="config-muted">Use the native owner history to reconcile the uncertain call. This form deliberately offers no write retry for an unknown outcome. CLI/headless receipt history remains the same authority.</p>}
      {native && <FirstSourceAction native={native}/>}
      {!native && <p className="config-muted">Opening a real source requires the native host. Fixture results do not establish first-use readiness.</p>}
      <button type="button" disabled={locked} onClick={close}>Return to settings</button>
    </section>}
  </div>;
}

function ScopePicker({setting, request, hint, onChange}: {setting: SettingSpec; request: ChangeRequest; hint: (kind: ScopeAddress["scope_kind"]) => string | null; onChange: (scope: ScopeAddress) => void}) {
  const scopes = setting.allowed_scopes;
  const exact = scopes.findIndex(scope => scope.scope_kind === request.scope.scope_kind && scope.scope_ref === request.scope.scope_ref);
  const selected = exact >= 0 ? exact : scopes.findIndex(scope => scope.scope_kind === request.scope.scope_kind && scope.scope_ref === null);
  const singular = ["world", "ground", "machine"].includes(request.scope.scope_kind);
  return <>
    <label>Where this setting applies
      <select className="config-input" value={selected < 0 ? "" : String(selected)} onChange={event => {
        const choice = scopes[Number(event.target.value)];
        onChange({scope_kind: choice.scope_kind, scope_ref: choice.scope_ref ?? (choice.scope_kind === request.scope.scope_kind ? request.scope.scope_ref : hint(choice.scope_kind))});
      }}>
        {selected < 0 && <option value="">Choose a supported scope</option>}
        {scopes.map((scope, index) => <option key={index} value={index}>{scopeLabel(scope)}</option>)}
      </select>
    </label>
    {!singular && scopes[selected]?.scope_ref == null && <label>Native scope reference
      <input className="config-input" value={request.scope.scope_ref ?? ""} placeholder={hint(request.scope.scope_kind) ?? "Use the owner's existing reference"} onChange={event => onChange({...request.scope, scope_ref: event.target.value || null})}/>
    </label>}
  </>;
}

function DraftValue({setting, request, resolution, native, onChange}: {setting: SettingSpec; request: ChangeRequest; resolution?: ConfigResolution; native?: SetupNative; onChange: (next: {value?: unknown; secret_reference?: {ref: string} | null}) => void}) {
  const id = useId();
  const schema = setting.value_schema;
  const refs = [...new Set([request.secret_reference?.ref, resolution?.desired?.secret_reference?.ref,
    ...[resolution?.native.declared?.value, resolution?.native.effective?.value, resolution?.native.active?.value]
      .map(value => value && typeof value === "object" && "ref" in value && typeof value.ref === "string" ? value.ref : undefined)]
    .filter((value): value is string => !!value))];
  if (schema.type === "secret") return <label>Credential reference — never the credential itself
    <select className="config-input" data-config-control="secret" value={request.secret_reference?.ref ?? ""} onChange={event => onChange({secret_reference: event.target.value ? {ref: event.target.value} : null})}>
      <option value="">Choose a disclosed credential reference</option>
      {refs.map(ref => <option value={ref} key={ref}>{ref}</option>)}
    </select>
    <span className="config-muted">Create or rotate credentials in the owner's secure native mechanism, then re-read. This form has no secret-material input.</span>
  </label>;
  if (setting.sensitive) return <p>Read-only here: use the owner's secure native configuration.</p>;
  if (schema.type === "table" || schema.type === "list") return <StructuredDraft schema={schema} value={request.value} onChange={value => onChange({value})}/>;
  const value = request.value;
  const options = [resolution?.desired?.value, resolution?.native.declared?.value, resolution?.native.effective?.value, resolution?.native.active?.value].filter((value): value is string => typeof value === "string");
  return <>
    <label htmlFor={id}>Desired value</label>
    {schema.type === "boolean" ? <select id={id} className="config-input" data-config-control="boolean" value={typeof value === "boolean" ? String(value) : ""} onChange={event => onChange({value: event.target.value === "" ? undefined : event.target.value === "true"})}>
      <option value="">Choose…</option><option value="true">On</option><option value="false">Off</option>
    </select> : schema.type === "enum" ? <select id={id} className="config-input" data-config-control="enum" value={typeof value === "string" ? value : ""} onChange={event => onChange({value: event.target.value})}>
      {!schema.options.some(option => option.value === value) && <option value={typeof value === "string" ? value : ""}>{value === undefined ? "Choose…" : "Current draft is no longer an owner option"}</option>}
      {schema.options.map(option => <option key={option.value} value={option.value}>{option.title ?? option.value}</option>)}
    </select> : schema.type === "number" || schema.type === "integer" ? <input id={id} className="config-input" data-config-control={schema.type} type="number" step={schema.type === "integer" ? 1 : "any"} min={schema.minimum} max={schema.maximum} value={typeof value === "number" || typeof value === "string" ? value : ""} onChange={event => onChange({value: event.target.value.trim() === "" ? "" : Number(event.target.value)})}/> : <>
      <input id={id} className="config-input" data-config-control={schema.type} type="text" list={`${id}-values`} value={typeof value === "string" ? value : ""} onChange={event => onChange({value: event.target.value})}/>
      <datalist id={`${id}-values`}>{[...new Set(options)].map(option => <option value={option} key={option}/>)}</datalist>
      {schema.type === "reference" && <p className="config-muted">Suggestions are previously disclosed values, not a fabricated resolver. The owner validates a new reference.</p>}
      {schema.type === "path" && native && <PathPicker native={native} value={typeof value === "string" ? value : ""} onPick={path => onChange({value: path})}/>}
    </>}
  </>;
}

function StructuredDraft({schema, value, onChange}: {schema: Extract<ValueSchema, {type: "table" | "list"}>; value: unknown; onChange: (value: unknown[]) => void}) {
  const rows: unknown[] = Array.isArray(value) ? value : [];
  const columns = schema.type === "table" ? schema.columns : [{name: "item", type: schema.items?.type ?? "scalar"}];
  const edit = (index: number, name: string, next: unknown) => onChange(rows.map((row, i) => i === index ? schema.type === "table" ? {...(row as Record<string, unknown>), [name]: next} : next : row));
  return <div data-config-control={schema.type}>
    {rows.map((row, index) => <fieldset key={index}>
      <legend>{schema.type === "table" ? "Row" : "Item"} {index + 1}</legend>
      {columns.map(column => {
        const cell = schema.type === "table" ? (row as Record<string, unknown>)?.[column.name] : row;
        return <label key={column.name}>{column.name}
          {column.type === "boolean" ? <input type="checkbox" checked={cell === true} onChange={event => edit(index, column.name, event.target.checked)}/> : <input className="config-input" type={column.type === "number" || column.type === "integer" ? "number" : "text"} step={column.type === "integer" ? 1 : "any"} value={typeof cell === "string" || typeof cell === "number" ? cell : ""} onChange={event => edit(index, column.name, column.type === "number" || column.type === "integer" ? event.target.value === "" ? "" : Number(event.target.value) : event.target.value)}/>}
        </label>;
      })}
      <button type="button" onClick={() => onChange(rows.filter((_, i) => i !== index))}>Remove item</button>
    </fieldset>)}
    <button type="button" onClick={() => onChange([...rows, schema.type === "table" ? Object.fromEntries(columns.map(column => [column.name, ""])) : ""])}>Add {schema.type === "table" ? "row" : "item"}</button>
  </div>;
}

function PathPicker({native, value, onPick}: {native: SetupNative; value: string; onPick: (path: string) => void}) {
  const [directory, setDirectory] = useState<NativeDirectory | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  useEffect(() => {generation.current += 1; setDirectory(null); setPending(false); setError(null);}, [value]);
  const browse = async (path: string) => {
    const at = ++generation.current;
    setPending(true); setError(null);
    try {const result = await native.listDirectory(path); if (at === generation.current) setDirectory(result);}
    catch {if (at === generation.current) setError("The native owner could not list this directory. Enter an existing directory or retry; no setting was changed.");}
    finally {if (at === generation.current) setPending(false);}
  };
  return <div aria-label="Native path picker">
    <button type="button" disabled={pending || !value.trim()} onClick={() => void browse(value)}>Browse native files</button>
    {pending && <span role="status"> Reading directory…</span>}
    {error && <p role="alert">{error}</p>}
    {directory && <div>
      <p>{directory.location.path}</p>
      <button type="button" onClick={() => {onPick(directory.location.path); setDirectory(null);}}>Choose this directory</button>
      <ul>{directory.entries.map(entry => <li key={entry.location.ref}>
        <button type="button" disabled={pending} onClick={() => entry.kind === "directory" ? void browse(entry.location.path) : (onPick(entry.location.path), setDirectory(null))}>{entry.name}{entry.kind === "directory" ? " /" : ""}</button>
      </li>)}</ul>
      <button type="button" onClick={() => {generation.current += 1; setDirectory(null); setPending(false);}}>Cancel picker</button>
    </div>}
  </div>;
}

function Axes({request, resolution, setting}: {request: ChangeRequest; resolution?: ConfigResolution; setting?: SettingSpec}) {
  const sensitive = setting?.sensitive || setting?.value_schema.type === "secret";
  const nativeValue = (value: unknown) => sensitive ? value === undefined ? "Not disclosed" : "Presence/reference disclosed by owner; material is not shown" : show(value);
  return <dl className="config-plan-facts">
    <div><dt>Draft intent</dt><dd>{sensitive ? request.secret_reference?.ref ?? "No credential reference selected" : show(request.value)}</dd></div>
    <div><dt>Held desired</dt><dd>{sensitive ? resolution?.desired?.secret_reference?.ref ?? "Not held" : resolution?.desired ? show(resolution.desired.value) : "Not held"}</dd></div>
    <div><dt>Native declared</dt><dd>{nativeValue(resolution?.native.declared?.value)}</dd></div>
    <div><dt>Native effective</dt><dd>{nativeValue(resolution?.native.effective?.value)}</dd></div>
    <div><dt>Native active</dt><dd>{nativeValue(resolution?.native.active?.value)}</dd></div>
    {resolution?.native.staged && <div><dt>Native stage</dt><dd>{resolution.native.staged.stage_state} · {nativeValue(resolution.native.staged.value)}</dd></div>}
    <div><dt>Reconciliation</dt><dd>{resolution?.reconciliation.status ?? "unknown"}{resolution?.reconciliation.reason ? ` — ${resolution.reconciliation.reason}` : ""}</dd></div>
    <div><dt>Native reading</dt><dd>{resolution?.native_reading.reading_digest ?? "No digest disclosed"}{resolution?.native_reading.observed_at_unix_ms != null ? ` · ${new Date(resolution.native_reading.observed_at_unix_ms).toLocaleString()}` : ""}</dd></div>
  </dl>;
}

function PlanView({plan, setting}: {plan: PlanDocument; setting?: SettingSpec}) {
  return <details className="config-plan" data-plan-id={plan.plan_id} open>
    <summary><strong>{setting?.title ?? plan.setting_ref}</strong> · {scopeLabel(plan.scope)} · {plan.expected_effect.kind}</summary>
    <p>{plan.expected_effect.summary}</p>
    {plan.changes.map((change, index) => <p key={index}>{setting?.sensitive ? "Owner-native credential-reference change" : change.summary}</p>)}
    <dl className="config-plan-facts">
      <div><dt>Owner authority</dt><dd>{plan.authority?.requires?.join(", ") || "Owner-native"}{plan.authority?.granted_by ? ` · ${plan.authority.granted_by}` : ""}</dd></div>
      <div><dt>Plan</dt><dd>{plan.plan_id} · {plan.plan_digest}</dd></div>
      {plan.expires_at_unix_ms != null && <div><dt>Expires</dt><dd>{new Date(plan.expires_at_unix_ms).toLocaleTimeString()}</dd></div>}
    </dl>
  </details>;
}

/** Existing public result-view contract retained. Values are read through
 * Axes; this summary intentionally never prints requested secret material. */
export function ChangeSetView({changeset, receipts}: {changeset: ChangeSetDocument; receipts: ReceiptDocument[]}) {
  return <div className="config-changeset" data-changeset-status={changeset.status}>
    <p className="config-changeset-head"><strong>{changeset.changeset_id}</strong> <span className={`config-chip is-changeset status-${changeset.status}`}>{changeset.status}</span></p>
    <table className="config-table config-ops">
      <thead><tr><th>Operation</th><th>Owner</th><th>Setting</th><th>Scope</th><th>Status</th><th>Receipt</th></tr></thead>
      <tbody>{changeset.operations.map(operation => <tr key={operation.op_id} data-op-status={operation.status}>
        <td>{operation.op_id}</td><td>{operation.owner_ref}</td><td>{operation.setting_ref}</td><td>{scopeLabel(operation.scope)}</td>
        <td>{operation.status}{operation.error ? ` · ${operation.error.code}${operation.error.retryable ? " (retryable)" : ""}` : ""}</td><td>{operation.receipt_ref ?? "No receipt disclosed"}</td>
      </tr>)}</tbody>
    </table>
    {changeset.verification && <div className="config-verification"><strong>Re-read verification</strong> · {changeset.verification.reading_digest ?? "No digest disclosed"}
      <ul>{changeset.verification.reconciliations.map((row, index) => <li key={`${row.setting_ref}:${index}`}>{row.setting_ref} <span className={`config-status is-${row.status}`}>{row.status}</span></li>)}</ul>
    </div>}
    {changeset.status === "partially_applied" && <p className="config-error" role="alert">Partially applied. Successful operations remain applied; there is no implicit rollback. Only explicitly retryable failed operations can enter a fresh plan.</p>}
    {receipts.length > 0 && <details className="config-receipts"><summary>Receipts ({receipts.length})</summary>{receipts.map(receipt => <p key={receipt.receipt_id}>{receipt.receipt_id} · {receipt.outcome} · {receipt.expected_effect?.kind ?? "unknown"}{receipt.error ? ` · ${receipt.error.error_code}` : ""}</p>)}</details>}
  </div>;
}

/** One real, optional first use. It opens a native source, not a sample,
 * Agent conversation or new renderer; Track 1 retains normal pane routing. */
function FirstSourceAction({native}: {native: SetupNative}) {
  const sourceId = useId();
  const [listing, setListing] = useState<SourceListingState | null>(null);
  const [selected, setSelected] = useState("");
  const [buffer, setBuffer] = useState<SourceBufferState | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (open: boolean) => {
    if (pending) return;
    setPending(true); setError(null);
    try {
      if (open) setBuffer(await native.openSource(selected, listing?.project));
      else {setListing(await native.listSources()); setSelected(""); setBuffer(null);}
    } catch {setError("The native source operation is unavailable or refused. Retry after repairing that owner; no source was written and no Agent was invoked.");}
    finally {setPending(false);}
  };
  return <section aria-label="Useful first action">
    <h5>Try your world: open a real source</h5>
    <p className="config-muted">Optional, read-only use through Central's existing source operations. This is not proof that every product, a Factory Run, or the hosted corpus is ready.</p>
    <button type="button" disabled={pending} onClick={() => void run(false)}>Find sources in this world</button>
    {pending && <p role="status">Reading from the native owner…</p>}
    {error && <p role="alert">{error}</p>}
    {listing && <>
      {typeof listing.availability === "object" && <p role="status">{"unavailable" in listing.availability ? listing.availability.unavailable.reason : listing.availability.ground_only.reason}</p>}
      <label htmlFor={sourceId}>Native source</label>
      <select id={sourceId} className="config-input" value={selected} disabled={pending} onChange={event => {setSelected(event.target.value); setBuffer(null);}}>
        <option value="">Choose a source…</option>
        {listing.sources.map(source => <option value={source.ref} key={source.ref}>{source.path}</option>)}
      </select>
      {!listing.sources.length && <p>No sources were returned. This is a native empty/degraded listing, not demonstration content.</p>}
      <button type="button" disabled={pending || !selected} onClick={() => void run(true)}>Open selected source</button>
    </>}
    {buffer && <div><p>{buffer.source_ref} · revision {buffer.base_revision}</p><pre>{buffer.content.slice(0, 4000)}</pre>{buffer.content.length > 4000 && <p>Preview truncated; continue in the normal source pane for the full document.</p>}</div>}
  </section>;
}
