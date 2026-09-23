/** The system canvas surface (D11) — a thin host over the Settings page
 * (docs/cradle/12-SETTINGS.md). The export name, props, and
 * `CompositionReading` type are a load-bearing contract:
 * kernel/types.ts imports the type, DesktopShell/DetachedFrame/Workbench
 * mount this component as the `system` canvas surface.
 */
import {SettingsPage} from "./settings/SettingsPage";

export type {CompositionReading, NativeReading} from "./settings/types";

/** `binding` is accepted (and ignored) so this slots into SurfaceBody's call
 * convention when mounted as the `system` canvas surface. */
export function SystemPanel({binding}: {binding?: import("../surface/types").SurfaceBinding} = {}) {
  void binding;
  return <SettingsPage/>;
}
