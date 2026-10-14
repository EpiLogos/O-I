# T-DEVICES-* — each family's devices through the one device runtime

FOUNDATION §3 F5 ("the Day die, a QL instrument face, a Factory skillset rack, an Expressions field device and the Live
torus all render through the same three components, with no text-only cards"), §7 (InhabitantRack's text cards go; its
face bodies stay as device bodies). The runtime landed with the Live torus as the reference (`live/torusDevice.ts`,
`live/TorusOnChain.tsx`). Builders: Sonnet, one family each. 14 Oct 2026.

## Realises

Manual `docs/dlw/DLW.md` §10.4 in full ("A device does one job … Every device comes in three sizes, and all three show the
same live settings … A light on a device is a reading … When something moves a value, the value shows what moved it …").
§3 ("Device view shows the chain … Wherever you are, the instrument in the focused pane brings its own controls into the
chain"). Lock §0 (owners write, faces read), §1 (each device keeps its Live semantic), §5 (gate rules).

## The contract (read in full)

- `frame/devices/deviceRuntime.ts` — `DeviceInstance` (declaration, rows, the owner's `values`, `heldBy`, `enabledKey`,
  `submit`, `handBack`), `compactRows` (macros first, else rows marked `compact`, at most four), `groupRows`, `lightOf`.
- `frame/devices/DeviceView.tsx` — the three sizes; `picture` (the device's own live picture), `actions`, `wrapRow`.
- `frame/devices/deviceDoor.ts` — `publishDevice(id, {device, picture})`, `selectDevice(id)` (the pool shows it whole),
  and `frame/devices/devicePane.tsx` (`projection.device` shows it full, opened with `openInstrument(DEVICE_PANE_KIND,
  undefined, {ref, title})`).
- `inhabitants/sdk/define.ts` `SdkParamRow` (now with `group`, `compact`, `macro`), `DeviceDeclaration`.
- The reference: `live/torusDevice.ts` + `live/TorusOnChain.tsx` (read both; copy their shape).

## Per family (one ticket each)

- **T-DEVICES-CENTRAL** — the Central family's devices (the Day die, Flow, Nara conversation, the Context-world / Agent
  identity / Ground hygiene / Impact readings) as `DeviceInstance`s on Central's Device side, replacing
  `InhabitantRack`'s text cards in `shell/ModeDetail.tsx` `BaseDevicesDetail`. The face bodies
  (`inhabitants/inhabitantRack.tsx` `faceBodyFor`: DocumentDayDieFace, FlowFace, NaraConversationFace) become the
  devices' pictures/bodies. Zone: `central/devices/**` (new) and the `BaseDevicesDetail` body in `shell/ModeDetail.tsx`.
- **T-DEVICES-TECHNE** — the QL family (Sky, Torus / field, M3 clock, Deck, Chakra, M′ matrices, QL field / PCM owner) and
  the atlas and knowledge faces as devices in `TechneInstrumentsDetail` and `InstrumentDeviceDetail`
  (`shell/ModeDetail.tsx`); QlInstrumentBody, AtlasFaceBody, KnowledgeFaceBody become pictures/bodies. Zone:
  `inhabitants/ql/devices/**` (new), the two detail bodies in `shell/ModeDetail.tsx`.
- **T-DEVICES-FACTORY** — the agent chain (gateway → agent → skills → scope → landing) as devices, the skills rack as a
  rack (`liveSemantic: 'rack'`, chains + selector, its macros as macro rows) in `agent/AgentShellDeviceDetail.tsx`,
  through the owner paths `agent/NativeAgentDeviceRack.tsx` and `inhabitants/agentParamAddresses.ts` already use. Zone:
  `agent/devices/**` (new), `agent/AgentShellDeviceDetail.tsx`.
- **T-DEVICES-EXPRESSIONS** — the field devices (physics, pointer, relation, medium, collision, morph, focus, colour,
  ink, depth, resonance) as devices: compact on the rack the person adds to (`components/NativeDeviceRack.tsx`'s
  add-to-rack semantics are the generic rack's), whole in the pool, full in a pane — over the native editor's reading and
  its `apply` (`components/nativeDeviceCustody.ts`). Zone: `components/devices/**` (new), `components/NativeDeviceRack.tsx`.

## Laws for every one

No text-only card: every device draws through `DeviceView`. Every write row carries the owner's write path; a row
without one is a reading. A light is the owner's reading, dark when unknown. A device keeps its Live semantic. Publish
each device to the door so the pool and the full pane show the same live settings. Port the existing bodies; never
redraw an owner's picture.

## Done when (lead, on screen)

The family's devices show on its Device side as compact devices (picture + ≤4 controls); choosing one shows it whole in
the pool; opening it full puts it in a pane; a change in any size is the same change.
