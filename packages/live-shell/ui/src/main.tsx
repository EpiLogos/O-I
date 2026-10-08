import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './styles.css'
import './panels' // builtin panel registration — third-party panels import here too
import { App } from './App'
import { WorkspaceProvider } from './shell/workspace'
import { ContinuityProvider } from './continuity/workspace'
import {NativeFoundation} from './native/Foundation'
import {NativeDetached} from './native/Detached'
import {NativeApplicationClose} from './native/ApplicationClose'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ContinuityProvider><WorkspaceProvider><NativeApplicationClose/><NativeFoundation>{window.__OI_DETACHED__ ? <NativeDetached /> : <App />}</NativeFoundation></WorkspaceProvider></ContinuityProvider>
  </StrictMode>,
)
