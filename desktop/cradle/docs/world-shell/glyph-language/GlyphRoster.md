# Glyph roster

The icon language for the world shell. One sprite, [`roster.svg`](roster.svg). One typed module, [`glyphs.ts`](glyphs.ts). 79 marks.

Every symbol is drawn on a 24×24 grid. Stroke marks use weight 1.5, round caps, and round joins. Marks the mockups filled stay filled: play, stop, record, the admit light, the beings figure, and the filled skill stand-ins.

A mark is coloured with `currentColor`. The button sets `color` to a token from `packages/live-shell/ui/src/styles.css`: `var(--text)`, `var(--text-dim)`, `var(--text-faint)`, `var(--accent)`, `var(--rec)`. Nothing inside a mark names a colour.

Geometry that already existed in the mockups is carried across. Skill stand-ins drawn on the 16-grid in `agent-shell-mockup.html` are scaled by 1.5. Where the mockup used a character, the mark is that character's plain meaning, and the entry says so.

## Use

Load the sprite once. Every use has an aria-label. The spoken name is the plain name, or a more specific phrase when the same mark means a mode's own verb (Play, Answer, Run, Walk).

```html
<svg role="img" aria-label="Play" width="16" height="16" viewBox="0 0 24 24">
  <use href="roster.svg#play"/>
</svg>
```

`renderGlyph(name, { label, size })` inlines the mark. `renderGlyphUse` points at the sprite. Both refuse an empty label.

The mockup tooltip pattern still applies to the control, not to the mark: `data-i="Name|What it does"`, read into the status line.

## States

`refusing`, `disabled`, and `waiting` are their own marks, drawn at full weight.

- A control the shell declines shows `refusing`.
- A control that is present and cannot be used shows `disabled`.
- A control that has not heard back shows `waiting`.
- A skill light that is on shows `admit`. A skill light that was refused shows `deny`.

A transport button's on state is the button's colour. Record's live colour is `var(--rec)`. Play's armed colour is `var(--accent)`. That colour is not a second glyph.

## Chips

Any text or image can become an engine glyph (`AsciiToGlyphModal`, `ImageToGlyphModal`, `GlyphSampler`). The chip is how that result sits in the shell. It is a UI frame, not the stage bake, and it does not carry the volume profiles in `glyphVolume.ts`.

| | |
|---|---|
| Sizes | 16, 20, 24. Default 24. |
| Frame | Square. Border `1px solid var(--line)`. Background `var(--bg-0)`. Ink inset 2. |
| Colour | `currentColor` for engine text and plain characters. An image keeps its own ink. |
| Engine or character | One line, `var(--font-ui)`. One grapheme is 0.7 of the inner box, the sampler's font-to-canvas ratio. A longer run shrinks so the advance stays inside 0.9 of the inner box. |
| Empty text | Drawn as `O`. That is the sampler's empty sample. |
| Newlines | Collapsed to spaces. The chip is one line. `asciiLayout` belongs to the bake. |
| Image | `img` with `object-fit: contain` inside the same frame. If the image fails, the chip shows `waiting`. |
| Label | `aria-label` is required. The engine text does not replace it. |

`renderGlyphChip` in `glyphs.ts` builds the chip. `chipInk` resolves the empty sample and the size.

## Shared drawings

- `base` and `central` share the diamond.
- `factory` and `software-factory` share the hexagon.
- `panes` and `four-fold` share the four-pane square.
- Home uses `earth`.

## Left as they were

Bee portraits stay illustrations: they use each agent's own colour, which this roster does not bake in. Planet bodies stay the Earth projection's drawing. M0′–M5′ stay the text labels the mockup uses. Skill stand-ins keep the mockup's skill ids; an authored engine glyph replaces the picture through a chip.

When the widget-standards extraction names a control, that name is the one to follow. This roster uses the mockup's words and does not rename ahead of that extraction. The open alignment is in `RESULT.json`.

## Transport

### play

Start the transport.

- **Usage.** The play slot in every mode. Live plays; Base sends the packet; Factory runs; Expressions plays scenes; Technē walks. The button paints an active play control with var(--accent).
- **States.** One filled triangle. A play control that refuses shows refusing beside it. A play control that cannot run shows disabled. A play control waiting on a peer shows waiting.
- **Appears.** Ported from world-shell-mockup.html SV.play (M7 4.5v15l13-7.5z).

### stop

Stop the transport.

- **Usage.** The stop slot. Once pauses at the next quantize point. Twice returns to Now, discards the answer, or cancels, following the mode.
- **States.** One filled square. Refusal, disability, and waiting use those state glyphs.
- **Appears.** Ported from world-shell-mockup.html SV.stop.

### record

Record into the armed target.

- **Usage.** The record slot. Live records the arrangement; Base dictates; Factory takes voice; Expressions captures a take; Technē records a walk. The shell paints a live record control with var(--rec).
- **States.** One filled circle. The live colour is the button's color, not a second drawing.
- **Appears.** Ported from world-shell-mockup.html SV.rec.

### arm

Arm writes so they can land.

- **Usage.** The arm slot: automation arm, write arm, Studio arm, or instrument writes. Off, edits arrive as proposals. On, they land with a receipt.
- **States.** The ring is the housing and the centre dot is the armed light. Deny replaces the dot when admission is refused. Disabled replaces the whole control when arming cannot be offered.
- **Appears.** The mockup drew this slot as the character ⌘. The roster mark is the arm ring the slot describes.

### loop

Brace a region and repeat it.

- **Usage.** The loop slot between the two brace fields. Live loops a section; Base runs the close routine; Factory repeats a task; Expressions loops scenes; Technē limits panes to an occasion window.
- **States.** One drawing. The button's on state uses var(--accent) via color.
- **Appears.** Ported from world-shell-mockup.html SV.loop. Stroke cleaned from 2 to 1.5.

### punch

Punch in and out of record on the brace.

- **Usage.** The punch action on the loop brace. The two fields stay numeric; this mark is the punch itself.
- **States.** One drawing. The brace numbers are text, not glyphs.
- **Appears.** Revision 5 names punch on the Live transport. The mockup drew the brace as loop plus two fields. This flag-on-a-post is the punch mark for that slot.

### tap

Tap a tempo or stamp the present.

- **Usage.** The tap slot. Live and Expressions tap tempo. Base stamps Now into the focused document. Factory asks running agents for a status line. Technē snaps the occasion back to Now.
- **States.** One drawing.
- **Appears.** The mockup drew the word Tap. The ripples are that action.

### link

Join this session to peers on one clock.

- **Usage.** The link slot. Live shares tempo; Base shares the ground; Factory joins harnesses; Expressions syncs a field; Technē joins the field carrier.
- **States.** One drawing. Off, the same grammar runs on local material. The count of peers stays a numeral beside the mark.
- **Appears.** The mockup drew the word Link. Two overlapping stadiums are the link.

### metronome

The pulse that the other slots quantize to.

- **Usage.** The metronome slot. Live clicks; Base autosaves; Factory heartbeats; Expressions pulses the field; Technē shows presence.
- **States.** One drawing. The mockup's on state is the button color.
- **Appears.** The mockup drew ●◦ for this slot. The pendulum is the metronome that character stood for.

### re-enable

Return a lane to its recorded automation.

- **Usage.** The re-enable slot in Live and Expressions. The same slot is hand-back in Base, Factory, and Technē; use hand-back there.
- **States.** One drawing. Lit means the recorded line is waiting to be restored.
- **Appears.** Revision 5 names re-enable automation. The curve rejoining a baseline is that action. Hand-back keeps the left arrow the mockup drew for the other meaning of this slot.

### capture

Catch what just happened into the slot's target.

- **Usage.** The capture slot. Live captures MIDI; Base takes the selection into the packet; Factory records a worked example; Expressions captures gestures as a scene; Technē captures the view as a scene.
- **States.** One open circle, the mockup's ○. Record is the filled circle. They stay distinct.
- **Appears.** Ported from the transport's ○ character in world-shell-mockup.html renderTransport.

### overdub

Layer the next pass on the current one.

- **Usage.** The plus slot beside record. Live overdubs; Base appends; Factory's same slot is steer when the meaning is steering; Expressions layers a take; Technē extends the walk. Use steer when the slot steers a running turn.
- **States.** One plus. The button on-state is color.
- **Appears.** Ported from the transport's + character.

### follow

Panes follow the encounter.

- **Usage.** The follow control. A pane that is pinned keeps its own context; follow moves the panes that are still attached.
- **States.** One arrow. On uses var(--accent) via color.
- **Appears.** Ported from the transport's ➜ character.

### session

Session view: rows you launch.

- **Usage.** The session icon, left of the mode icons. Live shows clips and scenes; Base shows the day as clips; Factory shows sessions and tasks; Expressions shows scene rows; Technē shows the Journey.
- **States.** One drawing. The mode changes what the view contains, not the mark.
- **Appears.** Ported from world-shell-mockup.html renderTransport, the Session button path.

### arrangement

Arrangement view: one ruler over time.

- **Usage.** The arrangement icon beside session. Live shows the song; Base shows today; Factory shows the run viewer; Expressions shows scenes over time; Technē shows the relation field.
- **States.** One drawing.
- **Appears.** Ported from world-shell-mockup.html renderTransport, the Arrangement button path. Timeline adds a playhead; this mark stays the three bars.


## Mode selector

### live

Live, the musical working mode.

- **Usage.** Mode selector. Live is the shell's base musical mode: clips, scenes, and the transport's musical meanings.
- **States.** One drawing. The selected mode paints the button with var(--accent) via color.
- **Appears.** Ported from world-shell-mockup.html MODES live path.

### base

Base · Central: the ground and its documents.

- **Usage.** Mode selector for Day, Flow, Beings, and Things with a situated agent. The central product uses the same diamond; see central.
- **States.** One drawing.
- **Appears.** Ported from world-shell-mockup.html MODES base path, the diamond.

### factory

Factory: sessions, runs, and their results.

- **Usage.** Mode selector. The software-factory product uses the same hexagon; see software-factory.
- **States.** One drawing.
- **Appears.** Ported from world-shell-mockup.html MODES factory path.

### expressions

Expressions: the lived field.

- **Usage.** Mode selector. The Expression projection is the four-point star, expression. This mode mark is the field with a centre.
- **States.** One drawing.
- **Appears.** Ported from world-shell-mockup.html MODES expressions path: two rings and a cross.

### techne

Technē: the six instruments over one subject.

- **Usage.** Mode selector. The four linked squares are the mockup's Technē mark. Instrument names M0′–M5′ stay text.
- **States.** One drawing.
- **Appears.** Ported from world-shell-mockup.html MODES techne path, including its uneven squares.


## Projections

### earth

Earth and the solar-system field: bodies in one space.

- **Usage.** The Earth / Solar-System projection, and the Home control that opens it. Your body in the field, Earth at its root.
- **States.** One drawing. Landmass controls that Earth refuses stay on the control, with disabled, because Earth is given.
- **Appears.** Ported from world-shell-mockup.html SV.earth. Stroke cleaned from 1.8 to 1.5.

### timeline

Time: authored history on lanes.

- **Usage.** The Timeline projection. Arrangement keeps the three bars alone; this mark adds the playhead the projection draws.
- **States.** One drawing.
- **Appears.** The mockup's aperture character for Timeline is ≡, the same three bars as arrangement. The playhead is added so the projection can be told from the view icon.

### constellation

Relation: arrange, frame, and connect.

- **Usage.** The Constellation projection (Canvas in the mockup's aperture list).
- **States.** One drawing.
- **Appears.** Ported from the aperture character ▣ on canvas in world-shell-mockup.html APS.

### expression

Form: an expression of the subject.

- **Usage.** The Expression projection. The Expressions mode uses expressions, the ringed field.
- **States.** One drawing. An engine glyph inside an expression chip uses the chip spec, not this star.
- **Appears.** Ported from the aperture character ✦ on expression in world-shell-mockup.html APS.


## Device families

### morph

The morph device: one form becoming another.

- **Usage.** Rack face for the morph family. Square and circle overlap to show the change.
- **States.** One drawing. Folded, expanded, and popped out use folded, expand, and pop-out.
- **Appears.** WORLD-SHELL-DESIGN.md §5 names morph as a parameter device. The mockup did not draw a morph icon. This overlap is the roster mark.

### colour

The colour device.

- **Usage.** Rack face for colour. The wedge is a sector of the circle. The hue is the device's own reading, never a colour baked into this mark.
- **States.** One drawing.
- **Appears.** WORLD-SHELL-DESIGN.md §5 names colour as a parameter device. No mockup icon. The outlined sector is the roster mark.

### force

The force device: a push applied to a target.

- **Usage.** Rack face for force. Field lines are field-lines, the sibling face.
- **States.** One drawing.
- **Appears.** WORLD-SHELL-DESIGN.md §5 names force as a parameter device. No mockup icon.

### field-lines

The field device: a field the force sits in.

- **Usage.** Rack face for the field family. The encounter spine's Field is the separate mark field.
- **States.** One drawing. C3 may name this face field; until that extraction lands, the spine keeps the plain name field and this face keeps field-lines.
- **Appears.** WORLD-SHELL-DESIGN.md §5 names field beside force. No mockup icon. Alignment with C3 is recorded in RESULT.json.


## Products

### central

The central product: the ground itself.

- **Usage.** Product mark for central. Same diamond as the Base · Central mode.
- **States.** One drawing, shared with base.
- **Appears.** Same path as base, which the mockup drew for Base · Central. WORLD-SHELL-DESIGN.md §12 names the product.

### actuation

Actuation: how an agent runs.

- **Usage.** Product mark. The needle is the effort knob the agent-shell mockup draws as a control. The effort steps themselves are effort.
- **States.** One drawing.
- **Appears.** The mockup draws the knob as a live control, not a product icon. This reduces that knob to a mark. WORLD-SHELL-DESIGN.md §12 names the product.

### ai-kit

AIKit: skills held in a rack.

- **Usage.** Product mark. Three device strips. Individual skills use their own stand-ins or a glyph chip.
- **States.** One drawing. Admission of each skill is admit or deny, not a fade of this mark.
- **Appears.** agent-shell-mockup.html describes skills as plug-ins in a rack. WORLD-SHELL-DESIGN.md §12 names the product. The three strips are the roster mark.

### software-factory

Software Factory: work as something that happens in the world.

- **Usage.** Product mark. Same hexagon as the Factory mode.
- **States.** One drawing, shared with factory.
- **Appears.** Same path as factory. WORLD-SHELL-DESIGN.md §12 names the product.

### workcell

Workcell: the seat where computation runs.

- **Usage.** Product mark. A cell grid with one seat filled means a claimed seat.
- **States.** One drawing. Occupancy copy stays text. A seat that refuses a claim shows refusing.
- **Appears.** WORLD-SHELL-DESIGN.md §12 names the seat device. No mockup icon. The filled cell is the roster mark.

### quaternal-logic

Quaternal Logic: four positions.

- **Usage.** Product mark. Four nodes on a square. Technē's linked squares stay techne. The day die stays day.
- **States.** One drawing.
- **Appears.** WORLD-SHELL-DESIGN.md §12 names the product. No mockup icon. Four nodes are the roster mark, without a mystical reading.


## Device and skill states

### power

Power: the device is on, or benched.

- **Usage.** The device header light. The mockup drew a small ring. This mark adds the stem so power stays distinct from capture's open circle at 16px.
- **States.** This is the on housing. Benched uses the same mark painted with var(--text-faint), or deny when the bench is a refusal. Do not draw a dimmed copy as a second glyph.
- **Appears.** agent-shell-mockup.html .pw, data-i "Power|The agent on, or benched." The ring is the mockup; the stem is the roster's distinction.

### admit

Admitted: the skill or lane is allowed to act.

- **Usage.** The admit light on a skill row. Paint it with var(--accent) or the shell's on-colour. The glyph itself stays a disc.
- **States.** The on light. The off light is deny, its own drawing.
- **Appears.** agent-shell-mockup.html skill rows: a light that admits or denies. The mockup used a CSS disc. This is that disc.

### deny

Denied: admission was refused.

- **Usage.** The deny light on a skill row or a lane. Pair it with the skill's own mark; do not fade the skill mark to mean deny.
- **States.** A ring and a slash, full weight. Refusing is the slashed square, for a control that will not run. They are different objects.
- **Appears.** The mockup turned the light off with a CSS class. Deny is drawn so the refusal is visible without relying on faint colour alone.

### hold

Held: someone else has custody, so your edit suspended their hold.

- **Usage.** Custody on a device. The agent-shell mockup badges a held agent with a circle and an exclamation.
- **States.** One drawing, full weight. Hand-back is the action that returns custody.
- **Appears.** Ported from the held badge in agent-shell-mockup.html bee(), without the badge's hardcoded orange.

### hand-back

Hand custody back to the holder.

- **Usage.** The hand-back slot. Lit when you edited something an agent holds. Pressing it returns the hold.
- **States.** One left arrow. The lit state is the button color.
- **Appears.** Ported from the ← character on the hand-back slot in both mockups.

### steer

Steer the running turn.

- **Usage.** Factory and the agent device: what you send redirects the turn in progress. When the same plus-slot means overdub, use overdub.
- **States.** One drawing. Off, input queues; the queue state can show waiting.
- **Appears.** agent-shell-mockup.html data-i "Steer · overdub" used +. Steer is drawn as a turn in the path so it is not the plus.

### effort

How hard the armed session thinks, in steps.

- **Usage.** The effort control. The mockup shows the step as a word (low, med, high, xhigh, max). This mark is the steps. The current word stays text.
- **States.** Three rising bars, one drawing. The selected step stays a word. A refused effort shows refusing.
- **Appears.** agent-shell-mockup.html data-i Effort, and the Factory tempo slot. No icon was drawn. The bars are the roster mark.

### folded

A device folded to its title.

- **Usage.** A rack device shown as a narrow title, as in Live. The title is text written on the folded strip. This mark stands for that state in a legend or a menu.
- **States.** The folded state itself. Expand opens it. The launcher's chevron is fold, a different control.
- **Appears.** agent-shell-mockup.html .dev.folded and foldedRack(): a 24px-wide title column.

### expand

Expand in place.

- **Usage.** Deep edit, or expand neighbours without moving focus. The mockup's graph uses a +count badge for neighbours; this mark is the expand affordance ⤢.
- **States.** One drawing. Pop-out leaves the pane; expand stays in it.
- **Appears.** Named in the commission as ⤢. The graph mockup draws +n in a circle for neighbour expand. These two diagonals are the expand mark.

### pop-out

Pop a device out into its own pane or window.

- **Usage.** Device lifecycle pop-out. The mockup uses ↗ to open a thread. Pop-out is the box with an arrow leaving it: detach, then the pane engine's existing detach.
- **States.** One drawing. There is no separate pop-in mark; returning uses return or the pane's close.
- **Appears.** WORLD-SHELL-DESIGN.md §5 pop-out. The mockup's ↗ on an agent header is the open-thread cousin. This box-and-arrow is the device pop-out.

### refusing

This control will not run.

- **Usage.** A first-class refusal on a button or a device: the shell declined the action. Show it in place of, or beside, the action mark. Paint it at full strength with currentColor.
- **States.** The refusal itself. It is not a faded play, stop, or record.
- **Appears.** Save outcomes include refused (WORLD-SHELL-DESIGN.md §5 and §12). The mockup did not draw a refusal icon. The slashed square is the roster mark. Deny remains the admission light.

### disabled

Present, and not available.

- **Usage.** A control that is shown and cannot be used. Earth's landmass controls when Earth is given are the example. The mark stays full weight.
- **States.** A plate with a bar. Faint colour may accompany it; faint colour alone is not this state.
- **Appears.** WORLD-SHELL-DESIGN.md Revision 3: Earth's landmass controls are disabled. No icon was drawn. The barred plate is the roster mark.

### waiting

Waiting: the work has not returned.

- **Usage.** A stalled agent, a pending admission, or a chip with nothing to draw yet. Three dots at full size.
- **States.** The waiting state itself. The mockup's stalled badge used an orange ellipsis; the dots here are the mark, and any warning colour is the button's color.
- **Appears.** agent-shell-mockup.html stalled badge draws three dots. Those dots, without the hardcoded orange.


## Encounter spine

### field

Field: the bounded place the encounter admits.

- **Usage.** Encounter spine, beside World, Subject, and Occasion. The device family that edits a force field is field-lines.
- **States.** One drawing.
- **Appears.** WORLD-SHELL-DESIGN.md §2 and the aperture slot name Field. No icon was drawn. Four corners are the roster mark for a bounded field.

### world

World: which world this encounter stands in.

- **Usage.** Encounter spine. The Earth projection, with meridians, is earth. This mark is a body with a smaller body beside it: a world you can name.
- **States.** One drawing.
- **Appears.** The spine label World. The aperture list uses ◯ for a world body. The second body keeps this distinct from earth, from capture, and from the arm ring.

### subject

Subject: what the encounter is about.

- **Usage.** Encounter spine. The window title carries the subject's name; this mark is the subject in a legend or a chip.
- **States.** One drawing. Base's diamond has no stem. This diamond sits on a stem so the two can share a toolbar.
- **Appears.** The spine label Subject. No mockup icon. The stemmed diamond is the roster mark.

### occasion

Occasion: the time the encounter is held at.

- **Usage.** Encounter spine, and the Occasion clock beside Now and Transport. A clock with two hands. The device toggle's single hand is device. The pendulum is metronome.
- **States.** One drawing.
- **Appears.** WORLD-SHELL-DESIGN.md §8 names Occasion. No icon was drawn.

### aperture

Aperture: how much of the field is admitted.

- **Usage.** The aperture control. The mockup draws it as a row of named steps (your world, local, shared, federated). This iris is the mark for that control when a legend needs one. The step names stay text.
- **States.** One drawing. The current step is text or a segment, not a second iris.
- **Appears.** world-shell-mockup.html aperture slot, data-i "Aperture". No icon was drawn.

### view-as

View as: see the world as an audience sees it.

- **Usage.** The view-as slot, where Live has key and scale. What is not projected is fog. The word "as" and the audience name stay text.
- **States.** One eye. The skill stand-in review-pr is a filled eye; this one is stroked, with a second small arc for the other viewpoint.
- **Appears.** world-shell-mockup.html data-i "View as". The mockup wrote "as" plus a name. The eye is the roster mark.

### trail

Trail: the encounters you passed through.

- **Usage.** Context tile and back/forward through the encounter. A dotted path with an arrow.
- **States.** One drawing. An empty trail shows the mark with waiting, or the tile's own empty copy.
- **Appears.** world-shell-mockup.html context tile Trail, and MED does not draw a trail icon. The dotted path is the roster mark.

### packet

Packet: exactly what the agent receives.

- **Usage.** The packet device and the context tile. Token counts stay numerals. The envelope is the packet.
- **States.** One drawing. A refused packet shows refusing. A packet being built can show waiting.
- **Appears.** WORLD-SHELL-DESIGN.md Revision 5 packet slot, and the context tile Packet. No icon was drawn.

### contact

Contact: a two-way link that is open.

- **Usage.** An open contact between worlds, and the contribution/contact relation while it is live. Link is the transport join. Contact is two parties with arrows between them.
- **States.** One drawing. A contact that has not been admitted shows deny or waiting, not a faded contact.
- **Appears.** world-shell-mockup.html MED contact uses ⇄. The two nodes and opposing arrows are that character.

### return

Return: bring the work back to the holder.

- **Usage.** A Return in the encounter, and back to the previous encounter. Re-enable restores automation. Hand-back returns custody. This hook is the return of work or of navigation.
- **States.** One drawing.
- **Appears.** world-shell-mockup.html MED return uses ↩, and the browser back control is ‹. The hook is the return mark.


## Document forms

### day

Day: the day's die, six faces, four positions and two poles.

- **Usage.** The Day document. Face names and the open face stay in the document. This cube is the form's mark in a browser or a tab.
- **States.** One drawing. The open face is document state, not a second glyph.
- **Appears.** world-shell-mockup.html APS day uses ⚀, and Revision 3 draws the die as six faces. The cube stands for that die.

### flow

Flow: dialogue, flow, and journal.

- **Usage.** The Flow document. Participants are drawn in the page: a person solid, an agent as points. This pilcrow is the form's mark.
- **States.** One drawing.
- **Appears.** Ported from the pilcrow the mockup uses for Flow (APS flow, g ¶).

### beings

Beings: a presence and its world.

- **Usage.** The Beings document. A person is drawn solid, matching the Flow rule for a human participant.
- **States.** One filled figure. An agent participant drawn as points belongs to the document body, not to this mark.
- **Appears.** Revision 3: a person drawn solid. APS being used ☺; this roster does not use that face. The solid figure is the form.

### things

Things: a subject and its relations.

- **Usage.** The Things document. A page with a folded corner. The detail toggle's ruled square is detail.
- **States.** One drawing.
- **Appears.** APS thing uses ▤, the same character as the detail chrome. The roster gives Things a page, and keeps the ruled square for detail.

### clip

Clip: what is in focus.

- **Usage.** The Clip side of the Clip | Device toggle in the status bar. The square is the mockup's ▢.
- **States.** One drawing. Selected paints the button with var(--accent) via color.
- **Appears.** Ported from the ▢ Clip label in world-shell-mockup.html status toggle.

### device

Device: what works on the focus.

- **Usage.** The Device side of the Clip | Device toggle. A circle with one hand, the mockup's ◷.
- **States.** One drawing.
- **Appears.** Ported from the ◷ Device label in the status toggle.


## Chrome

### browser

Show or hide the browser.

- **Usage.** Chrome toggle for the left browser and the aperture slot.
- **States.** One drawing. On uses var(--accent) via color.
- **Appears.** Ported from the ▥ browser chrome character in world-shell-mockup.html.

### detail

Show or hide the detail row.

- **Usage.** Chrome toggle for Clip | Device. The ruled square is the mockup's ▤.
- **States.** One drawing.
- **Appears.** Ported from the ▤ detail chrome character.

### companion

Show or hide the companion and the launcher.

- **Usage.** Chrome toggle for the context dock.
- **States.** One drawing.
- **Appears.** Ported from the companion path in world-shell-mockup.html. Stroke cleaned from 1.8 to 1.5.

### panes

Pane layout.

- **Usage.** The chrome button that opens the pane menu: split beside, split below, four-fold, close. Same drawing as four-fold.
- **States.** One drawing.
- **Appears.** Ported from the ⊞ pane button in world-shell-mockup.html.

### split-beside

Split the focused pane beside itself.

- **Usage.** Pane menu. A vertical split.
- **States.** One drawing.
- **Appears.** world-shell-mockup.html renderPmenu "Split beside", character ⇥. The divided rectangle is that action.

### split-below

Split the focused pane below itself.

- **Usage.** Pane menu. A horizontal split.
- **States.** One drawing.
- **Appears.** renderPmenu "Split below", character ⤓.

### four-fold

Split the focused pane into four.

- **Usage.** Pane menu. Same drawing as the panes button, because that button is this mark.
- **States.** One drawing, shared with panes.
- **Appears.** renderPmenu "Four-fold", character ⊞.

### close-pane

Close the focused pane.

- **Usage.** Pane menu. Closing the last pane is the shell's own rule; the mark is only the close.
- **States.** One drawing.
- **Appears.** renderPmenu "Close pane", character ✕.

### fold

Fold the launcher down to its search bar.

- **Usage.** The launcher fold chevron. A folded device in the rack is folded, not this chevron.
- **States.** One chevron. The expanded launcher points down; the folded launcher can rotate the same mark.
- **Appears.** Ported from the ▾ fold control on the launcher in both mockups.


## Skill stand-ins

### port-widgets

Skill stand-in: port widgets.

- **Usage.** A skill chip in a skillset rack until an authored engine glyph replaces it. The picture is a diamond.
- **States.** One drawing. The row's light is admit or deny.
- **Appears.** Ported from agent-shell-mockup.html SK['port-widgets'], scaled from 16 to 24. They are geometric stand-ins; the Expressions glyph library is their intended later source.

### capture-plan

Skill stand-in: capture a plan.

- **Usage.** A skill chip. A ring with a hole.
- **States.** One drawing. Admission is the light, not a fade.
- **Appears.** Ported from SK['capture-plan'], scaled from 16 to 24, even-odd hole kept.

### diff-grammar

Skill stand-in: diff a grammar.

- **Usage.** A skill chip. Three waves.
- **States.** One drawing.
- **Appears.** Ported from SK['diff-grammar'], the stroked triple wave, scaled from 16 to 24. Stroke is the roster's 1.5.

### review-pr

Skill stand-in: review a change.

- **Usage.** A skill chip. A filled eye. View-as is the stroked eye used for the audience control.
- **States.** One drawing.
- **Appears.** Ported from SK['review-pr'], scaled from 16 to 24, even-odd pupil kept.

### tune-physics

Skill stand-in: tune physics.

- **Usage.** A skill chip. A triangle with a hole.
- **States.** One drawing.
- **Appears.** Ported from SK['tune-physics'], scaled from 16 to 24.

### deploy

Skill stand-in: deploy.

- **Usage.** A skill chip. An arrow up onto a baseline.
- **States.** One drawing.
- **Appears.** Ported from SK['deploy'], the stroked arrow, scaled from 16 to 24.

### test-depth

Skill stand-in: test depth.

- **Usage.** A skill chip. Three bars, wide to narrow.
- **States.** One drawing. The macro's depth value stays a word or a number.
- **Appears.** Ported from SK['test-depth'], scaled from 16 to 24.

