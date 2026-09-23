/**
 * The dev-only fixture-world console, rendered only when a walk build was
 * asked for the fixture world (`?fixtures=1`, 12-SETTINGS §5). It drives the
 * generic-projection proofs (an owner outage, the empty registry, a section
 * shipped mid-walk) through the build-gated seam in sourceHost — never a
 * production chunk.
 */
import {useState} from "react";
import {fixtureWorld, type FixtureWorldActions} from "../../configuration/sourceHost";
import {refreshAll} from "./settingsData";

export function FixtureConsole() {
  const [empty, setEmpty] = useState(false);
  const [workcellOut, setWorkcellOut] = useState(false);
  const mutate = async (action: (world: FixtureWorldActions) => Promise<void> | void) => {
    const world = await fixtureWorld();
    if (!world) return;
    await action(world);
    await refreshAll();
  };
  return <details className="settings-disclosure" data-config-fixture-console>
    <summary>Fixture world console (development)</summary>
    <p className="settings-muted">Simulates the re-read laws against the fixture world. Nothing here exists in a production build.</p>
    <div className="settings-card-actions">
      <button type="button" className="settings-button" data-config-registry-mode onClick={() => void mutate((world) => {world.setRegistryMode(empty ? "full" : "empty"); setEmpty(!empty);})}>{empty ? "Restore the full registry" : "Empty the registry (bootstrap world)"}</button>
      <button type="button" className="settings-button" data-config-workcell-outage onClick={() => void mutate((world) => {world.setOwnerAvailability("workcell", workcellOut ? "available" : "unavailable"); setWorkcellOut(!workcellOut);})}>{workcellOut ? "Restore Workcell" : "Simulate Workcell going unavailable"}</button>
      <button type="button" className="settings-button" data-config-l6-section onClick={() => void mutate((world) => {world.addFixtureSection("oi");})}>Ship a new section in a fixture descriptor (L6 proof — fixture-backed)</button>
    </div>
  </details>;
}
