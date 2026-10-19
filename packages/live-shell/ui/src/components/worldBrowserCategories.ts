// Expressions' categories in the one browser (F6), apart from the browser itself: the browser table names them before the
// browser's own code has loaded (shell/modeBrowsers.tsx; shell/loadWhenDrawn.ts).
import type {BrowserCategory as OneBrowserCategory, BrowserKind} from '../frame/browser/browserKinds'

export type BrowserCategory = 'works' | 'material' | 'objects' | 'properties' | 'devices' | 'files' | 'knowledge'
export const CATEGORIES: {id: BrowserCategory; name: string; icon: string}[] = [
  {id: 'works', name: 'Expressions', icon: '◇'},
  {id: 'material', name: 'Material', icon: '▧'},
  {id: 'objects', name: 'Objects', icon: '+'},
  {id: 'properties', name: 'Parameters', icon: '○'},
  {id: 'devices', name: 'Devices', icon: '▤'},
  {id: 'files', name: 'Files', icon: '▸'},
  {id: 'knowledge', name: 'Knowledge', icon: '⌘'},
]

/** Each Expressions category's kind in the one browser (F6): works, material and files are material to open; objects,
 * parameters and devices go on the open scene's chain; knowledge opens instruments over the work. */
export const WORLD_KINDS: Record<BrowserCategory, BrowserKind> = {works: 'material', material: 'material', files: 'material', objects: 'devices', properties: 'devices', devices: 'devices', knowledge: 'instruments'}
export const WORLD_BROWSER_CATEGORIES: readonly OneBrowserCategory[] = CATEGORIES.map(row => ({id: row.id, label: row.name, kind: WORLD_KINDS[row.id], mark: row.icon}))
