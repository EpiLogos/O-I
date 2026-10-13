// The Earth projection's admission into the shell (T-ATLAS-HOST): one centre panel for the lens bar, and the atlas as the
// `projection.earth` and `projection.constellation` pane kinds through the cradle's module door
// (desktop/cradle/src/surface/projectionModules.ts). Called once from App.tsx.

import {registerPanel} from '../../shell/panels'
import {detectTransport} from '../../../../../../desktop/cradle/src/kernel/bridge'
import {registerProjectionModule, type ProjectionModuleHandle} from '../../../../../../desktop/cradle/src/surface/projectionModules'
import {AtlasEarthPane, attachAtlas, type AtlasView} from './AtlasProjectionPanel'

export const ATLAS_PANEL_ID = 'projection.earth'
export const ATLAS_MODULE_ID = 'atlas-earth'

let registered = false

export function registerAtlasHost(): void {
  if (registered) return
  registered = true
  registerPanel({
    id: ATLAS_PANEL_ID,
    title: 'Earth',
    slot: 'center',
    component: AtlasEarthPane,
    navigation: false,
    order: 30,
    note: 'The Archetypal-Earth atlas: the globe and the graph over the World\'s corpus',
  })
  registerProjectionModule({id: ATLAS_MODULE_ID, kind: 'projection.earth', create: context => mountKind(context.element, 'earth')})
  registerProjectionModule({id: ATLAS_MODULE_ID, kind: 'projection.constellation', create: context => mountKind(context.element, 'graph')})
}

/** The module door's mount: the same atlas, in a pane of its kind, with the kind's fixed view. */
async function mountKind(element: HTMLElement, view: AtlasView): Promise<ProjectionModuleHandle> {
  const attachment = await attachAtlas({element, transport: detectTransport(), follow: false, view})
  return {
    setVisible: visible => attachment.setVisible(visible),
    unmount: () => attachment.unmount(),
  }
}
