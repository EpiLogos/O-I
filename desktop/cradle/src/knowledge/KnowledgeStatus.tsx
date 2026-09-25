import {useEffect, useState} from "react";
import type {KernelTransportStatus} from "../kernel/types";
import {knowledge} from "./client";

interface Provider {provider: string; available: boolean; detail?: string; indexed?: boolean}
export interface KnowledgeStatusReading {
  sources: Provider[];
  wiki?: Provider;
  code?: Provider;
  project_map: boolean;
  absences: string[];
  notes: string[];
  authored_pending: {project: string; unresolved_targets: number; occurrences: number}[];
}
export function readKnowledgeStatus(value: unknown): KnowledgeStatusReading {
  const row = value as Partial<KnowledgeStatusReading> | null;
  const provider = (item: unknown): item is Provider => {
    const value = item as Partial<Provider> | null;
    return !!value && typeof value.provider === "string" && typeof value.available === "boolean";
  };
  if (!row || !Array.isArray(row.sources) || !row.sources.every(provider) || typeof row.project_map !== "boolean"
    || (row.wiki != null && !provider(row.wiki)) || (row.code != null && !provider(row.code))) {
    throw new Error("AIKit returned an unreadable source status.");
  }
  const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  return {...row, sources: row.sources, project_map: row.project_map, absences: strings(row.absences), notes: strings(row.notes),
    authored_pending: Array.isArray(row.authored_pending) ? row.authored_pending.filter(item => typeof item?.project === "string" && Number.isInteger(item.unresolved_targets) && Number.isInteger(item.occurrences)) : []};
}
function providerName(ref: string) {
  return ref.replace(/^provider[/:](?:source-pool[/:])?/, "").replace(/[-_]/g, " ");
}
export function KnowledgeStatusContent({reading}: {reading: KnowledgeStatusReading}) {
  const providers = [...(reading.wiki ? [reading.wiki] : []), ...reading.sources, ...(reading.code ? [reading.code] : [])];
  return <>
    <ul>{providers.map((provider, index) => <li key={`${provider.provider}:${index}`}><strong>{providerName(provider.provider)}</strong> — {provider.available ? "Available" : "Unavailable"}
      {provider.indexed === false && " · not indexed"}{provider.detail && <p>{provider.detail}</p>}</li>)}</ul>
    <p>Project map: {reading.project_map ? "available" : "unavailable"}.</p>
    {reading.notes.length > 0 && <details><summary>Coverage and freshness</summary>{reading.notes.map((note, index) => <p key={index}>{note}</p>)}</details>}
    {reading.absences.length > 0 && <details open><summary>Unavailable or incomplete sources</summary>{reading.absences.map((note, index) => <p key={index}>{note}</p>)}</details>}
    {reading.authored_pending.length > 0 && <details><summary>Unresolved authored links</summary><ul>{reading.authored_pending.map(row => <li key={row.project}>{row.project}: {row.unresolved_targets} unresolved targets across {row.occurrences} links.</li>)}</ul></details>}
  </>;
}
export function KnowledgeStatus({transport, project}: {transport: KernelTransportStatus; project?: string}) {
  const [reading, setReading] = useState<KnowledgeStatusReading>();
  const [error, setError] = useState<string>();
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    let live = true;
    setReading(undefined); setError(undefined);
    void knowledge<unknown>(transport, project, {action: "status"}, {fresh: true}).then(value => {
      const next = readKnowledgeStatus(value);
      if (live) setReading(next);
    }).catch(failure => { if (live) setError(failure instanceof Error ? failure.message : String(failure)); });
    return () => {live = false;};
  }, [transport, project, generation]);
  return <section aria-label="Knowledge source status"><header><strong>Sources</strong> <button onClick={() => setGeneration(value => value + 1)}>Refresh sources</button></header>
    {error ? <p role="alert">{error}</p> : reading ? <KnowledgeStatusContent reading={reading}/> : <p role="status">Reading source coverage…</p>}
  </section>;
}
