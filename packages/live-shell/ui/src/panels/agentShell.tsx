import {registerPanel} from '../shell/panels'
import {AgentShellCentre} from '../agent/AgentShellRoot'

registerPanel({
  id: 'native.agent',
  title: 'Agent',
  icon: 'agents',
  slot: 'center',
  component: () => <AgentShellCentre />,
  order: 12,
  navigation: true,
  note: 'Agent-native session grid, arrangement needles, and threads over real agency_read sessions',
})
