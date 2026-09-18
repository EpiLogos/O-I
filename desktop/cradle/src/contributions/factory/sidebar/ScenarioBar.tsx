/**
 * The Factory sidebar's labelled dev scenarios (handoff §8): one quiet
 * dev-only select, never part of a production bundle. Selecting a scenario
 * loads its typed fixture; the planes' own controls mutate it.
 */
import {appendArrival, SCENARIOS, activeScenario, exitScenarios, setScenario} from "./sidebarModel";
import "./sidebar.css";

export function ScenarioBar() {
  if (!import.meta.env.DEV) return null;
  const active = activeScenario();
  return <div className="factory-side-scenarios">
    <select
      className="oi-input"
      value={active ?? ""}
      aria-label="Dev scenario"
      onChange={event => {const next = event.target.value; next ? setScenario(next) : exitScenarios();}}
    >
      <option value="">Scenario…</option>
      {SCENARIOS.map(scenario => <option key={scenario.key} value={scenario.key}>{scenario.label}</option>)}
    </select>
    {active === "history" && <button className="oi-action" onClick={appendArrival}>Simulate arrival</button>}
  </div>;
}
