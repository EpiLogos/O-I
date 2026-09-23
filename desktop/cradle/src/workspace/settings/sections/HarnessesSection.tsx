/**
 * Harnesses: pick a harness by name (12-SETTINGS §3.2). One card per
 * harness from `aikit client status`: Ready (an adapter exists), Detected
 * with no adapter yet (collapsed), Not found (collapsed). The broker is
 * AIKit itself and is not listed. Install runs `aikit client install`.
 */
import {useState} from "react";
import type {HarnessRow} from "../../../configuration/harnessSource";
import {adapterNeeded, harnessEffect, harnessItems, harnessName, notFound, readyHarnesses} from "../sectionModel";
import {expect, loadSuite, plain, refreshAll, stageDefaultConnection, type SettingsSnapshot} from "../settingsData";
import {currentConnection} from "../changeModel";
import {Group, Reading, Unreadable} from "../rows";

/** The owner's config folder, as one path (it may add a note after it). */
export function folderOf(row: HarnessRow): string | null {
  const first = row.config_dir?.split(" (")[0]?.split(" and ")[0]?.trim();
  return first && first.startsWith("/") ? first : null;
}

/** The encounter connection a harness can open new chats with, if one is configured. */
export function connectionFor(data: SettingsSnapshot, row: HarnessRow): string | null {
  const providers = data.suite.state === "ok" && data.suite.value.harness.providers.state === "ok" ? data.suite.value.harness.providers.rows : [];
  const names = [row.client, row.harness].filter(Boolean);
  return providers.find((provider) => names.includes(provider.id))?.id
    ?? providers.find((provider) => names.some((name) => provider.id.startsWith(`${name}-`)))?.id ?? null;
}

function ReadyCard({row, data}: {row: HarnessRow; data: SettingsSnapshot}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const connection = connectionFor(data, row);
  const isDefault = connection !== null && (data.stagedDefault ?? currentConnection(data)) === connection;
  const folder = folderOf(row);
  const install = async () => {
    setBusy(true); setNote(null);
    try {
      await expect({op: "client_install", client: row.client}, "client_installed");
      await loadSuite();
      setNote("Installed. " + (harnessEffect(row) ?? ""));
    } catch (cause) {
      setNote(`Not installed: ${plain(cause)}`);
    } finally {
      setBusy(false);
    }
  };
  return <section className="settings-card settings-harness" data-settings-row={`harness:${row.client}`} data-harness-card={row.client} data-harness={row.harness} data-installed={row.installed ? "true" : "false"}>
    <h3>{harnessName(row.harness)}</h3>
    <p>{row.installed ? "Installed · detected" : "Detected · not installed"}</p>
    {harnessItems(row) && <p>{harnessItems(row)}</p>}
    {harnessEffect(row) && <p className="settings-card-strong" data-harness-effect>{harnessEffect(row)}</p>}
    <div className="settings-card-actions">
      {!row.installed && <button type="button" className="settings-button is-primary" disabled={busy} data-harness-install onClick={() => void install()}>{busy ? "Installing…" : "Install"}</button>}
      {connection && (isDefault
        ? <span className="settings-chip" data-harness-default>Default for new chats</span>
        : <button type="button" className="settings-button" data-harness-set-default onClick={() => stageDefaultConnection(connection === currentConnection(data) ? null : connection)}>Set as default</button>)}
      {folder && <button type="button" className="settings-button" onClick={() => void expect({op: "settings_reveal", path: folder}, "settings_revealed").catch((cause) => setNote(plain(cause)))}>Open folder</button>}
    </div>
    {note && <p className="settings-card-note" role="status">{note}</p>}
  </section>;
}

export function HarnessesSection({data}: {data: SettingsSnapshot}) {
  if (data.suite.state === "reading") return <Reading/>;
  if (data.suite.state === "failed") return <Unreadable error={data.suite.error} onRetry={() => void refreshAll()}/>;
  const reading = data.suite.value;
  if (reading.harness.harnesses.state === "failed") return <Unreadable error={reading.harness.harnesses.error} onRetry={() => void refreshAll()}/>;
  const ready = readyHarnesses(reading), needing = adapterNeeded(reading), missing = notFound(reading);
  return <div className="settings-harnesses" data-harness-panel>
    <Group title="Ready" count={ready.length} id="ready">
      {ready.length === 0 ? <p className="settings-muted">No harness with an AIKit adapter is on this machine.</p>
        : <div className="settings-cards">{ready.map((row) => <ReadyCard key={row.client} row={row} data={data}/>)}</div>}
    </Group>
    <Group title="Detected, adapter needed" count={needing.length} collapsible defaultOpen={false} id="adapter-needed" summary={<p className="settings-muted settings-names" data-harness-names="adapter-needed">{needing.map((row) => harnessName(row.harness)).join(", ")}</p>}>
      <ul className="settings-name-list" data-harness-adapter-needed>
        {needing.map((row) => <li key={row.client} data-harness-card={row.client}><strong>{harnessName(row.harness)}</strong> <span className="settings-muted">Adapter needed{row.adapter_gap?.authoring_skill_ref ? ` — how adapters are made: the harness-adapter authoring skill` : ""}</span></li>)}
      </ul>
    </Group>
    <Group title="Not found" count={missing.length} collapsible defaultOpen={false} id="not-found" summary={<p className="settings-muted settings-names" data-harness-names="not-found">{missing.map((row) => harnessName(row.harness)).join(", ")}</p>}>
      <ul className="settings-name-list" data-harness-not-found>
        {missing.map((row) => <li key={row.client} data-harness-card={row.client}><strong>{harnessName(row.harness)}</strong> <span className="settings-muted">Not on this machine</span></li>)}
      </ul>
    </Group>
  </div>;
}
