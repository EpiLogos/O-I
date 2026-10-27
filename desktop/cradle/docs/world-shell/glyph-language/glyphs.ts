/**
 * Glyph roster for the world shell.
 *
 * Typed source for the sprite at roster.svg. Bodies use currentColor only.
 * Grid is 24. Stroke weight is 1.5 with round caps and joins. Marks the
 * mockup filled stay filled. A consumer sets colour with a design token on
 * the element (`color: var(--text)`), never inside the mark.
 *
 * Ported geometry keeps the mockup's path, moved onto this grid. A skill
 * stand-in drawn on the 16-grid in agent-shell-mockup.html is scaled by 1.5.
 * Where the mockup used a character, the body is that character's plain
 * meaning, drawn for this grid. Those cases say so in `appears`.
 */

export const GLYPH_VIEWBOX = "0 0 24 24" as const;
export const GLYPH_STROKE = 1.5 as const;

export const GLYPH_GROUPS = [
  "transport",
  "mode",
  "projection",
  "family",
  "product",
  "state",
  "spine",
  "document",
  "chrome",
  "skill",
] as const;

export type GlyphGroup = (typeof GLYPH_GROUPS)[number];

export const GROUP_LABELS: Record<GlyphGroup, string> = {
  transport: "Transport",
  mode: "Mode selector",
  projection: "Projections",
  family: "Device families",
  product: "Products",
  state: "Device and skill states",
  spine: "Encounter spine",
  document: "Document forms",
  chrome: "Chrome",
  skill: "Skill stand-ins",
};

export interface GlyphDef {
  group: GlyphGroup;
  /** One sentence: what the mark means. */
  meaning: string;
  /** Where a consumer puts it, and the token colour if the shell has one. */
  usage: string;
  /** How this mark behaves when the control is on, refused, disabled, or waiting. */
  states: string;
  /** Mockup or engine source. Plain when this roster drew it. */
  appears: string;
  /** Inner markup of the 24×24 symbol. */
  body: string;
}

const stroke = `fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"`;

function g(inner: string): string {
  return `<g ${stroke}>${inner}</g>`;
}

export const GLYPHS = {
  play: {
    group: "transport",
    meaning: `Start the transport.`,
    usage: `The play slot in every mode. Live plays; Base sends the packet; Factory runs; Expressions plays scenes; Technē walks. The button paints an active play control with var(--accent).`,
    states: `One filled triangle. A play control that refuses shows refusing beside it. A play control that cannot run shows disabled. A play control waiting on a peer shows waiting.`,
    appears: `Ported from world-shell-mockup.html SV.play (M7 4.5v15l13-7.5z).`,
    body: `<path fill="currentColor" d="M7 4.5v15l13-7.5z"/>`,
  },
  stop: {
    group: "transport",
    meaning: `Stop the transport.`,
    usage: `The stop slot. Once pauses at the next quantize point. Twice returns to Now, discards the answer, or cancels, following the mode.`,
    states: `One filled square. Refusal, disability, and waiting use those state glyphs.`,
    appears: `Ported from world-shell-mockup.html SV.stop.`,
    body: `<path fill="currentColor" d="M6 6h12v12H6z"/>`,
  },
  record: {
    group: "transport",
    meaning: `Record into the armed target.`,
    usage: `The record slot. Live records the arrangement; Base dictates; Factory takes voice; Expressions captures a take; Technē records a walk. The shell paints a live record control with var(--rec).`,
    states: `One filled circle. The live colour is the button's color, not a second drawing.`,
    appears: `Ported from world-shell-mockup.html SV.rec.`,
    body: `<path fill="currentColor" d="M12 5.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13z"/>`,
  },
  arm: {
    group: "transport",
    meaning: `Arm writes so they can land.`,
    usage: `The arm slot: automation arm, write arm, Studio arm, or instrument writes. Off, edits arrive as proposals. On, they land with a receipt.`,
    states: `The ring is the housing and the centre dot is the armed light. Deny replaces the dot when admission is refused. Disabled replaces the whole control when arming cannot be offered.`,
    appears: `The mockup drew this slot as the character ⌘. The roster mark is the arm ring the slot describes.`,
    body: `${g(`<circle cx="12" cy="12" r="7"/>`)}<circle cx="12" cy="12" r="2.2" fill="currentColor"/>`,
  },
  loop: {
    group: "transport",
    meaning: `Brace a region and repeat it.`,
    usage: `The loop slot between the two brace fields. Live loops a section; Base runs the close routine; Factory repeats a task; Expressions loops scenes; Technē limits panes to an occasion window.`,
    states: `One drawing. The button's on state uses var(--accent) via color.`,
    appears: `Ported from world-shell-mockup.html SV.loop. Stroke cleaned from 2 to 1.5.`,
    body: g(`<path d="M17 3.5l3.5 3.5-3.5 3.5M20.5 7H8.5a5 5 0 0 0-5 5M7 20.5 3.5 17 7 13.5M3.5 17h12a5 5 0 0 0 5-5"/>`),
  },
  punch: {
    group: "transport",
    meaning: `Punch in and out of record on the brace.`,
    usage: `The punch action on the loop brace. The two fields stay numeric; this mark is the punch itself.`,
    states: `One drawing. The brace numbers are text, not glyphs.`,
    appears: `Revision 5 names punch on the Live transport. The mockup drew the brace as loop plus two fields. This flag-on-a-post is the punch mark for that slot.`,
    body: `<path fill="currentColor" d="M5 4h2.2v16H5z"/><path fill="currentColor" d="M7.2 8.2 16.5 12 7.2 15.8z"/>`,
  },
  tap: {
    group: "transport",
    meaning: `Tap a tempo or stamp the present.`,
    usage: `The tap slot. Live and Expressions tap tempo. Base stamps Now into the focused document. Factory asks running agents for a status line. Technē snaps the occasion back to Now.`,
    states: `One drawing.`,
    appears: `The mockup drew the word Tap. The ripples are that action.`,
    body: `${g(`<path d="M7.2 12.2a6.2 6.2 0 0 1 9.6 0"/><path d="M4.6 9.2a9.4 9.4 0 0 1 14.8 0"/>`)}<circle cx="12" cy="15.6" r="1.7" fill="currentColor"/>`,
  },
  link: {
    group: "transport",
    meaning: `Join this session to peers on one clock.`,
    usage: `The link slot. Live shares tempo; Base shares the ground; Factory joins harnesses; Expressions syncs a field; Technē joins the field carrier.`,
    states: `One drawing. Off, the same grammar runs on local material. The count of peers stays a numeral beside the mark.`,
    appears: `The mockup drew the word Link. Two overlapping stadiums are the link.`,
    body: g(`<rect x="3.5" y="6.5" width="11" height="6" rx="3"/><rect x="9.5" y="11.5" width="11" height="6" rx="3"/>`),
  },
  metronome: {
    group: "transport",
    meaning: `The pulse that the other slots quantize to.`,
    usage: `The metronome slot. Live clicks; Base autosaves; Factory heartbeats; Expressions pulses the field; Technē shows presence.`,
    states: `One drawing. The mockup's on state is the button color.`,
    appears: `The mockup drew ●◦ for this slot. The pendulum is the metronome that character stood for.`,
    body: g(`<path d="M8.5 19.5 12 4.5 15.5 19.5z"/><path d="M12 17.5 16.2 9"/>`),
  },
  "re-enable": {
    group: "transport",
    meaning: `Return a lane to its recorded automation.`,
    usage: `The re-enable slot in Live and Expressions. The same slot is hand-back in Base, Factory, and Technē; use hand-back there.`,
    states: `One drawing. Lit means the recorded line is waiting to be restored.`,
    appears: `Revision 5 names re-enable automation. The curve rejoining a baseline is that action. Hand-back keeps the left arrow the mockup drew for the other meaning of this slot.`,
    body: g(`<path d="M4 17.5h16"/><path d="M16 17.5A6 6 0 0 0 10 11.5H7"/><path d="M10 8.5 7 11.5 10 14.5"/>`),
  },
  capture: {
    group: "transport",
    meaning: `Catch what just happened into the slot's target.`,
    usage: `The capture slot. Live captures MIDI; Base takes the selection into the packet; Factory records a worked example; Expressions captures gestures as a scene; Technē captures the view as a scene.`,
    states: `One open circle, the mockup's ○. Record is the filled circle. They stay distinct.`,
    appears: `Ported from the transport's ○ character in world-shell-mockup.html renderTransport.`,
    body: g(`<circle cx="12" cy="12" r="6.5"/>`),
  },
  overdub: {
    group: "transport",
    meaning: `Layer the next pass on the current one.`,
    usage: `The plus slot beside record. Live overdubs; Base appends; Factory's same slot is steer when the meaning is steering; Expressions layers a take; Technē extends the walk. Use steer when the slot steers a running turn.`,
    states: `One plus. The button on-state is color.`,
    appears: `Ported from the transport's + character.`,
    body: g(`<path d="M12 5v14M5 12h14"/>`),
  },
  follow: {
    group: "transport",
    meaning: `Panes follow the encounter.`,
    usage: `The follow control. A pane that is pinned keeps its own context; follow moves the panes that are still attached.`,
    states: `One arrow. On uses var(--accent) via color.`,
    appears: `Ported from the transport's ➜ character.`,
    body: g(`<path d="M4 12h13"/><path d="M13 7l5 5-5 5"/>`),
  },
  session: {
    group: "transport",
    meaning: `Session view: rows you launch.`,
    usage: `The session icon, left of the mode icons. Live shows clips and scenes; Base shows the day as clips; Factory shows sessions and tasks; Expressions shows scene rows; Technē shows the Journey.`,
    states: `One drawing. The mode changes what the view contains, not the mark.`,
    appears: `Ported from world-shell-mockup.html renderTransport, the Session button path.`,
    body: g(`<path d="M5 4v16M12 4v16M19 4v16"/>`),
  },
  arrangement: {
    group: "transport",
    meaning: `Arrangement view: one ruler over time.`,
    usage: `The arrangement icon beside session. Live shows the song; Base shows today; Factory shows the run viewer; Expressions shows scenes over time; Technē shows the relation field.`,
    states: `One drawing.`,
    appears: `Ported from world-shell-mockup.html renderTransport, the Arrangement button path. Timeline adds a playhead; this mark stays the three bars.`,
    body: g(`<path d="M4 5h16M4 12h16M4 19h16"/>`),
  },

  live: {
    group: "mode",
    meaning: `Live, the musical working mode.`,
    usage: `Mode selector. Live is the shell's base musical mode: clips, scenes, and the transport's musical meanings.`,
    states: `One drawing. The selected mode paints the button with var(--accent) via color.`,
    appears: `Ported from world-shell-mockup.html MODES live path.`,
    body: g(`<path d="M3 12h3l3-7 4 14 3-7h5"/>`),
  },
  base: {
    group: "mode",
    meaning: `Base · Central: the ground and its documents.`,
    usage: `Mode selector for Day, Flow, Beings, and Things with a situated agent. The central product uses the same diamond; see central.`,
    states: `One drawing.`,
    appears: `Ported from world-shell-mockup.html MODES base path, the diamond.`,
    body: g(`<path d="M12 3.5 20.5 12 12 20.5 3.5 12z"/>`),
  },
  factory: {
    group: "mode",
    meaning: `Factory: sessions, runs, and their results.`,
    usage: `Mode selector. The software-factory product uses the same hexagon; see software-factory.`,
    states: `One drawing.`,
    appears: `Ported from world-shell-mockup.html MODES factory path.`,
    body: g(`<path d="M12 3.5 19.4 7.75v8.5L12 20.5l-7.4-4.25v-8.5z"/>`),
  },
  expressions: {
    group: "mode",
    meaning: `Expressions: the lived field.`,
    usage: `Mode selector. The Expression projection is the four-point star, expression. This mode mark is the field with a centre.`,
    states: `One drawing.`,
    appears: `Ported from world-shell-mockup.html MODES expressions path: two rings and a cross.`,
    body: g(`<path d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18z"/><path d="M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10z"/><path d="M12 10v4M10 12h4"/>`),
  },
  techne: {
    group: "mode",
    meaning: `Technē: the six instruments over one subject.`,
    usage: `Mode selector. The four linked squares are the mockup's Technē mark. Instrument names M0′–M5′ stay text.`,
    states: `One drawing.`,
    appears: `Ported from world-shell-mockup.html MODES techne path, including its uneven squares.`,
    body: g(`<path d="M5 5h4v4H5zM15 15h4v4h-4zM15 4h5v5h-5zM4 15h5v5H4z"/><path d="M9 7h6M7 9v6M9 17h6M17 9v6"/>`),
  },

  earth: {
    group: "projection",
    meaning: `Earth and the solar-system field: bodies in one space.`,
    usage: `The Earth / Solar-System projection, and the Home control that opens it. Your body in the field, Earth at its root.`,
    states: `One drawing. Landmass controls that Earth refuses stay on the control, with disabled, because Earth is given.`,
    appears: `Ported from world-shell-mockup.html SV.earth. Stroke cleaned from 1.8 to 1.5.`,
    body: g(`<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c3 3 3 14 0 17M12 3.5c-3 3-3 14 0 17"/>`),
  },
  timeline: {
    group: "projection",
    meaning: `Time: authored history on lanes.`,
    usage: `The Timeline projection. Arrangement keeps the three bars alone; this mark adds the playhead the projection draws.`,
    states: `One drawing.`,
    appears: `The mockup's aperture character for Timeline is ≡, the same three bars as arrangement. The playhead is added so the projection can be told from the view icon.`,
    body: g(`<path d="M4 6.5h16M4 12h10M4 17.5h16"/><path d="M15 3.5v17"/>`),
  },
  constellation: {
    group: "projection",
    meaning: `Relation: arrange, frame, and connect.`,
    usage: `The Constellation projection (Canvas in the mockup's aperture list).`,
    states: `One drawing.`,
    appears: `Ported from the aperture character ▣ on canvas in world-shell-mockup.html APS.`,
    body: g(`<path d="M5 5h14v14H5z"/><path d="M9 9h6v6H9z"/>`),
  },
  expression: {
    group: "projection",
    meaning: `Form: an expression of the subject.`,
    usage: `The Expression projection. The Expressions mode uses expressions, the ringed field.`,
    states: `One drawing. An engine glyph inside an expression chip uses the chip spec, not this star.`,
    appears: `Ported from the aperture character ✦ on expression in world-shell-mockup.html APS.`,
    body: `<path fill="currentColor" d="M12 3.2 13.4 10.6 20.8 12 13.4 13.4 12 20.8 10.6 13.4 3.2 12 10.6 10.6z"/>`,
  },

  morph: {
    group: "family",
    meaning: `The morph device: one form becoming another.`,
    usage: `Rack face for the morph family. Square and circle overlap to show the change.`,
    states: `One drawing. Folded, expanded, and popped out use folded, expand, and pop-out.`,
    appears: `WORLD-SHELL-DESIGN.md §5 names morph as a parameter device. The mockup did not draw a morph icon. This overlap is the roster mark.`,
    body: g(`<rect x="4" y="7" width="9" height="9"/><circle cx="14.5" cy="12" r="5"/>`),
  },
  colour: {
    group: "family",
    meaning: `The colour device.`,
    usage: `Rack face for colour. The wedge is a sector of the circle. The hue is the device's own reading, never a colour baked into this mark.`,
    states: `One drawing.`,
    appears: `WORLD-SHELL-DESIGN.md §5 names colour as a parameter device. No mockup icon. The outlined sector is the roster mark.`,
    body: g(`<circle cx="12" cy="12" r="7"/><path d="M12 5v7h7"/>`),
  },
  force: {
    group: "family",
    meaning: `The force device: a push applied to a target.`,
    usage: `Rack face for force. Field lines are field-lines, the sibling face.`,
    states: `One drawing.`,
    appears: `WORLD-SHELL-DESIGN.md §5 names force as a parameter device. No mockup icon.`,
    body: g(`<path d="M12 4v9"/><path d="M8 10l4 4 4-4"/><path d="M5 19h14"/>`),
  },
  "field-lines": {
    group: "family",
    meaning: `The field device: a field the force sits in.`,
    usage: `Rack face for the field family. The encounter spine's Field is the separate mark field.`,
    states: `One drawing. C3 may name this face field; until that extraction lands, the spine keeps the plain name field and this face keeps field-lines.`,
    appears: `WORLD-SHELL-DESIGN.md §5 names field beside force. No mockup icon. Alignment with C3 is recorded in RESULT.json.`,
    body: g(`<path d="M5 17c2.2-7 11.8-7 14 0"/><path d="M7.5 17c1.6-4.2 7.4-4.2 9 0"/><path d="M10 17c.8-1.8 3.2-1.8 4 0"/>`),
  },

  central: {
    group: "product",
    meaning: `The central product: the ground itself.`,
    usage: `Product mark for central. Same diamond as the Base · Central mode.`,
    states: `One drawing, shared with base.`,
    appears: `Same path as base, which the mockup drew for Base · Central. WORLD-SHELL-DESIGN.md §12 names the product.`,
    body: g(`<path d="M12 3.5 20.5 12 12 20.5 3.5 12z"/>`),
  },
  actuation: {
    group: "product",
    meaning: `Actuation: how an agent runs.`,
    usage: `Product mark. The needle is the effort knob the agent-shell mockup draws as a control. The effort steps themselves are effort.`,
    states: `One drawing.`,
    appears: `The mockup draws the knob as a live control, not a product icon. This reduces that knob to a mark. WORLD-SHELL-DESIGN.md §12 names the product.`,
    body: g(`<circle cx="12" cy="13" r="6"/><path d="M12 13 15.6 7.8"/>`),
  },
  "ai-kit": {
    group: "product",
    meaning: `AIKit: skills held in a rack.`,
    usage: `Product mark. Three device strips. Individual skills use their own stand-ins or a glyph chip.`,
    states: `One drawing. Admission of each skill is admit or deny, not a fade of this mark.`,
    appears: `agent-shell-mockup.html describes skills as plug-ins in a rack. WORLD-SHELL-DESIGN.md §12 names the product. The three strips are the roster mark.`,
    body: g(`<path d="M4.5 6h4v12h-4z"/><path d="M10 6h4v12h-4z"/><path d="M15.5 6h4v12h-4z"/>`),
  },
  "software-factory": {
    group: "product",
    meaning: `Software Factory: work as something that happens in the world.`,
    usage: `Product mark. Same hexagon as the Factory mode.`,
    states: `One drawing, shared with factory.`,
    appears: `Same path as factory. WORLD-SHELL-DESIGN.md §12 names the product.`,
    body: g(`<path d="M12 3.5 19.4 7.75v8.5L12 20.5l-7.4-4.25v-8.5z"/>`),
  },
  workcell: {
    group: "product",
    meaning: `Workcell: the seat where computation runs.`,
    usage: `Product mark. A cell grid with one seat filled means a claimed seat.`,
    states: `One drawing. Occupancy copy stays text. A seat that refuses a claim shows refusing.`,
    appears: `WORLD-SHELL-DESIGN.md §12 names the seat device. No mockup icon. The filled cell is the roster mark.`,
    body: `${g(`<path d="M4 4h16v16H4z"/><path d="M4 12h16M12 4v16"/>`)}<rect x="5.2" y="5.2" width="5.6" height="5.6" fill="currentColor"/>`,
  },
  "quaternal-logic": {
    group: "product",
    meaning: `Quaternal Logic: four positions.`,
    usage: `Product mark. Four nodes on a square. Technē's linked squares stay techne. The day die stays day.`,
    states: `One drawing.`,
    appears: `WORLD-SHELL-DESIGN.md §12 names the product. No mockup icon. Four nodes are the roster mark, without a mystical reading.`,
    body: `${g(`<path d="M8 8h8v8H8z"/>`)}<circle cx="8" cy="8" r="1.5" fill="currentColor"/><circle cx="16" cy="8" r="1.5" fill="currentColor"/><circle cx="8" cy="16" r="1.5" fill="currentColor"/><circle cx="16" cy="16" r="1.5" fill="currentColor"/>`,
  },

  power: {
    group: "state",
    meaning: `Power: the device is on, or benched.`,
    usage: `The device header light. The mockup drew a small ring. This mark adds the stem so power stays distinct from capture's open circle at 16px.`,
    states: `This is the on housing. Benched uses the same mark painted with var(--text-faint), or deny when the bench is a refusal. Do not draw a dimmed copy as a second glyph.`,
    appears: `agent-shell-mockup.html .pw, data-i "Power|The agent on, or benched." The ring is the mockup; the stem is the roster's distinction.`,
    body: g(`<path d="M12 3.8v6"/><path d="M7.1 8.2a6.5 6.5 0 1 0 9.8 0"/>`),
  },
  admit: {
    group: "state",
    meaning: `Admitted: the skill or lane is allowed to act.`,
    usage: `The admit light on a skill row. Paint it with var(--accent) or the shell's on-colour. The glyph itself stays a disc.`,
    states: `The on light. The off light is deny, its own drawing.`,
    appears: `agent-shell-mockup.html skill rows: a light that admits or denies. The mockup used a CSS disc. This is that disc.`,
    body: `<circle cx="12" cy="12" r="6" fill="currentColor"/>`,
  },
  deny: {
    group: "state",
    meaning: `Denied: admission was refused.`,
    usage: `The deny light on a skill row or a lane. Pair it with the skill's own mark; do not fade the skill mark to mean deny.`,
    states: `A ring and a slash, full weight. Refusing is the slashed square, for a control that will not run. They are different objects.`,
    appears: `The mockup turned the light off with a CSS class. Deny is drawn so the refusal is visible without relying on faint colour alone.`,
    body: g(`<circle cx="12" cy="12" r="6.5"/><path d="M8 8l8 8"/>`),
  },
  hold: {
    group: "state",
    meaning: `Held: someone else has custody, so your edit suspended their hold.`,
    usage: `Custody on a device. The agent-shell mockup badges a held agent with a circle and an exclamation.`,
    states: `One drawing, full weight. Hand-back is the action that returns custody.`,
    appears: `Ported from the held badge in agent-shell-mockup.html bee(), without the badge's hardcoded orange.`,
    body: `${g(`<circle cx="12" cy="12" r="7.5"/><path d="M12 7.4v5.2"/>`)}<circle cx="12" cy="16.1" r="1" fill="currentColor"/>`,
  },
  "hand-back": {
    group: "state",
    meaning: `Hand custody back to the holder.`,
    usage: `The hand-back slot. Lit when you edited something an agent holds. Pressing it returns the hold.`,
    states: `One left arrow. The lit state is the button color.`,
    appears: `Ported from the ← character on the hand-back slot in both mockups.`,
    body: g(`<path d="M20 12H6"/><path d="M11 7 6 12l5 5"/>`),
  },
  steer: {
    group: "state",
    meaning: `Steer the running turn.`,
    usage: `Factory and the agent device: what you send redirects the turn in progress. When the same plus-slot means overdub, use overdub.`,
    states: `One drawing. Off, input queues; the queue state can show waiting.`,
    appears: `agent-shell-mockup.html data-i "Steer · overdub" used +. Steer is drawn as a turn in the path so it is not the plus.`,
    body: g(`<path d="M4 17h7.2A4.8 4.8 0 0 0 16 12.2V7"/><path d="M13 10l3-3 3 3"/>`),
  },
  effort: {
    group: "state",
    meaning: `How hard the armed session thinks, in steps.`,
    usage: `The effort control. The mockup shows the step as a word (low, med, high, xhigh, max). This mark is the steps. The current word stays text.`,
    states: `Three rising bars, one drawing. The selected step stays a word. A refused effort shows refusing.`,
    appears: `agent-shell-mockup.html data-i Effort, and the Factory tempo slot. No icon was drawn. The bars are the roster mark.`,
    body: g(`<path d="M5 15h3.2v4H5z"/><path d="M10.4 11h3.2v8h-3.2z"/><path d="M15.8 7h3.2v12h-3.2z"/>`),
  },
  folded: {
    group: "state",
    meaning: `A device folded to its title.`,
    usage: `A rack device shown as a narrow title, as in Live. The title is text written on the folded strip. This mark stands for that state in a legend or a menu.`,
    states: `The folded state itself. Expand opens it. The launcher's chevron is fold, a different control.`,
    appears: `agent-shell-mockup.html .dev.folded and foldedRack(): a 24px-wide title column.`,
    body: g(`<path d="M9 3.5h6v17H9z"/><path d="M12 7v2.5"/>`),
  },
  expand: {
    group: "state",
    meaning: `Expand in place.`,
    usage: `Deep edit, or expand neighbours without moving focus. The mockup's graph uses a +count badge for neighbours; this mark is the expand affordance ⤢.`,
    states: `One drawing. Pop-out leaves the pane; expand stays in it.`,
    appears: `Named in the commission as ⤢. The graph mockup draws +n in a circle for neighbour expand. These two diagonals are the expand mark.`,
    body: g(`<path d="M10 5H5v5"/><path d="M5 5l6.5 6.5"/><path d="M14 19h5v-5"/><path d="M19 19l-6.5-6.5"/>`),
  },
  "pop-out": {
    group: "state",
    meaning: `Pop a device out into its own pane or window.`,
    usage: `Device lifecycle pop-out. The mockup uses ↗ to open a thread. Pop-out is the box with an arrow leaving it: detach, then the pane engine's existing detach.`,
    states: `One drawing. There is no separate pop-in mark; returning uses return or the pane's close.`,
    appears: `WORLD-SHELL-DESIGN.md §5 pop-out. The mockup's ↗ on an agent header is the open-thread cousin. This box-and-arrow is the device pop-out.`,
    body: g(`<path d="M5 9.5h8.5V19H5z"/><path d="M11 13 18.5 5.5"/><path d="M13.5 5.5h5v5"/>`),
  },
  refusing: {
    group: "state",
    meaning: `This control will not run.`,
    usage: `A first-class refusal on a button or a device: the shell declined the action. Show it in place of, or beside, the action mark. Paint it at full strength with currentColor.`,
    states: `The refusal itself. It is not a faded play, stop, or record.`,
    appears: `Save outcomes include refused (WORLD-SHELL-DESIGN.md §5 and §12). The mockup did not draw a refusal icon. The slashed square is the roster mark. Deny remains the admission light.`,
    body: g(`<path d="M6 6h12v12H6z"/><path d="M8.2 15.8 15.8 8.2"/>`),
  },
  disabled: {
    group: "state",
    meaning: `Present, and not available.`,
    usage: `A control that is shown and cannot be used. Earth's landmass controls when Earth is given are the example. The mark stays full weight.`,
    states: `A plate with a bar. Faint colour may accompany it; faint colour alone is not this state.`,
    appears: `WORLD-SHELL-DESIGN.md Revision 3: Earth's landmass controls are disabled. No icon was drawn. The barred plate is the roster mark.`,
    body: g(`<path d="M6.5 6.5h11v11h-11z"/><path d="M9 12h6"/>`),
  },
  waiting: {
    group: "state",
    meaning: `Waiting: the work has not returned.`,
    usage: `A stalled agent, a pending admission, or a chip with nothing to draw yet. Three dots at full size.`,
    states: `The waiting state itself. The mockup's stalled badge used an orange ellipsis; the dots here are the mark, and any warning colour is the button's color.`,
    appears: `agent-shell-mockup.html stalled badge draws three dots. Those dots, without the hardcoded orange.`,
    body: `<circle cx="6.5" cy="12" r="1.45" fill="currentColor"/><circle cx="12" cy="12" r="1.45" fill="currentColor"/><circle cx="17.5" cy="12" r="1.45" fill="currentColor"/>`,
  },

  field: {
    group: "spine",
    meaning: `Field: the bounded place the encounter admits.`,
    usage: `Encounter spine, beside World, Subject, and Occasion. The device family that edits a force field is field-lines.`,
    states: `One drawing.`,
    appears: `WORLD-SHELL-DESIGN.md §2 and the aperture slot name Field. No icon was drawn. Four corners are the roster mark for a bounded field.`,
    body: g(`<path d="M5 9V5h4"/><path d="M15 5h4v4"/><path d="M19 15v4h-4"/><path d="M9 19H5v-4"/>`),
  },
  world: {
    group: "spine",
    meaning: `World: which world this encounter stands in.`,
    usage: `Encounter spine. The Earth projection, with meridians, is earth. This mark is a body with a smaller body beside it: a world you can name.`,
    states: `One drawing.`,
    appears: `The spine label World. The aperture list uses ◯ for a world body. The second body keeps this distinct from earth, from capture, and from the arm ring.`,
    body: g(`<circle cx="10.2" cy="12.4" r="5.2"/><circle cx="17.4" cy="7.6" r="2.1"/>`),
  },
  subject: {
    group: "spine",
    meaning: `Subject: what the encounter is about.`,
    usage: `Encounter spine. The window title carries the subject's name; this mark is the subject in a legend or a chip.`,
    states: `One drawing. Base's diamond has no stem. This diamond sits on a stem so the two can share a toolbar.`,
    appears: `The spine label Subject. No mockup icon. The stemmed diamond is the roster mark.`,
    body: g(`<path d="M12 4.2 17.2 9.6 12 15l-5.2-5.4z"/><path d="M12 15v4.5"/>`),
  },
  occasion: {
    group: "spine",
    meaning: `Occasion: the time the encounter is held at.`,
    usage: `Encounter spine, and the Occasion clock beside Now and Transport. A clock with two hands. The device toggle's single hand is device. The pendulum is metronome.`,
    states: `One drawing.`,
    appears: `WORLD-SHELL-DESIGN.md §8 names Occasion. No icon was drawn.`,
    body: g(`<circle cx="12" cy="12" r="7"/><path d="M12 12V7.2"/><path d="M12 12h3.8"/>`),
  },
  aperture: {
    group: "spine",
    meaning: `Aperture: how much of the field is admitted.`,
    usage: `The aperture control. The mockup draws it as a row of named steps (your world, local, shared, federated). This iris is the mark for that control when a legend needs one. The step names stay text.`,
    states: `One drawing. The current step is text or a segment, not a second iris.`,
    appears: `world-shell-mockup.html aperture slot, data-i "Aperture". No icon was drawn.`,
    body: g(`<circle cx="12" cy="12" r="7.5"/><path d="M12 8.2 15.2 10v4L12 15.8 8.8 14v-4z"/>`),
  },
  "view-as": {
    group: "spine",
    meaning: `View as: see the world as an audience sees it.`,
    usage: `The view-as slot, where Live has key and scale. What is not projected is fog. The word "as" and the audience name stay text.`,
    states: `One eye. The skill stand-in review-pr is a filled eye; this one is stroked, with a second small arc for the other viewpoint.`,
    appears: `world-shell-mockup.html data-i "View as". The mockup wrote "as" plus a name. The eye is the roster mark.`,
    body: g(`<path d="M3 12S6.2 7.2 12 7.2 21 12 21 12 17.8 16.8 12 16.8 3 12 3 12z"/><circle cx="12" cy="12" r="2"/><path d="M16.5 5.2a3 3 0 0 1 3.2 1.6"/>`),
  },
  trail: {
    group: "spine",
    meaning: `Trail: the encounters you passed through.`,
    usage: `Context tile and back/forward through the encounter. A dotted path with an arrow.`,
    states: `One drawing. An empty trail shows the mark with waiting, or the tile's own empty copy.`,
    appears: `world-shell-mockup.html context tile Trail, and MED does not draw a trail icon. The dotted path is the roster mark.`,
    body: g(`<path d="M5 16c2.4 0 3-6 6.4-6s3.4 5 6.8 4" stroke-dasharray="0.2 2.8"/><path d="M16.2 11.4 19.4 14l-3.6 2"/>`),
  },
  packet: {
    group: "spine",
    meaning: `Packet: exactly what the agent receives.`,
    usage: `The packet device and the context tile. Token counts stay numerals. The envelope is the packet.`,
    states: `One drawing. A refused packet shows refusing. A packet being built can show waiting.`,
    appears: `WORLD-SHELL-DESIGN.md Revision 5 packet slot, and the context tile Packet. No icon was drawn.`,
    body: g(`<path d="M4.5 7.5h15v10h-15z"/><path d="M4.5 7.5 12 13.2 19.5 7.5"/>`),
  },
  contact: {
    group: "spine",
    meaning: `Contact: a two-way link that is open.`,
    usage: `An open contact between worlds, and the contribution/contact relation while it is live. Link is the transport join. Contact is two parties with arrows between them.`,
    states: `One drawing. A contact that has not been admitted shows deny or waiting, not a faded contact.`,
    appears: `world-shell-mockup.html MED contact uses ⇄. The two nodes and opposing arrows are that character.`,
    body: `${g(`<path d="M8.4 12h7.2"/><path d="M10.6 9.6 8.4 12l2.2 2.4"/><path d="M13.4 9.6 15.6 12l-2.2 2.4"/>`)}<circle cx="5" cy="12" r="2.6" fill="currentColor"/><circle cx="19" cy="12" r="2.6" fill="currentColor"/>`,
  },
  return: {
    group: "spine",
    meaning: `Return: bring the work back to the holder.`,
    usage: `A Return in the encounter, and back to the previous encounter. Re-enable restores automation. Hand-back returns custody. This hook is the return of work or of navigation.`,
    states: `One drawing.`,
    appears: `world-shell-mockup.html MED return uses ↩, and the browser back control is ‹. The hook is the return mark.`,
    body: g(`<path d="M18 7.5v5A4 4 0 0 1 14 16.5H8"/><path d="M11 13.2 8 16.5 11 19.8"/>`),
  },

  day: {
    group: "document",
    meaning: `Day: the day's die, six faces, four positions and two poles.`,
    usage: `The Day document. Face names and the open face stay in the document. This cube is the form's mark in a browser or a tab.`,
    states: `One drawing. The open face is document state, not a second glyph.`,
    appears: `world-shell-mockup.html APS day uses ⚀, and Revision 3 draws the die as six faces. The cube stands for that die.`,
    body: g(`<path d="M12 4.2 19 8v8l-7 4-7-4V8z"/><path d="M12 12 19 8"/><path d="M12 12 5 8"/><path d="M12 12v8"/>`),
  },
  flow: {
    group: "document",
    meaning: `Flow: dialogue, flow, and journal.`,
    usage: `The Flow document. Participants are drawn in the page: a person solid, an agent as points. This pilcrow is the form's mark.`,
    states: `One drawing.`,
    appears: `Ported from the pilcrow the mockup uses for Flow (APS flow, g ¶).`,
    body: g(`<path d="M8.2 19V8.2h4.6a3.3 3.3 0 0 0 0 6.6H8.2"/><path d="M15.4 6v13"/>`),
  },
  beings: {
    group: "document",
    meaning: `Beings: a presence and its world.`,
    usage: `The Beings document. A person is drawn solid, matching the Flow rule for a human participant.`,
    states: `One filled figure. An agent participant drawn as points belongs to the document body, not to this mark.`,
    appears: `Revision 3: a person drawn solid. APS being used ☺; this roster does not use that face. The solid figure is the form.`,
    body: `<circle cx="12" cy="7.4" r="2.7" fill="currentColor"/><path fill="currentColor" d="M6.4 19.2v-1.1a5.6 5.6 0 0 1 11.2 0v1.1z"/>`,
  },
  things: {
    group: "document",
    meaning: `Things: a subject and its relations.`,
    usage: `The Things document. A page with a folded corner. The detail toggle's ruled square is detail.`,
    states: `One drawing.`,
    appears: `APS thing uses ▤, the same character as the detail chrome. The roster gives Things a page, and keeps the ruled square for detail.`,
    body: g(`<path d="M6 4.5h8.2L18 8.2V19.5H6z"/><path d="M14.2 4.5v3.7H18"/>`),
  },
  clip: {
    group: "document",
    meaning: `Clip: what is in focus.`,
    usage: `The Clip side of the Clip | Device toggle in the status bar. The square is the mockup's ▢.`,
    states: `One drawing. Selected paints the button with var(--accent) via color.`,
    appears: `Ported from the ▢ Clip label in world-shell-mockup.html status toggle.`,
    body: g(`<rect x="6" y="6" width="12" height="12"/>`),
  },
  device: {
    group: "document",
    meaning: `Device: what works on the focus.`,
    usage: `The Device side of the Clip | Device toggle. A circle with one hand, the mockup's ◷.`,
    states: `One drawing.`,
    appears: `Ported from the ◷ Device label in the status toggle.`,
    body: g(`<circle cx="12" cy="12" r="7"/><path d="M12 12h5"/>`),
  },

  browser: {
    group: "chrome",
    meaning: `Show or hide the browser.`,
    usage: `Chrome toggle for the left browser and the aperture slot.`,
    states: `One drawing. On uses var(--accent) via color.`,
    appears: `Ported from the ▥ browser chrome character in world-shell-mockup.html.`,
    body: g(`<path d="M5 5h14v14H5z"/><path d="M9.7 5v14M14.3 5v14"/>`),
  },
  detail: {
    group: "chrome",
    meaning: `Show or hide the detail row.`,
    usage: `Chrome toggle for Clip | Device. The ruled square is the mockup's ▤.`,
    states: `One drawing.`,
    appears: `Ported from the ▤ detail chrome character.`,
    body: g(`<path d="M5 5h14v14H5z"/><path d="M5 9.7h14M5 14.3h14"/>`),
  },
  companion: {
    group: "chrome",
    meaning: `Show or hide the companion and the launcher.`,
    usage: `Chrome toggle for the context dock.`,
    states: `One drawing.`,
    appears: `Ported from the companion path in world-shell-mockup.html. Stroke cleaned from 1.8 to 1.5.`,
    body: g(`<path d="M9 7a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v2"/>`),
  },
  panes: {
    group: "chrome",
    meaning: `Pane layout.`,
    usage: `The chrome button that opens the pane menu: split beside, split below, four-fold, close. Same drawing as four-fold.`,
    states: `One drawing.`,
    appears: `Ported from the ⊞ pane button in world-shell-mockup.html.`,
    body: g(`<path d="M5 5h14v14H5z"/><path d="M12 5v14M5 12h14"/>`),
  },
  "split-beside": {
    group: "chrome",
    meaning: `Split the focused pane beside itself.`,
    usage: `Pane menu. A vertical split.`,
    states: `One drawing.`,
    appears: `world-shell-mockup.html renderPmenu "Split beside", character ⇥. The divided rectangle is that action.`,
    body: g(`<path d="M4.5 5.5h15v13h-15z"/><path d="M12 5.5v13"/>`),
  },
  "split-below": {
    group: "chrome",
    meaning: `Split the focused pane below itself.`,
    usage: `Pane menu. A horizontal split.`,
    states: `One drawing.`,
    appears: `renderPmenu "Split below", character ⤓.`,
    body: g(`<path d="M4.5 5.5h15v13h-15z"/><path d="M4.5 12h15"/>`),
  },
  "four-fold": {
    group: "chrome",
    meaning: `Split the focused pane into four.`,
    usage: `Pane menu. Same drawing as the panes button, because that button is this mark.`,
    states: `One drawing, shared with panes.`,
    appears: `renderPmenu "Four-fold", character ⊞.`,
    body: g(`<path d="M5 5h14v14H5z"/><path d="M12 5v14M5 12h14"/>`),
  },
  "close-pane": {
    group: "chrome",
    meaning: `Close the focused pane.`,
    usage: `Pane menu. Closing the last pane is the shell's own rule; the mark is only the close.`,
    states: `One drawing.`,
    appears: `renderPmenu "Close pane", character ✕.`,
    body: g(`<path d="M7 7l10 10M17 7 7 17"/>`),
  },
  fold: {
    group: "chrome",
    meaning: `Fold the launcher down to its search bar.`,
    usage: `The launcher fold chevron. A folded device in the rack is folded, not this chevron.`,
    states: `One chevron. The expanded launcher points down; the folded launcher can rotate the same mark.`,
    appears: `Ported from the ▾ fold control on the launcher in both mockups.`,
    body: g(`<path d="M6 9.5 12 15.5 18 9.5"/>`),
  },

  "port-widgets": {
    group: "skill",
    meaning: `Skill stand-in: port widgets.`,
    usage: `A skill chip in a skillset rack until an authored engine glyph replaces it. The picture is a diamond.`,
    states: `One drawing. The row's light is admit or deny.`,
    appears: `Ported from agent-shell-mockup.html SK['port-widgets'], scaled from 16 to 24. They are geometric stand-ins; the Expressions glyph library is their intended later source.`,
    body: `<path fill="currentColor" d="M12 2.25 21.75 12 12 21.75 2.25 12z"/>`,
  },
  "capture-plan": {
    group: "skill",
    meaning: `Skill stand-in: capture a plan.`,
    usage: `A skill chip. A ring with a hole.`,
    states: `One drawing. Admission is the light, not a fade.`,
    appears: `Ported from SK['capture-plan'], scaled from 16 to 24, even-odd hole kept.`,
    body: `<path fill="currentColor" fill-rule="evenodd" d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zm0 5.25a3.75 3.75 0 1 1 0 7.5 3.75 3.75 0 0 1 0-7.5z"/>`,
  },
  "diff-grammar": {
    group: "skill",
    meaning: `Skill stand-in: diff a grammar.`,
    usage: `A skill chip. Three waves.`,
    states: `One drawing.`,
    appears: `Ported from SK['diff-grammar'], the stroked triple wave, scaled from 16 to 24. Stroke is the roster's 1.5.`,
    body: g(`<path d="M3 7.5c3-3 6 3 9 0s6 3 9 0"/><path d="M3 12c3-3 6 3 9 0s6 3 9 0"/><path d="M3 16.5c3-3 6 3 9 0s6 3 9 0"/>`),
  },
  "review-pr": {
    group: "skill",
    meaning: `Skill stand-in: review a change.`,
    usage: `A skill chip. A filled eye. View-as is the stroked eye used for the audience control.`,
    states: `One drawing.`,
    appears: `Ported from SK['review-pr'], scaled from 16 to 24, even-odd pupil kept.`,
    body: `<path fill="currentColor" fill-rule="evenodd" d="M2.25 12S6 5.25 12 5.25 21.75 12 21.75 12 18 18.75 12 18.75 2.25 12 2.25 12zm9.75-3a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"/>`,
  },
  "tune-physics": {
    group: "skill",
    meaning: `Skill stand-in: tune physics.`,
    usage: `A skill chip. A triangle with a hole.`,
    states: `One drawing.`,
    appears: `Ported from SK['tune-physics'], scaled from 16 to 24.`,
    body: `<path fill="currentColor" fill-rule="evenodd" d="M12 3 21 19.5H3zm0 9.75a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6z"/>`,
  },
  deploy: {
    group: "skill",
    meaning: `Skill stand-in: deploy.`,
    usage: `A skill chip. An arrow up onto a baseline.`,
    states: `One drawing.`,
    appears: `Ported from SK['deploy'], the stroked arrow, scaled from 16 to 24.`,
    body: g(`<path d="M12 2.5v19"/><path d="M4.5 9 12 2.5 19.5 9"/><path d="M6 21.5h12"/>`),
  },
  "test-depth": {
    group: "skill",
    meaning: `Skill stand-in: test depth.`,
    usage: `A skill chip. Three bars, wide to narrow.`,
    states: `One drawing. The macro's depth value stays a word or a number.`,
    appears: `Ported from SK['test-depth'], scaled from 16 to 24.`,
    body: `<g fill="currentColor"><path d="M4.5 4.5h15v4.5h-15z"/><path d="M6.75 11.25h10.5v4.5h-10.5z"/><path d="M9 18h6v3.5H9z"/></g>`,
  },
} as const satisfies Record<string, GlyphDef>;

export type GlyphName = keyof typeof GLYPHS;

export function glyphNames(): GlyphName[] {
  return Object.keys(GLYPHS) as GlyphName[];
}

export function symbolMarkup(name: GlyphName): string {
  return `<symbol id="${name}" viewBox="${GLYPH_VIEWBOX}">${GLYPHS[name].body}</symbol>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface RenderGlyphOptions {
  /** Spoken name for this use. Required on every consumer. */
  label: string;
  /** Drawn size in CSS pixels. The grid stays 24. */
  size?: number;
  /** Sprite URL for renderGlyphUse. Defaults to roster.svg beside the page. */
  sprite?: string;
}

function requireLabel(label: string): string {
  if (!label.trim()) throw new Error("A glyph needs an aria-label.");
  return escapeXml(label);
}

/** Inline the mark. Use this when the page does not load the sprite. */
export function renderGlyph(name: GlyphName, options: RenderGlyphOptions): string {
  const label = requireLabel(options.label);
  const size = options.size ?? 24;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${GLYPH_VIEWBOX}" role="img" aria-label="${label}">${GLYPHS[name].body}</svg>`;
}

/** Reference the sprite. The sprite file is roster.svg. */
export function renderGlyphUse(name: GlyphName, options: RenderGlyphOptions): string {
  const label = requireLabel(options.label);
  const size = options.size ?? 24;
  const sprite = options.sprite ?? "roster.svg";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${GLYPH_VIEWBOX}" role="img" aria-label="${label}"><use href="${escapeXml(sprite)}#${name}"/></svg>`;
}

/**
 * Text / image / character as a UI chip.
 *
 * The Expressions engine bakes any text or image into a stage glyph
 * (AsciiToGlyphModal, ImageToGlyphModal, GlyphSampler). The chip is how that
 * result sits in the shell. It is not a second drawing of the stage glyph,
 * and it does not carry the volume profiles in glyphVolume.ts.
 *
 * Frame: a square at 16, 20, or 24. Border 1px solid var(--line). Background
 * var(--bg-0). Ink inset 2, the same optical inset as the symbols. Colour is
 * currentColor. Corners are square, matching the shell.
 *
 * Engine and plain character: one line of UI type, var(--font-ui). A single
 * grapheme is set at 0.7 of the inner box, the sampler's font-to-canvas
 * ratio. A longer run shrinks so its advance stays inside 0.9 of the inner
 * box (glyphMetrics MAX_WIDTH_RATIO; the width estimate is 0.62em per
 * character, the module's own heuristic). Newlines collapse to spaces.
 * Empty or whitespace-only text is drawn as O, the sampler's empty sample.
 *
 * Image: an img, object-fit contain, inside the same frame. The image keeps
 * its own ink. If it fails to load, the chip shows the waiting glyph.
 *
 * The chip's aria-label is the caller's label, required. The engine text is
 * not a substitute for that label.
 */
export const GLYPH_CHIP = {
  sizes: [16, 20, 24] as const,
  defaultSize: 24 as const,
  inset: 2,
  fontToBox: 0.7,
  maxWidthRatio: 0.9,
  advancePerChar: 0.62,
  emptySample: "O",
} as const;

export type GlyphChipSize = (typeof GLYPH_CHIP.sizes)[number];

export type GlyphChipSource =
  | { kind: "engine"; text: string }
  | { kind: "image"; src: string; alt: string }
  | { kind: "character"; text: string };

export interface GlyphChipSpec {
  source: GlyphChipSource;
  /** Spoken name for this chip. Required. */
  label: string;
  size?: GlyphChipSize;
}

export interface ChipInk {
  text: string;
  fontSize: number;
  fallback: "none" | "empty-measures-o" | "collapsed-newlines";
}

/** Resolve chip ink the way the sampler resolves empty text. */
export function chipInk(raw: string, size: GlyphChipSize): ChipInk {
  const collapsed = raw.replace(/\r\n?/g, " ").replace(/\n/g, " ");
  const newlineFallback = collapsed !== raw;
  const trimmed = collapsed.trim();
  if (!trimmed) {
    return { text: GLYPH_CHIP.emptySample, fontSize: chipFontSize(1, size), fallback: "empty-measures-o" };
  }
  const chars = Array.from(trimmed).length;
  return {
    text: trimmed,
    fontSize: chipFontSize(chars, size),
    fallback: newlineFallback ? "collapsed-newlines" : "none",
  };
}

export function chipFontSize(chars: number, size: GlyphChipSize): number {
  const inner = size - GLYPH_CHIP.inset * 2;
  const single = inner * GLYPH_CHIP.fontToBox;
  if (chars <= 1) return single;
  const fitted = (inner * GLYPH_CHIP.maxWidthRatio) / (chars * GLYPH_CHIP.advancePerChar);
  return Math.min(single, fitted);
}

/**
 * HTML for one chip. Image failure is a data-fallback="waiting" on the img;
 * the sheet's script, or the host, swaps in renderGlyph("waiting").
 */
export function renderGlyphChip(spec: GlyphChipSpec): string {
  const label = requireLabel(spec.label);
  const size = spec.size ?? GLYPH_CHIP.defaultSize;
  const common = `class="glyph-chip" style="width:${size}px;height:${size}px" role="img" aria-label="${label}"`;
  if (spec.source.kind === "image") {
    const src = escapeXml(spec.source.src);
    const alt = escapeXml(spec.source.alt);
    return `<span ${common} data-chip="image" data-i="${label}|An authored image in a glyph chip."><img src="${src}" alt="${alt}" data-fallback="waiting"/></span>`;
  }
  const ink = chipInk(spec.source.text, size);
  const kind = spec.source.kind === "engine" ? "An engine glyph" : "A plain character";
  return `<span ${common} data-chip="${spec.source.kind}" data-fallback="${ink.fallback}" data-i="${label}|${kind} in a glyph chip."><span class="glyph-chip-ink" style="font-size:${ink.fontSize.toFixed(2)}px">${escapeXml(ink.text)}</span></span>`;
}
