// The plates of the Technē instruments the hosted stage draws — M1′ Canvas, M2′ Timeline, M3′ Journey (T-FRAME-CHROME-ONTO-PLATES; lock
// §2.5 "drawn as one instrument frame with sections"; the mockup's deviceDetail k==='M1'/'M2'/'M3', world-shell-mockup.html:1457-1459).
// Their sections are the manual's own groups for each — DLW.md §17.4 Canvas "Whole: All parameters, in five groups: Tools, Lines,
// Relation, Look, Views"; §17.4 Timeline "four groups: Lens, Readings, Standing, Window"; §17.5 Journey "four groups: Stops, Pace,
// Transitions, Takes" — and each section stands the controls the frame's chrome places there (presentedChrome.ts homes), in the frame's
// words. A parameter the manual names that no owner carries yet stands dim with why (the mockup's rule: shown waiting, never faked).
// Then the Expression the lens reads: its Save, Undo and Redo, its scene bar and the stage's own tools — the frame's masthead and scene
// bar, which every lens drew in the pane. Pure: no React.
import type {FrameChromeHome} from '@epilogos/expressions-boundary'

export interface WaitingParameter {
  readonly name: string
  readonly values: string
  readonly why: string
  /** A quantity the mockup sweeps (a dial), drawn as a dial with no reading. */
  readonly dial?: {readonly unit?: string}
}
export interface StageSection {
  readonly id: string
  readonly title: string
  readonly homes: readonly FrameChromeHome[]
  /** The column's width at the device row's density (the mockup's section widths, :1457). Absent where the frame's run of keys is long
   * and varies: the section takes the columns the run needs (frameChrome.css), and the plate folds what does not fit. */
  readonly width?: number
  readonly waiting?: readonly WaitingParameter[]
  /** The waiting rows stand only while the frame places nothing here (a parameter one of the frame's views carries when it is shown). */
  readonly waitingWhenEmpty?: boolean
  /** What the section says while the frame places nothing in it (a selection it waits for). */
  readonly empty?: string
}
export type StageInstrumentId = 'techne:m1' | 'techne:m2' | 'techne:m3'

/** The stage-wide chrome every lens drew: the masthead's Save, Undo and Redo, its rail and workspace, Nara and the captures, the scene
 * bar and the toolbelt handle (shell.ts mountShell; app.ts :2814; actPanel.ts :59; naraInstrument.tsx :307). The lens chooser is not
 * here: the rack's instrument folds carry it (inhabitants/ql/devices/TechneDevices.tsx InstrumentFold → frame/instrumentDoor.ts
 * driveStageLens). */
export const EXPRESSION_SECTION: StageSection = {id: 'expression', title: 'Expression', homes: ['work', 'scene', 'tools', 'nara', 'capture', 'side']}

export const STAGE_PLATES: Readonly<Record<StageInstrumentId, readonly StageSection[]>> = {
  'techne:m1': [
    {id: 'tools', title: 'Tools', homes: ['canvas:tools'], waiting: [
      {name: 'Tool', values: 'Select · Frame · Relate · Note · Shape · Text', why: 'The canvas holds no standing tool: each tool here is one act — a note, an object, a frame around the selection — and a line is drawn from a card’s handle.'},
      {name: 'Layout', values: 'Free · Radial · Form', why: 'No owner arranges the cards around a centre or in the form of a whole yet: cards stand where they are placed.'},
    ]},
    {id: 'lines', title: 'Lines', homes: ['canvas:lines'], width: 176, empty: 'Select a line to set its kind, its label and the sides it binds to.', waiting: [
      {name: 'Line kind', values: 'Straight · Curved · Elbow', why: 'The next line has no kind of its own until it is drawn: select a drawn line to set its kind.'},
    ]},
    {id: 'relation', title: 'Relation', homes: ['canvas:relation'], width: 216, empty: 'Select a line drawn between two sources to promote it to the relation’s owner.', waiting: [
      {name: 'Relation type', values: 'Echo · Influence · Cause · Transform', why: 'The next line’s type has no owner: a drawn line’s relation is named when it is promoted.'},
      {name: 'Standing', values: 'Fact · Claim · Inference · Guess', why: 'No owner gives a drawn line a standing yet: a drawn line stays a proposal until its owner accepts it.'},
    ]},
    {id: 'look', title: 'Look', homes: ['canvas:look'], width: 150},
    {id: 'views', title: 'Views', homes: ['canvas:views'], width: 170},
  ],
  'techne:m2': [
    {id: 'lens', title: 'Lens', homes: ['timeline:lens'], width: 210},
    {id: 'readings', title: 'Readings', homes: ['timeline:readings'], width: 200, empty: 'The ruler’s reading discloses no layers or filters here.', waiting: [
      // The mockup's Strata (world-shell-mockup.html:1406; manual §17.5 Your work: Days · Runs · Receipts): the relation field's Activity
      // projection draws Days, NOWs, sessions and runs together (field-studies-journeys relationFieldView.tsx:50-51), and no owner shows
      // one stratum alone.
      {name: 'Strata', values: 'Occurrence · Receipt · Day · NOW · Run', why: 'No owner shows one temporal stratum alone: the Relations lens’s Activity projection draws Days, NOWs, sessions and runs together.'},
    ]},
    {id: 'standing', title: 'Standing', homes: ['timeline:standing'], width: 140, waitingWhenEmpty: true, waiting: [
      {name: 'Standing floor', values: 'Facts · Claims · Inferences · Guesses · All', why: 'The chronology filters no event by standing: every event shows at its own standing. The Relations projection carries its own standing filter, which stands here while it is shown.'},
    ]},
    {id: 'window', title: 'Window', homes: ['timeline:window'], width: 170, waiting: [
      // The mockup's Deep time (world-shell-mockup.html:1405, a 0–100 % dial; manual §17.5 Time scale): the ruler maps time by its own
      // scale (desktop/cradle/src/techne/m0m5/timeline/scale.ts) and no owner takes a stretch of deep time as a setting.
      {name: 'Deep time', values: '0–100 %', why: 'No owner stretches deep time on the ruler by a setting: the ruler maps time by its own scale.', dial: {unit: '%'}},
    ]},
  ],
  'techne:m3': [
    {id: 'stops', title: 'Stops', homes: ['journey:stops']},
    {id: 'pace', title: 'Pace', homes: ['journey:pace'], width: 170},
    {id: 'transitions', title: 'Transitions', homes: ['journey:transitions'], width: 170, empty: 'Each transition’s switch and curve stand on its row in the walk.'},
    {id: 'takes', title: 'Takes', homes: ['journey:takes'], width: 150, waiting: [
      {name: 'Take', values: 'The latest take', why: 'Recording a walk keeps no takes to choose among yet.'},
    ]},
  ],
}

export const isStageInstrument = (id: string): id is StageInstrumentId => id in STAGE_PLATES

/** What each instrument's catalogue design now carries on its binding (lane W4-Technē; techne/devices/frameBindings.ts), so the plate never
 * draws it twice (the design is the standard): whole groups whose every control the design writes, and the frame's own controls, by their
 * words, the design reads and presses itself. The plate's waiting rows (a parameter no owner carried) are the design's own parameters now,
 * drawn there with their reasons, and the well is the design's display. What the design does not carry yet stays on the plate. */
export const CARRIED_BY_DESIGN: Readonly<Record<StageInstrumentId, {readonly sections: readonly string[]; readonly labels: readonly RegExp[]}>> = {
  // Canvas: Mode (Draw, Erase, Lasso), Grid (Snap), Minimap (the overview toggle), the camera (Zoom, Fit all, Fit sel.: the canvas camera
  // command) and the save state; the whole Look group.
  'techne:m1': {sections: ['look'], labels: [/^(Draw|Erase|Lasso|Snap)$/, /^(Hide|Show) overview$/, /^(Zoom (in|out) canvas|Fit all cards|Fit selected cards|Canvas zoom)$/, /^\d+(\.\d+)?\s?%$/,
    /^(Saved|Saving|Held, not saved)$/]},
  // Timeline: the projection tabs and Refresh; the shared window (the design's Window writes the session's one window): the whole Window group.
  'techne:m2': {sections: ['window'], labels: [/^(Chronology|Relations|Relative|Refresh timeline)$/]},
  // Journey: Play and Stop of the saved scenes (the journey stage command) and the presented beat's Enter (its crossing).
  'techne:m3': {sections: [], labels: [/^(Play|Stop) saved scenes$/, /^Enter in Expression$/]},
}
/** Whether the design carries one of the frame's controls. */
export const carriedByDesign = (id: StageInstrumentId, label: string): boolean => CARRIED_BY_DESIGN[id].labels.some(word => word.test(label.trim()))
