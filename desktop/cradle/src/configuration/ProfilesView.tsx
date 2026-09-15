/**
 * The Profiles view (#299 §11, docs/cradle/09-CONFIGURATION-PLANE.md §12,
 * §13): O:I World profiles as the sparse desired compositions they are.
 *
 *  - the list marks the active profile;
 *  - a profile shows its sparse desired entries and its native product
 *    profiles AS REFERENCES (never expanded — O:I never mirrors native
 *    profile internals);
 *  - sparse overrides are editable per the setting's allowed scopes, with
 *    secret entries as presence/reference only (§14);
 *  - switching shows the inspectable use plan BEFORE anything moves, and
 *    the resulting ChangeSet after;
 *  - entries for settings no owner currently contributes render
 *    `unsupported` — honest, not dropped (§15).
 */
import {useEffect,useState} from "react";
import type {
  ProfileDocument,
  ProfileDesiredEntry,
  ScopeAddress,
  SettingSpec,
} from "./contracts";
import {compactScope} from "./contracts";
import type {ConfigPlaneSource, ProfileUsePlan} from "./source";
import {configPlaneSource} from "./sourceHost";
import {Loading} from "../shared/Loading";
import {SettingControl} from "./SettingControl";
import {ChangeSetView} from "./PlanDrawer";
import type {ChangeSetDocument} from "./contracts";
import {formatValue} from "./viewUtils";

export function ProfilesView() {
  const [source, setSource] = useState<ConfigPlaneSource | null>(null);
  const [profiles, setProfiles] = useState<ProfileDocument[] | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [settingsIndex, setSettingsIndex] = useState<Record<string, SettingSpec>>({});
  const [usePlan, setUsePlan] = useState<ProfileUsePlan | null>(null);
  const [useResult, setUseResult] = useState<ChangeSetDocument | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = async (planeSource: ConfigPlaneSource, keepSelection?: string | null) => {
    try {
      const listing = await planeSource.listProfiles();
      setProfiles(listing.profiles);
      setActive(listing.active_profile_ref);
      setSelected((current) => keepSelection ?? current ?? listing.active_profile_ref ?? listing.profiles[0]?.profile_ref ?? null);
    } catch (cause) {
      setError(String(cause));
    }
  };

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const planeSource = await configPlaneSource();
        if (!live) return;
        setSource(planeSource);
        if (planeSource.kind === "unbound") return;
        const registry = await planeSource.readRegistry();
        const index: Record<string, SettingSpec> = {};
        for (const mount of registry.mounts) {
          for (const section of mount.document?.sections ?? []) {
            for (const setting of section.settings) index[setting.setting_ref] = setting;
          }
        }
        setSettingsIndex(index);
        await reload(planeSource);
      } catch (cause) {
        if (live) setError(String(cause));
      }
    })();
    return () => {live = false;};
  }, []);

  if (error) return <p role="alert">{error}</p>;
  if (!source || profiles == null) return <Loading label="Reading profiles…"/>;
  if (source.kind === "unbound") {
    return <p className="config-empty" data-profiles-unbound>The profile store is not bound in this build: {source.label}. The live binding lands with the configuration-plane convergence; until then this surface renders its absence honestly.</p>;
  }
  const current = profiles.find((profile) => profile.profile_ref === selected) ?? null;
  return <div className="config-view profiles-view">
    <div className="profiles-layout">
      <nav className="profiles-list" aria-label="World profiles">
        {profiles.map((profile) => (
          <button key={profile.profile_ref} type="button"
            data-profile-ref={profile.profile_ref}
            aria-pressed={selected === profile.profile_ref}
            onClick={() => {setSelected(profile.profile_ref); setUsePlan(null); setUseResult(null);}}
          >
            <strong>{profile.title ?? profile.profile_ref}</strong>
            {active === profile.profile_ref && <span className="config-chip is-active">active</span>}
          </button>
        ))}
        <NewProfile source={source} onCreated={(profile_ref) => void reload(source, profile_ref)}/>
      </nav>
      {current && <ProfileDetail
        key={current.profile_ref}
        source={source}
        profile={current}
        isActive={active === current.profile_ref}
        settingsIndex={settingsIndex}
        onChanged={() => void reload(source, current.profile_ref)}
        onUse={async () => {
          setUseResult(null);
          setUsePlan(await source.profileUsePlan(current.profile_ref));
        }}
      />}
      {!current && <p className="config-empty">No profile is selected.</p>}
    </div>
    {usePlan && <div className="config-drawer" role="dialog" aria-label="Profile use plan" data-profile-use-plan>
      <header>
        <h4>Use profile “{usePlan.profile_ref}” — inspectable plan</h4>
        <button type="button" className="config-mini" onClick={() => setUsePlan(null)}>close</button>
      </header>
      <p className="config-muted">Nothing has moved yet. This is what using the profile would hold as desired state, and the native profiles it would point the owners at, by reference.</p>
      <table className="config-table">
        <thead><tr><th>Setting</th><th>Scope</th><th>Now</th><th>Would hold</th></tr></thead>
        <tbody>
          {usePlan.entries.map((entry) => (
            <tr key={`${entry.setting_ref}|${compactScope(entry.scope)}`} data-use-entry={entry.setting_ref} data-supported={entry.setting ? "true" : "false"}>
              <td className="config-mono config-ref">{entry.setting_ref}{!entry.setting && <span className="config-chip is-unsupported">unsupported</span>}</td>
              <td className="config-mono">{compactScope(entry.scope)}</td>
              <td className="config-mono">{entry.current ? (entry.current.secret_reference ? `${entry.current.secret_reference.ref} (reference)` : formatValue(entry.current.value)) : "—"}</td>
              <td className="config-mono">{entry.target ? (entry.target.secret_reference ? `${entry.target.secret_reference.ref} (reference)` : formatValue(entry.target.value)) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {usePlan.native_profiles.length > 0 && <div className="config-native-profiles">
        <strong>Native profiles, by reference</strong>
        <ul>
          {usePlan.native_profiles.map((native) => (
            <li key={`${native.owner_ref}:${native.native_profile_ref}`} className="config-mono">{native.owner_ref} → {native.native_profile_ref} <span className="config-muted">(the owner resolves it; never expanded here)</span></li>
          ))}
        </ul>
      </div>}
      <div className="config-drawer-actions">
        <button type="button" data-profile-use-apply onClick={async () => {
          try {
            const result = await source.applyProfileUse(usePlan.profile_ref);
            if (result) setUseResult(result);
            setUsePlan(null);
            await reload(source, usePlan.profile_ref);
          } catch (cause) {
            setError(String(cause));
          }
        }}>Make active</button>
        <span className="config-muted">the owners receive native-profile references; sparse overrides ride the resolution order</span>
      </div>
    </div>}
    {useResult && <div className="config-drawer" role="dialog" aria-label="Profile use result">
      <header>
        <h4>Profile switch result</h4>
        <button type="button" className="config-mini" onClick={() => setUseResult(null)}>close</button>
      </header>
      <ChangeSetView changeset={useResult} receipts={[]}/>
    </div>}
  </div>;
}

function ProfileDetail({source, profile, isActive, settingsIndex, onChanged, onUse}: {
  source: ConfigPlaneSource;
  profile: ProfileDocument;
  isActive: boolean;
  settingsIndex: Record<string, SettingSpec>;
  onChanged: () => void;
  onUse: () => void | Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const save = async (next: ProfileDocument) => {
    try {
      await source.saveProfile(next);
      onChanged();
    } catch (cause) {
      setError(String(cause));
    }
  };
  return <div className="profile-detail" data-profile-detail={profile.profile_ref}>
    <header className="profile-detail-head">
      <div>
        <h4>{profile.title ?? profile.profile_ref} <span className="config-mono config-ref">{profile.profile_ref}</span></h4>
        {profile.description && <p className="config-muted">{profile.description}</p>}
        <p className="config-muted">Sparse intent — absent entries mean “no O:I intent”, never a value. {profile.provenance?.authored_by ? `Authored by ${profile.provenance.authored_by}.` : ""}</p>
      </div>
      <div className="profile-detail-actions">
        <button type="button" data-profile-use disabled={isActive} onClick={() => void onUse()}>{isActive ? "Active" : "Use…"}</button>
      </div>
    </header>
    {error && <p role="alert" className="config-error">{error}</p>}
    {profile.native_profiles.length > 0 && <div className="config-native-profiles">
      <strong>Native profiles</strong>
      <ul>{profile.native_profiles.map((native) => (
        <li key={`${native.owner_ref}:${native.native_profile_ref}`} className="config-mono">{native.owner_ref} → {native.native_profile_ref}</li>
      ))}</ul>
    </div>}
    <div className="profile-entries">
      <strong>Desired entries</strong>
      {profile.desired.length === 0 && <p className="config-empty">No overrides — this profile only points at native profiles.</p>}
      <table className="config-table">
        <thead><tr><th>Setting</th><th>Scope</th><th>Value</th><th/></tr></thead>
        <tbody>
          {profile.desired.map((entry) => {
            const setting = settingsIndex[entry.setting_ref];
            return <ProfileEntryRow
              key={`${entry.setting_ref}|${compactScope(entry.scope)}`}
              entry={entry}
              setting={setting ?? null}
              onRemove={() => void save({...profile, desired: profile.desired.filter((candidate) => candidate !== entry)})}
            />;
          })}
        </tbody>
      </table>
      <AddEntry source={source} onAdd={(entry) => void save({...profile, desired: [...profile.desired, entry]})}/>
    </div>
  </div>;
}

function ProfileEntryRow({entry, setting, onRemove}: {entry: ProfileDesiredEntry; setting: SettingSpec | null; onRemove: () => void}) {
  return <tr data-profile-entry={entry.setting_ref} data-supported={setting ? "true" : "false"}>
    <td className="config-mono config-ref">{entry.setting_ref}
      {!setting && <span className="config-chip is-unsupported" title="No mounted owner contributes this setting — the entry is held and rendered honestly (§15), never dropped.">unsupported</span>}
    </td>
    <td className="config-mono">{compactScope(entry.scope)}</td>
    <td className="config-mono">{entry.secret_reference ? `${entry.secret_reference.ref} (reference)` : formatValue(entry.value)}</td>
    <td><button type="button" className="config-mini" onClick={onRemove}>remove</button></td>
  </tr>;
}

/** Sparse overrides are editable per the setting's allowed scopes; a
 * secret-kind entry takes a reference, never a value (§12, §14). */
function AddEntry({source, onAdd}: {source: ConfigPlaneSource; onAdd: (entry: ProfileDesiredEntry) => void}) {
  const [picker, setPicker] = useState<SettingSpec | null>(null);
  const [scope, setScope] = useState<ScopeAddress>({scope_kind: "world", scope_ref: null});
  const [value, setValue] = useState<{value?: unknown; secret_reference?: {ref: string} | null}>({});
  const [options, setOptions] = useState<SettingSpec[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || options.length > 0) return;
    void (async () => {
      try {
        const registry = await source.readRegistry();
        const found: SettingSpec[] = [];
        for (const mount of registry.mounts) {
          for (const section of mount.document?.sections ?? []) {
            for (const setting of section.settings) if (setting.profileable) found.push(setting);
          }
        }
        setOptions(found);
      } catch {
        setOptions([]);
      }
    })();
  }, [open, options.length, source]);

  if (!open) return <button type="button" className="config-mini" data-profile-add-entry onClick={() => setOpen(true)}>Add desired entry…</button>;
  const committed = picker ? (picker.value_schema.type === "secret" ? value.secret_reference?.ref : value.value !== undefined) : false;
  return <div className="config-add-entry">
    <select className="config-input" aria-label="Setting" value={picker?.setting_ref ?? ""} onChange={(event) => {
      const setting = options.find((candidate) => candidate.setting_ref === event.target.value) ?? null;
      setPicker(setting);
      setValue({});
      if (setting) {
        const allowed = setting.allowed_scopes[0];
        setScope({scope_kind: allowed?.scope_kind ?? "world", scope_ref: allowed && allowed.scope_ref != null ? allowed.scope_ref : null});
      }
    }}>
      <option value="">— pick a profileable setting —</option>
      {options.map((setting) => <option key={setting.setting_ref} value={setting.setting_ref}>{setting.title} ({setting.setting_ref})</option>)}
    </select>
    {picker && <>
      <select className="config-input" aria-label="Scope kind" value={scope.scope_kind} onChange={(event) => {
        const allowed = picker.allowed_scopes.find((candidate) => candidate.scope_kind === event.target.value);
        setScope({scope_kind: event.target.value as ScopeAddress["scope_kind"], scope_ref: allowed?.scope_ref ?? null});
      }}>
        {picker.allowed_scopes.map((allowed) => <option key={allowed.scope_kind} value={allowed.scope_kind}>{allowed.scope_kind}</option>)}
      </select>
      {scope.scope_kind !== "world" && scope.scope_kind !== "ground" && scope.scope_kind !== "machine" && (
        <input className="config-input" type="text" aria-label="Scope reference" placeholder="scope reference"
          value={scope.scope_ref ?? ""} onChange={(event) => setScope({...scope, scope_ref: event.target.value})}/>
      )}
      <SettingControl
        schema={picker.value_schema}
        value={picker.value_schema.type === "secret" ? undefined : value.value}
        secretReference={value.secret_reference ?? null}
        secretPresence={false}
        onCommit={(next) => setValue(next)}
      />
      <button type="button" className="config-mini" disabled={!committed}
        onClick={() => {
          if (!picker || !committed) return;
          onAdd({
            setting_ref: picker.setting_ref,
            scope,
            value: picker.value_schema.type === "secret" ? undefined : value.value,
            secret_reference: picker.value_schema.type === "secret" ? value.secret_reference ?? null : null,
          });
          setOpen(false);
          setPicker(null);
          setValue({});
        }}
      >Hold in profile</button>
      <button type="button" className="config-mini" onClick={() => {setOpen(false); setPicker(null);}}>cancel</button>
    </>}
  </div>;
}

function NewProfile({source, onCreated}: {source: ConfigPlaneSource; onCreated: (profile_ref: string) => void}) {
  const [open, setOpen] = useState(false);
  const [profileRef, setProfileRef] = useState("");
  const valid = /^[a-z0-9][a-z0-9-]*$/.test(profileRef);
  if (!open) return <button type="button" className="config-mini" onClick={() => setOpen(true)}>New profile…</button>;
  return <span className="config-new-profile">
    <input className="config-input" type="text" placeholder="profile ref (e.g. staging)" value={profileRef}
      onChange={(event) => setProfileRef(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && valid) {
          void source.createProfile(profileRef).then(() => {onCreated(profileRef); setOpen(false); setProfileRef("");});
        }
      }}
    />
    <button type="button" className="config-mini" disabled={!valid} onClick={() => {
      void source.createProfile(profileRef).then(() => {onCreated(profileRef); setOpen(false); setProfileRef("");});
    }}>create</button>
    <button type="button" className="config-mini" onClick={() => setOpen(false)}>cancel</button>
  </span>;
}
