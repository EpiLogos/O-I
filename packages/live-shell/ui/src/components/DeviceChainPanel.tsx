import { useEffect, useState } from 'react'

import type { SetSummary } from '../shell/useSet'
import { getPanels } from '../shell/panels'
import { Icon } from './Icon'

/**
 * Bottom device-chain panel: per-track device names from the opened set as
 * chain tiles (real data). The parameters area is an honest stub — device
 * editing lands M3 — and additionally renders 'bottom'-slot panels.
 */

const KIND_LABEL: Record<string, string> = {
  audio: 'aud',
  midi: 'midi',
  return: 'ret',
  master: 'mst',
}

export function DeviceChainPanel({ set }: { set: SetSummary | null }) {
  const [selected, setSelected] = useState(0)

  useEffect(() => {
    setSelected(0)
  }, [set])

  const track = set && selected < set.tracks.length ? set.tracks[selected] : null
  const bottomPanels = getPanels('bottom')

  return (
    <section className="chain">
      <div className="chain-main">
        <div className="chain-tracks">
          {set ? (
            set.tracks.map((t, i) => (
              <button
                key={i}
                type="button"
                className={'chain-track-btn' + (i === selected ? ' chain-track-btn-active' : '')}
                onClick={() => setSelected(i)}
                title={`${t.name} — ${t.devices.length} device${t.devices.length === 1 ? '' : 's'}`}
              >
                <span className="track-kind">{KIND_LABEL[t.kind]}</span>
                {t.name}
              </button>
            ))
          ) : (
            <span className="chain-empty">no set open</span>
          )}
        </div>

        <div className="chain-tiles">
          {track ? (
            track.devices.length > 0 ? (
              track.devices.map((d, i) => (
                <div
                  key={i}
                  className="device-tile"
                  title={`${d} — hosted with its live-dynamics model at M3 (device hosting)`}
                >
                  <Icon name="device" size={13} />
                  <span className="device-tile-name">{d}</span>
                  <span className="tag">M3</span>
                </div>
              ))
            ) : (
              <span className="chain-empty">no devices on “{track.name}”</span>
            )
          ) : (
            <span className="chain-empty">
              device chains appear here from the opened set
            </span>
          )}
        </div>
      </div>

      <div className="chain-side">
        <div className="chain-params-stub" title="Device parameter editing lands M3 (device hosting — Glue/Echo/Reverb wired to live-dynamics)">
          <span className="micro-label">parameters</span>
          <span className="chain-params-text">
            {track && track.devices.includes('GlueCompressor')
              ? 'Glue Compressor parameters land M3'
              : 'device editing lands M3'}
            {' — Glue Compressor · Echo · Reverb wire to live-dynamics models'}
          </span>
        </div>
        {bottomPanels.map((p) => {
          const BottomPanel = p.component
          return (
            <BottomPanel
              key={p.id}
              set={set}
              loading={false}
              error={null}
              openSet={() => {}}
            />
          )
        })}
      </div>
    </section>
  )
}
