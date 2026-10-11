/** The Central family L7 harness: the hygiene, impact and day/now devices
 * plus the Central subject detail craft, driven against the LIVE kernel
 * walk-bridge when `?kernel=` names it (read-only ops only; refusals shown
 * verbatim), with the machine-level declared reads served by the harness's
 * own middleware (each labelled with its boundary operation).
 *
 * Harness only: nothing here is the shell build. The devices are the real
 * components; the subjects are real Central paths from the ground. Where no
 * live bridge is supplied, the transport is unavailable and the devices
 * render their honest unread states. */

import {createRoot} from 'react-dom/client'
import {createElement as h, useMemo, useState} from 'react'
import type {KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {declareCentralFamilyL7} from '../centralFamilyL7.ts'
import {loadAgentShellFamilies} from '../loadAgentShellFamilies.ts'
import {inhabitantManifest, validateInhabitantManifest} from '../manifest.ts'
import {CentralHygieneDevice} from '../CentralHygieneDevice'
import {CentralImpactDevice} from '../CentralImpactDevice'
import {CentralDayNowDevice} from '../CentralDayNowDevice'
import {CentralSubjectDetail, type CentralSubjectSelection} from '../CentralSubjectDetail'
import '../centralDevices.css'
import '../inhabitantDevices.css'

// The extension is declared so the composed manifest carries the day-now
// face; the door's identity law makes re-declaration a no-op.
loadAgentShellFamilies()
declareCentralFamilyL7()

// The param names the walk-bridge BASE (kernelOp posts to url + '/op'); a
// full /op route is accepted and normalised.
const kernelParam = new URLSearchParams(window.location.search).get('kernel') ?? ''
const kernelUrl = kernelParam.replace(/\/op\/?$/, '')
const GROUND_ROOT = '/Users/admin/Central'

/** The harness's subjects — real Central paths from the ground, one per
 * kind. The walk selects each in turn (folder → note → day). */
const SUBJECTS: {key: string; label: string; selection: CentralSubjectSelection}[] = [
  {key: 'folder', label: 'Folder: O-I wayfinder maps', selection: {kind: 'folder', path: 'Work/O-I/.wayfinder/maps'}},
  {key: 'note', label: 'Note: central-field-health skill', selection: {kind: 'note', path: 'Control/user/skills/central-field-health/SKILL.md'}},
  {key: 'day', label: 'Day: 2026-10-08 (reverse-engineering register)', selection: {kind: 'day', path: 'Work/reverse-engineering/ProjectCentral/now/day/2026-10-08.md'}},
]

/** The machine-level declared reads, served by the harness middleware. */
const machineRead = async (kind: 'seat-status' | 'worktree-list' | 'branch-refs') => {
  const response = await fetch('/machine-read', {method: 'POST', body: JSON.stringify({kind})})
  return response.json()
}

const transport: KernelTransportStatus = kernelUrl
  ? {kind: 'bridge', url: kernelUrl}
  : {kind: 'unavailable', reason: 'no ?kernel= supplied — the devices render their unread states'}

function App() {
  const [selected, setSelected] = useState<string>('day')
  const subject = useMemo(() => SUBJECTS.find(entry => entry.key === selected) ?? null, [selected])
  const manifest = useMemo(() => inhabitantManifest('central'), [])
  const faults = useMemo(() => (manifest ? validateInhabitantManifest(manifest) : ['central family not admitted']), [manifest])
  const dayPath = subject?.selection.kind === 'day' ? subject.selection.path : null

  const channel = document.querySelector('[data-channel-label]')
  if (channel) {
    channel.textContent = kernelUrl
      ? `central family L7 harness · channel: LIVE kernel walk-bridge (${kernelUrl}/op) · read-only · computer use blocked machine-wide`
      : 'central family L7 harness · channel: no kernel — unread states'
  }

  return h('div', {className: 'l7-harness'},
    h('header', {className: 'l7-header'},
      h('h1', null, 'Central — the ground\u2019s clip-view craft (L7 devices)'),
      h('p', {className: 'l7-faults', 'data-manifest-faults': String(faults.length)},
        faults.length ? `MANIFEST FAULTS: ${faults.join(' · ')}` : `central manifest valid · faces: ${manifest?.faces.map(face => face.id).join(', ')}`),
    ),
    h('nav', {'data-subject-selector': true, className: 'l7-subjects'},
      SUBJECTS.map(entry =>
        h('button', {
          key: entry.key,
          type: 'button',
          'data-subject-key': entry.key,
          className: selected === entry.key ? 'on' : '',
          onClick: () => setSelected(entry.key),
        }, entry.label),
      ),
    ),
    h('div', {'data-detail-mount': true},
      h(CentralSubjectDetail, {transport, subject: subject?.selection ?? null, groundRoot: GROUND_ROOT}),
    ),
    h('div', {'data-devices-mount': true, className: 'l7-devices'},
      h(CentralHygieneDevice, {transport, machineRead, expanded: true}),
      h(CentralImpactDevice, {transport, subject: subject?.selection ?? null, expanded: true}),
      h(CentralDayNowDevice, {transport, dayPath, groundRoot: GROUND_ROOT, expanded: true}),
    ),
  )
}

const root = createRoot(document.getElementById('root') ?? document.body)
root.render(h(App))
