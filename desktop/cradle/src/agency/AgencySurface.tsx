import {NativeAgentLauncher} from "./NativeAgentLauncher";
/**
 * AgencySurface — fills its host, composes the roster, mint flow and
 * Guardian repertoire (COMMON-BRIEF §handoff 2/3/7). Owns no scrolling
 * document: it is `height:100%; min-height:0` and scrolls its own body.
 * Workspace-level errors go to `onMessage`, never an inline banner here.
 */
import { useEffect, useState } from "react";
import { useKernel } from "../kernel/KernelProvider";
import { AgencyRoster } from "./AgencyRoster";
import { AgentDetail } from "./AgentDetail";
import { MintAgent } from "./MintAgent";
import { GuardianRepertoire } from "./GuardianRepertoire";
import { readAgency } from "./agencySources";
import type { AgencyReading, AgencySessionRow } from "./agencyTypes";
import "./agency.css";

type AgencyView = "roster" | "mint" | "guardians";

export function AgencySurface({ project, onMessage, onOpenSettings }: { project?: string; onMessage?: (message: string) => void; onOpenSettings?: () => void }) {
  const kernel = useKernel();
  const [view, setView] = useState<AgencyView>("roster");
  const [reading, setReading] = useState<AgencyReading | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AgencySessionRow | null>(null);

  useEffect(() => {
    let live = true;
    setPending(true);
    void readAgency(kernel.transport, project??"").then((outcome) => {
      if (!live) return;
      if ("error" in outcome) { setError(outcome.error); return; }
      setError(null);
      setReading(outcome.reading);
      setSelected((current) => (current && outcome.reading.rows.some((row) => row.sessionRef === current.sessionRef)) ? current : null);
    }).finally(() => { if (live) setPending(false); });
    return () => { live = false; };
  }, [project, kernel.transport]);

  // Fixture-backed dev sources — never a production data path (COMMON-BRIEF
  // fixture rule). Imported dynamically so the module never ships in a
  // build that does not ask for it.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!new URLSearchParams(location.search).has("fixtures")) return;
    let cleanup: (() => void) | undefined;
    void import("./fixtures.dev").then((module) => { cleanup = module.installAgencyFixtures(); });
    return () => cleanup?.();
  }, []);

  return <div className="agency-surface">
    <header className="oi-panel-head">
      <span className="oi-eyebrow">Agency · {project??"Central root"}</span>
      <div className="oi-segment" role="tablist" aria-label="Agency view">
        <button type="button" role="tab" aria-selected={view === "roster"} onClick={() => setView("roster")}>Roster</button>
        <button type="button" role="tab" aria-selected={view === "mint"} onClick={() => setView("mint")}>Mint Agent</button>
        <button type="button" role="tab" aria-selected={view === "guardians"} onClick={() => setView("guardians")}>Guardians</button>
      </div>
    </header>

    <div className="agency-body oi-scroll">
      {view === "roster" && (
        <div><NativeAgentLauncher project={project}/><div className="agency-roster-layout">
          <AgencyRoster reading={reading} pending={pending} error={error} selected={selected} onSelect={setSelected}/>
          {selected
            ? <AgentDetail row={selected} siblingSessions={reading?.rows.filter((row) => row.spaceRef === selected.spaceRef) ?? []}/>
            : <div className="oi-empty agency-detail-placeholder"><span>Select a session to see its Purpose, Skills & tools, Sessions, Knowledge and History.</span></div>}
        </div></div>
      )}
      {view === "mint" && <MintAgent project={project} onMessage={onMessage}/>}
      {view === "guardians" && <GuardianRepertoire project={project}/>}
    </div>

    {onOpenSettings && (
      <footer className="agency-settings-link">
        <button type="button" className="oi-action" onClick={onOpenSettings}>System settings manages sources, providers, projection, telemetry, search and history</button>
      </footer>
    )}
  </div>;
}
