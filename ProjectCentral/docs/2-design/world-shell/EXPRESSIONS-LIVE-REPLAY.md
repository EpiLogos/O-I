# Expressions: one-pass live replay checklist

**This document is not itself a live replay.** It is a checklist a person can run once the native stack is up. Nothing below has been run. The ledger's standing says the same for every row: `live_replay` is `pending-native-stack` (`EXPRESSIONS-PORT-STATUS.json`, `standing`).

Each step says what to do and what passing looks like. Where a step is known to be partial, the step says so. A failed or unclear step is a finding to record, not a reason to skip the rest.

## Before you start

- The native stack is running and the shell opens onto a native Expression.
- The Expression has at least one formation and one pin, so object-scoped devices have something to act on.
- Record the result of each step in a results file of your choosing. The suggested name is `new-shell/evidence/expressions-live-replay-<date>.json`. Include the step ID, pass or fail, the viewport width, and anything observed that differs from "passing looks like".
- Two viewports are needed: the full window at about 1920 px wide, and a browser pane or window about 700 px wide. Use the same Expression for both.

Step IDs are letter and number: the letter is the section.

## A. Rack: add, remove, reorder

**A-1 Add a device with + Device.**
- Do: click `+ Device` in the rack. Choose an addable device from the menu.
- Passing: the device appears as a card at the end of the rack. The menu no longer lists it. The `+ Device` button stays enabled. Reading the rack after a reload shows the same card.
- Code reference: `NativeDeviceRack.tsx` (AddDevice, around `:342-383`).

**A-2 Add a device by drag.**
- Do: open the Browser's Devices category. Drag a row onto the rack, into a gap between two cards.
- Passing: an insertion line shows during the drag. The device lands at that gap, not at the end. Only one device is added.

**A-3 Remove a device.**
- Do: on a card, click the `✕` button labelled "Remove ... from the rack".
- Passing: the card goes. Its parameters keep their values: the tooltip says "Removes the widget only; parameters keep their values". Check one parameter's value before and after.

**A-4 Reorder by drag and by keyboard.**
- Do: drag a card by its `⋮⋮` grip to another position. Then focus a grip and press Alt+Left, then Alt+Right.
- Passing: each move changes the order once. Undo (one step) restores the previous order.

## B. Pool panel for every device, at about 700 px and at 1920 px

Open each device from the Browser's Devices category: click its row (`NativeDeviceBrowser.tsx:28`). Do this at both viewports. There are 21 catalogue devices:

- Field (9): physics, medium, resonance, contacts, ink, depth, relational, pointer, focus.
- Field-level bespoke (2): morph, colour.
- Entity (4): force, formation, sound, meaning. Entity devices need exactly one object selected.
- Scene (6): scene, text, automation, blueprint, arrange, body.

For each device, the passing check is the same:
- The panel opens and its title matches the row. The pool region is labelled "<title> panel".
- Its controls can be reached, by scrolling inside the pool body if needed. Nothing is clipped or overlapping at the narrow width.
- The `Add to rack` (or `On rack ✓`) button is present and shows the right state.
- `Open in studio ↗` appears only for devices that have a Studio section. Record which devices have it.
- `Esc` or the `✕` closes the panel, and focus returns to the Browser row that opened it.

**B-1 Entity devices with no object selected.** Clear the object selection (the Object header select set to "Choose an object"). Open force, formation, sound and meaning.
- Passing: each shows its "Select one object to act on its ..." message. No control writes anything.

**B-2 Entity devices with one object selected.** Select one object. Open the same four.
- Passing: each shows the object's values, and the rack's Force card matches the same object.

**B-3 Scene devices.** Open scene, text, automation, blueprint, arrange, body.
- Passing: each shows its own panel. The scene device shows Scene settings and Expression settings (title and description). Note any Scene editor that also appears in the Clip view (see the fifth-places audit, item 5).

**B-4 Arrange panel.** Open arrange. Check two objects with the checkboxes. Choose a mode. Press Apply.
- Passing: the checklist does not change the native selection (the Object header still shows the same object). Apply produces one undo step that restores both positions and the layout.

**B-5 Devices category with search.** Type a search term in the Browser search box, then press Esc.
- Passing: the count label updates. Esc clears the search. The rows match the term.

**B-6 Pool target agrees with the spine.** This is the check for the defect in `EXPRESSIONS-ENCOUNTER-SPINE.md` (S1).
- Do: with two objects, A and B, select A in the Object header. Open a field or entity device in the pool. In the pool's "Device target entity" select, choose B. Then choose A again. Also, with the Browser pool closed and reopened, compare the pool's target with the header.
- Passing: at every step, the pool's target, the header's Object select, and the rack's target line name the same object.
- Record: if they ever differ, note exactly which step, and what each one showed.

## C. Session

**C-1 Scene transport in Session.** Switch the centre to Session.
- Passing: the transport strip shows Scene ↗ and Acts only (compact). No second Play or scrub control is there.

**C-2 Scene selection.** If Session shows Scenes as columns, click another Scene's column. (Not verified in code: check what Session shows for this Expression first, and record it.)
- Passing: that Scene becomes the presented Scene, and the top-bar Scene name matches.

## D. Arrangement

**D-1 Compact transport.** Switch the centre to Arrangement.
- Passing: as C-1, compact transport only.

**D-2 Arrange while Arrangement is up.** Use the Arrange device from B-4 while this view is showing. (Not verified in code whether Arrangement redraws on the owner's reply: record what it shows.)
- Passing: the view reflects the new Scene state after Apply, or the gap is recorded.

## E. Transport

**E-1 Play, Stop and the Scene readouts.**
- Do: press Play (or Space with no control focused). Let it run, then press Stop.
- Passing: Play becomes `Ⅱ` while running. Stop rewinds the working Scene to its start and pauses it. "Scene time" and "Expression time" readouts move, then reset.

**E-2 Scrub.**
- Do: drag the position slider. Then use the arrow keys (Shift for 1 s, Home and End for the ends).
- Passing: the readout moves with the drag. One release seeks once. Nothing is sent on an unmoved press.

**E-3 Scene navigation and Saved scenes.**
- Do: use the `‹` and `›` buttons, then Saved scenes, then the loop button.
- Passing: `‹` and `›` are disabled with a reason when there is no earlier or later Scene with material. Saved scenes plays the saved sequence. The loop button shows `aria-pressed` correctly.

**E-4 Arm and Play.** The transport's `A` arms recording. Note: a take start with chosen properties is not yet replayed (ledger row 0). Expect either a take or a refusal with a reason.
- Passing: Play while armed starts a take, or shows a named reason ("Playing without a take: ..."). Play while not armed plays the Scene.

**E-5 Take mode and the overflow.** Open `…` (More transport controls). Check the take-mode select, and the Guide and Save buttons inside it.
- Passing: the overflow opens and closes. Each control inside it is reachable at 700 px.

## F. Takes

**F-1 Empty state.** Open the Clip view and choose the Takes tab.
- Passing: with no recorded tracks, the text says "No property takes are recorded in this Scene. Record chosen properties from the transport bar."

**F-2 With a take.** If E-4 produced a take, reopen the Takes tab.
- Passing: the list shows the track name, its point count and duration, and an envelope drawn in the box.

**F-3 Preview.** Press Preview, then Stop preview.
- Passing: the button's `aria-pressed` follows the state. A refusal (no tracks, or another Scene presented) shows a named reason. Preview is a frame gesture: the shell shows no clock of its own.

**F-4 Delete and undo.** Press Delete on a track, then Undo once.
- Passing: the track is removed in one owner edit. Undo puts it back.

## G. Fold

Fold copies a state into an earlier Scene. The shell's fold is an inline two-step confirm (ledger rows 48 and 49).

**G-1 Choose and confirm.** Open the Clip view, States tab. Select a formation with at least two states. Open "Fold this state". Choose a destination, choose a playback mode, then press Confirm fold.
- Passing: the confirm text names the destination and whether the state is removed from here. After confirm, the earlier Scene has the new state.

**G-2 Undo.** Press Undo once.
- Passing: the fold is undone in one step.

**G-3 Refusals.** Try folding the last remaining state of a formation, and try folding into a locked formation.
- Passing: each refusal shows a reason. The last-state case is a deliberate difference from the app (fold-state, row 48). Record what the reason says.

## H. Starters

**H-1 Kundalini sequence.** Select one formation. In the Objects category, open Starters and run "Kundalini sequence (on selected formation)".
- Passing: a progress line reads "... placed" at the end. The formation has seven new states.
- Expected, from the ledger (row 11): the starter is two owner batches. One Undo may not restore everything. Record how many Undo presses restore the original states.

**H-2 Chain starters.** Run one "Chain:" starter.
- Passing: as H-1, with its own result. A starter with a stated reason is disabled and shows that reason.

## I. Save

There is no Central file save in the shell (ledger row `native-save-file`, owner-op-required). The "File Save" step in the brief means the transport's **Save Expression** (`NativeTransportBar.tsx:211`), which is an owner commit of the working edit. Do not record a file write.

**I-1 Disabled with no edit.** With no edit made, open `…` and find Save Expression.
- Passing: it is disabled, and its reason says "Nothing to save: this Expression matches the native owner."

**I-2 Save an edit.** Make one edit (move a parameter). Press Save Expression, inside `…`.
- Passing: the notice reads "Saved to the native Expression" only after the owner's reply shows a clean draft. The button is then disabled again.

**I-3 Ctrl or Cmd+S.** Make one edit. Press Ctrl+S (or Cmd+S) with focus on the canvas, not in a text field.
- Passing: the same result as I-2. With focus in a text field, Ctrl+S must not save.

## J. Negative checks (record only)

These check the known rule split in `EXPRESSIONS-ENCOUNTER-SPINE.md` (R1 and R2). They are expected to show a split. Record what you see; do not treat the split as a pass or fail of the shell.

**J-1 Two objects selected in the retained app.** In the application, select one object, then add a second object with its multi-select gesture. (The app's `selectEntity` takes a multi flag, `app.ts:341`; the exact gesture is not verified, so find it in the app and record it.)
- Observe: the rack's entity widgets show "Select one object" (rule R1). The Parameters browser's Object scope follows the first object (rule R2). Record both.

**J-2 Follow control with two objects.** With the state from J-1, look at a chosen control in "Follow" scope.
- Observe: the rack shows no target, but the control's value may come from the first object. Record which object the value follows.

## Summary to record

- Total steps run, passed, failed, and not run (with reasons).
- For each failure: step ID, viewport, what was observed.
- For B-6, J-1 and J-2: the exact observation, in words and, where possible, one screenshot.
