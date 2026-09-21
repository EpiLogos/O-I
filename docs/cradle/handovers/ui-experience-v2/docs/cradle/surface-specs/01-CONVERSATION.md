# Tasks — the conversation, not the work dashboard

**Version 2.** Tasks is the existing left-navigation conversation destination. Use the owner's selected Grok Bot/Slack message-room visual grammar and the existing Buzz-style To:/@ behaviour as design references, not a new messaging product or a claim about current external software. Read [Desk](07-DESK.md) and [common controls](00-EXPERIENCE-CONSTITUTION.md).

## 1. Recurring job

Talk with the agent or team carrying the work, write the next thought, send the chosen context, answer a request and open the produced material. Opening Tasks should feel like returning to an exchange—not opening a task tracker, configuration wizard or flight recorder.

The shared AgentChat, session, draft and accepted Context insertion remain. Desk is where the Run is composed/inspected; Tasks is where it is discussed. They are views of related work, not two transcripts.

## 2. Resting composition and type

```text
<avatar> <agent / team / conversation title>        [ ... ]
<small Run link only when genuinely related>

<avatar> <agent name>   <time at speaker-group boundary>
         <readable message body>
         <compact actual work mark>

                                      <person's message>

         <one outcome line>  [actual artifact]

<retained context inserts and draft attachment treatment>
+------------------------------------------------------+
| To: [real recipient]                                 |
| Message…                                             |
| [ + ]                                      [ send ]  |
+------------------------------------------------------+
```

Keep a 64–72 ch readable prose lane, max about 760 px, with wide code/material blocks allowed to use the available lane without changing the whole shell width. At narrow width use 16 px side padding. Give speaker groups 24 px separation; consecutive parts from the same speaker use 8 px and do not repeat avatar/time. Human messages may use a quiet neutral bubble; agent prose remains open, without a card around every paragraph. Do not introduce bright brand-colour bubbles or change authored document artwork.

The title is an identity/open-profile control, not a repeated Agent/Session header. Its menu contains actual conversation actions. Runtime facts move to the selected Agent or Run detail. If current chat already has better equivalent grouping, preserve it and apply only the bounded spacing/chrome refinements.

Composer anchors inside its own pane, not the browser window. Keep the existing context insert above/within it as currently implemented. Draft area grows roughly 80–200 px then scrolls; the transcript reserves its actual height. No composer over the last message, no second composer hidden by CSS.

## 3. Compose: exact controls and states

**Plus.** Keep the current working composer insert control. The visible icon is `+` where appropriate, accessible **Insert context**. Open its existing menu/picker for files, terminals and browser context. Do not rebuild that menu or flatten these types into upload-only attachments. Any additional supported skills/action entries reuse existing behaviour, not a new command registry.

**To:/@.** The compact recipient strip is part of the draft. Click To: or type @ to open the same attached picker. Actual agent results have a quiet Agent badge; teams show their actual type/membership distinction. Arrow keys move results, Enter selects, Escape closes and restores the draft caret. Selecting does not send, add team members, or grant access. Removing a chip removes the recipient relation, not authored prose. An empty chip input uses Backspace first to focus the previous chip, then to remove it.

**Send.** One 32 px arrow control with accessible **Send message**. Blank/invalid draft uses the existing real invalid-input state, not an absent-capability placeholder. Preserve the current send shortcut and expose it in the existing hint/tooltip. Never send during IME composition or while Enter is selecting a picker result. Revalidate recipient/context/binding at send; failure keeps the exact draft and inserts.

**Working.** If the current provider offers interruption, the same end slot can show a stop glyph with accessible **Stop current response**; do not create a permanent Stop button beside Send. Keep composing the next draft possible according to the current session behaviour. Stop is a request, not proof that the process stopped; show local pending then actual result. Do not invent queue-next-message capability.

**Empty.** Existing suggested prompts remain verbatim, at most three, positioned with the current accepted welcome/composer layout. Choosing a suggestion writes into the draft; it does not dispatch. No fabricated greeting or example conversation.

## 4. Messages, marks, permissions and results

A message's own secondary tools appear on hover/focus-within in its reserved edge: Copy and actual overflow actions. Do not show a full action row under every message at rest. Coarse-pointer mode retains an accessible overflow. Copy feedback changes the icon/accessible label briefly without adding a new toast stack.

**Work marks.** One compact disclosure line, 13 px secondary text: `⟡ {verb} {object} · {duration} · {calls}` with unavailable metrics omitted. It expands in place to a short semantic summary, at most three meaningful rows, and **Open activity**. That link opens the right Run tape at the exact correlated event; it does not navigate away to a new page. Repeated updates to the same native call replace its mark; retries remain distinct. Clicking the disclosure is not itself a grant or a rerun.

**Permissions.** One narrow inline card aligned to the message measure, with subject and requested effect first. Display the real offered scope beside the controls. One primary grant choice and quiet Refuse appear only when correctly mapped to native choices; multiple native grant scopes use the existing scope selector, not invented “Always allow.” Pending locks duplicate response at this exact request. On acknowledgement, collapse the card to a one-line outcome with expandable original scope. Expired/refused requests remain attributable history, not recurring alerts.

**Completion.** A status announcement is one line plus actual artifact chips/links. Substantial code/report/check material opens as the existing material Surface, with its exact revision. **Do not truncate genuine conversational answers, requested prose, or the user's text to one line.** The one-line rule applies to automatic completion/status announcements, not everything the agent says. A long useful answer remains readable conversation.

**Artifact chip.** Mark, real title, optional actual revision. Whole chip opens; overflow is separate. No Download/View/Open triple button row. An arrival adds a quiet cue without replacing the document under review.

## 5. Return from Desk and inspect without losing thought

Desk step → Message opens the exact carried conversation in Tasks. Existing drafts are preserved per conversation. Opening an Agent drawer or skill from a message does not change the draft recipient. **Open in Desk** opens that same object in the workbench while retaining the exchange. No automatic Team setup page on the path to ordinary Send.

Scrolling into history stops auto-follow. A single **New messages** pill appears only when new messages arrive; selecting it resumes. It does not count every token as a message. The workmark's expansion, page scroll and draft survive Run/Agents/Context and Desk/Tasks switches.

## 6. States and exact copy

| State | Response |
|---|---|
| Empty | Actual draft and retained suggestions; no runtime checklist |
| Working | Real text and compact marks; supported interruption in the composer's action slot |
| Needs-you | Exact inline question/permission; no duplicate resolution on the roster |
| Error, known unsent | **Message not sent.** and supported retry beside the draft |
| Delivery uncertain | **Checking whether your message was sent…** only while actual reconciliation runs; no duplicate send |
| Refused | Actual concise operation refusal in its thread context; safe conversation remains possible |
| Live | Stable grouped messages/marks; history reading held; New messages pill only on arrival |
| Recipient stale | **This recipient changed. Choose again.** with draft preserved |
| Permission sent/refused/expired | **Granted.**, **Refused.**, **Request expired.** only from actual state |
| Partial result | Accurate short progress/outcome plus real partial artifact; not a fake Done |

Control labels: **Insert context**, **Send message**, **Stop current response**, **To:**, **Open activity**, **Message**, **Open in Desk**, **Copy message**, **New messages**, **Details**. Preserve current context labels and suggested prompts. No architectural send hint.

## 7. Subtraction list

Remove the visible New agent/New team row from chat; redundant session/provider banners; log dumps; one-card-per-paragraph styling; action batteries below every message; status-only parting essays; duplicated attachment/source forms; fixed empty runtime consoles; permanent inbox/receiving strips; fabricated welcome history. Keep substantive answers, actual workmarks, permissions, existing context inserts and real source/material references.


## Retained binding inventory

The following inventory is retained from v1 as source-qualified implementation reference. It is not a rendering prescription. Reconcile it with the active local tree; this version's interaction and preservation rules govern presentation.

## Appendix A — element → binding

| Element | Existing component/owner | Read or operation; limits |
|---|---|---|
| Single conversation | `src/agent/chat/AgentChat.tsx`, hosted by `AgentLayer.tsx` or Factory Tasks | Shared `useEncounterSession`; one native session and draft basis. Import path verified through AgentLayer. |
| Draft and transcript | `src/encounter/client.ts` | `kernel_op {op: "encounter", project, request}` with `draft`, `view`, `read`, `status`. |
| Addressed send | Same client | `send` / `send-group`; preserve `delivery_ref`, sender, `expected_binding_revision`, `expected_task`, packet and per-recipient outcomes. Group delivery is not atomic. |
| Send after prepared context | Same client | `prompt-context` with draft revision and context expectation; do not replace the current native context pipeline. |
| Permission | `EncounterReading.permissions`, `NativePermission` | `permission` with `request_id` and actual selected `option_id`, or the native cancelled decision. |
| Interrupt | Current session action availability | `cancel` only where the selected action is exposed and valid. Request is not proof of stopping. |
| Activity mark | Native correlated activity / encounter blocks | `RunPlane` / `TrajectoryPlane` receive the exact activity identity. Plain blocks have `id`, `kind`, `text`; they do not supply duration. |
| Provenance chip | Actual agent/management provenance | Omit without a source-backed relationship. |
| Artifact link | Existing source/material/Surface open route | Exact ref and reviewed revision; no generated placeholder link. |

## Acceptance — interaction and visual proof


T01 — Tasks is the real shared conversation. Desk/Tasks, centre/side and detach/re-dock keep one visible composer, exact draft, caret, recipient and inserts.

T02 — Recipient picker Enter selects without sending; Escape restores caret; chip Backspace follows the specified sequence; IME does not send. Existing send shortcut is unchanged.

T03 — Existing file/terminal/browser insertion is still the actual context flow. Opening/adding an object does not silently send or disclose it.

T04 — A mark expands to a short summary, then opens the right Run tape at the exact event. Distinct retries are not coalesced and missing metrics disappear.

T05 — Permission resolves one native request with real scope options; acknowledgement collapses its card. Double activation, refusal, expiry and unknown transport effects are tested.

T06 — Completion announcements use actual material links; useful long conversational prose is not suppressed. Artifact arrival does not steal selection or replace a held revision.

T07 — Message actions reveal on hover/focus without moving text, and remain reachable on coarse pointer. Narrow width, long code, 200% zoom and growing composer do not hide the last message.
