import {registerPanel} from '../shell/panels'
import {loadWhenDrawn} from '../shell/loadWhenDrawn'

// The Workbench (its terminal, files and sessions) loads when its panel first draws, not with the shell (shell/loadWhenDrawn.ts).
const NativeWorkbench = loadWhenDrawn('Workbench', () => import('../native/Workbench').then(module => module.NativeWorkbench))
registerPanel({id: 'native.workbench', title: 'Workbench', slot: 'center', component: () => <NativeWorkbench/>, navigation: true, order: 15, note: 'Native sources, sessions and registered contribution bodies in the continuity workspace'})
