/** The inhabitant-rack harness (L2): the six world-shell families' composed
 * manifests rendered by the real InhabitantRack, with the Day die and Flow
 * document devices and the conversation device docked over a fixture kernel
 * bridge (the vite middleware in vite.config.mjs plays the /op route).
 *
 * Harness only: nothing here is the shell build, and the fixture transport
 * serves fixture readings shaped exactly like the native contracts — the
 * retained ql-daily-die.html and ql-flow.html bytes are the owners' own,
 * read from disk. The fixture identity is labelled as such on the toggle. */

import {createRoot} from 'react-dom/client'
import {createElement as h, useEffect, useMemo, useState} from 'react'
import {loadWorldShellFamilies, worldShellFamilyManifests} from '../worldShellFamilies.ts'
import {validateAllInhabitantManifests} from '../manifest.ts'
import {InhabitantRack} from '../inhabitantRack.tsx'
import {selectCurrentIdentity, clearCurrentIdentity} from '../../../../../../desktop/cradle/src/nara/identity/current'
import type {KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'

loadWorldShellFamilies()

const kernelUrl = new URLSearchParams(window.location.search).get('kernel') ?? ''

/** `?reading=fixture` hands the rack an owner-shaped fixture instrument
 * reading (the same shape the L9 ql-musical-face walk binds — shaped like
 * the native contracts, labelled as a fixture; NOT a live owner). Absent,
 * the QL instrument face renders its honest refusing state. */
const FIXTURE_INSTRUMENT_READING = {
  schema: 'ql.instrument-reading/v1',
  standing: 'following',
  reason: null,
  identity: {
    event_ref: 'fixture:occasion', subject_ref: 'fixture:subject',
    registry_revision: 'fixture:registry', geometry_ref: 'fixture:geometry',
    material_ref: 'fixture:material', model_ref: 'fixture:model',
  },
  acknowledged: {generation: '4', samples_elapsed: '245760'},
  presented: {generation: '4', samples_elapsed: '245760'},
  audio: {
    schema: 'ql.native-audio-receipt/v1', device_epoch: 0, device_sample_rate: 48000,
    native_origin: '0', context_origin_seconds: 0.5, observed_context_seconds: 0.61,
    target_context_seconds: 5.62, status: 'scheduled', muted: true, presentation_gain: 0.1,
    scheduled_blocks: 6, discarded_blocks: 1, reason: null, interval: null,
    standing: 'native PCM scheduled on a browser audio graph; not proof of physical speaker output (fixture reading)',
  },
  available: true, held: false, in_flight: false, queued_blocks: 3, queued_bytes: 4096,
  coalesced_presentation_frames: 0, views: 1, disposed: false,
  playback_policy: {blockFrames: 8192, leadSeconds: 0.5, lookaheadSeconds: 0.5, owner: 'fixture (embedded policy values)'},
} as unknown

const DAY = {
  project: 'o-i',
  sourceRef: 'central:path-ref:day-2026-10-09',
  documentId: 'day-2026-10-09',
}
const FLOW = {
  location: {schema: 'central.path-ref/v1', ref: 'central:path-ref:flows:capture-plan', root: 'central', path: 'Control/user/flows/capture-plan.html'},
} as const

/** A fixture identity, labelled as such on the toggle: the face reads
 * person/nara/source only; the kernel's binding op is the fixture echo. */
const FIXTURE_IDENTITY_READING = {
  schema: 'ql.nara-identity-reading/v1',
  person_ref: 'fixture:person',
  nara_ref: 'fixture:nara',
  input_revision: '0',
  profile: {person_ref: 'fixture:person', nara_ref: 'fixture:nara'},
  matrix: [],
  natal: null,
} as unknown as Parameters<typeof selectCurrentIdentity>[0]

function App() {
  const manifests = useMemo(() => worldShellFamilyManifests(), [])
  const faults = useMemo(() => [...validateAllInhabitantManifests().entries()], [])
  // Bumping the generation remounts the rack, so the conversation face
  // re-reads the identity owner — the same module state a real identity
  // selection notifies through.
  const [identityGeneration, setIdentityGeneration] = useState(0)
  useEffect(() => {
    const bump = () => setIdentityGeneration(generation => generation + 1)
    window.addEventListener('inhabitant-harness:identity', bump)
    return () => window.removeEventListener('inhabitant-harness:identity', bump)
  }, [])
  const transport = useMemo<KernelTransportStatus>(() => ({kind: 'bridge', url: kernelUrl}), [])

  const readingEl = document.getElementById('reading')
  const totalFaces = manifests.reduce((count, manifest) => count + manifest.faces.length, 0)
  const reading = `${manifests.length} families · ${totalFaces} faces · ${faults.length ? `${faults.length} VALIDATION FAULTS` : 'schema valid'}`
  if (readingEl && readingEl.textContent !== reading) readingEl.textContent = reading

  return h(InhabitantRack, {
    key: identityGeneration,
    manifests,
    transport,
    day: DAY,
    flow: FLOW,
    conversation: {project: 'o-i', expressionRef: 'fixture:expression-1'},
    projects: [{name: 'O-I', path: 'Work/O-I'}],
    instrumentReading: new URLSearchParams(window.location.search).get('reading') === 'fixture'
      ? FIXTURE_INSTRUMENT_READING
      : undefined,
  })
}

const container = document.getElementById('rack')!
const root = createRoot(container)
root.render(h(App))

// The bar toggle: a fixture identity makes the conversation face bind; off
// returns it to the honest absence.
let identityOn = false
const identityButton = document.getElementById('identity-btn')
identityButton?.addEventListener('click', () => {
  identityOn = !identityOn
  if (identityOn) {
    selectCurrentIdentity(FIXTURE_IDENTITY_READING, {source_ref: 'central:path-ref:fixture-identity', revision: 'r1'})
  } else {
    clearCurrentIdentity()
  }
  if (identityButton) identityButton.textContent = `fixture identity: ${identityOn ? 'on' : 'off'}`
  window.dispatchEvent(new CustomEvent('inhabitant-harness:identity'))
})
