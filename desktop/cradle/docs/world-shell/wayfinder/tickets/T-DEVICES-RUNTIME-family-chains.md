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

## State of record (moved from PATH sec 7, 22 Oct 2026)

Moved verbatim from the retired `PATH.md` (history: PATH.md at `41557a9ed`). Hashes, run labels (r1, r23 ...) and cross-references inside are as PATH wrote them; "PATH sec N" and "FOUNDATION sec N" in this text name the retired files, whose content is now in `MAP.md` (State of the streams, The foundation's route), `EXECUTE.md` and the tickets.

### The catalogue of designed devices (PATH sec 7 table row)

| Ticket | Who | Zone | Since |
|---|---|---|---|
| The catalogue of designed devices (owner, 16 Oct: "the parallel lanes are developing the high end device component specs in the documentation lane, you can directly work from its … catalogue of pre designed UI, the wiring and UX integration should be somewhat trivial wiring"): `catalogue/panels/design.ts` is the contract, `panels/<family>__<face>.tsx` (exporting `design`, loaded through `loadDesign`) the designs. The runtime hosts each published device's design when one exists, else the generic plate; a device lane writes the binding (owner readings and writes on the design's value keys), never a panel | the owner's documentation lane | `inhabitants/catalogue/**` — read-only for every builder | 16 Oct |

### PATH sec 7: the device lanes (BF2, BC2, W4, BL, D, BC, BF, W1, W3, BT, BE, R, F, E) and the widget slot

Then: lanes BF2 and BC2 landed (16 Oct). BF2 (`516c9608a`): the Thread, the Gateways rack, the Agency gateway, Experiment, the
Frames monitor (+ its rail widget), Tasks and Runs draw their designs on their owners — the Thread from the thread pane's own owner
read (one poll), the Agent's `thread`, `models` (AIKit's catalogue) and `harnesses` filled, its light disabled as a reading; with no
session selected the Device side is Factory's Main track. BC2 (`4608ae324`): Central's page family (Document, Flow, Workspace, Text,
Highlight, Notes; Beings/Things bound but unplaced) draws on Central — a Flow's entries append through the Flow file's CAS write;
flow-document is an instrument on a reached Flow's chain and a document face is declared; Ground hygiene reads a clean landed seat as
landed and a clean seat ahead of main as not, its seats from the register's primaries; Impact matches seat sessions; Central's
devices re-read on lane W3's receipts. On the way: the documentation lane's Ground hygiene design type-checked only against BC2's
uncommitted model, failing #677's candidate tsc — the two fields landed first (inside the documentation lane's 0b5361847, which swept
the staged entry); the shared seat now commits by explicit path. The landing tier's one red (browser-canvas-editor, 69 s, once) was a
load flake: the same contract passes locally and in the same run's candidate job. The Torus: the documentation lane's design now draws
the four determinants (adbe6978e); lane BL2 hosts it once designed controls can be MIDI-map targets.

Then: lanes W4 and BL landed; ai-kit #510 and Central #274 merged and installed (16 Oct). W4 (`ea15033ad`): `oi where` and the world
heads read the cached suite verification and hash in-process — 711–832 ms / 6 shasum → 4–7 ms / 0 (366–375 ms on the first call
after a suite change); an update that installs another `oi` has it reconcile the suite (`oi update --reconcile-suite`), so an older
`oi` can no longer leave products shadowed. BL (`aba3ddaea`): the Sky draws its catalogue design on the kernel's nara_identity
transit; Live's keyboard, note and set devices carry live wells; the Torus publishes its own Full (the torus with the Jankó keyboard
under it) but keeps its generic plate — the catalogue's Torus does not draw the four determinants, so hosting it would remove working
controls (keys proposed); the M3 clock, Deck, Chakra and M′ matrices stay waiting (no readable producer). Installed from main: ai-kit
`51a98e6d`, Central `5b92994c` (receipt-exact, nothing shadowed); both seats released. The door natively after W1 and D (build n2,
the old AIKit): Locations › O-I settled "in O I · +2" with the Scene open and saved, no conflict.

Then: lanes D, BC, BF, W1, W3, BT, BE and R2 converged (16 Oct). D (`533ac32f8`): an opened work reads saved until edited (the
frame had written its own shared settings into every loaded work), a conflict reads the owner's current revision and the frame's
refusal reaches the shell's ask in the owner's words, a fault stands only on the pane that raised it. BC (`9184ae9f2`, `1c59a1a79`):
the Day draws its catalogue design on Central's readings; Open today is the person's press through Central's ensure-day — the
documentation lane's Day (21249d7b9) draws the refusal in its well and the press. BF (`b04124a93`) and R2 (`9a1974d13`): the agent
chain's Gateway, Agent, Skillset rack, member device and Scope draw their designs on AIKit/Factory/Actuation, every refused write
disabled with its owner-op reason; the runtime gained a fault boundary per view, a device's own Full (the Day's page, the Agent's
thread), place marks on designed heads, view-held keys (Cancel reaches the binding); the setter bridge's existence check retired.
W1 (ai-kit #510, Central #274): the root register stays warm — ledger 7,566 → 565 observations, 0 changes in 600 s, a cold root
walk 7–11 s → 0.8–1.8 s, a root-cold door batch 14 → 8 s, relations byte-equal 17/17; Central writes its state only on change.
W3 (`aba029db5`): every write B0 found ordered under the lock is prepared or free — a 60 s owner write's lock_held 60,380 → 1.4 ms,
lock-probe p95 60 s → 6.7 ms; receipts now_changed/day_changed/receiving_changed/factory_run_changed, the temporal field re-reads on
them (its floor kept only for other processes' writes; agency's 30 s floor kept — AIKit has no session event, proposed); a temporal
read 27 → 10 processes; the native host writes a timing line per op (OI_KERNEL_TRACE_FILE); src-tauri clippy clean and gated.
BT (`1f6ff5d42`, `b8bb75051`): the six Technē instruments carry a live picture in their wells and stand on the kit's head, no sentence in a plate,
ownerless controls disabled with their reason, Compacts follow the open plate's width, the detail head names the standing
instrument. BE (`108634cf3`): the Studio fits its band with one Save at 1280/1372/1440, Your controls page as kit dials, Physics draws
on the field engine, Acts/Nara/Find/the Library open as devices, not over the field. Not yet bound (designs still on module
constants, keys proposed to the documentation lane): the six Technē designs and the Expressions Field. A CI red fixed on the way:
the kernel gateway test read a busy exec's refusal-as-data (`842ff3aa3`). Native: build n1 (`1e2d6db89`) launched; the screen pass
waits on the owner's full-screen approval (two requests timed out); build n2 at `9a1974d13` is next.

Then: lanes R and F landed. R (`f9792cac8`): every device draws on the owner's panel kit in five views from one binding — the
catalogue's design where its family publishes a binding (`frame/devices/designs.ts` resolves `loadDesign('<family>:<face>')`), the
generic plate on the kit otherwise; a change goes to the owner on release, waits in italics, and a refusal says the owner's words on
the Info line (the Send bar is gone); Folded/Compact on the chain, Whole in the pool, Full in a pane, Widget on the rail. A design
draws only once its family binds it: hosted on raw row keys the Day drew `NaN·NaN·NaN`. Open from R: the instrument plates (Studio,
Places, Palace, Project) and Technē's folded devices still wear FacePlate heads (with the Technē and Expressions binding lanes). The
switchboard tripwire leaves the catalogue's designs uncounted (a mode reaches a design as a value of its binding). F (`92ba218a7`):
pane content follows its pane (the atlas observes its own boxes; every pane kind swept headless), palace entry brings the Earth into
view, the transport folds owner slots to their mark, the Info line keeps its room, a pane's tabs reveal from its top edge and ⌘⌥\
pins them. Seen during F: a private stack writes works into the owner's ground (the kernel's works home is Central's
`Control/user/flows`); F moved its two files out; the kit says so now (`4c81aefbe`). Out: BC and BF, the first binding lanes.

Then: lane E landed (`1f40feefe`), drawn to docs/dlw/DLW.md §16 — the owner's device standard, which landed on main the same
evening with its panel kit and five reference devices (`2fdfe6606`, `79d5b4c36`, committed in this seat by the owner's session): the
plate grammar fits or folds, never scrolls, one hairline between sections, no box in a box, a head slot (the Studio's Save, Undo,
Redo); the World's Body/Landmass/Climate/Sky as dials and switches drawn waiting with Earth's reason, Locations and Relations as paged rows;
the Palace's Rooms, Path, Board, Return; Canvas, Relation Field and Journey on the kit's styling; the Project one plate (View, Graph, Forces, Deep time) and the stage's
Expression controls while its project lens stands; Compact devices (a live well and four manual-named macros) where the row has room.
Headless, GPU on: no overflow and no scrolling element in the device row in 20 shots. Beside Live's Operator the plates are closer,
not there: fewer, larger controls and no live picture at their heart — the next pass, to manual §16. Lane R3 (`a113536f3`): the
register follows Y and E — every cited home resolves at HEAD (9 re-quoted, 8 moved), implemented 105 holds. The native build at
`2de90416e` (stamp 20261015T-m4) waits for the owner's screen approval (three requests timed out today).

The widget slot reaches the rail (`79ee6a608`): a panel a family registers in `right-dock` — FOUNDATION §4's widget
contract — is a widget of the one rail; the right dock and the duplicate "Agents & context" registration retire. The chain's end receives (`1dd808990`): a mode registers what lands on it (`MODE_DETAILS.drop`), and Live's note-device
rows drag onto it, landing what their double-click lands. The native pass at `2f5c1bcf6` (computer-use): Central's Days read the owner's surface; every day was named "day.md" in the
title line, trail and detail head (fixed, `3b66dcc3e`); the Expressions centre still read blank because the one frame keeps
its instrument session open in every cut — the frame now says when its cut draws (`f2ef25b0f`); Technē's rack reads its
plates; Sources and the Expressions browser say no works are disclosed, truly — the works home holds no work yet.
