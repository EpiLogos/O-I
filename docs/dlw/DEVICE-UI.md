# Device UI

You play a device while your attention is on the material. The agent runs, the
field moves, the torus rings, and your eyes are there, not on the device. So a
device must show its state at a glance, answer the hand at once, and never ask
you to read. Live solved this. Every Live device is one panel of one height:
a picture of what the device does, with handles on it, and the controls set
round the picture. You learn one panel and you can read all of them.

The DLW draws every device the same way: one head, one height, a picture with
handles, and the same few controls round it. What a device does is in its
catalogue entry. How it looks and how it answers your hand is set out here,
and five reference devices run live in §9.

## 1. What a device panel is

**A designed face, not a form.** A device's parameters are its contract with
its owner. Its panel is drawn by hand for that device, as every Live device
is. A list of parameters drawn one under the other is the fallback, and only
for a device that ships no panel of its own. Live does the same for a plug-in
that has no editor.

**The picture comes first.** Most panels have a display: a dark well that
draws the device's state from its live values. EQ Eight draws its curve,
Auto Filter its filter, Wavetable its wave. Handles in the well are controls:
drag the picture and the parameter moves. The other controls stand round the
display, in sections.

**One height, many widths.** On a chain, every device has the same height.
The width comes from what the device holds. A small effect is narrow, and an
instrument with two displays is wide.

**Nothing scrolls, and no box sits inside a box.** Sections are columns,
ruled off from each other by a hairline and named in small capitals. The well
is the only inset surface. When a panel holds more than fits, it gets pages in
its head, as Wavetable has Osc 1 and Osc 2.

**Values are short.** A control shows a number, a unit or a word. A sentence
never appears in a panel. What a control does is said in the status bar when
you point at it.

## 2. One device, five views

A device has one set of values and five views. All five show the same values.
A change in one view shows in the other four at once.

| View | Where | Size | What it holds | Live's nearest |
|---|---|---|---|---|
| Folded | A chain | 22 px wide, chain height | The activator, the name, up to two short readings, read downward. | A folded device. |
| Compact | A chain | Chain height. The width comes from its sections. | The display and up to four macros. | A rack with only its macros showing; a small device such as Utility. |
| Whole | The pool under the browser | The pool's width, one or two bands high. Pages when more is needed. | Every parameter, grouped, and the display with all its handles. | The full panel of a device, with its pages. |
| Full | A pane | The pane | The material itself: the page, the field, the torus, the world. No controls. | Wavetable's expanded view; a plug-in window. |
| Widget | The rail | A tile of 136 × 136 px, or 280 × 136 px | A small display and up to three readings or macros. | Live has none. Push's display is the nearest. |

- Press a plate on a chain to show its device whole in the pool.
- Press ⤢ to open the device full in a pane.
- Press ▾ in the head to fold the device. Press the folded title to open it.
- A pane holds no device controls. They stay in Device view under the pane.
  When you maximise the pane to the window, the device can show its own
  controls inside it.
- A widget stays on the rail when you change mode. You choose what its tile
  shows.

## 3. Measures

All measures are in pixels at 100 %. The grid is 4 px.

| Part | Measure |
|---|---|
| Head | 22 high |
| Band (the body on a chain) | 168 high |
| Plate on a chain | 191 high: head, band and borders |
| Control column | 56 wide |
| Dial | 28 square, a 270° ring |
| Value box | 16 high, 50 wide or more |
| Toggle, radio button, chooser, action | 16 high |
| Hit area of any control | 22 or more in each direction |
| Row of a list | 17 high |
| Display on a compact plate | 140 × 146 |
| Display on a whole plate | up to 194 × 146 |
| Section label | 9 px capitals, 13 high |
| Names and values | 10 to 11 px |
| Folded strip | 22 wide |
| Widget tile | 136 × 136, or 280 × 136 |
| Pool | 400 wide |

The plate does not reflow. When the detail area is shorter or taller, the
whole plate scales between 80 % and 125 %, as Live's zoom scales its devices.

## 4. Anatomy

### 4.1 The head

From left to right:

1. **Activator.** A round light. Amber: the owner reports the device on.
   Grey: the owner reports it off. A hollow ring: the owner has not said. Press
   it to ask the owner to turn the device on or off. The light changes only
   when the owner answers.
2. **Fold** ▾.
3. **Name.** A rack shows its set's name: "Skills · build-lane".
4. **Held mark.** The name of whoever holds values on this device, in the
   stall colour.
5. **Pages.** One tab for each page. The shown page joins the body's face. A
   page can carry its own light, as Hybrid Reverb's EQ tab does.
6. **Open full** ⤢, at the right.

Right-click the head for Save as preset, Hot-swap, Show automation and Map.

### 4.2 The body

The body is one band on a chain and one or two bands in the pool. A band is a
row of sections. A section is a column of controls with a label. The display
stands in a section of its own, at the left.

### 4.3 Colours

| Colour | Means |
|---|---|
| Face | The body of the plate. |
| Head | Lighter than the face. Tinted blue when the device is selected. |
| Field | The ground of value boxes, toggles and choosers. |
| Well | The display. Near black. |
| Teal | A value: a dial's arc, a value box's fill, a curve, a reach for reading. |
| Amber | On: a toggle, a chosen radio button, the activator, a handle, a reach for writing. |
| Green | An owner's yes: a skill admitted, a task done. |
| Orange | Someone else holds this value. |
| Red | Automation, and the record button. |

A device does not bring colours of its own. A colour inside a display carries
a meaning of the material, as a track's colour does.

## 5. Controls

A panel uses these controls and no others.

| Control | Use it for | It shows | Live's nearest |
|---|---|---|---|
| Dial | A number that you sweep | The name above, a 270° ring with a teal arc, the value below. A value that can turn either way starts its arc at zero. | A knob. |
| Value box | A number where space is short, or one you set exactly | The value in a field that fills teal to its place in the range. | A slider, such as Wavetable's Volume. |
| Toggle | On or off | The name in a box, amber when on. | Auto Filter's Hz button. |
| Radio | One of two to five | Buttons side by side or stacked; the chosen one amber. | Auto Filter's filter types. |
| Chooser | One of many | The value and ▾; a menu. | Wavetable's wavetable menu. |
| Rows | A list: a rack's chains, a scope's places | One row each: your request as a square, the owner's answer as a light, the name, a short note. A long list pages. | A rack's chain list. |
| Readout | A reading | A short value over its name. A large readout is the count that the view is for. | Hybrid Reverb's "100 % / 285 ms". |
| Action | Something done once | The name in an outlined box. | A momentary button. |
| Light | A state that the owner reports | A small round light. | A chain's activator. |
| Handle | A parameter that you move on the picture | An amber ring, numbered in order of importance. | EQ Eight's band dots. |

### 5.1 The hand

The same moves work on every control that holds a number.

| Do | Result |
|---|---|
| Drag up or down | The value moves. The whole range is 160 px. A stepped value moves one step for each 14 px. |
| Hold Shift while you drag | The value moves ten times more slowly. |
| Double-click | The value returns to its default. |
| Focus it and press ↑ ↓ or ← → | One step, or 1 % of the range. |
| Page Up, Page Down | 10 % of the range. |
| Home, End | The minimum, the maximum. |
| Delete | The default. |
| Point at it | The status bar says its name and what it does. |

A handle moves in the directions that its picture shows. A handle for two
parameters, such as gravity across and up, moves in two directions. The arrow
keys move a focused handle 2 px, or 0.5 px with Shift.

### 5.2 A change and its answer

While you drag, the control shows the value you set. When you release it, the
new value goes to the owner; a key press sends at once. Until the owner
confirms the value, it shows in italics. If the owner refuses, the control
returns to the owner's value, and the status bar gives the owner's reason.

Some changes ask you first. When you raise a scope's reach, the new reach
waits, drawn dashed, with Confirm and Cancel beside it. Nothing is sent until
you confirm.

## 6. Standing

Besides its value, a control shows who moves it.

| Standing | How it shows | What you do |
|---|---|---|
| Automated | A red dot at the control's top left. | Move it to override the lane. |
| Overridden | A hollow red dot. The transport's Re-enable lights. | Press Re-enable to give the value back to its lane. |
| Modulated | A thin outer arc on the dial: the range that the modulator moves the value through. The status bar names the modulator. | Set the centre of the range with the dial. |
| Held | The arc or the fill in orange, and the holder's name under the control. | Press the name to give the value back. |
| Waiting | The value in italics, the arc dashed. | Wait for the owner, or move it again. |
| Disabled | The control at 40 % strength. The status bar says why. | Do what the reason says. |
| No reading | A hollow light. | Nothing. The owner has not said. |

## 7. The display

- Draw every mark from the device's values or readings, by the device's own
  law. Do not draw a likely picture.
- When a reading is missing, say which one in the well. Do not draw it as zero.
- Give a compact display at least one handle: the one parameter that you most
  often move. Give a whole display a handle for each parameter that the
  picture can show.
- Number the handles 1, 2 and on, in order of importance.
- Put axis labels inside the well, small and faint. Put one short reading at
  the top right.
- Move the picture only when its readings move. Respect a request for reduced
  motion.
- A rack's picture is its chain list.

## 8. What a device supplies

A device brings these to the shell:

1. **Its parameters**, each declared under the device's own id: key, name,
   kind, range or values, default, unit, group, whether it is a macro, and its
   write path. A parameter without a write path is a reading.
2. **Its five views**, built from the panel kit: folded, compact, whole, full
   and widget.
3. **Its displays and their handles.**

The shell brings the values, the writes, the navigation between views, and the
standing of each parameter: its automation, its modulator, its holder.

The panel kit is `packages/live-shell/ui/src/inhabitants/sdk/panel.tsx`. A
device without views of its own is drawn by the generic plate: its parameters,
grouped, in the order the device declares them.

## 9. The reference devices

Five devices show the whole pattern. Each runs on a labelled fixture. Move a
control in one view and the other four follow. Point at a control to read what
it does, in the line under the views.

| Device | Kind | It shows | Live's nearest |
|---|---|---|---|
| Day | Instrument | A display that you click. Pages that are two things at once: today's Day and tomorrow's. Macros of four kinds. | Hybrid Reverb |
| Torus | Instrument | A picture drawn by the law that it plays. Handles on the picture. An envelope display. A modulation arc and an automation dot. | Wavetable |
| Physics | Effect | A law drawn as a diagram with a two-way handle. Pages for a long set of parameters. Macros on the widget. | Auto Filter, Corpus |
| Skillset rack | Rack | The chain list as the picture. Your request beside the owner's answer. Pages instead of a scroller. | Audio Effect Rack |
| Scope | Effect | A change that asks you first. Two reaches on one picture. A list where you request places. | Utility |

### 9.1 Day

```ui
device: central:day-die
width: 1500
height: 940
caption: The Day in its five views, on one set of values. Click a face of the die, or turn the Face dial.
```

| View | Holds | Why |
|---|---|---|
| Folded | Day, the date, the open face. | The date and the face are what you look for. |
| Compact | The die's net, the open face lit, a dot on a face where the agent waits for you. Macros: Face, Rollover, Agent, Close now. | The net is the die's own fold round face 0: 2 above, 4, 0, 1 and 5 across, 3 below. Opposite faces add to five. |
| Whole | Pages Today and Tomorrow. Band one: the net with names and counts, Face, View, Template, the waiting and running counts. Band two: Time, Agent, Sources, Close. | A Day after rollover is two Days. The pages make that plain. |
| Full | The template's page, with the pane's own tabs for the two Days. | The page is the Day's material. |
| Widget | A small net and three counts: tasks, running, patterns. Press a count to open its face. | The three counts are the day's pulse. |

Rollover and Day start are value boxes whose lowest step is Off. Close now is
an action, because it runs once.

### 9.2 Torus

```ui
device: quaternal-logic:torus
width: 1500
height: 940
caption: The Torus in its five views. Drag handle 1 along the line to mix the pulses; drag handle 2 out from the ring to drive the body.
```

| View | Holds | Why |
|---|---|---|
| Folded | Torus, the level, the notes that sound. | |
| Compact | The torus: the ring, the surface wave and the two helices. Handle 1 on the pulse line, handle 2 on the wave's crest. Macros: Pulse mix, Damping, Drive, Release. | You hear what you see: the wave is the sound's pattern. |
| Whole | Band one: the torus, Pulses, Output. Band two: Body, the Envelope display with its two squares, Voices and View. | Two displays, as Wavetable has its oscillator and its envelope. |
| Full | The torus at pane size and the Jankó keyboard under it. A sounding note lights its key and its point on the ring. | The pane is the instrument that you play. |
| Widget | The small torus and a level meter. | |

Drive carries a modulation arc: the sky moves it. Level carries an automation
dot.

### 9.3 Physics

```ui
device: expressions:physics
width: 1500
height: 1000
caption: Physics in its five views. Drag handle 1 to set the swirl's reach and handle 2 to push the field. Turn to the Physics+ page for gravity in depth.
```

| View | Holds | Why |
|---|---|---|
| Folded | Physics, viscosity, vortex. | |
| Compact | The swirl: stream lines stepped through the swirl and gravity, the reach ring, the gravity arrow. Macros: Viscosity, Vortex, Gravity Y, Time. | A stream line shows what the law does to a particle. |
| Whole | Pages Fluid and Physics+. Fluid: the swirl, Swirl, Spring, Curl and stir, Field. Physics+: the gravity pad with depth, Gravity, Medium, Drag, Limit, Time. | Twenty parameters do not fit in two bands. Pages do not scroll. |
| Full | The field's law at pane size. | In the shell, the pane is the field itself. |
| Widget | The swirl and the four macros as value boxes. | A macro on the widget is the macro on the chain. |

In the shell, the display is the field's own diagram, drawn from the engine's
readings by the same law.

### 9.4 Skillset rack

```ui
device: ai-kit:skillset-rack
width: 1500
height: 940
caption: The Skillset rack in its five views. The square is your request, the light is AIKit's answer. Point at a dark chain to read why.
```

| View | Holds | Why |
|---|---|---|
| Folded | The set's name, the lit chains. | |
| Compact | The chain list and the four macros: Thoroughness, Tests, Reach, Risk. | A rack has no wave to draw. Its chains are its picture. |
| Whole | Band one: Set (the set, the steward, the revision, the admitted count) and the macros. Band two: every chain, in two columns, paged. | |
| Full | The set as a page: each skill, its revision, its standing and what it does. | The set is a document that you read. |
| Widget | The first chains and the four macro values. | |

A chain that you request and AIKit holds back stays dark, with a ! that gives
the reason.

### 9.5 Scope

```ui
device: software-factory:context-write-mode
width: 1500
height: 940
caption: Scope in its five views. Raise the reach and it waits for you to confirm. Teal is what the agent may read; amber is what it may write.
```

| View | Holds | Why |
|---|---|---|
| Folded | Scope, the reach. | |
| Compact | The rings, teal over the top for reads and amber under the bottom for writes; the basis. Macros: Reach, Writes, and the counts of read and write places. | Both reaches show even when they are on one ring. |
| Whole | Band one: the rings with the reach handle, Reach with Confirm and Cancel, how writes arrive, the receipts. Band two: Reads, Writes, Knowledge and the basis. | |
| Full | The world the agent may touch, with its receipts on the places it wrote. | |
| Widget | Small rings, the reach, the write mode, the receipts. | |

## 10. When a device's UI is done

A device's UI is done when all of these are true:

- All five views draw in the device gallery on the device's declared
  parameters.
- The five views move together.
- Every control says what it does in the status bar.
- Nothing scrolls inside a plate, and no box sits inside a box.
- The compact view has four macros or fewer.
- The display draws from values, and its handles move the parameters they
  show.
- Every control works from the keyboard.
- The views match the device's catalogue entry.
- Beside its Live nearest, the plate reads as a Live device.

To see a device in the gallery, run the gallery from `packages/live-shell/ui`:

```bash
npx vite --config src/inhabitants/catalogue/vite.config.mjs
```

Then open `?device=<family>:<face>&view=all`. Add `&generic=1` to see the
generic plate of the same device.

## 11. The runtime

- The device runtime draws a device's own views when it has them, and the
  generic plate when it does not.
- The runtime has one size for each of the five views. Whole holds the
  controls. Full holds the material.
- The panel kit draws the head, the sections and the controls of every plate,
  generic plates included. An instrument's sections are bands and sections.
- A change goes to the owner when you release the control, as §5.2 says. No
  plate has a Send button.
- A field device of Expressions uses its field diagram as its display.
