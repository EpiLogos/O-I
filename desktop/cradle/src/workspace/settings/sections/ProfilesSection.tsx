/**
 * Profiles (12-SETTINGS §3.6): named sparse overlays (`oi.profile/v1`).
 * New profile saves what you have set here; Use profile STAGES its changes
 * into the ordinary review (nothing applies on its own); Import only stores.
 */
import {useRef, useState} from "react";
import type {ProfileDocument} from "../../../configuration/contracts";
import {briefValue} from "../sectionModel";
import {loadProfiles, loadResolutions, plain, plane, refreshAll, type SettingsSnapshot} from "../settingsData";
import {scopeLabel} from "../changeModel";
import {Reading, Unreadable} from "../rows";

function slug(text: string): string {
  return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
}

export function ProfilesSection({data}: {data: SettingsSnapshot}) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [note, setNote] = useState<{text: string; ok: boolean} | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  if (data.profiles.state === "reading") return <Reading/>;
  if (data.profiles.state === "failed") return <Unreadable error={data.profiles.error} onRetry={() => void refreshAll()}/>;
  const {profiles, active} = data.profiles.value;
  const held = Object.values(data.resolutions).filter((resolution) => resolution.desired);
  const run = async (work: () => Promise<string>) => {
    setBusy(true); setNote(null);
    try { setNote({text: await work(), ok: true}); } catch (cause) { setNote({text: plain(cause), ok: false}); } finally { setBusy(false); }
  };
  const create = () => run(async () => {
    const title = name.trim();
    const ref = slug(title);
    if (!ref) throw new Error("Give the profile a name.");
    const source = await plane();
    const profile = await source.createProfile(ref, title);
    const desired = held.map((resolution) => ({setting_ref: resolution.setting_ref, scope: resolution.scope, value: resolution.desired?.value, secret_reference: resolution.desired?.secret_reference ?? null}));
    if (desired.length) await source.saveProfile({...profile, desired} as ProfileDocument);
    setNaming(false); setName("");
    await loadProfiles();
    return `Saved “${title}” with ${desired.length} ${desired.length === 1 ? "setting" : "settings"}.`;
  });
  const use = (profile: ProfileDocument) => run(async () => {
    const source = await plane();
    const plan = await source.profileUsePlan(profile.profile_ref);
    let staged = 0;
    for (const entry of plan.entries) {
      if (!entry.target) continue;
      await source.holdDesired({setting_ref: entry.setting_ref, scope: entry.scope, value: entry.target.value, secret_reference: entry.target.secret_reference ?? null});
      staged++;
    }
    await loadResolutions();
    return staged === 0 ? `“${profile.title ?? profile.profile_ref}” changes nothing here.` : `Staged ${staged} ${staged === 1 ? "change" : "changes"} from “${profile.title ?? profile.profile_ref}”. Review them below; nothing is applied yet.`;
  });
  const importFile = (picked: File) => run(async () => {
    const document = JSON.parse(await picked.text()) as Partial<ProfileDocument>;
    if (document.schema !== "oi.profile/v1" || typeof document.profile_ref !== "string") throw new Error("That file isn't an O:I profile.");
    const source = await plane();
    const created = await source.createProfile(document.profile_ref, document.title ?? undefined);
    await source.saveProfile({...created, title: document.title ?? created.title, description: document.description ?? created.description, desired: document.desired ?? []} as ProfileDocument);
    await loadProfiles();
    return `Imported “${document.title ?? document.profile_ref}”. Nothing was applied; use it to review its changes.`;
  });
  return <div className="settings-profiles" data-profiles-panel>
    {profiles.length === 0 ? <p data-profiles-empty>No profiles yet.</p> : <div className="settings-profile-list">
      {profiles.map((profile) => <div className="settings-line" key={profile.profile_ref} data-profile-ref={profile.profile_ref}>
        <div className="settings-line-text">
          <div className="settings-line-title">{profile.title ?? profile.profile_ref}{active === profile.profile_ref && <span className="settings-chip">in use</span>}</div>
          <div className="settings-line-desc">{profile.desired.length === 0 ? "No settings in it" : profile.desired.slice(0, 3).map((entry) => `${entry.setting_ref.split(":").pop()} → ${briefValue(entry.value)} (${scopeLabel(entry.scope)})`).join(" · ")}{profile.desired.length > 3 ? ` · ${profile.desired.length - 3} more` : ""}</div>
        </div>
        <div className="settings-line-value"><button type="button" className="settings-button" disabled={busy} onClick={() => void use(profile)}>Use profile</button></div>
      </div>)}
    </div>}
    <p className="settings-muted settings-prose">A profile is a named set of settings you can switch to, like “demo” or “offline”. Using one stages its changes for review; nothing applies on its own.</p>
    {naming
      ? <form className="settings-keyentry-row" onSubmit={(event) => { event.preventDefault(); void create(); }}>
          <input className="settings-input" aria-label="Profile name" placeholder="Profile name" autoFocus value={name} onChange={(event) => setName(event.target.value)}/>
          <button type="submit" className="settings-button is-primary" disabled={busy}>Save profile</button>
          <button type="button" className="settings-button" onClick={() => setNaming(false)}>Cancel</button>
        </form>
      : <div className="settings-card-actions">
          <button type="button" className="settings-button is-primary" data-profile-new onClick={() => setNaming(true)}>New profile from current settings</button>
          <button type="button" className="settings-button" onClick={() => file.current?.click()}>Import…</button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(event) => { const picked = event.target.files?.[0]; event.target.value = ""; if (picked) void importFile(picked); }}/>
        </div>}
    {note && <p className={note.ok ? "settings-card-note" : "settings-inline-error"} role={note.ok ? "status" : "alert"}>{note.text}</p>}
  </div>;
}
