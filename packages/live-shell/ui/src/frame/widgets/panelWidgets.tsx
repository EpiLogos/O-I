// The widget docking contract (FOUNDATION §4: "widget: `PanelRegistration` slot `right-dock`"): a panel a family registers in
// the slot stands in the one rail as a widget, under its title and mark, its body the panel over the open set's context the
// rail's reading carries. Until 15 Oct the slot's only reader was the right dock the rail replaced (F8), so no family's widget
// showed. Pure apart from the body's one hook; shell/widgets.tsx composes it after the rail's own widgets.
import type {ComponentType} from 'react'
import type {PanelRegistration} from '../../shell/panels'
import type {WidgetBodyProps, WidgetDeclaration} from './widgets'
import {isIconName} from '../../inhabitants/sdk/Icon'
import {useWidgetReading} from '../../widgets/widgetReading'

/** One body per panel component, kept, so a render never remounts it. */
const bodies = new WeakMap<PanelRegistration['component'], ComponentType<WidgetBodyProps>>()
function panelBody(panel: PanelRegistration): ComponentType<WidgetBodyProps> {
  const held = bodies.get(panel.component)
  if (held) return held
  const Panel = panel.component
  const Body = function PanelWidget() {
    const reading = useWidgetReading()
    return reading?.panel ? <Panel {...reading.panel} /> : null
  }
  bodies.set(panel.component, Body)
  return Body
}

/** The slot's panels as widgets, in the registry's order, leaving out an id the rail already holds. */
export function panelWidgets(panels: readonly PanelRegistration[], taken: ReadonlySet<string>): WidgetDeclaration[] {
  return panels.filter(panel => !taken.has(panel.id)).map((panel): WidgetDeclaration => ({
    id: panel.id, name: panel.title, mark: panel.icon && isIconName(panel.icon) ? panel.icon : 'dock', hint: panel.note, Body: panelBody(panel)}))
}
