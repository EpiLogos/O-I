// The Scenes column of the Expressions clip (the mockup's clip view, world-shell-mockup.html:1678: "Scenes" — the work's scenes side by
// side, the open one lit). A Scene is a clip of its Expression (lock §9.1); this column is the Expression's clips in the owner's order,
// each a cell with its number, its title and its working duration. Pressing one focuses it through the Scene's own call (sceneCalls.ts
// focusScene — the same call as the ‹ › of the Scene's controls), and it becomes THE selection. The cell's picture well holds what the
// owner reads of the Scene — how many objects it carries — and no drawing: the owner discloses no picture of a Scene here.
import {useRef} from 'react'
import {useTimelineReading} from '../../../projections/timelinePaneHost'
import type {NativeCompositionViewSource} from '../../../shell/compositionViews'
import {focusScene} from './sceneCalls'
import {useSceneBusy} from './sceneState'

const seconds = (value: number | null | undefined) => typeof value === 'number' && Number.isFinite(value) ? `${Number(value.toFixed(2))} s` : '—'

export function SceneStrip({source}: {source: NativeCompositionViewSource}) {
  const latest = useRef(source); latest.current = source
  const busy = useSceneBusy()
  const timeline = useTimelineReading()
  const content = source.content, scenes = content?.scenes
  if (!content || !scenes) return null
  const ready = !!source.actions && !content.standing.pending && !busy
  return <div className="ccol scene-strip" aria-label="Scenes">
    <h5>Scenes <span>{scenes.scenes.length}</span></h5>
    <ol className="scene-cells">
      {scenes.scenes.map((row, index) => {
        const open = row.scene_ref === content.basis.scene_ref
        const members = row.members.filter(member => member.state !== 'absent').length
        return <li key={row.scene_ref}>
          <button type="button" className="scene-cell" aria-pressed={open} disabled={!open && (!ready || !row.material.available)}
            title={!row.material.available ? (row.material.reason ?? 'This Scene has no authored material') : open ? 'The open Scene' : `Open ${row.title}`}
            onClick={() => { if (!open) void focusScene(source, () => latest.current, row.scene_ref, timeline) }}>
            <span className="scene-cell-well" aria-hidden="true"><b>{index + 1}</b><small>{members} object{members === 1 ? '' : 's'}</small></span>
            <span className="scene-cell-name">{index + 1} · {row.title}</span>
            <span className="scene-cell-time">{seconds(row.working?.duration ?? row.snapshot.duration)}</span>
          </button>
        </li>
      })}
    </ol>
  </div>
}
