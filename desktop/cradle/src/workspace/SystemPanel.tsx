/** The system canvas surface (D11) — a thin host over the System Settings
 * page (docs/cradle/06-SYSTEM-SETTINGS.md). The export name, props, and
 * `CompositionReading` type are a load-bearing contract:
 * kernel/types.ts imports the type, DesktopShell/DetachedFrame/Workbench
 * mount this component, and the system walk asserts the rendered census.
 */
import {SettingsPage} from "./settings/SettingsPage";

export type {CompositionReading, NativeReading} from "./settings/types";

/** Native S disclosure only. Registration never stands in for runtime
 * readiness. `binding` is accepted (and ignored) so this slots into
 * SurfaceBody's call convention when mounted as the `system` canvas
 * surface (D11: System is a canvas surface opened from the sidebar, not a
 * right-plane inspector). */
export function SystemPanel({binding}: {binding?: import("../surface/types").SurfaceBinding} = {}) {
  void binding;
  return <SettingsPage/>;
}
