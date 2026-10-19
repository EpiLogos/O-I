import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'

import './styles.css'
import './shell/theme' // the theme library's blocks; the chosen theme paints through styles.css's bridge
import './panels' // builtin panel registration — third-party panels import here too
import {loadAgentShellFamilies} from './inhabitants/loadAgentShellFamilies'
loadAgentShellFamilies()
import { WorkspaceProvider } from './shell/workspace'
import { ContinuityProvider } from './continuity/workspace'
import {NativeFoundation} from './native/Foundation'
import {NativeApplicationClose} from './native/ApplicationClose'
import {AgentSessionsProvider} from './agent/AgentSessionsProvider'
import {nativeHost} from './native/application'

// Each window loads its own frame (MAP, the build lane's loading item): the main window the shell, a device's or a page's window
// its detached frame — neither fetches the other's code before it draws (scripts/load-census.mjs counts what each loads first).
const App = lazy(() => import('./App').then(module => ({default: module.App})))
const NativeDetached = lazy(() => import('./native/Detached').then(module => ({default: module.NativeDetached})))

// The native window draws its traffic lights over the content (tauri.candidate.conf.json titleBarStyle "Overlay"); the
// transport's controls row stands in that band at the mockup's 46px, so the frame insets it past them (styles.css).
if (nativeHost() && /Mac/i.test(navigator.platform || navigator.userAgent)) document.documentElement.dataset.windowChrome = 'overlay'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ContinuityProvider><WorkspaceProvider><NativeApplicationClose/><NativeFoundation><Suspense fallback={null}>{window.__OI_DETACHED__ ? <NativeDetached /> : <AgentSessionsProvider><App /></AgentSessionsProvider>}</Suspense></NativeFoundation></WorkspaceProvider></ContinuityProvider>
  </StrictMode>,
)
