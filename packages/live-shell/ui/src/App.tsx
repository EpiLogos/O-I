import { useCallback, useState } from 'react'

import { ArrangementView } from './components/ArrangementView'
import { BrowserPane } from './components/BrowserPane'
import { DeviceChainPanel } from './components/DeviceChainPanel'
import { RightDock } from './components/RightDock'
import { SessionView } from './components/SessionView'
import { StatusBar } from './components/StatusBar'
import { TransportBar } from './components/TransportBar'
import { useSetSummary, useShellConfig } from './shell/useSet'
import type { PanelContext } from './shell/panels'

/**
 * The Live shell application frame — the thing other agents build inside.
 *
 * CSS-grid frame: transport bar on top, browser left, Session/Arrangement
 * center, device chain bottom, panel dock right, status strip at the floor.
 * The right dock is the panel registry surface; see ui/PANELS.md.
 */

type CenterTab = 'session' | 'arrangement'

export function App() {
  const config = useShellConfig()
  const defaultSet = config?.default_set || ''
  const state = useSetSummary(defaultSet)
  const [tab, setTab] = useState<CenterTab>('session')

  const ctx = {
    set: state.set,
    loading: state.loading,
    error: state.error,
    openSet: state.open,
  } satisfies PanelContext

  const onOpenSet = useCallback(
    (path: string) => {
      state.open(path)
    },
    [state],
  )

  return (
    <div className="frame">
      <TransportBar tempoBpm={state.set ? state.set.tempo_bpm : null} />

      <BrowserPane defaultSet={defaultSet} ctx={{ ...ctx, openSet: onOpenSet }} />

      <main className="center">
        <nav className="center-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'session'}
            className={'center-tab' + (tab === 'session' ? ' center-tab-active' : '')}
            onClick={() => setTab('session')}
          >
            Session
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'arrangement'}
            className={'center-tab' + (tab === 'arrangement' ? ' center-tab-active' : '')}
            onClick={() => setTab('arrangement')}
          >
            Arrangement
          </button>
        </nav>
        <div className="center-body">
          {tab === 'session' ? (
            <SessionView set={state.set} />
          ) : (
            <ArrangementView set={state.set} />
          )}
        </div>
      </main>

      <RightDock ctx={{ ...ctx, openSet: onOpenSet }} />

      <DeviceChainPanel set={state.set} />

      <StatusBar state={state} />
    </div>
  )
}
