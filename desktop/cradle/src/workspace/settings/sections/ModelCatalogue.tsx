/** The shared catalogue is a comparison tool; selections come from the live harness. */
import {useEffect, useMemo, useState} from "react";
import type {CatalogueEntry} from "../../../configuration/harnessSource";
import {modelDisplayName} from "../../../agent/chat/modelPresentation";
import {availabilityWords, boundProviders, modelAvailability, modelGroup, RANKING_POLICIES} from "../sectionModel";
import {loadSuite, type SettingsSnapshot} from "../settingsData";
import {goTo} from "../settingsNav";
import {Row, Scrim} from "../rows";

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
    {count === 0 && <p className="settings-muted">No model name matches.</p>}
    {groups.map(([group, list]) => <div key={group} className="settings-model-group" data-model-group={group}>
      <h4 className="settings-eyebrow">{group}</h4>
      {list.map((entry) => {
        const availability = modelAvailability(entry, bound);
        const words = availabilityWords(availability);
        return <div key={entry.model} className="settings-model-item" data-model={entry.model} data-availability={availability.state}>
          <div><strong>{modelDisplayName(entry.name) ?? "Unnamed model"}</strong><span>{words.line}{availability.state === "needs-key" && <> · <button type="button" className="settings-link" onClick={() => goTo({kind: "section", id: "credentials"}, `credential:${availability.provider}`)}>Credentials</button></>}</span></div>
          <span className={`settings-chip is-${availability.state}`} data-availability-chip>{words.chip}</span>
        </div>;
      })}
    </div>)}
  </div>;
}

function CatalogueDialog({entries, data, onClose}: {entries: CatalogueEntry[]; data: SettingsSnapshot; onClose: () => void}) {
  const [query, setQuery] = useState("");
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [onClose]);
  return <Scrim onDismiss={onClose}>
    <div className="settings-sheet settings-catalogue oi-scroll-quiet" role="dialog" aria-modal="true" aria-label="Model catalogue" data-catalogue-dialog>
      <header className="settings-sheet-head"><h2>Model catalogue</h2><button type="button" className="settings-button" onClick={onClose}>Close</button></header>
      <input className="settings-input" type="search" placeholder={`Search ${entries.length} models`} aria-label="Search the model catalogue" data-catalogue-search autoFocus value={query} onChange={(event) => setQuery(event.target.value)}/>
      <div className="settings-sheet-body"><ModelList entries={entries} data={data} query={query}/></div>
    </div>
  </Scrim>;
}

export function ModelCatalogue({data}: {data: SettingsSnapshot}) {
  const [browsing, setBrowsing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  if (data.suite.state !== "ok") return null;
  const catalogue = data.suite.value.harness.catalogue;
  const entries = catalogue.state === "ok" ? catalogue.rows.entries : [];
  return <section className="settings-models" aria-label="Model catalogue">
    <Row id="model:catalogue" title="Model catalogue" description={catalogue.state === "ok" ? `${catalogue.rows.count} models to compare. Chat choices come from the connected harness.` : "The model catalogue could not be read."}>
      {catalogue.state === "failed" && <span className="settings-inline-error">{catalogue.error}</span>}
      {catalogue.state === "ok" && <button type="button" className="settings-button" data-catalogue-browse onClick={() => setBrowsing(true)}>Browse…</button>}
      <button type="button" className="settings-button" disabled={refreshing} onClick={() => { setRefreshing(true); void loadSuite().finally(() => setRefreshing(false)); }}>{refreshing ? "Reading…" : "Refresh"}</button>
    </Row>
    <details className="settings-model-policies" data-settings-row="model:ranking-policy">
      <summary>About model policies</summary>
      <p className="settings-muted">A launch with an explicit model policy uses that policy before the saved harness default. This catalogue does not choose a policy or change a chat.</p>
      <p className="settings-muted">AIKit policy choices: {RANKING_POLICIES.map(policy => policy.label).join(" · ")}.</p>
    </details>
    {browsing && <CatalogueDialog entries={entries} data={data} onClose={() => setBrowsing(false)}/>}
  </section>;
}
