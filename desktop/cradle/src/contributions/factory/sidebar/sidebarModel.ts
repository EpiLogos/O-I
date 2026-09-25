/**
 * What the composition root lends the Factory sidebar planes (FACTORY-UI-
 * INTEGRATION-HANDOFF §4/§8): the real ways to reach the rest of the app, so
 * a control never has to fake an outcome.
 *
 * The planes' working subject is NOT held here: the Run | Agents | Context
 * planes read the desk store's one held selection (`deskStore.ts`) — the
 * centre publishes it, the sidebar reads it, and there is no second
 * selection path. A former dev-fixture store that lived in this module was
 * deleted 2026-09-25: its scenario bar mounted nowhere and its board fixture
 * rows were seeded into a store nothing read — unreachable wiring waiting to
 * be mistaken for the live path.
 */
import type {EncounterRow} from "../../../encounter/EncounterList";

export interface FactoryPanelHost {
  /** Focus the centre's full SSSF multi-lane Run view (the factory surface). */
  onOpenFullRun?: () => void;
  /** Take the panel to its full depth (the shell's right-depth full state). */
  onExpandPanel?: () => void;
  /** Switch the Factory sidebar to another top-level plane (e.g. Context for a comparison). */
  onOpenPlane?: (plane: "run" | "agents" | "factory-context") => void;
  /** Open a conversation as the centre's Chat tab (the one open path). */
  onOpenEncounterRow?: (row: EncounterRow) => Promise<void> | void;
}
