/**
 * One product page (12-SETTINGS §3.9), rendered uniformly from the owner's
 * own descriptor and contribution: a Health line with its degradations;
 * friendly settings rows (the owner's axes only when they disagree);
 * Actions as buttons, missing ones as one sentence; Known gaps collapsed;
 * Show raw last and collapsed — the ONLY place JSON appears.
 */
import {useState} from "react";
import type {DisclosedAction, DisclosedSetting, OwnerMount} from "../types";
import {availabilityWord} from "../v2/vocabulary";
import {expect, plain, refreshAll, type SettingsSnapshot} from "../settingsData";
import {CAPABILITIES_REF} from "../changeModel";
import {goTo} from "../settingsNav";
import {skillCounts} from "../sectionModel";
import {driftSide} from "./StatusSection";
import {ConfigSettingRow} from "./ConfigRows";
import {Reading, Row, Unreadable} from "../rows";
import {AdoptionEntry} from "../../../configuration/AdoptionEntry";

const CONTRIBUTION_OWNER: Record<string, string> = {"software-factory": "software-factory"};

/** "Starting, attaching and stopping sessions" — the missing actions, once. */
export function missingSentence(actions: DisclosedAction[]): string | null {
  const missing = actions.filter((action) => action.availability !== "disclosed");
  if (missing.length === 0) return null;
  const titles = missing.map((action) => action.title.replace(/\.$/, ""));
  const list = titles.length === 1 ? titles[0] : `${titles.slice(0, -1).join(", ")} and ${titles[titles.length - 1]}`;
  return `${list.charAt(0).toUpperCase()}${list.slice(1)} ${missing.length === 1 ? "has" : "have"} no native operation here yet.`;
}

function actionLabel(action: DisclosedAction): string {
  const short = action.action_ref.split(".").slice(1).join(" ").replace(/[-_]/g, " ");
  return short ? short.charAt(0).toUpperCase() + short.slice(1) : action.title;
}

function runnable(action: DisclosedAction & {native_path?: string}): boolean {
  return action.availability === "disclosed" && action.exposure?.ui !== false && !/[<[]/.test(action.native_path ?? "");
}

function Actions({product, actions}: {product: string; actions: (DisclosedAction & {native_path?: string})[]}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [ran, setRan] = useState<{ref: string; ok: boolean; at: number; output: unknown; error?: string} | null>(null);
  const run = async (action: DisclosedAction) => {
    setBusy(action.action_ref); setRan(null);
    try {
      const outcome = await expect<{data: {ok: boolean; output: unknown; ran_at_unix_ms: number}}>({op: "product_action_run", product_id: product, action_ref: action.action_ref}, "product_action_ran");
      setRan({ref: action.action_ref, ok: outcome.data.ok, at: outcome.data.ran_at_unix_ms, output: outcome.data.output});
    } catch (cause) {
      setRan({ref: action.action_ref, ok: false, at: Date.now(), output: null, error: plain(cause)});
    } finally {
      setBusy(null);
    }
  };
  const buttons = actions.filter(runnable);
  const needsSubject = actions.filter((action) => action.availability === "disclosed" && !runnable(action));
  const missing = missingSentence(actions);
  const ranAction = ran ? actions.find((action) => action.action_ref === ran.ref) : null;
  return <>
    <h3 className="settings-eyebrow">Actions</h3>
    {buttons.length === 0 && !missing && <p className="settings-muted">No actions here yet.</p>}
    {buttons.length > 0 && <div className="settings-card-actions" data-product-actions>
      {buttons.map((action) => <button key={action.action_ref} type="button" className="settings-button" title={action.title} disabled={busy !== null} data-product-action={action.action_ref} onClick={() => void run(action)}>{busy === action.action_ref ? "Running…" : actionLabel(action)}</button>)}
    </div>}
    {needsSubject.length > 0 && <p className="settings-muted">{needsSubject.map((action) => action.title).join(" · ")} — these act on a chosen subject, so they run from where that subject is.</p>}
    {missing && <p className="settings-missing" data-settings-missing>{missing}</p>}
    {ran && <div className="settings-action-result" role="status" data-product-action-result={ran.ref}>
      <p>{ranAction?.title ?? ran.ref}: {ran.error ? `didn't run — ${ran.error}` : ran.ok ? "ran" : "the product reported a problem"} · {new Date(ran.at).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"})}</p>
      {!ran.error && <details className="settings-raw"><summary>Show raw</summary><pre>{typeof ran.output === "string" ? ran.output : JSON.stringify(ran.output, null, 2)}</pre></details>}
    </div>}
  </>;
}

function DisclosedRow({product, setting}: {product: string; setting: DisclosedSetting}) {
  const axes = setting.axes as Record<string, {value?: unknown} | undefined>;
  const secret = setting.kind === "secret" || setting.kind === "credential";
  const current = axes.effective ?? axes.declared ?? axes.active;
  const value = secret ? (current?.value !== undefined ? "set" : "not set") : driftSide(current?.value);
  const drifted = setting.drift?.state === "diverged";
  return <Row id={`native:${product}:${setting.key}`} title={setting.title}
    description={drifted ? <span className="settings-axes">Declared {driftSide(axes[setting.drift!.between[0]]?.value)} · {setting.drift!.between[1] === "effective" ? "in effect" : setting.drift!.between[1]} {driftSide(axes[setting.drift!.between[1]]?.value)}</span> : setting.native_path ? <span className="settings-muted">Set through {setting.native_path}</span> : undefined}>
    <span className="settings-value" data-native-value>{value}</span>
    {drifted && <span className="settings-chip is-warning">differs</span>}
  </Row>;
}

export function ProductSection({id, data}: {id: string; data: SettingsSnapshot}) {
  const [details, setDetails] = useState(false);
  if (data.owners.state === "reading") return <Reading/>;
  if (data.owners.state === "failed") return <Unreadable error={data.owners.error} onRetry={() => void refreshAll()}/>;
  const mount: OwnerMount | undefined = data.owners.value[id];
  const descriptor = mount?.descriptor;
  const entries = data.registry.state === "ok" ? data.registry.value.entries.filter((entry) => entry.owner.owner_ref === (CONTRIBUTION_OWNER[id] ?? id)) : [];
  const contribution = data.registry.state === "ok" ? data.registry.value.mounts.find((candidate) => candidate.owner_ref === id) : undefined;
  const availability = descriptor?.availability.state ?? mount?.availability ?? "unknown";
  const degradations = descriptor?.degradations ?? [];
  const skills = data.suite.state === "ok" ? skillCounts(data.suite.value) : null;
  return <div className="settings-product" data-product-page={id}>
    <p className="settings-health" data-product-health={availability}>
      <span className={`settings-health-dot is-${availability}`} aria-hidden="true"/>
      {availabilityWord(availability)}{descriptor?.owner.owner_version ? ` · ${descriptor.owner.owner_version}` : ""}
      {degradations.length > 0 && <> · {degradations.length} {degradations.length === 1 ? "degradation" : "degradations"} <button type="button" className="settings-link" aria-expanded={details} onClick={() => setDetails(!details)}>details</button></>}
      {!descriptor && (mount?.reason || mount?.error) && <span className="settings-muted"> — {mount.reason ?? mount.error}</span>}
    </p>
    {details && <ul className="settings-degradations">{degradations.map((degradation, index) => <li key={index}>{degradation.subject_ref ? `${degradation.subject_ref}: ` : ""}{degradation.state}{degradation.reason ? ` — ${degradation.reason}` : ""}</li>)}</ul>}
    {descriptor?.about && <p className="settings-muted settings-prose">{descriptor.about}</p>}
    {entries.length > 0 && <div className="settings-lines" data-product-settings>
      {entries.map((entry) => entry.setting.setting_ref === CAPABILITIES_REF
        ? <Row key={entry.setting.setting_ref} id={`setting:${entry.setting.setting_ref}`} title="Capabilities" description={skills ? `${skills.active} active of ${skills.total}` : undefined}>
            <button type="button" className="settings-button" onClick={() => goTo({kind: "section", id: "skills"})}>Open Skills</button>
          </Row>
        : entry.setting.value_schema.type === "secret"
          ? <Row key={entry.setting.setting_ref} id={`setting:${entry.setting.setting_ref}`} title={entry.setting.title} description={entry.setting.description}>
              <button type="button" className="settings-button" onClick={() => goTo({kind: "section", id: "credentials"})}>Open Credentials</button>
            </Row>
          : <ConfigSettingRow key={entry.setting.setting_ref} entry={entry} data={data}/>)}
    </div>}
    {entries.length === 0 && descriptor && <div className="settings-lines" data-product-settings>
      {descriptor.sections.flatMap((section) => section.settings).slice(0, 40).map((setting) => <DisclosedRow key={setting.key} product={id} setting={setting}/>)}
    </div>}
    {descriptor && <Actions product={id} actions={descriptor.actions as (DisclosedAction & {native_path?: string})[]}/>}
    {id === "oi" && <div className="settings-adoption"><AdoptionEntry onApplied={() => void refreshAll()}/></div>}
    {(descriptor?.obligations?.length ?? 0) > 0 && <details className="settings-disclosure"><summary>Known gaps</summary><ul>{descriptor!.obligations!.map((gap, index) => <li key={index}>{gap}</li>)}</ul></details>}
    <details className="settings-disclosure settings-raw" data-show-raw><summary>Show raw</summary>
      <pre>{JSON.stringify({descriptor: descriptor ?? null, contribution: contribution?.document ?? null, mount_error: mount?.error ?? null}, null, 2)}</pre>
    </details>
  </div>;
}
