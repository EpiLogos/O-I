/**
 * The Settings surface — where the world's configuration is read and
 * changed. The successor to the old Configuration view: the same data
 * seam (`ConfigPlaneSource`), the same generic projection law (a new
 * product setting needs no new React code), the same frozen reconciliation
 * vocabulary — rendered for a person instead of for the contract.
 *
 * What changed against the old view, deliberately:
 *  - one search box over every setting (title, description, ref) with
 *    @-filters (`@modified`, `@attention`, `@readonly`, `@secret`,
 *    `@owner:<ref>`);
 *  - a table of contents by owner, not a wall of disclosure trees;
 *  - value-first rows: human title and control first; the ref lives in a
 *    copy action, not beside every title; the "In sync" state is silent —
 *    only settings needing attention carry a chip;
 *  - a pending-changes tray: held-but-unapplied edits gather in one place
 *    with one Apply, instead of a ceremony per row;
 *  - raw documents collapse into one developer view at the bottom.
 */
import {useEffect, useMemo, useState} from "react";
import type {
  ConfigResolution,
  ScopeAddress,
  SettingSpec,
} from "../../../configuration/contracts";
import {SINGULAR_SCOPE_KINDS, compactScope} from "../../../configuration/contracts";
import type {RegistryComposition} from "../../../configuration/composition";
import {settingsActionable} from "../../../configuration/composition";
import type {ChangeRequest, ConfigPlaneSource, ContributionMount} from "../../../configuration/source";
import {configPlaneSource, fixtureWorld} from "../../../configuration/sourceHost";
import {Loading} from "../../../shared/Loading";
import {SettingControl} from "../../../configuration/SettingControl";
import {PlanDrawer} from "../../../configuration/PlanDrawer";
import {ProfilesView} from "../../../configuration/ProfilesView";
import {ChatHarnessPanel} from "../../../configuration/ChatHarnessPanel";
import {NativeAxesDisplay, formatValue} from "./axisDisplay";
import {GroundChooser} from "../../GroundChooser";
import type {CompositionReading} from "../types";
import "../../../configuration/configuration.css";
import {
  availabilityWord,
  effectWord,
  productName,
  reconciliationMeaning,
  reconciliationWord,
  scopeWord,
} from "./vocabulary";
import "../settings-v2.css";

interface ScopeChoice {
  scope_kind: ScopeAddress["scope_kind"];
  scope_ref: string;
}

/** One renderable setting: the spec, its owner, and its section title. */
interface SettingEntry {
  owner: ContributionMount;
  sectionTitle: string;
  setting: SettingSpec;
}

type Panel = {kind: "all"} | {kind: "owner"; ownerRef: string} | {kind: "ground"} | {kind: "profiles"} | {kind: "chat"};

export function SettingsHome({census,target}: {census?: CompositionReading;target?: {owner:string;topic:string;settingRef?:string}}) {
  const [source, setSource] = useState<ConfigPlaneSource | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [mounts, setMounts] = useState<ContributionMount[] | null>(null);
  const [composition, setComposition] = useState<RegistryComposition | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, ConfigResolution>>({});
  const [scopeChoices, setScopeChoices] = useState<Record<string, ScopeChoice>>({});
  const [panel, setPanel] = useState<Panel>({kind: "all"});
  const [query, setQuery] = useState("");
  useEffect(()=>{
    if(!target)return;
    setPanel({kind:"owner",ownerRef:target.owner});
    // Filter actual owner disclosures. No setting or credential is fabricated.
    setQuery(`@owner:${target.owner}${target.settingRef?` ${target.settingRef}`:target.topic==="credentials"?" @secret":""}`);
  },[target]);
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
      setComposition(registry.composition ?? null);
      const pairs: {setting_ref: string; scope: ScopeAddress}[] = [];
      for (const mount of registry.mounts) {
        // An owner standing outside the effective composition has nothing
        // to resolve here (lock §5): its settings are disclosure-only.
        if (!settingsActionable(mount)) continue;
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

  const discardAll = async (requests: ChangeRequest[]) => {
    if (!source) return;
    for (const request of requests) {
      try {
        await source.discardDesired(request.setting_ref, request.scope);
      } catch (cause) {
        setError(String(cause));
      }
    }
    await refresh(source);
  };

  const entries = useMemo(() => {
    const list: SettingEntry[] = [];
    for (const mount of mounts ?? []) {
      for (const section of mount.document?.sections ?? []) {
        for (const setting of section.settings) {
          list.push({owner: mount, sectionTitle: section.title, setting});
        }
      }
    }
    return list;
  }, [mounts]);

  /** The resolution a row will show, for the scope that row edits. */
  const resolutionFor = (setting: SettingSpec): ConfigResolution | undefined => {
    const scope = chosenScope(setting, scopeChoices, source ?? undefined);
    return resolutions[`${setting.setting_ref}|${compactScope(scope)}`];
  };

  const filtered = useMemo(() => {
    const tokens = query.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return entries;
    const filters = tokens.filter((token) => token.startsWith("@"));
    const text = tokens.filter((token) => !token.startsWith("@")).join(" ").toLowerCase();
    return entries.filter((entry) => {
      const resolution = resolutionFor(entry.setting);
      const desired = resolution?.desired ?? null;
      const status = resolution?.reconciliation.status ?? "unknown";
      for (const filter of filters) {
        if (filter === "@modified" && !desired) return false;
        if (filter === "@attention" && !["drifted", "blocked", "pending", "unknown"].includes(status)) return false;
        if (filter === "@readonly" && entry.setting.writable) return false;
        if (filter === "@secret" && entry.setting.value_schema.type !== "secret") return false;
        if (filter.startsWith("@owner:") && entry.owner.owner_ref !== filter.slice("@owner:".length)) return false;
      }
      if (!text) return true;
      const haystack = [
        entry.setting.title,
        entry.setting.description ?? "",
        entry.sectionTitle,
        entry.setting.setting_ref,
        productName(entry.owner.owner_ref),
      ].join(" ").toLowerCase();
      return haystack.includes(text);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, query, resolutions, scopeChoices]);

  /** Held-but-unapplied changes — what the tray and "apply all" work on. */
  const pendingRequests: ChangeRequest[] = Object.values(resolutions)
    .filter((resolution) => resolution.desired != null && ["drifted", "pending"].includes(resolution.reconciliation.status))
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

  if (sourceError) return <p role="alert">{sourceError}</p>;
  if (!source || mounts == null) return <Loading label="Reading your settings…"/>;
  if (source.kind === "unbound") {
    return <div className="settings-home" data-settings-home>
      <p className="settings-empty" data-config-unbound>Settings are not connected in this build: {source.label}. The desktop reads and applies settings through the installed suite; without it there is nothing to show — and nothing is faked.</p>
    </div>;
  }

  const drawerOpen = drawer != null;
  const ownerGroups = mounts.filter((mount) => mount.document);
  const searching = query.trim() !== "";

  return <div className="settings-home" data-settings-home>
    <div className="settings-layout">
      <nav className="settings-toc" aria-label="Setting groups">
        <button type="button" aria-pressed={panel.kind === "all"} onClick={() => setPanel({kind: "all"})}>
          <span>All settings</span>
          {pendingRequests.length > 0 && <span className="settings-toc-badge" title={`${pendingRequests.length} change(s) waiting to be applied`}>{pendingRequests.length}</span>}
        </button>
        {ownerGroups.map((mount) => {
          const count = entries.filter((entry) => entry.owner === mount).length;
          const state = mount.availability.state;
          return <button key={mount.owner_ref} type="button"
            aria-pressed={panel.kind === "owner" && panel.ownerRef === mount.owner_ref}
            disabled={count === 0 && state === "unavailable"}
            onClick={() => setPanel({kind: "owner", ownerRef: mount.owner_ref})}>
            <span>{productName(mount.owner_ref)}</span>
            {count > 0 && <span className="settings-toc-count">{count}</span>}
            {state !== "available" && <span className={`settings-toc-state is-${state}`}>{availabilityWord(state)}</span>}
          </button>;
        })}
        <button type="button" aria-pressed={panel.kind === "chat"} onClick={() => setPanel({kind: "chat"})}>
          <span>Chat &amp; harnesses</span>
        </button>
        <button type="button" aria-pressed={panel.kind === "ground"} onClick={() => setPanel({kind: "ground"})}>
          <span>Ground & suite</span>
        </button>
        <button type="button" aria-pressed={panel.kind === "profiles"} onClick={() => setPanel({kind: "profiles"})}>
          <span>Profiles</span>
        </button>
      </nav>

      <div className="settings-main">
        <div className="settings-searchrow">
          <input
            className="settings-search"
            type="search"
            placeholder={`Search ${entries.length} settings — try “@modified” or “@attention”`}
            aria-label="Search settings"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="button" className="settings-refresh" data-config-refresh disabled={refreshing || drawerOpen} onClick={() => void refresh(source)}>
            {refreshing ? "Reading…" : "Re-read"}
          </button>
        </div>

        {source.kind === "fixture" && <p className="settings-sourcenote" data-config-source="fixture">{source.label} — a worked example for development, not this machine's real settings</p>}
        {source.kind === "live" && <p className="settings-sourcenote" data-config-source="live">{source.label}</p>}
        {composition?.warnings.map((warning, index) => <p key={index} role="note" className="settings-note" data-config-warning>{warning}</p>)}
        {error && <p role="alert" className="settings-error">{error}</p>}

        {panel.kind === "profiles"
          ? <ProfilesView/>
          : panel.kind === "chat"
            ? <ChatHarnessPanel/>
            : panel.kind === "ground"
            ? <div className="settings-groundpanel">
                <GroundChooser/>
                <SuitePins census={census}/>
              </div>
            : <>
                {ownerGroups.length === 0 && <p className="settings-empty" data-config-empty-registry>Nothing installed to configure yet.</p>}
                {searching && <p className="settings-note" data-settings-search-count>{filtered.length === entries.length ? `${entries.length} settings` : `${filtered.length} of ${entries.length} settings match`}</p>}
                {ownerGroups.map((mount) => {
                  if (panel.kind === "owner" && panel.ownerRef !== mount.owner_ref) return null;
                  const groupEntries = filtered.filter((entry) => entry.owner === mount);
                  const actionable = settingsActionable(mount);
                  const standing = mount.composition?.standing ?? "unknown";
                  return <section key={mount.owner_ref} className="settings-group" data-owner={mount.owner_ref} data-owner-group
                    data-availability={mount.availability.state} data-standing={standing}>
                    <header className="settings-group-head">
                      <h3>{productName(mount.owner_ref)}</h3>
                      {mount.document?.about && <p className="settings-group-about">{mount.document.about}</p>}
                    </header>
                    {!actionable && mount.availability.state !== "available" && (
                      <p className="settings-empty" data-owner-availability={mount.availability.state}>
                        {availabilityWord(mount.availability.state)}{mount.availability.reason ? ` — ${mount.availability.reason}` : ""}
                      </p>
                    )}
                    {!actionable && mount.availability.state === "available" && standing === "absent" && (
                      <p className="settings-empty" data-config-absent-owner>
                        Not part of the running world — its settings can't change here.
                      </p>
                    )}
                    {groupEntries.length === 0 && !mount.error && !searching && <p className="settings-empty">No settings here right now.</p>}
                    {sectionEntries(groupEntries).map(([title, list]) => <div key={title} className="settings-section">
                      <h4>{title}</h4>
                      {list.map((entry) => {
                        const scope = chosenScope(entry.setting, scopeChoices, source ?? undefined);
                        return <SettingRowCard
                          key={entry.setting.setting_ref}
                          entry={entry}
                          resolution={resolutionFor(entry.setting)}
                          ownerOperable={actionable}
                          drawerOpen={drawerOpen}
                          scopeChoice={scopeChoices[entry.setting.setting_ref] ?? null}
                          onScopeChoice={(next, commit) => {
                            setScopeChoices({...scopeChoices, [entry.setting.setting_ref]: next});
                            if (commit && source) void refresh(source);
                          }}
                          onHold={(next) => void holdDesired(entry.setting, scope, next)}
                          onDiscard={() => void discard(entry.setting.setting_ref, scope)}
                          onPlan={(request) => setDrawer([request])}
                        />;
                      })}
                    </div>)}
                  </section>;
                })}
              </>}
      </div>
    </div>

    {source.kind === "fixture" && <FixtureConsole onMutate={() => void refresh(source)}/>}
    <DevView mounts={mounts}/>

    {pendingRequests.length > 0 && !drawerOpen && panel.kind !== "profiles" && panel.kind !== "chat" && (
      <div className="settings-tray" role="region" aria-label="Pending changes" data-settings-tray>
        <span>
          <strong>{pendingRequests.length}</strong> change{pendingRequests.length === 1 ? "" : "s"} waiting
        </span>
        <span className="settings-tray-actions">
          <button type="button" className="settings-mini" data-config-discard-all onClick={() => void discardAll(pendingRequests)}>Discard all</button>
          <button type="button" data-config-plan-all onClick={() => setDrawer(pendingRequests)}>Review &amp; apply…</button>
        </span>
      </div>
    )}

    {drawer && <PlanDrawer
      source={source}
      requests={drawer}
      settings={Object.fromEntries(Object.entries(settingsIndex).map(([ref, entry]) => [ref, entry.setting]))}
      onClose={() => {setDrawer(null); void refresh(source);}}
      onApplied={() => void refresh(source)}
    />}
  </div>;
}

function sectionEntries(entries: SettingEntry[]): [string, SettingEntry[]][] {
  const bySection = new Map<string, SettingEntry[]>();
  for (const entry of entries) {
    const list = bySection.get(entry.sectionTitle) ?? [];
    list.push(entry);
    bySection.set(entry.sectionTitle, list);
  }
  return [...bySection.entries()];
}

/** The scope a setting is currently edited at: the explicit choice when
 * one was made, else the setting's first allowed kind (with the
 * source's hint for the ref where one is needed). */
function chosenScope(setting: SettingSpec, choices: Record<string, ScopeChoice>, source?: ConfigPlaneSource): ScopeAddress {
  const choice = choices[setting.setting_ref];
  const allowed = choice ?? {scope_kind: setting.allowed_scopes[0]?.scope_kind ?? "world", scope_ref: ""};
  const singular = SINGULAR_SCOPE_KINDS.has(allowed.scope_kind);
  const ref = singular ? null : allowed.scope_ref || source?.scopeRefHint?.(allowed.scope_kind) || null;
  return {scope_kind: allowed.scope_kind, scope_ref: ref};
}

// ---------------------------------------------------------------------------

/** One setting row: human title, one control, and — only when it matters —
 * the state that needs attention. The ref lives behind a copy action. */
function SettingRowCard({
  entry, resolution, ownerOperable, drawerOpen, scopeChoice, onScopeChoice, onHold, onDiscard, onPlan,
}: {
  entry: SettingEntry;
  resolution: ConfigResolution | undefined;
  ownerOperable: boolean;
  drawerOpen: boolean;
  scopeChoice: ScopeChoice | null;
  onScopeChoice: (next: ScopeChoice, commit: boolean) => void;
  onHold: (next: {value?: unknown; secret_reference?: {ref: string} | null}) => void;
  onDiscard: () => void;
  onPlan: (request: ChangeRequest) => void;
}) {
  const {setting, owner} = entry;
  const [copied, setCopied] = useState(false);
  const secret = setting.value_schema.type === "secret";
  const status = resolution?.reconciliation.status ?? "unknown";
  const desired = resolution?.desired ?? null;
  const nativeAxisValue = resolution?.native.effective?.value ?? resolution?.native.declared?.value;
  const controlValue = secret ? undefined : desired?.value !== undefined ? desired.value : nativeAxisValue;
  const secretReference = desired?.secret_reference ?? (typeof nativeAxisValue === "string" ? {ref: nativeAxisValue} : null);
  const canPlan = setting.writable && setting.operations.plan && setting.operations.apply && ownerOperable
    && owner.document?.operations.plan.availability === "disclosed";
  // The product-side axes show whenever the row is not quietly in sync —
  // that is exactly when the two sides of the story matter.
  const axesNeedShowing = resolution && status !== "satisfied"
    && (["declared", "effective", "active"] as const).some((name) => resolution.native[name]?.value !== undefined);
  // Effects worth a line: anything the person has to act on. Instant value
  // changes stay quiet — that is what a setting is expected to do.
  const effectWorthShowing = !["value-change", "none"].includes(setting.effect.kind);

  const requestFor = (): ChangeRequest | null => {
    if (!desired) return null;
    return {
      setting_ref: setting.setting_ref,
      scope: resolution?.scope ?? chosenScope(setting, {}, undefined),
      value: secret ? undefined : desired.value,
      secret_reference: secret ? desired.secret_reference ?? null : null,
    };
  };

  return <div className={`settings-row is-${status}`} data-setting-ref={setting.setting_ref} data-reconciliation={status}>
    <div className="settings-row-main">
      <div className="settings-row-title">
        <strong>{setting.title}</strong>
        {status !== "satisfied" && resolution
          && <span className={`settings-status is-${status}`} data-settings-status={status}
              title={resolution.reconciliation.reason ?? reconciliationMeaning(status)}>{reconciliationWord(status)}</span>}
        {setting.sensitive && !secret && <span className="settings-tag" title="This setting is treated as private">Private</span>}
        {!setting.writable && <span className="settings-tag" title="This setting cannot be changed here">View only</span>}
        <button type="button" className="settings-copy" title={`Copy the setting id: ${setting.setting_ref}`}
          aria-label={`Copy setting id for ${setting.title}`}
          onClick={() => {void navigator.clipboard?.writeText(setting.setting_ref); setCopied(true);}}>
          {copied ? "Copied" : "Copy id"}
        </button>
      </div>
      {setting.description && <p className="settings-row-desc">{setting.description}</p>}
      <div className="settings-row-body">
        {setting.allowed_scopes.length > 1 && <ScopePicker
          setting={setting}
          choice={scopeChoice ?? {scope_kind: firstScope(setting), scope_ref: ""}}
          onChange={onScopeChoice}/>}
        {setting.writable
          ? <SettingControl
              schema={setting.value_schema}
              value={controlValue}
              secretReference={secretReference}
              secretPresence={secret && nativeAxisValue !== undefined}
              disabled={!ownerOperable || drawerOpen}
              hint={null}
              onCommit={onHold}/>
          : null}
        {desired && (secret ? !desired.secret_reference : desired.value === undefined) && <span className="settings-note">Finish this change below before applying.</span>}
      </div>
      {(desired || axesNeedShowing || effectWorthShowing) && <div className="settings-row-facts">
        {desired && <span className="settings-fact is-desired">
          <span className="settings-fact-name">Asked for here</span>
          <span>{secret ? `${desired.secret_reference?.ref ?? "—"} (reference)` : formatValue(desired.value)}</span>
        </span>}
        {axesNeedShowing && resolution && <NativeAxesDisplay resolution={resolution} secret={secret}/>}
        {effectWorthShowing && <span className="settings-fact is-effect">
          <span className="settings-fact-name">Applying will</span>
          <span>{effectWord(setting.effect.kind)}{setting.effect.summary ? ` — ${setting.effect.summary}` : ""}</span>
        </span>}
      </div>}
      {resolution?.reconciliation.reason && status === "drifted" && <p className="settings-note settings-reason">{resolution.reconciliation.reason}</p>}
    </div>
    {(desired || canPlan) && <div className="settings-row-actions">
      {desired && <button type="button" className="settings-mini" data-config-discard disabled={drawerOpen} onClick={onDiscard}>Undo</button>}
      {desired && canPlan
        && <button type="button" className="settings-mini" data-config-plan
            disabled={drawerOpen || (secret ? !desired.secret_reference : desired.value === undefined)}
            title="Apply this change through the product's own operation"
            onClick={() => {const request = requestFor(); if (request) onPlan(request);}}>Apply…</button>}
    </div>}
  </div>;
}

function firstScope(setting: SettingSpec): ScopeAddress["scope_kind"] {
  return setting.allowed_scopes[0]?.scope_kind ?? "world";
}

/** The scope picker, only for settings that genuinely have a choice of
 * where they apply. Human words; the raw kind stays in the value. */
function ScopePicker({setting, choice, onChange}: {setting: SettingSpec; choice: ScopeChoice; onChange: (next: ScopeChoice, commit: boolean) => void}) {
  const singular = SINGULAR_SCOPE_KINDS.has(choice.scope_kind);
  const hint = setting.allowed_scopes.find((allowed) => allowed.scope_kind === choice.scope_kind);
  return <span className="settings-scopepicker">
    <select
      className="settings-select"
      aria-label={`Where "${setting.title}" applies`}
      value={choice.scope_kind}
      onChange={(event) => onChange({scope_kind: event.target.value as ScopeChoice["scope_kind"], scope_ref: ""}, true)}
    >
      {setting.allowed_scopes.map((allowed) => <option key={allowed.scope_kind} value={allowed.scope_kind}>{scopeWord(allowed.scope_kind)}</option>)}
    </select>
    {!singular && <input
      className="settings-select"
      type="text"
      aria-label={`Which ${scopeWord(choice.scope_kind).toLowerCase()} "${setting.title}" applies to`}
      placeholder={hint?.scope_ref ?? "name"}
      value={choice.scope_ref}
      onChange={(event) => onChange({...choice, scope_ref: event.target.value}, false)}
      onBlur={() => onChange(choice, true)}
      onKeyDown={(event) => {if (event.key === "Enter") onChange(choice, true);}}
    />}
  </span>;
}

/** The suite's installed products and versions, from the kernel census —
 * shown on the Ground & suite panel. */
function SuitePins({census}: {census?: CompositionReading}) {
  if (!census) return <p className="settings-note">The installed suite hasn't been read yet.</p>;
  return <div className="settings-suited">
    <h3>Installed products</h3>
    <table className="settings-pins" data-suite-pins>
      <thead><tr><th>Product</th><th>State</th><th>Version</th></tr></thead>
      <tbody>
        {census.positions.map((position) => <tr key={position.product_id}>
          <td>{productName(position.product_id)}</td>
          <td><span className={`settings-tag is-${position.availability}`}>{availabilityWord(position.native_state)}</span></td>
          <td>{typeof position.current_world.version === "string" ? position.current_world.version : "—"}</td>
        </tr>)}
      </tbody>
    </table>
  </div>;
}

/** The dev-only fixture console (walk builds): simulates the re-read laws.
 * Reached only through the build-gated seam in sourceHost — never a
 * production chunk. */
function FixtureConsole({onMutate}: {onMutate: () => void}) {
  const [externallyEdited, setExternallyEdited] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [workcellOut, setWorkcellOut] = useState(false);
  const mutate = async (action: (world: import("../../../configuration/sourceHost").FixtureWorldActions) => Promise<void> | void) => {
    const world = await fixtureWorld();
    if (!world) return;
    await action(world);
    onMutate();
  };
  return <details className="settings-fixture-console" data-config-fixture-console>
    <summary>Fixture world console (development)</summary>
    <p className="settings-note">Simulates the re-read laws against the fixture world. Nothing here exists in a production build.</p>
    <button type="button" className="settings-mini" disabled={externallyEdited}
      onClick={() => void mutate(async (world) => {await world.simulateExternalNativeEdit("ai-kit:resolution:model.default", "opus"); setExternallyEdited(true);})}
    >Simulate external native edit: ai-kit:resolution:model.default → opus</button>
    <button type="button" className="settings-mini" data-config-registry-mode
      onClick={() => void mutate((world) => {world.setRegistryMode(empty ? "full" : "empty"); setEmpty(!empty);})}
    >{empty ? "Restore the full registry" : "Empty the registry (bootstrap world)"}</button>
    <button type="button" className="settings-mini" data-config-workcell-outage
      onClick={() => void mutate((world) => {world.setOwnerAvailability("workcell", workcellOut ? "available" : "unavailable"); setWorkcellOut(!workcellOut);})}
    >{workcellOut ? "Restore Workcell (simulated outage over)" : "Simulate Workcell going unavailable"}</button>
    <button type="button" className="settings-mini" data-config-l6-section
      onClick={() => void mutate((world) => {world.addFixtureSection("oi");})}
    >Ship a new section in a fixture descriptor (L6 proof — fixture-backed)</button>
  </details>;
}

/** The one escape hatch: every raw contribution document, behind a single
 * explicit disclosure. Replaces the scattered JSON dumps. */
function DevView({mounts}: {mounts: ContributionMount[]}) {
  return <details className="settings-dev">
    <summary>Developer view — the raw documents behind these settings</summary>
    {mounts.map((mount) => <details key={mount.owner_ref} className="settings-dev-doc">
      <summary>{productName(mount.owner_ref)}{mount.error ? ` — read failed: ${mount.error}` : ""}</summary>
      <pre>{JSON.stringify(mount.document ?? {availability: mount.availability, error: mount.error}, null, 2)}</pre>
    </details>)}
  </details>;
}
