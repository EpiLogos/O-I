import {useState, type CSSProperties} from 'react'
import {createRoot} from 'react-dom/client'
import {StubWorkspaceProvider} from '../shell/workspaceContext'
import {AgentShellProvider, useAgentShell} from './AgentShellContext'
import {AgentShellTransport} from './AgentShellTransport'
import {AgentShellBrowser} from './AgentShellBrowser'
import {AgentContextDock} from './AgentContextDock'
import {AgentSessionGrid} from './AgentSessionGrid'
import {AgentArrangementView} from './AgentArrangementView'
import {AgentShellDeviceDetail} from './AgentShellDeviceDetail'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {loadAgentShellFamilies} from '../inhabitants/loadAgentShellFamilies'
import '../styles.css'
import './agentShell.css'

// The fixture stands on the real shell's family admission (same as main.tsx)
// so the device pool renders its real rows — with the refusal note, not a
// fabricated one.
loadAgentShellFamilies()

/**
 * The F2 refusal fixture: the real agent-shell components over an
 * unavailable transport and EMPTY agency data. It shows only what the shell
 * honestly discloses when no kernel is attached — no fabricated rows, no
 * fabricated telemetry. The live oracle path (tests/agent-shell-live.browser.mjs)
 * is the one that exercises native.agent against the F1 oracle; this fixture
 * exists so the refusal behaviour itself stays checkable offline.
 */
export const FIXTURE_TRANSPORT = {
  kind: 'unavailable',
  reason: 'kernel not attached — refusal harness',
} as const satisfies KernelTransportStatus

function Stage() {
  const shell = useAgentShell()
  const [browser, setBrowser] = useState(true)
  const [detail, setDetail] = useState(true)
  const [dock, setDock] = useState(true)
  const [running, setRunning] = useState(false)
  return (
    <div
      className={`frame agent-shell-frame${browser ? '' : ' browser-hidden'}${detail ? '' : ' detail-hidden'}${dock ? ' dock-open' : ''}`}
      style={{['--dock-w' as string]: `${shell.dockWidth}px`} as CSSProperties}
      data-agent-shell="true"
    >
      <AgentShellTransport
        title="Agent sessions"
        browser={browser}
        detail={detail}
        dock={dock}
        toggleBrowser={() => setBrowser(value => !value)}
        toggleDetail={() => setDetail(value => !value)}
        toggleDock={() => setDock(value => !value)}
        centreView={shell.centreView === 'thread' ? 'session' : shell.centreView}
        onCentreView={view => shell.setCentreView(view)}
        running={running}
        onRun={() => setRunning(true)}
        onStop={() => setRunning(false)}
        transport={FIXTURE_TRANSPORT}
      />
      <div className="browser-residence" hidden={!browser}><AgentShellBrowser rows={[]} error={null} loading={false} /></div>
      <main className="center" data-region="centre">
        {shell.centreView === 'arrangement'
          ? <AgentArrangementView tracks={[]} error={null} />
          : <AgentSessionGrid tracks={[]} />}
      </main>
      <div className="dock-residence" hidden={!dock}><AgentContextDock /></div>
      <div className="detail-residence" hidden={!detail}><AgentShellDeviceDetail tracks={[]} /></div>
      <footer className="statusbar" data-region="status-bar" role="status">Agent shell refusal fixture — {FIXTURE_TRANSPORT.reason}</footer>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StubWorkspaceProvider transport={FIXTURE_TRANSPORT}>
    <AgentShellProvider>
      <Stage />
    </AgentShellProvider>
  </StubWorkspaceProvider>,
)

Object.assign(window, {__agentShellFixture: true})
