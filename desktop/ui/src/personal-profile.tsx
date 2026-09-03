import { invoke } from '@tauri-apps/api/core';
import { useCallback, useEffect, useMemo, useState } from 'react';
import './personal-profile.css';

type AgentProfileSource = {
  schema?: string;
  ref?: string;
  revision?: string;
  agent_ref?: string;
  scope?: string;
  world_ref?: string;
  role?: string | null;
  purpose?: string | null;
  skill_refs?: string[];
  skill_set_refs?: string[];
  method_refs?: string[];
  ratified_world_refs?: string[];
  knowledge_source_refs?: string[];
  computer_access_intent_refs?: string[];
  placement_intent_refs?: string[];
  operative_requirement_refs?: string[];
  material_requirement_refs?: string[];
  provenance_refs?: string[];
  [key: string]: unknown;
};

type AgentProfileReading = {
  profile: AgentProfileSource;
  source_path: string;
};

type AgentProfileList = {
  scope: 'personal' | 'project';
  profiles: AgentProfileReading[];
  source_payloads_disclosed: false;
};

type ProfileSelection = {
  scope: 'personal' | 'project';
  profileRef: string;
};

type Props = {
  aikitContext: unknown;
};

const NEW_PROFILE_TEMPLATE: AgentProfileSource = {
  schema: 'central.agent-profile/v1',
  ref: 'agent-profile:',
  revision: 'p1',
  agent_ref: 'agent:',
  scope: 'personal',
  world_ref: 'world:personal',
  ratified_world_refs: ['world:personal'],
};

export function PersonalProfileSurface({ aikitContext }: Props) {
  const [personal, setPersonal] = useState<AgentProfileList | null>(null);
  const [project, setProject] = useState<AgentProfileList | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AgentProfileReading | null>(null);
  const [selection, setSelection] = useState<ProfileSelection | null>(null);
  const [draft, setDraft] = useState(() => JSON.stringify(NEW_PROFILE_TEMPLATE, null, 2));
  const [operation, setOperation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    const personalReading = await invoke<AgentProfileList>('agent_profile_list', {
      scope: 'personal',
      project: null,
    });
    setPersonal(personalReading);

    try {
      const projectReading = await invoke<AgentProfileList>('agent_profile_list', {
        scope: 'project',
        project: null,
      });
      setProject(projectReading);
      setProjectError(null);
    } catch (reason) {
      setProject(null);
      setProjectError(String(reason));
    }
  }, []);

  useEffect(() => {
    refresh().catch((reason) => setError(String(reason)));
  }, [refresh]);

  async function readProfile(next: ProfileSelection) {
    setError(null);
    const reading = await invoke<AgentProfileReading>('agent_profile_read', {
      scope: next.scope,
      project: null,
      profileRef: next.profileRef,
    });
    setSelection(next);
    setSelected(reading);
    setDraft(JSON.stringify(reading.profile, null, 2));
    setOperation(null);
  }

  function newProfile() {
    setSelection(null);
    setSelected(null);
    setDraft(JSON.stringify(NEW_PROFILE_TEMPLATE, null, 2));
    setOperation('New authored source. Central will validate the canonical document on save.');
    setError(null);
  }

  async function saveProfile() {
    setError(null);
    let profile: AgentProfileSource;
    try {
      profile = JSON.parse(draft) as AgentProfileSource;
    } catch (reason) {
      setError(`Source JSON is invalid: ${String(reason)}`);
      return;
    }

    const scope = profile.scope === 'project' ? 'project' : 'personal';
    const receipt = await invoke<unknown>('agent_profile_save', {
      scope,
      project: null,
      profile,
      expectedRevision: selected?.profile.revision ?? null,
    });
    setOperation(`Central save return: ${JSON.stringify(receipt)}`);
    await refresh();
    if (typeof profile.ref === 'string' && profile.ref.length > 0) {
      await readProfile({ scope, profileRef: profile.ref });
    }
  }

  async function removeProfile() {
    if (!selected?.profile.ref || !selected.profile.revision || !selection) return;
    setError(null);
    const receipt = await invoke<unknown>('agent_profile_remove', {
      scope: selection.scope,
      project: null,
      profileRef: selected.profile.ref,
      expectedRevision: selected.profile.revision,
    });
    setOperation(`Central remove return: ${JSON.stringify(receipt)}`);
    setSelected(null);
    setSelection(null);
    setDraft(JSON.stringify(NEW_PROFILE_TEMPLATE, null, 2));
    await refresh();
  }

  const praxis = useMemo<Array<[string, string[]]>>(() => {
    if (!selected) return [];
    return [
      ['Skills', selected.profile.skill_refs ?? []],
      ['SkillSets', selected.profile.skill_set_refs ?? []],
      ['Methods', selected.profile.method_refs ?? []],
    ];
  }, [selected]);

  return (
    <section className="oi-profile" aria-label="Personal Agent Profile application">
      <header className="oi-profile__header">
        <div>
          <p className="oi-eyebrow">Personal · authored / effective</p>
          <h1>Agent Profiles</h1>
          <p className="oi-lead">
            Central owns the durable source relation. AIKit separately owns the effective operative resolution.
          </p>
        </div>
        <div className="oi-profile__actions">
          <button type="button" onClick={() => void refresh().catch((reason) => setError(String(reason)))}>Refresh</button>
          <button type="button" onClick={newProfile}>New source</button>
        </div>
      </header>

      {error && <p className="oi-profile__error">{error}</p>}
      {operation && <p className="oi-profile__return">{operation}</p>}

      <div className="oi-profile__composition">
        <section className="oi-profile__source" aria-label="Central authored AgentProfile source">
          <p className="oi-eyebrow">Authored source · Central</p>
          <div className="oi-profile__lists">
            <ProfileList
              title="Personal"
              reading={personal}
              selected={selection}
              onRead={readProfile}
            />
            <ProfileList
              title="Project"
              reading={project}
              selected={selection}
              onRead={readProfile}
              unavailable={projectError}
            />
          </div>

          {selected ? (
            <article className="oi-profile__reading">
              <div className="oi-profile__identity">
                <div>
                  <span className="oi-contribution-state" data-state="ready">authored</span>
                  <h2>{selected.profile.role || selected.profile.ref || 'Agent profile'}</h2>
                  <p>{selected.profile.purpose || 'No authored purpose supplied.'}</p>
                </div>
                <small>{selected.source_path}</small>
              </div>
              <dl>
                <dt>AgentProfileRef</dt><dd>{selected.profile.ref ?? 'missing'}</dd>
                <dt>AgentRef</dt><dd>{selected.profile.agent_ref ?? 'missing'}</dd>
                <dt>Revision</dt><dd>{selected.profile.revision ?? 'missing'}</dd>
                <dt>Scope</dt><dd>{selected.profile.scope ?? 'missing'}</dd>
                <dt>World</dt><dd>{selected.profile.world_ref ?? 'missing'}</dd>
              </dl>
              {praxis.map(([label, refs]) => (
                <div className="oi-profile__refs" key={label}>
                  <strong>{label}</strong>
                  {refs.length ? refs.map((ref) => <code key={ref}>{ref}</code>) : <span className="oi-muted">None assigned</span>}
                </div>
              ))}
            </article>
          ) : (
            <p className="oi-muted">Select a saved source relation or create a new one. AgentProfileRef remains distinct from AgentRef.</p>
          )}

          <label className="oi-profile__editor">
            <span>Canonical Central source document</span>
            <textarea value={draft} onChange={(event) => setDraft(event.currentTarget.value)} spellCheck={false} />
          </label>
          <div className="oi-profile__actions">
            <button type="button" onClick={() => void saveProfile().catch((reason) => setError(String(reason)))}>Save through Central</button>
            <button type="button" disabled={!selected} onClick={() => void removeProfile().catch((reason) => setError(String(reason)))}>Remove source relation</button>
          </div>
          <small className="oi-muted">Save/remove use Central compare-and-swap revisions. Removing this source never means deleting Agent identity or runtime state.</small>
        </section>

        <section className="oi-profile__effective" aria-label="AIKit effective operative state">
          <p className="oi-eyebrow">Effective operative state · AIKit</p>
          <h2>Context Resolution</h2>
          {aikitContext == null ? (
            <p className="oi-muted">No native AIKit ContextResolution is supplied. O:I does not fabricate effective state from the Central profile.</p>
          ) : (
            <>
              <p className="oi-muted">This is the current AIKit-owned resolution supplied to the desktop. It is not written back into AgentProfile source.</p>
              <pre className="oi-profile__effective-json">{JSON.stringify(aikitContext, null, 2)}</pre>
            </>
          )}
          <div className="oi-profile__laws">
            <code>authored AgentProfile ≠ effective ContextResolution</code>
            <code>assigned praxis ≠ effective execution</code>
            <code>source access intent ≠ disclosed Context</code>
            <code>source configuration ≠ active material body</code>
          </div>
        </section>
      </div>
    </section>
  );
}

function ProfileList({
  title,
  reading,
  selected,
  onRead,
  unavailable,
}: {
  title: string;
  reading: AgentProfileList | null;
  selected: ProfileSelection | null;
  onRead: (selection: ProfileSelection) => Promise<void>;
  unavailable?: string | null;
}) {
  return (
    <section>
      <div className="oi-profile__list-heading">
        <strong>{title}</strong>
        <small>{reading ? `${reading.profiles.length} saved` : 'not loaded'}</small>
      </div>
      {unavailable ? (
        <p className="oi-muted">Project source unavailable: {unavailable}</p>
      ) : reading?.profiles.length ? (
        reading.profiles.map(({ profile, source_path }) => {
          const profileRef = profile.ref ?? source_path;
          const scope = reading.scope;
          const active = selected?.scope === scope && selected.profileRef === profileRef;
          return (
            <button
              className="oi-profile__list-item"
              data-active={active || undefined}
              type="button"
              key={`${scope}:${profileRef}`}
              onClick={() => void onRead({ scope, profileRef })}
            >
              <span>{profile.role || profileRef}</span>
              <small>{profile.agent_ref ?? 'AgentRef unavailable'} · {profile.revision ?? 'revision unavailable'}</small>
            </button>
          );
        })
      ) : (
        <p className="oi-muted">No saved {title.toLowerCase()} AgentProfiles.</p>
      )}
    </section>
  );
}
