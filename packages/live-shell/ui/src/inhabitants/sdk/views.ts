// A device's states, declared once (manual §16.3: "A device has one set of values and up to six views. It has the views of the places it
// stands in"; O-I #744: "Every catalogue device declares which states it has"). This table names every catalogue device's views by its id,
// `<family>:<face>`, and the two places that used to declare them apart derive from it: the catalogue's designs take their `views` from it
// as the registry hands them out (catalogue/panels/index.ts `stated`; design.ts RAIL_AND_PANE), and a family manifest's `presentations`
// for a catalogue device come to `statePresentations(id)` (the kit's vocabulary: compact the chain plate and its fold, expanded Whole, full
// Full). The device gate refuses a face whose presentations drift from it (validate.ts deviceStateFaults). Where the manifests and the
// designs disagreed (20 of 28 faces, 29 Oct), the manual's states stand: on a chain Folded, Compact and Whole; Full and Pop-out where the
// device has material of its own; a monitor, or an instrument born on the rail, has its Widget and Full only ("Its window holds its Full");
// Link stands in the transport with Whole beside it, Full in a pane and its tile on the rail (§16.3, §19.23). No device lost a state its
// design had (tests/fixtures/device-states-before-744.json). The frame's device door reads a design's views (frame/devices/deviceHost.tsx
// viewsOf, viewIn, navWithin): Compact on the chain, Whole as the band above it, Pop-out in the device's own window, from one binding.
// Which faces pop out of the inhabitant rack from their identity alone stays manifest.ts faceStandsAlone. Pure; nothing here imports.
import type {DevicePresentation} from '../familyManifest'

/** The six views (manual §16.3; catalogue/panels/design.ts ViewName, frame/devices/designed.ts DeviceViewName). */
export const VIEWS = ['folded', 'compact', 'whole', 'full', 'popout', 'widget'] as const
export type DeviceView = typeof VIEWS[number]

/** A device that stands on a chain and has material of its own: all six. */
const CHAIN_AND_PANE: readonly DeviceView[] = VIEWS
/** A monitor, or an instrument born on the rail: its tile and its Full (manual §16.3). */
export const RAIL_AND_PANE_VIEWS: readonly DeviceView[] = ['widget', 'full']

/** Every catalogue device's states. */
export const DEVICE_STATES: Readonly<Record<string, readonly DeviceView[]>> = {
  'actuation:gateway': CHAIN_AND_PANE,
  'actuation:harness-model': CHAIN_AND_PANE,
  'ai-kit:messages': RAIL_AND_PANE_VIEWS,
  'ai-kit:skill-device': CHAIN_AND_PANE,
  'ai-kit:skillset-rack': CHAIN_AND_PANE,
  'atlas-earth:globe-engine': CHAIN_AND_PANE,
  'central:day-die': CHAIN_AND_PANE,
  'central:docs': CHAIN_AND_PANE,
  'central:document': CHAIN_AND_PANE,
  'central:packet': CHAIN_AND_PANE,
  'central:search': CHAIN_AND_PANE,
  'dlw:arrangement-ruler': CHAIN_AND_PANE,
  'dlw:session-grid': CHAIN_AND_PANE,
  'expressions:colour': CHAIN_AND_PANE,
  'expressions:contacts': CHAIN_AND_PANE,
  'expressions:depth': CHAIN_AND_PANE,
  'expressions:field': CHAIN_AND_PANE,
  'expressions:focus': CHAIN_AND_PANE,
  'expressions:ink': CHAIN_AND_PANE,
  'expressions:medium': CHAIN_AND_PANE,
  'expressions:morph': CHAIN_AND_PANE,
  'expressions:physics': CHAIN_AND_PANE,
  'expressions:pointer': CHAIN_AND_PANE,
  'expressions:relational': CHAIN_AND_PANE,
  'expressions:resonance': CHAIN_AND_PANE,
  'expressions:studio': CHAIN_AND_PANE,
  'knowledge-graph:graph': CHAIN_AND_PANE,
  'live:delay': CHAIN_AND_PANE,
  'live:dynamics': CHAIN_AND_PANE,
  'live:exact-ratio': CHAIN_AND_PANE,
  'live:filter': CHAIN_AND_PANE,
  'live:reverb': CHAIN_AND_PANE,
  'live:scale-mapping': CHAIN_AND_PANE,
  'quaternal-logic:chakra': CHAIN_AND_PANE,
  'quaternal-logic:deck': CHAIN_AND_PANE,
  'quaternal-logic:m-prime-matrices': CHAIN_AND_PANE,
  'quaternal-logic:m3-clock': CHAIN_AND_PANE,
  'quaternal-logic:resonator-bank': CHAIN_AND_PANE,
  'quaternal-logic:sky': CHAIN_AND_PANE,
  'quaternal-logic:sky-modulation': CHAIN_AND_PANE,
  'quaternal-logic:torus': CHAIN_AND_PANE,
  // Settings is a window, not a device (§10.10): the catalogue draws its Full alone.
  'settings:window': ['full'],
  'software-factory:agentset-rack': CHAIN_AND_PANE,
  'software-factory:approvals': CHAIN_AND_PANE,
  'software-factory:context-write-mode': CHAIN_AND_PANE,
  'software-factory:ledger': RAIL_AND_PANE_VIEWS,
  'software-factory:prompt-pads': CHAIN_AND_PANE,
  'software-factory:run-map': CHAIN_AND_PANE,
  'techne:canvas': CHAIN_AND_PANE,
  'techne:journey': CHAIN_AND_PANE,
  'techne:lens': CHAIN_AND_PANE,
  'techne:palace': CHAIN_AND_PANE,
  'widgets:files': RAIL_AND_PANE_VIEWS,
  'widgets:nows': RAIL_AND_PANE_VIEWS,
  'widgets:terminal': CHAIN_AND_PANE,
  'widgets:trail': RAIL_AND_PANE_VIEWS,
  'widgets:web': RAIL_AND_PANE_VIEWS,
  'widgets:wiki': RAIL_AND_PANE_VIEWS,
  'workcell:git-seat': CHAIN_AND_PANE,
  // Link stands in the transport, not on a chain: Whole beside its button, Full in a pane, its tile on the rail (§16.3, §19.23).
  'workcell:link': ['whole', 'full', 'widget'],
  'workcell:remote-carrier': CHAIN_AND_PANE,
  'workcell:workcell': CHAIN_AND_PANE,
}

/** A catalogue device's states, or undefined for a device the catalogue does not draw. */
export function deviceStates(id: string): readonly DeviceView[] | undefined {
  return Object.hasOwn(DEVICE_STATES, id) ? DEVICE_STATES[id] : undefined
}

/** The presentations a device's views come to, in the kit's vocabulary: compact from Folded or Compact, expanded from Whole, full from
 * Full. Pure. */
export function presentationsOf(views: readonly DeviceView[]): DevicePresentation[] {
  const has = new Set(views)
  return [...(has.has('compact') || has.has('folded') ? ['compact' as const] : []), ...(has.has('whole') ? ['expanded' as const] : []), ...(has.has('full') ? ['full' as const] : [])]
}

/** A catalogue device's presentations, as its family's manifest declares them (derived, never written apart). A face the table does not
 * name keeps the kit's default, all three. */
export function statePresentations(id: string): DevicePresentation[] {
  return presentationsOf(deviceStates(id) ?? VIEWS)
}
