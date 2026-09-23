/**
 * Models: pick a model relative to the harness (12-SETTINGS §3.3).
 *
 *  - Default connection for new chats: labelled a CONNECTION, never a model
 *    (Amendment A1). Choosing one stages it; Apply holds it.
 *  - One row per ready harness, with a searchable picker grouped by provider
 *    where each model shows Usable / Needs a key / Local — the model's routes
 *    JOINED with the bound credentials (S14). Auto keeps its identity.
 *  - Per-harness model choice has no write operation today: the current
 *    choice is read-only and one sentence names the missing operation.
 *  - The catalogue opens in a searchable dialog, never a wall table.
 */
import {useEffect, useMemo, useRef, useState} from "react";
import type {CatalogueEntry} from "../../../configuration/harnessSource";
import {availabilityWords, boundProviders, harnessName, modelAvailability, modelGroup, RANKING_POLICIES, readyHarnesses} from "../sectionModel";
import {loadSuite, refreshAll, stageDefaultConnection, type SettingsSnapshot} from "../settingsData";
import {currentConnection, DEFAULT_CONNECTION_ROW, stagedChanges, undoChange} from "../changeModel";
import {goTo} from "../settingsNav";
import {Missing, ReadOnly, Reading, Row, Unreadable} from "../rows";

const AUTO_POLICY = RANKING_POLICIES[0];

function ModelList({entries, data, query}: {entries: CatalogueEntry[]; data: SettingsSnapshot; query: string}) {
  const bound = boundProviders(data.credentials.state === "ok" ? data.credentials.value.bindings : []);
  const needle = query.trim().toLowerCase();
  const groups = useMemo(() => {
    const map = new Map<string, CatalogueEntry[]>();
    for (const entry of entries) {
      if (needle && !`${entry.name} ${entry.model}`.toLowerCase().includes(needle)) continue;
      const group = modelGroup(entry);
      map.set(group, [...(map.get(group) ?? []), entry]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [entries, needle]);
  const count = groups.reduce((sum, [, list]) => sum + list.length, 0);
  return <div className="settings-model-list" data-model-list>
    {!needle && <div className="settings-model-item is-auto" data-model="auto">
      <div><strong>Auto · {AUTO_POLICY.label}</strong><span>Picks per task under the {AUTO_POLICY.label} policy</span></div>
      <span className="settings-chip">policy</span>
    </div>}
    {count === 0 && <p className="settings-muted">No model name matches.</p>}
    {groups.map(([group, list]) => <div key={group} className="settings-model-group" data-model-group={group}>
      <h4 className="settings-eyebrow">{group}</h4>
      {list.map((entry) => {
        const availability = modelAvailability(entry, bound);
        const words = availabilityWords(availability);
        return <div key={entry.model} className="settings-model-item" data-model={entry.model} data-availability={availability.state}>
          <div><strong>{entry.name || entry.model.replace(/^model:/, "")}</strong><span>{words.line}{availability.state === "needs-key" && <> · <button type="button" className="settings-link" onClick={() => goTo({kind: "section", id: "credentials"}, `credential:${availability.provider}`)}>Credentials</button></>}</span></div>
          <span className={`settings-chip is-${availability.state}`} data-availability-chip>{words.chip}</span>
        </div>;
      })}
    </div>)}
  </div>;
}

function Picker({label, entries, data}: {label: string; entries: CatalogueEntry[]; data: SettingsSnapshot}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!host.current?.contains(event.target as Node)) setOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { event.stopPropagation(); setOpen(false); } };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", key, true);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("keydown", key, true); };
  }, [open]);
  return <div className="settings-picker" ref={host}>
    <button type="button" className="settings-select-button" aria-haspopup="listbox" aria-expanded={open} data-model-picker={label} onClick={() => setOpen(!open)}>
      Auto · {AUTO_POLICY.label}<span aria-hidden="true" className="settings-select-caret">⌄</span>
    </button>
    {open && <div className="settings-popover" role="dialog" aria-label={`Models for ${label}`} data-model-popover>
      <input className="settings-input" type="search" placeholder="Search models" aria-label="Search models" autoFocus value={query} onChange={(event) => setQuery(event.target.value)}/>
      <p className="settings-popover-note">Shown to compare what each model needs; the choice itself stays read-only for now.</p>
      <ModelList entries={entries} data={data} query={query}/>
    </div>}
  </div>;
}

function CatalogueDialog({entries, data, onClose}: {entries: CatalogueEntry[]; data: SettingsSnapshot; onClose: () => void}) {
  const [query, setQuery] = useState("");
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [onClose]);
  return <div className="settings-scrim" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="settings-sheet settings-catalogue" role="dialog" aria-modal="true" aria-label="Model catalogue" data-catalogue-dialog>
      <header className="settings-sheet-head"><h2>Model catalogue</h2><button type="button" className="settings-button" onClick={onClose}>Close</button></header>
      <input className="settings-input" type="search" placeholder={`Search ${entries.length} models`} aria-label="Search the model catalogue" data-catalogue-search autoFocus value={query} onChange={(event) => setQuery(event.target.value)}/>
      <div className="settings-sheet-body"><ModelList entries={entries} data={data} query={query}/></div>
    </div>
  </div>;
}

export function ModelsSection({data}: {data: SettingsSnapshot}) {
  const [browsing, setBrowsing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  if (data.suite.state === "reading") return <Reading/>;
  if (data.suite.state === "failed") return <Unreadable error={data.suite.error} onRetry={() => void refreshAll()}/>;
  const reading = data.suite.value;
  const providers = reading.harness.providers.state === "ok" ? reading.harness.providers.rows : [];
  const current = currentConnection(data);
  const chosen = data.stagedDefault ?? current ?? "";
  const staged = stagedChanges(data).find((change) => change.kind === "chat-default");
  const catalogue = reading.harness.catalogue;
  const entries = catalogue.state === "ok" ? catalogue.rows.entries : [];
  const ready = readyHarnesses(reading);
  const sources = catalogue.state === "ok" ? [...new Set(entries.map((entry) => entry.source))] : [];
  return <div className="settings-models" data-models-panel>
    <Row id={DEFAULT_CONNECTION_ROW} title="Default connection for new chats" description="Which harness a new conversation starts with. A connection, not a model."
      changed={!!staged} onUndo={staged ? () => void undoChange(staged) : undefined}>
      {reading.harness.providers.state === "failed"
        ? <span className="settings-inline-error">{reading.harness.providers.error}</span>
        : providers.length === 0
          ? <span className="settings-muted">No connection is configured yet</span>
          : <select className="settings-select" aria-label="Default connection for new chats" data-default-connection value={chosen}
              onChange={(event) => stageDefaultConnection(event.target.value === current ? null : event.target.value)}>
              {providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.label}</option>)}
            </select>}
    </Row>
    {ready.map((row) => <Row key={row.client} id={`model:${row.client}`} title={harnessName(row.harness)} description="Model for this harness">
      {catalogue.state === "ok" ? <Picker label={harnessName(row.harness)} entries={entries} data={data}/> : <ReadOnly value={`Auto · ${AUTO_POLICY.label}`} place="AIKit's roster"/>}
    </Row>)}
    <Missing>Choosing a model or a ranking policy per harness needs an AIKit setting that doesn't exist yet; the current choice is shown read-only.</Missing>
    <Row id="model:ranking-policy" title="Ranking policy" description={`How Auto chooses: ${RANKING_POLICIES.map((policy) => policy.label).join(", ")}`}>
      <ReadOnly value={AUTO_POLICY.label} place="AIKit's roster default"/>
    </Row>
    <Row id="model:catalogue" title="Catalogue" description={catalogue.state === "ok" ? `${catalogue.rows.count} models from ${sources.length === 1 ? "one source" : `${sources.length} sources`} in AIKit's catalogue` : "The model catalogue"}>
      {catalogue.state === "failed" ? <span className="settings-inline-error">{catalogue.error}</span> : <>
        <button type="button" className="settings-button" data-catalogue-browse onClick={() => setBrowsing(true)}>Browse…</button>
        <button type="button" className="settings-button" disabled={refreshing} onClick={() => { setRefreshing(true); void loadSuite().finally(() => setRefreshing(false)); }}>{refreshing ? "Reading…" : "Refresh"}</button>
      </>}
    </Row>
    {catalogue.state === "ok" && <p className="settings-muted settings-foot" data-catalogue-count>{catalogue.rows.count} models</p>}
    {browsing && <CatalogueDialog entries={entries} data={data} onClose={() => setBrowsing(false)}/>}
  </div>;
}
