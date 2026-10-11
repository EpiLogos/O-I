import {registerPanel} from '../shell/panels'
import {NativeContextPanel} from '../components/NativeContextPanel'
registerPanel({id: 'native.context', title: 'Agents & context', icon: 'agents', slot: 'right-dock', component: () => <NativeContextPanel />, order: 10, note: 'Native agents, selected material and operation receipts'})
