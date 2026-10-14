// lane-3 E23: focus mode is the app's presenting mode, extended, not a second mode.
// Focus hides the chrome (the stylesheet's .presentation rules), closes the transient panels,
// asks the browser for real fullscreen on the stage, and on exit restores the layout it found.
// This module is the pure layout model: what is snapshotted, what focus changes, what exit restores.
// It is also the one fullscreen path (request, release, the browser's own exit, handover between modes), shared by E23 and A8.
// The body class and panel flags stay in app.ts and researchInstruments.tsx.

export interface FocusLayout {
  readonly sequenceOpen: boolean;
  readonly beltOpen: boolean;
  readonly timelineOpen: boolean;
  readonly inspectorOpen: boolean;
  readonly editing: boolean;
  readonly contextKind: string;
  readonly beltPickerOpen: boolean;
  readonly shapePickerOpen: boolean;
  readonly modesOpen: boolean;
  readonly captureOpen: boolean;
  readonly tool: string;
  readonly cursorTool: string;
  readonly selected: readonly string[];
}

/** `prior` is the layout to restore while focused; null when focus is not active. */
export interface FocusSession {
  readonly prior: FocusLayout | null;
}

export const NOT_FOCUSED: FocusSession = {prior: null};

function copyLayout(layout: FocusLayout): FocusLayout {
  return {...layout, selected: [...layout.selected]};
}

export function isFocused(session: FocusSession): boolean {
  return session.prior !== null;
}

/** Starts focus and snapshots the layout. Beginning while focused keeps the first snapshot. */
export function beginFocus(session: FocusSession, layout: FocusLayout): FocusSession {
  if (session.prior) return session;
  return {prior: copyLayout(layout)};
}

/** Ends focus. `restore` is the exact layout focus began from, or null when focus was not active. */
export function endFocus(session: FocusSession): {session: FocusSession; restore: FocusLayout | null} {
  return {session: NOT_FOCUSED, restore: session.prior ? copyLayout(session.prior) : null};
}

/**
 * The layout while focused. Panels that only make sense as a working surface close (local controls,
 * belt picker, shape picker, modes, capture) and the selection clears, as the presenting mode always did.
 * The other flags are kept as they are: the stylesheet hides them while focused, and exit restores them.
 */
export function focusedLayout(layout: FocusLayout): FocusLayout {
  return {
    ...copyLayout(layout),
    contextKind: '',
    beltPickerOpen: false,
    shapePickerOpen: false,
    modesOpen: false,
    captureOpen: false,
    selected: [],
  };
}

// ---------------------------------------------------------------------------
// lane-2 T24: the same focus session for a host whose layout is its own (the M2′ timeline stage snapshots its
// chrome). Identical semantics to beginFocus/endFocus above: beginning while focused keeps the first snapshot,
// and ending returns the exact snapshot focus began from.
// ---------------------------------------------------------------------------

export interface StageFocusSession<L> {
  readonly prior: L | null;
}

export const NOT_STAGE_FOCUS: StageFocusSession<never> = {prior: null};

export function isStageFocused<L>(session: StageFocusSession<L>): boolean {
  return session.prior !== null;
}

export function beginStageFocus<L>(session: StageFocusSession<L>, layout: L, copy: (layout: L) => L): StageFocusSession<L> {
  if (session.prior) return session;
  return {prior: copy(layout)};
}

export function endStageFocus<L>(session: StageFocusSession<L>, copy: (layout: L) => L): {session: StageFocusSession<never>; restore: L | null} {
  return {session: NOT_STAGE_FOCUS, restore: session.prior ? copy(session.prior) : null};
}

// ---------------------------------------------------------------------------
// lane-2 T24 / lane-3 E23 / A8: the one fullscreen path. The document holds one fullscreen at a time, and the holder is
// named: a mode that asked for it passes a hold (E23's reader focus, A8's Canvas present); an unnamed request (the M2′
// Timeline stage) passes none. Taking the fullscreen over ends the previous holder's own state first, so two modes never
// hold it together and no exit races a new request.
// ---------------------------------------------------------------------------

/** A mode that asked for fullscreen. `lost` ends that mode's own state. It runs once: when the browser leaves a fullscreen
 *  that was granted to this hold, or when another request takes the fullscreen over. */
export interface FullscreenHold {
  readonly lost: () => void;
}

interface Holding {
  readonly element: HTMLElement;
  readonly hold: FullscreenHold | undefined;
  granted: boolean;
}

let holding: Holding | null = null;
let listening = false;

function exitIfHeld(): void {
  if (typeof document === 'undefined') return;
  if (document.fullscreenElement && typeof document.exitFullscreen === 'function') void document.exitFullscreen().catch(() => {});
}

/** The browser's own exit (its Escape, or its control) ends the mode that was granted the fullscreen, and no other. */
function onFullscreenChange(): void {
  const current = holding;
  if (!current?.granted || document.fullscreenElement) return;
  holding = null;
  current.hold?.lost();
}

function listen(): void {
  if (listening || typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;
  listening = true;
  document.addEventListener('fullscreenchange', onFullscreenChange);
}

/** A refused request holds nothing. If it displaced a fullscreen, that fullscreen is left, so none stands without an owner. */
function refuseStageFullscreen(mine: Holding, displaced: boolean): false {
  if (holding === mine) {
    holding = null;
    if (displaced) exitIfHeld();
  }
  return false;
}

/**
 * The one request for real fullscreen on a stage element. Granted resolves true; refused or unsupported resolves false,
 * and the mode that asked stands in place (a refusal never calls its `lost`). A request takes over what another hold had:
 * that hold's `lost` runs first, and its release is then a no-op, so the new request is not raced by an exit.
 */
export function requestStageFullscreenOn(element: HTMLElement, options: FullscreenOptions = {}, hold?: FullscreenHold): Promise<boolean> {
  if (typeof element.requestFullscreen !== 'function') return Promise.resolve(false);
  const previous = holding;
  const displaced = previous !== null;
  const mine: Holding = {element, hold, granted: false};
  holding = mine;
  listen();
  if (previous?.hold && previous.hold !== hold) previous.hold.lost();
  let request: Promise<void>;
  try {
    request = Promise.resolve(element.requestFullscreen(options));
  } catch {
    return Promise.resolve(refuseStageFullscreen(mine, displaced));
  }
  return request.then(
    () => {
      if (holding === mine) {
        mine.granted = true;
        return true;
      }
      // Ended or superseded while the request settled. A grant that nobody holds any more is exited; one another hold took over is that hold's, and is left.
      if (holding === null) exitIfHeld();
      return false;
    },
    () => refuseStageFullscreen(mine, displaced),
  );
}

/**
 * Leaves the fullscreen this owner holds. A named hold leaves only while it still holds the stage. An unnamed call (the
 * Timeline stage's own teardown) leaves only when no named mode holds it, so it never exits another mode's fullscreen.
 * Idempotent; a failed exit is not an error for the stage.
 */
export function releaseStageFullscreen(hold?: FullscreenHold): void {
  const current = holding;
  const owned = hold ? current?.hold === hold : !current?.hold;
  if (!owned) return;
  holding = null;
  exitIfHeld();
}

/** The DOM a stage focus touches: the stage that fullscreens and carries the mark while focused, and the chrome it hides. */
export interface StageFocusDom {
  readonly stage: HTMLElement;
  readonly chrome: HTMLElement;
  /** The dataset key the stage carries while focused (`data-*` as camelCase, e.g. `timelineFocus`). */
  readonly markKey: string;
}

export interface StageFocus {
  /** The hold this stage's fullscreen is requested under. Its `lost` ends the stage focus. */
  readonly hold: FullscreenHold;
  isFocused(): boolean;
  begin(): void;
  end(): void;
}

/**
 * lane-2 T24, ported onto the one fullscreen path: the Timeline stage's focus. Begin hides the chrome, marks the stage and
 * asks for fullscreen under the stage's hold. End restores the chrome it began from, clears the mark and releases the hold.
 * The hold's `lost` is end, so the browser leaving fullscreen, or another mode taking the stage over, ends this focus the
 * same way E23 and A8 end theirs.
 */
export function createStageFocus(dom: StageFocusDom): StageFocus {
  let session: StageFocusSession<{toolsDisplay: string}> = NOT_STAGE_FOCUS;
  const copy = (chrome: {toolsDisplay: string}) => ({...chrome});
  const hold: FullscreenHold = {lost: () => end()};

  function end(): void {
    const ended = endStageFocus(session, copy);
    session = ended.session;
    delete dom.stage.dataset[dom.markKey];
    if (ended.restore) dom.chrome.style.display = ended.restore.toolsDisplay;
    releaseStageFullscreen(hold);
  }

  function begin(): void {
    if (isStageFocused(session)) return;
    session = beginStageFocus(session, {toolsDisplay: dom.chrome.style.display}, copy);
    dom.chrome.style.display = 'none';
    dom.stage.dataset[dom.markKey] = 'true';
    // A grant that settles after the focus ended is released by the shared path, never held.
    void requestStageFullscreenOn(dom.stage, {navigationUI: 'hide'}, hold);
  }

  return {hold, isFocused: () => isStageFocused(session), begin, end};
}
