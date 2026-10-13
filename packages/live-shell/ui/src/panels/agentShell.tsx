import {registerPanel} from '../shell/panels'

// The agent surface is the Factory Workbench tree's default tab (agent/factoryCentre.ts): its body is mounted by the tree's
// conversation node (native/Workbench.tsx). This registration keeps the `native.agent` id valid for saved views and mounts no
// second agent body, so the sessions poll has one owner.
registerPanel({
  id: 'native.agent',
  title: 'Agent',
  icon: 'agents',
  slot: 'center',
  component: () => null,
  order: 12,
  navigation: false,
  note: 'Retired centre id: the agent surface is the Factory Workbench tree\'s default tab',
})
