import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './styles.css'
import './panels' // builtin panel registration — third-party panels import here too
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
