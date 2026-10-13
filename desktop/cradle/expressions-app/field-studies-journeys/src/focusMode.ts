// lane-3 E23: focus mode is the app's presenting mode, extended, not a second mode.
// Focus hides the chrome (the stylesheet's .presentation rules), closes the transient panels,
// asks the browser for real fullscreen on the stage, and on exit restores the layout it found.
// This module is the pure layout model: what is snapshotted, what focus changes, what exit restores.
// The DOM work (requestFullscreen, body class, panel flags) stays in app.ts.

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
