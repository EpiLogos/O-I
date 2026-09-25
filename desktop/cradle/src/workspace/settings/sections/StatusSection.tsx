/**
 * Status: is everything working? (12-SETTINGS §3.1) — a handful of cards,
 * each linking to its section, and DRIFT first when a product's own CLI has
 * changed something: both sides and the owner's remedy (S10). O:I never
 * rewrites it silently.
 */
import type {DisclosedSetting} from "../types";
import {adapterNeeded, readyHarnesses, skillCounts, credentialCards, storedIn, providerName} from "../sectionModel";
import {useEffect} from "react";
import {refreshAll, watchPair, type SettingsSnapshot} from "../settingsData";
import {goTo} from "../settingsNav";
import {settingsProducts} from "../settingsProducts";
import {stagedChanges} from "../changeModel";
import {Card, Reading, Unreadable} from "../rows";
import {formatRelativeTime} from "../../../shared/relativeTime";

/** A drifted value, briefly: its scalar fields and the size of its lists. */
export function driftSide(value: unknown): string {
  if (value === undefined || value === null) return "nothing reported";
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) return `${value.length} ${value.length === 1 ? "item" : "items"}`;
  const parts: string[] = [];
  for (const [key, field] of Object.entries(value as Record<string, unknown>)) {
    const name = key.replace(/[_-]+/g, " ");
    if (field === null || field === undefined) continue;
    if (typeof field !== "object") parts.push(`${name} ${String(field)}`);
    else if (Array.isArray(field)) parts.push(`${field.length} ${name}`);
    else parts.push(`${Object.keys(field as object).length} ${name}`);
  }
  return parts.length ? parts.join(" · ") : "nothing reported";
}

export interface DriftRow {
  product: string;
  productName: string;
  setting: DisclosedSetting;
  sides: {axis: string; value: string}[];
  remedy: string;
}

export function driftRows(data: SettingsSnapshot): DriftRow[] {
  if (data.owners.state !== "ok") return [];
  const rows: DriftRow[] = [];
  for (const product of settingsProducts(data)) {
    const descriptor = data.owners.value[product.id]?.descriptor;
    for (const section of descriptor?.sections ?? []) {
      for (const setting of section.settings) {
        if (setting.drift?.state !== "diverged") continue;
        const axes = setting.axes as Record<string, {value?: unknown} | undefined>;
        const between = setting.drift.between?.length ? setting.drift.between : ["declared", "effective"];
        rows.push({
          product: product.id, productName: product.label, setting,
          sides: between.map((axis) => ({axis, value: setting.kind === "secret" || setting.kind === "credential" ? (axes[axis]?.value !== undefined ? "set" : "not set") : driftSide(axes[axis]?.value)})),
          remedy: setting.drift.remediation_action_ref
            ? `Run ${setting.drift.remediation_action_ref}`
            : setting.native_path ? `Change it through ${product.label}'s own command: ${setting.native_path}` : `${product.label} discloses no remedy for this`,
        });
      }
    }
  }
  return rows;
}

const AXIS_WORD: Record<string, string> = {declared: "Declared", effective: "In effect", active: "Running", staged: "Staged"};

export function StatusSection({data}: {data: SettingsSnapshot}) {
  useEffect(() => { void watchPair("oi:update:state", {scope_kind: "world", scope_ref: null}); }, []);
  if (data.suite.state === "reading" && data.census.state === "reading") return <Reading/>;
  const drift = driftRows(data);
  const owners = data.owners.state === "ok" ? data.owners.value : null;
  const unread = owners ? settingsProducts(data).filter((product) => product.id !== "oi" && !owners[product.id]?.descriptor) : [];
  const pending = stagedChanges(data);
  const suite = data.suite.state === "ok" ? data.suite.value : null;
  const oi = data.owners.state === "ok" ? data.owners.value.oi?.descriptor : null;
  const update = data.registry.state === "ok" ? data.resolutions["oi:update:state|world"]?.native.effective?.value : undefined;
  const cards = credentialCards(data).filter((card) => card.binding && !card.binding.revoked);
  const skills = suite ? skillCounts(suite) : null;
  const stores = suite?.disclosure.state === "ok" ? suite.disclosure.rows.secretStores.filter((store) => store.availability === "available") : [];
  return <div className="settings-status" data-status-section>
    <div className="settings-cards">
      <Card title="Suite" id="suite">
        <p data-status-suite>{oi?.owner.owner_version ? `O:I ${oi.owner.owner_version}` : data.census.state === "ok" ? "O:I" : "O:I · not read yet"}{typeof update === "string" && update ? ` · ${update}` : ""}</p>
      </Card>
      <Card title="Harnesses" id="harnesses">
        {suite ? <p data-status-harnesses>{readyHarnesses(suite).length} ready · {adapterNeeded(suite).length} detected without an adapter</p>
          : data.suite.state === "failed" ? <p>Couldn't be read.</p> : <p>Reading…</p>}
        <button type="button" className="settings-button" onClick={() => goTo({kind: "section", id: "harnesses"})}>Open</button>
      </Card>
      <Card title="Credentials" id="credentials">
        {data.credentials.state === "ok"
          ? <p data-status-credentials>{cards.length === 0 ? "No keys yet" : cards.map((card) => `${card.label}${card.binding?.last_verified_at_unix_seconds ? ` · checked ${formatRelativeTime(card.binding.last_verified_at_unix_seconds * 1000)}` : ` · ${storedIn(card.binding!)}`}`).join(" · ")}</p>
          : data.credentials.state === "failed" ? <p>Couldn't be read.</p> : <p>Reading…</p>}
        <button type="button" className="settings-button" onClick={() => goTo({kind: "section", id: "credentials"})}>Open</button>
      </Card>
      <Card title="Secret stores" id="secret-stores">
        <p data-status-stores>{data.suite.state === "reading" ? "Reading…" : suite?.disclosure.state === "ok" ? (stores.length ? `${stores.map((store) => store.store === "OS secure store" ? "Keychain" : store.store).join(", ")} available` : "None available") : "Not disclosed here"}</p>
      </Card>
      <Card title="Skills" id="skills">
        <p data-status-skills>{data.suite.state === "reading" ? "Reading…" : skills ? `${skills.active} active of ${skills.total}` : "Not disclosed here"}</p>
        <button type="button" className="settings-button" onClick={() => goTo({kind: "section", id: "skills"})}>Open</button>
      </Card>
      <Card title="Capability changes" id="changes">
        {data.resolutionsState.state === "failed"
          ? <Unreadable error={data.resolutionsState.error} onRetry={() => void refreshAll()}/>
          : data.resolutionsState.state === "reading" ? <p>Reading…</p>
          : <p data-status-changes>{pending.length === 0 ? "No capability changes." : `${pending.length} ${pending.length === 1 ? "change" : "changes"} pending`}</p>}
      </Card>
    </div>
    <h3 className="settings-eyebrow">Drift</h3>
    {data.owners.state === "failed" ? <Unreadable error={data.owners.state === "failed" ? data.owners.error : ""} onRetry={() => void refreshAll()}/>
      : data.owners.state === "reading" ? <p className="settings-muted">Reading each product's settings…</p>
      : unread.length > 0 && drift.length === 0 ? <p className="settings-muted" data-status-drift-unknown>{unread.length === settingsProducts(data).filter(product => product.id !== "oi").length ? "No product's settings could be read, so drift can't be known." : `${unread.map((product) => product.label).join(", ")} couldn't be read, so drift can't be known there; the others agree.`}</p>
      : drift.length === 0 ? <p className="settings-muted" data-status-drift-none>Nothing has drifted: every product's declared and effective settings agree.</p>
      : <div className="settings-drift-list" data-status-drift>
        {drift.map((row) => <div className="settings-drift" key={`${row.product}:${row.setting.key}`} data-drift-product={row.product} data-drift-setting={row.setting.key}>
          <div className="settings-drift-head"><strong>{row.productName}</strong><span>{row.setting.title}</span></div>
          <dl className="settings-drift-sides">{row.sides.map((side) => <div key={side.axis}><dt>{AXIS_WORD[side.axis] ?? side.axis}</dt><dd data-drift-side={side.axis}>{side.value}</dd></div>)}</dl>
          <p className="settings-drift-remedy" data-drift-remedy>{row.remedy}</p>
          <button type="button" className="settings-link" onClick={() => goTo({kind: "product", id: row.product}, `native:${row.product}:${row.setting.key}`)}>Open {row.productName}</button>
        </div>)}
      </div>}
    {suite && suite.harness.catalogue.state === "ok" && <p className="settings-muted settings-foot">{suite.harness.catalogue.rows.count} models catalogued · keys for {cards.map((card) => providerName(card.provider)).join(", ") || "no provider"}</p>}
  </div>;
}
