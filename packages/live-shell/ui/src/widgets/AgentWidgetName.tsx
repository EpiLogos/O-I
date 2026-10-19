// The agent widget's name, apart from its body (AgentWidget.tsx): the rail draws the head before the body's code has loaded
// (shell/widgets.tsx; shell/loadWhenDrawn.ts).
import {COMPANIONS} from '../shell/modeDockTiles'
import {useWidgetReading} from './widgetReading'

/** The companion's name in the mode in front of you: the agent widget's name in its head and its launcher cell. */
export function AgentWidgetName() {
  const reading = useWidgetReading()
  return <>{reading ? COMPANIONS[reading.mode].name : 'Agent'}</>
}
