import {NativeWorkbench} from '../native/Workbench'
import {registerPanel} from '../shell/panels'
registerPanel({id: 'native.workbench', title: 'Workbench', slot: 'center', component: () => <NativeWorkbench/>, navigation: true, order: 15, note: 'Native sources, sessions and registered contribution bodies in the continuity workspace'})
