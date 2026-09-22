/**
 * The Factory sidebar's labelled dev scenarios (handoff §8): one quiet
 * dev-only select, never part of a production bundle. Selecting a scenario
 * loads its typed fixture; the planes' own controls mutate it.
 */
import {appendArrival, SCENARIOS, activeScenario, exitScenarios, setScenario} from "./sidebarModel";
import {peekDeskFixture, simulateDeskFixtureUpdate} from "../desk/deskModel";
import "./sidebar.css";

export function ScenarioBar() {
  if (!import.meta.env.DEV) return null;
  const active = activeScenario();
  // The desk scenario seeds the board's own fixture rows (not a sidebar
  // fixture), so its presence is what marks it active here.
  const deskFixtureActive = Boolean(peekDeskFixture());
  return <div className="oi-side-scenarios">
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
    {deskFixtureActive && <button className="oi-action" onClick={simulateDeskFixtureUpdate}>Simulate update</button>}
  </div>;
}
