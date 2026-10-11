import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Match Vite's extension and JSON loading for the actual production modules.
// Neither native calls nor the React external-store implementation are replaced.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
      const candidate = fileURLToPath(new URL(specifier, context.parentURL))
      if (existsSync(candidate + '.ts')) return nextResolve(pathToFileURL(candidate + '.ts').href, context)
    }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url.endsWith('/settings/native-inventory.capture.json')) {
      return { format: 'module', source: `export default ${readFileSync(new URL(url), 'utf8')};`, shortCircuit: true }
    }
    return nextLoad(url, context)
  },
})

const { configureSettingsHost, getSettingsHostSnapshot, openSettings } = await import('./host.ts')
const { unavailableSettingsAdapter } = await import('./adapter.ts')

test('native admission or retirement preserves the frame Return callback and contextual request', () => {
  let returned = 0
  const returnToWork = () => { returned++ }
  const request = { requestId: 'host-regression', setting_ref: 'ai-kit:skills:skills.capabilities', scope: { scope_kind: 'machine', scope_ref: null }, returnLabel: 'Agent setup' }
  configureSettingsHost(unavailableSettingsAdapter(), returnToWork)
  openSettings(request)
  const retired = unavailableSettingsAdapter('The originating native access has retired.')
  configureSettingsHost(retired)
  const current = getSettingsHostSnapshot()
  assert.equal(current.adapter, retired)
  assert.equal(current.request, request)
  assert.equal(current.onReturn, returnToWork)
  current.onReturn()
  assert.equal(returned, 1)
  assert.equal(current.adapter.canApply, false)
})

test('explicit frame teardown clears Return without clearing the current request', () => {
  const request = getSettingsHostSnapshot().request
  configureSettingsHost(unavailableSettingsAdapter(), undefined)
  assert.equal(getSettingsHostSnapshot().onReturn, undefined)
  assert.equal(getSettingsHostSnapshot().request, request)
  openSettings(null)
  assert.equal(getSettingsHostSnapshot().request, null)
})
