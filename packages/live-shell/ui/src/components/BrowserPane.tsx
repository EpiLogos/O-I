import { useEffect, useState } from 'react'

import type { PanelContext } from '../shell/panels'
import { getPanels } from '../shell/panels'
import { Icon } from './Icon'

/**
 * Left browser pane: Sets / Devices / Elements.
 *
 * "Elements" is the integration surface — panels other agents register with
 * slot 'browser-section' render there without frame changes.
 */

const RECENTS_KEY = 'live-shell.recent.sets'
const RECENTS_MAX = 8

function loadRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as string[]).filter((p) => typeof p === 'string') : []
  } catch {
    return []
  }
}

function rememberRecent(path: string): string[] {
  const next = [path, ...loadRecents().filter((p) => p !== path)].slice(0, RECENTS_MAX)
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
  } catch {
    /* private mode — recents just don't persist */
  }
  return next
}

function baseName(p: string): string {
  return p.replaceAll('\\', '/').split('/').pop() || p
}

/** Devices with gated models or RE-lane work items, per SHELL-BLUEPRINT.md. */
const MODELED_DEVICES = [
  { name: 'Glue Compressor', tag: 'M3', note: 'modeled in live-dynamics' },
  { name: 'Echo', tag: 'M3', note: 'modeled in live-dynamics' },
  { name: 'Reverb', tag: 'M3', note: 'modeled in live-dynamics' },
  { name: 'Operator', tag: 'M6', note: 'RE lane — voice models pending' },
  { name: 'Wavetable', tag: 'M6', note: 'RE lane — voice models pending' },
]

export function BrowserPane({
  defaultSet,
  ctx,
}: {
  defaultSet: string
  ctx: PanelContext
}) {
  const openSet = ctx.openSet
  const [recents, setRecents] = useState<string[]>(() => loadRecents())
  const [draft, setDraft] = useState('')

  // The server's command-line set is pinned at the top of Sets until the
  // user opens something else.
  const [opened, setOpened] = useState<string | null>(null)
  useEffect(() => {
    if (defaultSet) setRecents(rememberRecent(defaultSet))
  }, [defaultSet])

  const open = (path: string) => {
    if (!path.trim()) return
    setOpened(path)
    setRecents(rememberRecent(path))
    openSet(path)
  }

  const sets = [
    ...(defaultSet ? [defaultSet] : []),
    ...recents.filter((p) => p !== defaultSet),
  ]

  const sectionPanels = getPanels('browser-section')

  return (
    <aside className="browser">
      <section className="browser-section">
        <h2 className="micro-label browser-heading">Sets</h2>
        <form
          className="browser-open"
          onSubmit={(e) => {
            e.preventDefault()
            open(draft)
            setDraft('')
          }}
        >
          <input
            className="browser-open-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="open .als by absolute path…"
            spellCheck={false}
          />
          <button className="browser-open-btn" type="submit" title="Open set">
            <Icon name="folder" size={13} />
          </button>
        </form>
        <ul className="browser-list">
          {sets.length === 0 && (
            <li className="browser-empty">
              no sets yet — open one by path, or start the server with one:
              cargo run -- &lt;set.als&gt;
            </li>
          )}
          {sets.map((p) => (
            <li key={p}>
              <button
                type="button"
                className={
                  'browser-item' + (p === opened ? ' browser-item-active' : '')
                }
                onClick={() => open(p)}
                title={p}
              >
                <Icon name="set" size={12} />
                <span className="browser-item-name">{baseName(p)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="browser-section">
        <h2 className="micro-label browser-heading">Devices</h2>
        <ul className="browser-list">
          {MODELED_DEVICES.map((d) => (
            <li key={d.name}>
              <button
                type="button"
                className="browser-item browser-item-static"
                title={`Drag to a track — device drag/drop lands M3 (device hosting). ${d.note}.`}
                draggable={false}
              >
                <Icon name="device" size={12} />
                <span className="browser-item-name">{d.name}</span>
                <span className="tag">{d.tag}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="browser-section browser-section-elements">
        <h2 className="micro-label browser-heading">Elements</h2>
        {sectionPanels.length === 0 ? (
          <p className="browser-empty">
            Panels other agents register with slot{' '}
            <code>'browser-section'</code> appear here — see{' '}
            <code>ui/PANELS.md</code>.
          </p>
        ) : (
          <div className="browser-elements">
            {sectionPanels.map((p) => {
              const SectionPanel = p.component
              return <SectionPanel key={p.id} {...ctx} />
            })}
          </div>
        )}
      </section>
    </aside>
  )
}
