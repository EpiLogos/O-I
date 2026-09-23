/**
 * The Settings page — the centre in Settings mode (docs/cradle/12-SETTINGS.md).
 *
 * The left frame's body is the section list (`SettingsNavigator`); this is
 * the page it chooses: a header (the section's name, its own actions,
 * Search settings, Back to work), the section, and — only while something
 * is staged — the pending strip and its one review sheet. Back to work (or
 * Escape with nothing pending) returns to the previous mode.
 */
import {useEffect, useMemo, useRef, useState} from "react";
import {ensureSettingsLoaded, refreshAll, useSettings} from "./settingsData";
import {goTo, placeLabel, useSettingsNav} from "./settingsNav";
import {stagedChanges} from "./changeModel";
import {PendingStrip, ReviewSheet} from "./ReviewSheet";
import {searchIndex, searchSettings} from "./settingsSearch";
import {StatusSection} from "./sections/StatusSection";
import {HarnessesSection} from "./sections/HarnessesSection";
import {ModelsSection} from "./sections/ModelsSection";
import {CredentialsSection, discoverKeys, type Discovery} from "./sections/CredentialsSection";
import {SkillScopeSwitch, SkillsSection} from "./sections/SkillsSection";
import {ProfilesSection} from "./sections/ProfilesSection";
import {PermissionsSection} from "./sections/PermissionsSection";
import {ProductSection} from "./sections/ProductSection";
import {VisualsView} from "./VisualsView";
import {Reading, Unreadable} from "./rows";
import {FixtureConsole} from "./FixtureConsole";
import {AgentSetupReturn} from "../../agency/AgentSetupReturn";
import {AGENT_SETUP_EVENT, agentSetupSnapshot} from "../../agency/agentSetup";
import "./settings-page.css";

function backToWork() {
  window.dispatchEvent(new Event("oi:close-settings"));
}

function Search() {
  const data = useSettings();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const index = useMemo(() => searchIndex(data), [data]);
  const results = useMemo(() => searchSettings(index, query), [index, query]);
  const land = (at: number) => {
    const hit = results[at];
    if (!hit) return;
    goTo(hit.place, hit.row);
    setOpen(false); setQuery("");
  };
  return <div className="settings-search" data-settings-search>
    {open
      ? <input ref={input} className="settings-input settings-search-input" type="search" autoFocus placeholder="Search settings" aria-label="Search settings"
          value={query} onChange={(event) => { setQuery(event.target.value); setActive(0); }}
          onBlur={() => window.setTimeout(() => { if (!query) setOpen(false); }, 150)}
          onKeyDown={(event) => {
            if (event.key === "Escape") { event.stopPropagation(); event.preventDefault(); setOpen(false); setQuery(""); }
            if (event.key === "ArrowDown") { event.preventDefault(); setActive((value) => Math.min(value + 1, results.length - 1)); }
            if (event.key === "ArrowUp") { event.preventDefault(); setActive((value) => Math.max(value - 1, 0)); }
            if (event.key === "Enter") { event.preventDefault(); land(active); }
          }}/>
      : <button type="button" className="settings-button settings-search-button" data-settings-search-open onClick={() => setOpen(true)}>
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>
          Search settings
        </button>}
    {open && query.trim() && <ul className="settings-popover settings-search-results" role="listbox" aria-label="Settings found" data-settings-search-results>
      {results.length === 0 && <li className="settings-muted">Nothing matches “{query.trim()}”.</li>}
      {results.map((hit, at) => <li key={`${hit.where}:${hit.label}:${hit.row}`} role="option" aria-selected={at === active}>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => land(at)} data-search-hit={hit.row ?? hit.label}>
          <strong>{hit.label}</strong><span>{hit.where}</span>
        </button>
      </li>)}
    </ul>}
  </div>;
}

export function SettingsPage() {
  const data = useSettings();
  const nav = useSettingsNav();
  const [reviewing, setReviewing] = useState(false);
  const [discovery, setDiscovery] = useState<Discovery>({state: "idle", findings: []});
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => ensureSettingsLoaded(), []);
  // An Agent-setup excursion (agency/agentSetup.ts) lands on the section
  // that repairs it; its return control rides in the header.
  useEffect(() => {
    const land = () => {
      const destination = agentSetupSnapshot()?.destination;
      if (!destination) return;
      const section = ({credentials: "credentials", skills: "skills", harness: "harnesses"} as const)[destination.topic as "credentials" | "skills" | "harness"];
      goTo(section ? {kind: "section", id: section} : {kind: "product", id: destination.owner}, destination.settingRef ? `setting:${destination.settingRef}` : null);
    };
    land();
    window.addEventListener(AGENT_SETUP_EVENT, land);
    return () => window.removeEventListener(AGENT_SETUP_EVENT, land);
  }, []);
  const changes = stagedChanges(data);
  const pendingRef = useRef(changes.length);
  pendingRef.current = changes.length;
  // Escape with nothing pending (and nothing open above the page) goes back.
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || reviewing) return;
      if (pendingRef.current > 0) return;
      if ((event.target as HTMLElement | null)?.closest?.("input,textarea,select,[role=dialog]")) return;
      if (!body.current?.isConnected || body.current.closest("[hidden]")) return;
      event.preventDefault();
      backToWork();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [reviewing]);
  // A search result (or a review row) lands on its exact row.
  useEffect(() => {
    if (!nav.focusRow) return;
    let tries = 0;
    const timer = window.setInterval(() => {
      const row = body.current?.querySelector<HTMLElement>(`[data-settings-row="${CSS.escape(nav.focusRow!)}"]`);
      if (row || ++tries > 40) {
        window.clearInterval(timer);
        if (!row) return;
        row.scrollIntoView({block: "center"});
        row.classList.add("is-landed");
        row.setAttribute("data-landed", "true");
        window.setTimeout(() => { row.classList.remove("is-landed"); row.removeAttribute("data-landed"); }, 2400);
      }
    }, 50);
    return () => window.clearInterval(timer);
  }, [nav.focusRow, nav.focusSeq]);
  const place = nav.place;
  const everythingFailed = [data.suite, data.registry, data.owners, data.credentials].every((part) => part.state === "failed");
  const anyRead = [data.suite, data.registry, data.owners, data.credentials, data.census].some((part) => part.state !== "reading");
  return <section className="settings-page" aria-label="Settings" data-settings-page data-settings-place={`${place.kind}:${place.id}`}>
    <header className="settings-page-header">
      <h1>{placeLabel(place)}</h1>
      <div className="settings-page-actions">
        {place.kind === "section" && place.id === "skills" && <SkillScopeSwitch/>}
        {place.kind === "section" && place.id === "credentials" && <button type="button" className="settings-button" data-credential-discover
          disabled={discovery.state === "reading"} onClick={() => { setDiscovery({state: "reading", findings: []}); void discoverKeys().then(setDiscovery); }}>Look for keys on this machine</button>}
        <Search/>
        <button type="button" className="settings-button" data-settings-back onClick={backToWork}>Back to work</button>
      </div>
    </header>
    <AgentSetupReturn/>
    {data.registry.state === "ok" && data.registry.value.source === "fixture" && <p className="settings-muted" data-config-source="fixture">A worked example for development (the fixture world) — not this machine's settings.</p>}
    <div className="settings-page-body" ref={body}>
      {!anyRead ? <Reading/>
        : everythingFailed && data.suite.state === "failed" ? <Unreadable error={data.suite.error} onRetry={() => void refreshAll()}/>
        : place.kind === "product" ? <ProductSection key={place.id} id={place.id} data={data}/>
        : place.id === "status" ? <StatusSection data={data}/>
        : place.id === "harnesses" ? <HarnessesSection data={data}/>
        : place.id === "models" ? <ModelsSection data={data}/>
        : place.id === "credentials" ? <CredentialsSection data={data} discovery={discovery}/>
        : place.id === "skills" ? <SkillsSection data={data}/>
        : place.id === "profiles" ? <ProfilesSection data={data}/>
        : place.id === "permissions" ? <PermissionsSection data={data}/>
        : <div className="settings-appearance" data-appearance-panel><VisualsView/></div>}
    </div>
    {data.registry.state === "ok" && data.registry.value.source === "fixture" && <FixtureConsole/>}
    <PendingStrip changes={changes} onReview={() => setReviewing(true)}/>
    {reviewing && <ReviewSheet changes={changes} onClose={() => setReviewing(false)}/>}
  </section>;
}
