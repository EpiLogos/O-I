import { useState } from 'react'

import type { PanelContext } from '../shell/panels'
import { getPanels } from '../shell/panels'
import { Icon } from './Icon'

/**
 * Right dock — THE panel registry surface. Everything registered with slot
 * 'right-dock' renders here as a stacked, collapsible card, in `order`.
 */

export function RightDock({ ctx }: { ctx: PanelContext }) {
  const panels = getPanels('right-dock')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  if (panels.length === 0) {
    return (
      <aside className="dock">
        <p className="dock-empty">
          no panels registered — this dock is the panel registry surface
          (<code>slot: 'right-dock'</code>). See <code>ui/PANELS.md</code>.
        </p>
      </aside>
    )
  }

  return (
    <aside className="dock">
      {panels.map((p) => {
        const isCollapsed = collapsed[p.id] ?? false
        const Panel = p.component
        return (
          <section key={p.id} className="dock-panel">
            <button
              type="button"
              className="dock-panel-header"
              title={p.note ?? p.title}
              onClick={() => setCollapsed((c) => ({ ...c, [p.id]: !isCollapsed }))}
            >
              {p.icon && <Icon name={p.icon} size={12} />}
              <span className="dock-panel-title">{p.title}</span>
              <span className={'dock-panel-chevron' + (isCollapsed ? ' is-collapsed' : '')}>
                <Icon name="chevron" size={12} />
              </span>
            </button>
            {!isCollapsed && (
              <div className="dock-panel-body">
                <Panel {...ctx} />
              </div>
            )}
          </section>
        )
      })}
    </aside>
  )
}
