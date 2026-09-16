/**
 * The Configuration view (#299 §11, docs/cradle/09-CONFIGURATION-PLANE.md):
 * the primary editable view of the desired/native relation.
 *
 * Everything here is a GENERIC projection of the owner contributions: the
 * owner/section/setting tree comes from the mounted
 * `oi.configuration-contribution/v1` documents, controls come from the
 * frozen value-schema kinds, and per-setting state renders the frozen
 * reconciliation vocabulary. A new product setting appears here with no
 * new React code — the contract carries it.
 *
 * The desired axis is O:I intent: editing holds desired state (which may
 * drift from the owner's native truth). Plan/apply routes through the
 * owner-native transport under an inspectable plan — authority and
 * expected effect are visible BEFORE the apply.
 */
import {useEffect, useMemo,useState} from "react";
import type {
  ConfigResolution,
  ScopeAddress,
  SettingSpec,
} from "./contracts";
import {SINGULAR_SCOPE_KINDS, compactScope} from "./contracts";
import type {ChangeRequest, ConfigPlaneSource, ContributionMount} from "./source";
import {configPlaneSource, fixtureWorld} from "./sourceHost";
import {Loading} from "../shared/Loading";
import {SettingControl} from "./SettingControl";
import {PlanDrawer} from "./PlanDrawer";
import {NativeAxesDisplay, ReconciliationChip, formatValue} from "./viewUtils";
import "./configuration.css";

interface ScopeChoice {
  scope_kind: ScopeAddress["scope_kind"];
  scope_ref: string;
}

export function ConfigurationView() {
  const [source, setSource] = useState<ConfigPlaneSource | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [mounts, setMounts] = useState<ContributionMount[] | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, ConfigResolution>>({});
  const [scopeChoices, setScopeChoices] = useState<Record<string, ScopeChoice>>({});
  const [drawer, setDrawer] = useState<ChangeRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let live = true;
    configPlaneSource().then((planeSource) => {
      if (live) setSource(planeSource);
    }).catch((cause) => {
      if (live) setSourceError(String(cause));
    });
    return () => {live = false;};
  }, []);

  const settingsIndex = useMemo(() => {
    const index: Record<string, {setting: SettingSpec; owner: ContributionMount}> = {};
    for (const mount of mounts ?? []) {
      for (const section of mount.document?.sections ?? []) {
        for (const setting of section.settings) index[setting.setting_ref] = {setting, owner: mount};
      }
    }
    return index;
  }, [mounts]);

  const refresh = async (planeSource: ConfigPlaneSource) => {
    setRefreshing(true);
    setError(null);
    try {
      const registry = await planeSource.readRegistry();
      setMounts(registry.mounts);
      const pairs: {setting_ref: string; scope: ScopeAddress}[] = [];
      for (const mount of registry.mounts) {
        for (const section of mount.document?.sections ?? []) {
          for (const setting of section.settings) {
            pairs.push({setting_ref: setting.setting_ref, scope: chosenScope(setting, scopeChoices, planeSource)});
          }
        }
      }
      const results = await planeSource.readResolutions(pairs);
      const keyed: Record<string, ConfigResolution> = {};
      for (const resolution of results) keyed[`${resolution.setting_ref}|${compactScope(resolution.scope)}`] = resolution;
      setResolutions(keyed);
    } catch (cause) {
      setError(String(cause));
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (source) void refresh(source);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  const holdDesired = async (setting: SettingSpec, scope: ScopeAddress, next: {value?: unknown; secret_reference?: {ref: string} | null}) => {
    if (!source) return;
    try {
      await source.holdDesired({setting_ref: setting.setting_ref, scope, value: next.value, secret_reference: next.secret_reference ?? null});
    } catch (cause) {
      setError(String(cause));
    }
    await refresh(source);
  };

  const discard = async (setting_ref: string, scope: ScopeAddress) => {
    if (!source) return;
    try {
      await source.discardDesired(setting_ref, scope);
    } catch (cause) {
      setError(String(cause));
    }
    await refresh(source);
  };

  if (sourceError) return <p role="alert">{sourceError}</p>;
  if (!source || mounts == null) return <Loading label="Reading the configuration registry…"/>;
  if (source.kind === "unbound") {
    return <div className="config-view">
      <p className="config-empty" data-config-unbound>The configuration plane is not bound in this build: {source.label}. The live binding (KernelOp → the oi kernel) lands with the configuration-plane convergence; until then this surface renders its absence honestly.</p>
    </div>;
  }
  const operationsOpen = drawer != null;
  const driftedRequests: ChangeRequest[] = Object.values(resolutions)
    .filter((resolution) => resolution.desired != null && resolution.reconciliation.status === "drifted")
    .map((resolution) => {
      const entry = settingsIndex[resolution.setting_ref];
      const setting = entry?.setting;
      const secret = setting?.value_schema.type === "secret";
      return {
        setting_ref: resolution.setting_ref,
        scope: resolution.scope,
        value: secret ? undefined : resolution.desired?.value,
        secret_reference: secret ? resolution.desired?.secret_reference ?? null : null,
      };
    });
  return <div className="config-view">
    <header className="config-toolbar">
      <p className="config-note">Desired is O:I intent; native is the owner's own truth. Editing holds desired — plan and apply take it to the owner through its own operations.</p>
      <div className="config-toolbar-actions">
        <button type="button" data-config-plan-all disabled={refreshing || operationsOpen || driftedRequests.length === 0}
          title="Plan every drifted desired entry with its owner in one ChangeSet"
          onClick={() => setDrawer(driftedRequests)}
        >Plan desired changes…{driftedRequests.length > 0 ? ` (${driftedRequests.length})` : ""}</button>
        <button type="button" data-config-refresh disabled={refreshing || operationsOpen} onClick={() => void refresh(source)}>Re-read</button>
        {source.kind === "fixture" && <FixtureConsole onMutate={() => void refresh(source)}/>}
      </div>
    </header>
    {source.kind === "fixture" && <p className="config-source-label" data-config-source="fixture">{source.label} — simulated state for development; not this machine's truth</p>}
    {source.kind === "live" && <p className="config-source-label" data-config-source="live">{source.label}</p>}
    {error && <p role="alert" className="config-error">{error}</p>}
    {mounts.length === 0 && (
      <p className="config-empty" data-config-empty-registry>No owner contributes configuration in this World yet. An empty World is the same system at its beginning — install the suite, or bind owners, and their contributions appear here unchanged.</p>
    )}
    {mounts.map((mount) => <OwnerSection
      key={mount.owner_ref}
      mount={mount}
      source={source}
      resolutions={resolutions}
      scopeChoices={scopeChoices}
      setScopeChoices={setScopeChoices}
      onScopeChange={() => void refresh(source)}
      onHoldDesired={holdDesired}
      onDiscard={discard}
      onPlan={(requests) => setDrawer(requests)}
      drawerOpen={operationsOpen}
    />)}
    {drawer && <PlanDrawer
      source={source}
      requests={drawer}
      settings={Object.fromEntries(Object.entries(settingsIndex).map(([ref, entry]) => [ref, entry.setting]))}
      onClose={() => {setDrawer(null); void refresh(source);}}
      onApplied={() => void refresh(source)}
    />}
  </div>;
}

function chosenScope(setting: SettingSpec, choices: Record<string, ScopeChoice>, source?: ConfigPlaneSource): ScopeAddress {
  const choice = choices[setting.setting_ref];
  const allowed = choice ?? {scope_kind: setting.allowed_scopes[0]?.scope_kind ?? "world", scope_ref: ""};
  const singular = SINGULAR_SCOPE_KINDS.has(allowed.scope_kind);
  const ref = singular ? null : allowed.scope_ref || source?.scopeRefHint?.(allowed.scope_kind) || null;
  return {scope_kind: allowed.scope_kind, scope_ref: ref};
}

function OwnerSection(props: {
  mount: ContributionMount;
  source: ConfigPlaneSource;
  resolutions: Record<string, ConfigResolution>;
  scopeChoices: Record<string, ScopeChoice>;
  setScopeChoices: (next: Record<string, ScopeChoice>) => void;
  onScopeChange: () => void;
  onHoldDesired: (setting: SettingSpec, scope: ScopeAddress, next: {value?: unknown; secret_reference?: {ref: string} | null}) => Promise<void>;
  onDiscard: (setting_ref: string, scope: ScopeAddress) => Promise<void>;
  onPlan: (requests: ChangeRequest[]) => void;
  drawerOpen: boolean;
}) {
  const {mount} = props;
  const document_ = mount.document;
  const availability = mount.availability;
  return <details className="config-owner" data-owner={mount.owner_ref} data-availability={availability.state} open>
    <summary>
      <strong>{ownerTitle(mount.owner_ref)}</strong>
      <span className="config-owner-meta">
        {document_?.owner.owner_version && <span className="config-muted">{document_.owner.owner_version}</span>}
        <span className={`config-chip is-availability-${availability.state}`}>{availability.state}{availability.reason ? ` — ${availability.reason}` : ""}</span>
        <span className="config-mono config-ref">{mount.owner_ref}</span>
      </span>
    </summary>
    {mount.error && <p role="alert" className="config-error">{mount.error}</p>}
    {document_ && <p className="config-muted config-about">{document_.about}</p>}
    {document_?.obligations && document_.obligations.length > 0 && (
      <details className="config-obligations"><summary>Obligations ({document_.obligations.length})</summary>
        {document_.obligations.map((obligation, index) => <p key={index} className="config-muted">{obligation}</p>)}
      </details>
    )}
    {document_ && document_.sections.length === 0 && (
      <p className="config-empty" data-config-empty-owner>This owner discloses no configurable settings here — absence is the owner's own fact, nothing is fabricated.</p>
    )}
    {document_?.sections.map((section) => <div className="config-section" key={section.id}>
      <h4>{section.title}</h4>
      {section.settings.map((setting) => <SettingRowView key={setting.setting_ref} {...props} setting={setting}/>)}
    </div>)}
  </details>;
}

function SettingRowView({
  mount, source, resolutions, scopeChoices, setScopeChoices, onScopeChange, onHoldDesired, onDiscard, onPlan, drawerOpen, setting,
}: {
  mount: ContributionMount;
  source: ConfigPlaneSource;
  resolutions: Record<string, ConfigResolution>;
  scopeChoices: Record<string, ScopeChoice>;
  setScopeChoices: (next: Record<string, ScopeChoice>) => void;
  onScopeChange: () => void;
  onHoldDesired: (setting: SettingSpec, scope: ScopeAddress, next: {value?: unknown; secret_reference?: {ref: string} | null}) => Promise<void>;
  onDiscard: (setting_ref: string, scope: ScopeAddress) => Promise<void>;
  onPlan: (requests: ChangeRequest[]) => void;
  drawerOpen: boolean;
  setting: SettingSpec;
}) {
  const firstAllowed = setting.allowed_scopes[0]?.scope_kind ?? "world";
  const choice = scopeChoices[setting.setting_ref]
    ?? {scope_kind: firstAllowed, scope_ref: source.scopeRefHint?.(firstAllowed) ?? ""};
  const scope = chosenScope(setting, {[setting.setting_ref]: choice}, source);
  const key = `${setting.setting_ref}|${compactScope(scope)}`;
  const resolution = resolutions[key];
  const secret = setting.value_schema.type === "secret";
  const ownerOperable = mount.availability.state === "available" && mount.document?.operations.plan.availability === "disclosed";
  const canPlan = setting.writable && setting.operations.plan && setting.operations.apply && ownerOperable;
  const desired = resolution?.desired ?? null;
  const nativeAxisValue = resolution?.native.effective?.value ?? resolution?.native.declared?.value;
  const controlValue = secret ? undefined : desired?.value !== undefined ? desired.value : nativeAxisValue;
  const secretReference = desired?.secret_reference ?? (typeof nativeAxisValue === "string" ? {ref: nativeAxisValue} : null);
  const driftAgainstDesired = resolution?.reconciliation.status === "drifted";

  return <div className={`config-setting is-${resolution?.reconciliation.status ?? "unknown"}`} data-setting-ref={setting.setting_ref} data-reconciliation={resolution?.reconciliation.status ?? "unknown"}>
    <div className="config-setting-head">
      <strong>{setting.title}</strong>
      <code className="config-mono config-ref">{setting.setting_ref}</code>
      {resolution && <ReconciliationChip resolution={resolution}/>}
      {setting.sensitive && !secret && <span className="config-chip is-sensitive">sensitive</span>}
      {!setting.writable && <span className="config-chip is-readonly">read-only</span>}
    </div>
    {setting.description && <p className="config-muted config-desc">{setting.description}</p>}
    <div className="config-setting-body">
      <div className="config-control">
        <ScopePicker setting={setting} choice={choice}
          onChange={(next, commit) => {
            setScopeChoices({...scopeChoices, [setting.setting_ref]: next});
            if (commit) onScopeChange();
          }}/>
        {setting.writable
          ? <SettingControl
              schema={setting.value_schema}
              value={controlValue}
              secretReference={secretReference}
              secretPresence={secret && nativeAxisValue !== undefined}
              disabled={!ownerOperable || drawerOpen}
              hint={source.scopeRefHint?.(choice.scope_kind) ?? null}
              onCommit={(next) => void onHoldDesired(setting, scope, next)}
            />
          : <span className="config-muted">not writable here — {setting.effect.summary ?? "through its owner's own surface"}</span>}
      </div>
      <div className="config-facts">
        {resolution && <NativeAxesDisplay resolution={resolution} secret={secret}/>}
        {desired && <span className="config-axis is-desired">
          <span className="config-axis-name">desired</span>
          <span className="config-mono">{secret ? `${desired.secret_reference?.ref ?? "—"} (reference)` : formatValue(desired.value)}</span>
          {desired.source_ref && <span className="config-muted"> · {desired.source_ref}</span>}
        </span>}
        <span className="config-axis is-effect">
          <span className="config-axis-name">applying will</span>
          <span>{setting.effect.kind}{setting.effect.summary ? ` — ${setting.effect.summary}` : ""}</span>
        </span>
      </div>
      <div className="config-setting-actions">
        <button type="button" className="config-mini"
          data-config-plan
          disabled={!canPlan || !desired || drawerOpen || (secret ? !desired.secret_reference : desired.value === undefined)}
          title={canPlan ? "Plan this change with the owner before applying" : "the owner has not disclosed plan/apply here"}
          onClick={() => {if (desired) onPlan([requestFor(setting, scope, desired)]);}}
        >Plan apply…</button>
        {desired && <button type="button" className="config-mini" disabled={drawerOpen} onClick={() => void onDiscard(setting.setting_ref, scope)}>Discard desired</button>}
      </div>
      {resolution?.reconciliation.reason && driftAgainstDesired && <p className="config-muted config-reason">{resolution.reconciliation.reason}</p>}
    </div>
  </div>;
}

function requestFor(setting: SettingSpec, scope: ScopeAddress, desired: NonNullable<ConfigResolution["desired"]>): ChangeRequest {
  return {
    setting_ref: setting.setting_ref,
    scope,
    value: setting.value_schema.type === "secret" ? undefined : desired.value,
    secret_reference: setting.value_schema.type === "secret" ? desired.secret_reference ?? null : null,
  };
}

function ScopePicker({setting, choice, onChange}: {setting: SettingSpec; choice: ScopeChoice; onChange: (next: ScopeChoice, commit: boolean) => void}) {
  const singular = SINGULAR_SCOPE_KINDS.has(choice.scope_kind);
  const hint = setting.allowed_scopes.find((allowed) => allowed.scope_kind === choice.scope_kind);
  return <span className="config-scope-picker">
    <select
      className="config-input"
      aria-label={`Scope for ${setting.title}`}
      value={choice.scope_kind}
      onChange={(event) => onChange({scope_kind: event.target.value as ScopeChoice["scope_kind"], scope_ref: ""}, true)}
    >
      {setting.allowed_scopes.map((allowed) => <option key={allowed.scope_kind} value={allowed.scope_kind}>{allowed.scope_kind}</option>)}
    </select>
    {!singular && <input
      className="config-input"
      type="text"
      aria-label={`Scope reference for ${setting.title} at ${choice.scope_kind}`}
      placeholder={hint?.scope_ref ?? "scope reference"}
      value={choice.scope_ref}
      onChange={(event) => onChange({...choice, scope_ref: event.target.value}, false)}
      onBlur={() => onChange(choice, true)}
      onKeyDown={(event) => {if (event.key === "Enter") onChange(choice, true);}}
    />}
  </span>;
}

function FixtureConsole({onMutate}: {onMutate: () => void}) {
  const [externallyEdited, setExternallyEdited] = useState(false);
  const [empty, setEmpty] = useState(false);
  // The fixture world is reached only through the build-gated seam in
  // sourceHost — it never enters a production chunk graph.
  const mutate = async (action: (world: import("./sourceHost").FixtureWorldActions) => Promise<void> | void) => {
    const world = await fixtureWorld();
    if (!world) return;
    await action(world);
    onMutate();
  };
  return <details className="config-fixture-console" data-config-fixture-console>
    <summary>Fixture world console (development)</summary>
    <p className="config-muted">Simulates the reread laws against the fixture world. Nothing here exists in a production build.</p>
    <button type="button" className="config-mini" disabled={externallyEdited}
      onClick={() => void mutate(async (world) => {await world.simulateExternalNativeEdit("ai-kit:resolution:model.default", "opus"); setExternallyEdited(true);})}
    >Simulate external native edit: ai-kit:resolution:model.default → opus</button>
    <button type="button" className="config-mini"
      onClick={() => void mutate((world) => {world.setRegistryMode(empty ? "full" : "empty"); setEmpty(!empty);})}
    >{empty ? "Restore the full registry" : "Empty the registry (bootstrap world)"}</button>
  </details>;
}

function ownerTitle(owner_ref: string): string {
  const NAMES: Record<string, string> = {
    "ai-kit": "AIKit",
    oi: "O:I — composition",
    workcell: "Workcell",
    central: "Central",
    actuation: "Actuation",
    "software-factory": "Software Factory",
    "quaternal-logic": "Quaternal Logic",
  };
  return NAMES[owner_ref] ?? owner_ref;
}
