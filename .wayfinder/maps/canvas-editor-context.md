# Canvas editor and selected context

Standing: owner-commissioned implementation, 20 September 2026. Continues the Cradle Wayfinder D20/W1.7, U1.2/U1.3/U1.4, U3.1/U3.2 and FND-04. The original commission is the canvas editing/selection/context prompt supplied by the owner.

## Basis and boundaries

Recovered O:I `a222c8bdf46a7b2146084770b704dfbe83ce5027` with the integrated UI; existing branch `agent/canvas-editor-context-20260920`. Native AIKit source `99306d858c255fa258d8cc419b314a433d3f92a4`, branch `agent/canvas-context-20260920`. Read current successor heads before integration. W1 owns shared shell, workspace state and tokens; W2 owns Central/Day navigation; W3 owns Agent setup. This lane uses the existing ContextTray root mount and ContextPlane, not another shell. No user-machine access or deployment.

## Connected work

| Unit | Inherited contract | Files / native owner | Decisive proof |
|---|---|---|---|
| CE1 format tools | U1.2 / FND-04 | editor, material, FileSurface; Central save unchanged | commands edit intended ranges, one undo, read-only refusal; source/rendered/split preserve bytes |
| CE2 natural selection | U1.4 / W1.7 | EditorChrome, TextEditor, PageContext, browser adapter | ordinary selection without mode switch; deliberate pick does not consume text drag; retained cues are not source edits |
| CE3 prepared context | U3.1/U3.2 | ContextTray / ContextPlane; AIKit encounter store | multiple exact occurrences, remove/reveal, no modal or implicit send; session isolation/CAS |
| CE4 operative join | D20 / W1.7 | AIKit native expression parser + context preparation; thin O:I bridge | structured/typed native expression parity; immutable snapshots and exact source basis; no QL prerequisite |
| CE5 explicit delivery | U4.1/U4.2 | existing encounter draft/prompt and Activity | changed context refuses stale send; failed dispatch retains preparation; source and authority never granted by a gesture |

## Acceptance

Text/code: accessible icon controls, undo/redo, clipboard, search/replace, indent/comment/folding, line navigation, wrap and language override. Markdown: headings, emphasis, lists/tasks, quote/code/link/image/table, faithful source and rendered/split reading. HTML: mapped authored content stays owned; generic HTML is edited as source, never lossily serialised from contenteditable. Browser: real navigation remains normal; observations carry document identity. Other formats disclose actual capabilities, not universal editing.

Transient selection, authored annotations, prepared context and owner-recorded delivery have different states. Default selection does not publish, mint participants or invoke a model. Text ranges are UTF-16 and exact; repeated text is not a locator. DOM locators are observations, not source authority. Oversized selections fail visibly instead of truncating. Changed source/observation requires review; a captured snapshot never silently becomes current canonical text.

## Evidence and remaining gates

This is implementation work, not an acceptance claim. Append actual commands and results below. Controlled browser and native deterministic tests do not establish a real model/provider, installed Tauri/browser or human experience. Whole-source Return/inclusion and existing Day/NOW gates retain their own requirements.
