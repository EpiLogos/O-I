/**
 * The rebuilt settings sections (HARNESS-SETTINGS-RESEARCH 2026-09-22 §2,
 * owner rulings 2/3/6 of the same day): the working controls of the suite,
 * normalised into this desktop's grammar — harness by name, model per
 * harness, credential state masked, skills as manageable settings.
 *
 * Every control rides an existing seam (docs/cradle/06 §2 L4): the held
 * default provider writes through the kernel's chat-default ops; every
 * other verb this surface cannot reach renders its honest obligation —
 * the real native path, named — never a fake button. Credential material
 * is never rendered: presence, state and provenance only.
 *
 * Data: `systemDisclosure.ts` — the kernel ops + the AIKit owner's own
 * `oi.product-settings-disclosure/v2` document. The census rides the
 * `CompositionReading` the page already read.
 */
import {useEffect,useState} from "react";
import type {CompositionReading} from "../types";
import type {
  CredentialRow,
  SecretStoreRow,
  SkillRow,
  SystemDisclosureSource,
  SystemDisclosureReading,
} from "../../../configuration/systemDisclosure";
import type {CatalogueEntry, HarnessRow, ProviderRow} from "../../../configuration/harnessSource";
import {effectiveChatDefault} from "../../../configuration/harnessSource";
import {formatRelativeTime} from "../../../shared/relativeTime";

/** A section-level source label (L2: the read names where it came from). */
function SourceNote({reading}:{reading:SystemDisclosureReading}) {
  return <p className="config-source-label" data-disclosure-source={reading.kind}>{reading.label}</p>;
}

function DisclosureAbsent({reason}:{reason:string}) {
  return <p className="config-empty" data-disclosure-absent>
    The AIKit settings disclosure is not available here: {reason} The harness and model facts below are read directly from the installed suite.
  </p>;
}

// ---------------------------------------------------------------------------
// 1 · Status

export function StatusPanel({reading,census}:{reading:SystemDisclosureReading;census?:CompositionReading}) {
  const facts = reading.disclosure.state === "ok" ? reading.disclosure.rows : null;
  const providers = reading.harness.providers.state === "ok" ? reading.harness.providers.rows : [];
  const held = reading.harness.heldDefault?.value ?? null;
  const effective = effectiveChatDefault(providers, held);
  return <div className="config-view" data-status-panel>
    <SourceNote reading={reading}/>
    <section className="config-section">
      <h4>Suite</h4>
      <dl className="settings-world-facts" data-status-suite>
        <div><dt>Suite</dt><dd>{census?.suite_executable ? census.suite_executable.split("/").pop() : "Not yet read"}</dd></div>
        <div><dt>Products</dt><dd>{census ? `${census.positions.filter(p=>p.availability==="discovered").length} of ${census.positions.length} discovered` : "Not yet read"}</dd></div>
        <div><dt>Read</dt><dd>{census && Number.isFinite(census.observed_at_unix_ms) ? formatRelativeTime(census.observed_at_unix_ms) : "not yet"}</dd></div>
        <div><dt>AIKit</dt><dd>{facts?.version ?? "not disclosed here"}</dd></div>
        {facts?.generation?.catalog_revision && <div><dt>Resolution</dt><dd title={`resolution ${facts.generation.resolution_hash ?? ""}`}>catalog {facts.generation.catalog_revision.slice(0,12)}…</dd></div>}
      </dl>
    </section>
    {reading.disclosure.state === "absent" && <DisclosureAbsent reason={reading.disclosure.reason}/>}
    <section className="config-section">
      <h4>Sign-in state by provider</h4>
      <p className="config-desc">Presence and state only — key material is never shown here, by the owner's own contract.</p>
      {facts && facts.requirements.length > 0
        ? <table className="config-table" data-auth-table>
            <thead><tr><th>Requirement</th><th>State</th><th>Where it is kept</th></tr></thead>
            <tbody>
              {facts.requirements.map((row) => {
                const bound = facts.credentials.find((credential) => credential.credential === row.credential_ref);
                return <tr key={row.requirement_ref} data-auth-row data-credential={row.credential_ref} data-auth-state={row.state}>
                  <td>{row.credential_ref}{row.purpose ? <span className="config-muted"> — {row.purpose}</span> : null}</td>
                  <td>{row.state === "resolved" ? "bound" : row.state}{bound?.revoked ? " · revoked" : ""}</td>
                  <td className="config-mono config-ref">{bound?.provenance ?? row.selected_provider_ref ?? "—"}</td>
                </tr>;
              })}
            </tbody>
          </table>
        : <p className="config-empty" data-auth-absent>{facts ? "No provider sign-in requirement is disclosed right now." : "The disclosure is not available in this world."}</p>}
    </section>
    <section className="config-section">
      <h4>Model for new chats</h4>
      <p data-status-model>{effective
        ? <>New conversations open with <strong>{effective.provider}</strong>{reading.harness.providers.state==="ok" ? ` — chosen by ${effective.rule === "owner-choice" ? "your choice below in Models" : effective.rule === "pi-row" ? "the suite's standing default" : "falling back to the first configured provider"}` : ""}.</>
        : "No provider is configured yet — connect one from a chat's composer."}</p>
    </section>
    <section className="config-section">
      <h4>Connectivity</h4>
      <p data-status-connectivity>{reading.harness.providers.state === "ok"
        ? `${providers.length} encounter provider${providers.length === 1 ? "" : "s"} configured.`
        : `The provider census could not be read: ${reading.harness.providers.error}`}</p>
    </section>
    <section className="config-section">
      <h4>Secret stores</h4>
      {facts && facts.secretStores.length > 0
        ? <table className="config-table" data-secret-stores>
            <thead><tr><th>Store</th><th>Scheme</th><th>Availability</th></tr></thead>
            <tbody>
              {facts.secretStores.map((store) => <SecretStoreRowView key={store.scheme} store={store}/>)}
            </tbody>
          </table>
        : <p className="config-empty">{facts ? "No secret store is disclosed right now." : "The disclosure is not available in this world."}</p>}
    </section>
  </div>;
}

function SecretStoreRowView({store}:{store:SecretStoreRow}) {
  return <tr data-secret-store data-scheme={store.scheme} data-availability={store.availability}>
    <td>{store.store}</td>
    <td className="config-mono config-ref">{store.scheme}</td>
    <td>{store.availability}</td>
  </tr>;
}

// ---------------------------------------------------------------------------
// 2 · Harnesses

/** The effect of installing, in the owner's words: the harness needs a
 * restart to pick AIKit up. */
function harnessEffect(row:HarnessRow):string {
  if (row.installed) return "installed";
  return row.detected ? `install through \`aikit client install ${row.client}\`, then restart ${row.harness}` : "not detected on this machine";
}

export function HarnessesPanel({reading}:{reading:SystemDisclosureReading}) {
  const state = reading.harness.harnesses;
  return <div className="config-view" data-harness-panel>
    <SourceNote reading={reading}/>
    <section className="config-section">
      <h4>Harnesses</h4>
      <p className="config-desc">The agent harnesses this machine actually has, as AIKit's own census reads them.</p>
      {state.state === "failed"
        ? <p role="alert" className="config-error" data-harnesses-failed>{state.error}</p>
        : state.rows.length === 0
          ? <p className="config-empty" data-harnesses-empty>No harness answers on this machine right now.</p>
          : <div className="harness-cards" data-harness-cards>
              {state.rows.map((row) => <HarnessCard key={`${row.harness}:${row.client}`} row={row}/>)}
            </div>}
    </section>
  </div>;
}

function HarnessCard({row}:{row:HarnessRow}) {
  return <div className="harness-card" data-harness-card data-harness={row.harness} data-detected={row.detected?"true":"false"} data-installed={row.installed?"true":"false"}>
    <div className="harness-card-head">
      <strong>{row.harness}</strong>
      <span className={`config-chip ${row.detected ? "is-active" : ""}`}>{row.detected ? "detected" : "not detected"}</span>
      {row.installed && <span className="config-chip is-active">AIKit installed</span>}
    </div>
    {!row.detected && <p className="config-muted">{row.detection_reason ?? row.detection}</p>}
    <p className="harness-card-effect">{harnessEffect(row)}</p>
    {row.config_dir && <p className="config-muted">Configured at <span className="config-mono config-ref">{row.config_dir}</span></p>}
  </div>;
}

// ---------------------------------------------------------------------------
// 3 · Models

export function ModelsPanel({reading,source,onChanged}:{reading:SystemDisclosureReading;source:SystemDisclosureSource;onChanged:()=>void}) {
  const providers = reading.harness.providers.state === "ok" ? reading.harness.providers.rows : [];
  const held = reading.harness.heldDefault?.value ?? null;
  const effective = effectiveChatDefault(providers, held);
  return <div className="config-view" data-models-panel>
    <SourceNote reading={reading}/>
    <DefaultProviderPicker
      providers={providers}
      held={held}
      effective={effective}
      defaultStateError={reading.harness.defaultState.state === "failed" ? reading.harness.defaultState.error : null}
      onHold={async(provider)=>{
        try {
          await source.holdDefault(provider);
        } finally {
          onChanged();
        }
      }}
      onDiscard={async()=>{
        try {
          await source.discardDefault();
        } finally {
          onChanged();
        }
      }}
    />
    <CatalogueSection state={reading.harness.catalogue}/>
    <section className="config-section" data-model-obligations>
      <h4>Routes and ranking</h4>
      <p className="config-note" role="note">Which concrete model a conversation resolves to — the route availability and the ranking policy — is composed by the owner at launch. It is not disclosed to this surface yet; these are the real native paths:</p>
      <ul className="config-obligations">
        <li>Route availability — read through <code>aikit compose --json</code></li>
        <li>Ranking policy — the owner's compose configuration decides; <code>aikit compose --json</code> shows what resolved</li>
        <li>Catalogue refresh — <code>aikit model-catalogue refresh</code></li>
      </ul>
    </section>
  </div>;
}

/** The default-provider picker for NEW chats. Selecting a row holds it
 * through the kernel's chat-default ops; "Suite default" withdraws the
 * held choice so the owner's rows decide again. (Moved from the old
 * Chat & harnesses census panel; the seam and selectors are unchanged.) */
export function DefaultProviderPicker({providers,held,effective,defaultStateError,onHold,onDiscard}:{
  providers:ProviderRow[];
  held:string|null;
  effective:{provider:string;rule:string}|null;
  defaultStateError:string|null;
  onHold:(provider:string)=>Promise<void>;
  onDiscard:()=>Promise<void>;
}) {
  const [picker,setPicker]=useState<string>(held??"");
  const [busy]=useState(false);
  useEffect(()=>{setPicker(held??"");},[held]);
  return <section className="config-section" data-default-provider>
    <h4>Default provider for new chats</h4>
    <p className="config-desc">Which configured provider a NEW conversation opens with. Existing conversations keep their own provider. {effective?`Right now: ${effective.provider}${effective.rule==="owner-choice"?" (your choice)":effective.rule==="pi-row"?" (the suite's standing default)":" (the first configured row)"}.`:"No provider is configured yet."}</p>
    {defaultStateError&&<p role="alert" className="config-error">{defaultStateError}</p>}
    <div className="config-control">
      <select
        className="config-input"
        aria-label="Default provider for new chats"
        data-default-provider-picker
        value={picker}
        disabled={busy||providers.length===0}
        onChange={(event)=>{
          const next=event.target.value;
          setPicker(next);
          void (next?onHold(next):onDiscard());
        }}
      >
        <option value="">Suite default (pi row, else first configured)</option>
        {providers.map((provider)=><option key={provider.id} value={provider.id}>{provider.label} ({provider.id})</option>)}
      </select>
      {held&&<button type="button" className="config-mini" data-default-provider-discard disabled={busy}
        onClick={()=>{setPicker("");void onDiscard();}}>Withdraw choice</button>}
      {held&&<span className="config-chip is-active">held: {held}</span>}
    </div>
  </section>;
}

/** The catalogue renders count-first; the list answers a plain substring
 * search and caps itself, so 300+ entries stay a readable list. */
const CATALOGUE_CAP=60;

export function CatalogueSection({state}:{state:{state:"ok";rows:{count:number;entries:CatalogueEntry[]}}|{state:"failed";error:string}|undefined}) {
  const [query,setQuery]=useState("");
  if(!state)return null;
  if(state.state==="failed")return <section className="config-section" data-catalogue-failed>
    <h4>Model catalogue</h4>
    <p role="alert" className="config-error">{state.error}</p>
  </section>;
  const {count,entries}=state.rows;
  const needle=query.trim().toLowerCase();
  const matches=needle
    ?entries.filter((entry:CatalogueEntry)=>`${entry.name} ${entry.model}`.toLowerCase().includes(needle))
    :entries;
  const shown=matches.slice(0,CATALOGUE_CAP);
  return <section className="config-section" data-catalogue-ok>
    <h4>Model catalogue</h4>
    <p className="config-desc">{count} model{count===1?"":"s"} resolvable across the suite's provider sources. A conversation picks from these; the list below answers a search.</p>
    <div className="config-control">
      <input className="config-input" type="search" placeholder={`Search ${count} models…`} aria-label="Search the model catalogue"
        data-catalogue-search value={query} onChange={(event)=>setQuery(event.target.value)}/>
      <span className="config-muted" data-catalogue-count>{needle?`${matches.length} of ${count} match`:`${count} models`}</span>
    </div>
    {matches.length===0
      ?<p className="config-empty">No model name matches.</p>
      :<table className="config-table" data-catalogue-table>
        <thead><tr><th>Model</th><th>Ref</th><th>Source</th></tr></thead>
        <tbody>
          {shown.map((entry)=><tr key={entry.model} data-model={entry.model}>
            <td>{entry.name}</td>
            <td className="config-mono config-ref">{entry.model}</td>
            <td className="config-mono config-ref">{entry.source}</td>
          </tr>)}
        </tbody>
      </table>}
    {matches.length>shown.length&&<p className="config-muted">Showing the first {shown.length} — refine the search to see the rest.</p>}
  </section>;
}

// ---------------------------------------------------------------------------
// 4 · Credentials

/** The real native verbs of the credential path (aikit credential --help).
 * None of them is disclosed as a kernel operation on this cut, so each
 * card names its path instead of faking a button (L4). */
function credentialActions(name:string):{verb:string;command:string}[] {
  const ref = `credential:${name}`;
  return [
    {verb:"Bind a key", command:`aikit credential setup ${ref}`},
    {verb:"Verify", command:`aikit credential verify ${ref}`},
    {verb:"Rotate", command:`aikit credential rotate ${ref}`},
    {verb:"Revoke", command:`aikit credential revoke ${ref}`},
    {verb:"Explain", command:`aikit credential explain ${ref}`},
  ];
}

export function CredentialsPanel({reading}:{reading:SystemDisclosureReading}) {
  const facts = reading.disclosure.state === "ok" ? reading.disclosure.rows : null;
  return <div className="config-view" data-credentials-panel>
    <SourceNote reading={reading}/>
    <section className="config-section">
      <h4>Provider credentials</h4>
      <p className="config-desc">Presence and lifecycle only — no key material is ever shown here. Binding a key, verifying, rotating and revoking run through the owner's own credential path; the commands below are that path.</p>
      {reading.disclosure.state === "absent" && <DisclosureAbsent reason={reading.disclosure.reason}/>}
      {facts && facts.credentials.length === 0 && <p className="config-empty" data-credentials-empty>No credential is bound yet. Discover what this machine offers with `aikit credential discover`.</p>}
      {facts && facts.credentials.length > 0 && <div className="credential-cards" data-credential-cards>
        {facts.credentials.map((row) => <CredentialCard key={row.credential} row={row}/>)}
      </div>}
      <p className="config-note" role="note">Discover candidate keys already on this machine (presence only): <code>aikit credential discover</code></p>
    </section>
    <section className="config-section">
      <h4>Where keys can live</h4>
      <p className="config-desc">When binding, you name a location instead of pasting material — the owner resolves it at use.</p>
      {facts && facts.secretStores.length > 0
        ? <table className="config-table" data-secret-stores>
            <thead><tr><th>Store</th><th>Scheme</th><th>Availability</th></tr></thead>
            <tbody>
              {facts.secretStores.map((store) => <SecretStoreRowView key={store.scheme} store={store}/>)}
            </tbody>
          </table>
        : <p className="config-empty">{facts ? "No secret store is disclosed right now." : "The disclosure is not available in this world."}</p>}
    </section>
  </div>;
}

function CredentialCard({row}:{row:CredentialRow}) {
  return <div className="credential-card" data-credential-card data-credential={row.credential} data-revoked={row.revoked?"true":"false"}>
    <div className="harness-card-head">
      <strong>{row.credential}</strong>
      <span className={`config-chip ${row.revoked ? "" : "is-active"}`}>{row.revoked ? "revoked" : "bound"}</span>
    </div>
    <p className="config-muted">Kept at <span className="config-mono config-ref">{row.provenance ?? row.provider ?? "an undisclosed location"}</span>{row.materialisation ? ` · materialised as ${row.materialisation}` : ""}</p>
    <p className="config-muted">
      {row.bound_at_unix_seconds ? `Bound ${formatRelativeTime(row.bound_at_unix_seconds*1000)}. ` : "Not bound here. "}
      {row.last_rotated_at_unix_seconds ? `Last rotated ${formatRelativeTime(row.last_rotated_at_unix_seconds*1000)}.` : "Never rotated."}
    </p>
    <ul className="config-obligations" data-credential-actions>
      {credentialActions(row.credential).map((action) => (
        <li key={action.verb}>{action.verb} — <code>{action.command}</code></li>
      ))}
    </ul>
  </div>;
}

// ---------------------------------------------------------------------------
// 5 · Skills

export function SkillsPanel({reading}:{reading:SystemDisclosureReading}) {
  const facts = reading.disclosure.state === "ok" ? reading.disclosure.rows : null;
  const skills:SkillRow[] = facts?.skills ?? [];
  const activeCount = skills.filter((skill) => skill.active).length;
  return <div className="config-view" data-skills-panel>
    <SourceNote reading={reading}/>
    <section className="config-section">
      <h4>Skills & capabilities</h4>
      <p className="config-desc">{facts ? `${skills.length} resolved for this project — ${activeCount} active in the current composition. Source is the capability's own namespace.` : "What this world resolves for skills, read from the AIKit disclosure."}</p>
      {reading.disclosure.state === "absent" && <DisclosureAbsent reason={reading.disclosure.reason}/>}
      {facts && skills.length === 0 && <p className="config-empty" data-skills-empty>No skill resolves for this project right now.</p>}
      {skills.length > 0 && <table className="config-table" data-skills-table>
        <thead><tr><th>Skill</th><th>Source</th><th>State</th></tr></thead>
        <tbody>
          {skills.map((skill) => <tr key={skill.id} data-skill-row data-skill={skill.id} data-active={skill.active?"true":"false"}>
            <td>{skill.name || skill.id}</td>
            <td className="config-mono config-ref">{skill.id}</td>
            <td>{skill.active ? "active" : "resolved, not carried"}</td>
          </tr>)}
        </tbody>
      </table>}
      <ul className="config-obligations" data-skill-obligations>
        <li>Enable or disable in a scope — <code>aikit enable</code> / <code>aikit disable</code> (the change materialises with the project's next apply)</li>
        <li>Per-skill usage overlays — <code>aikit skill overlay</code></li>
        <li>Skill sources, sync and pins — <code>aikit source</code></li>
        <li>Method skills — <code>aikit method</code></li>
      </ul>
    </section>
  </div>;
}
