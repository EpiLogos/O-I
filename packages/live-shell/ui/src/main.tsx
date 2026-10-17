import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './styles.css'
import './shell/theme' // the theme library's blocks; the chosen theme paints through styles.css's bridge
import './panels' // builtin panel registration — third-party panels import here too
import {loadAgentShellFamilies} from './inhabitants/loadAgentShellFamilies'
loadAgentShellFamilies()
import { App } from './App'
import { WorkspaceProvider } from './shell/workspace'
import { ContinuityProvider } from './continuity/workspace'
import {NativeFoundation} from './native/Foundation'
import {NativeDetached} from './native/Detached'
import {NativeApplicationClose} from './native/ApplicationClose'
import {AgentSessionsProvider} from './agent/AgentSessionsProvider'
import {nativeHost} from './native/application'

// The native window draws its traffic lights over the content (tauri.candidate.conf.json titleBarStyle "Overlay"); the
// transport's controls row stands in that band at the mockup's 46px, so the frame insets it past them (styles.css).
if (nativeHost() && /Mac/i.test(navigator.platform || navigator.userAgent)) document.documentElement.dataset.windowChrome = 'overlay'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ContinuityProvider><WorkspaceProvider><NativeApplicationClose/><NativeFoundation>{window.__OI_DETACHED__ ? <NativeDetached /> : <AgentSessionsProvider><App /></AgentSessionsProvider>}</NativeFoundation></WorkspaceProvider></ContinuityProvider>
  </StrictMode>,
)
