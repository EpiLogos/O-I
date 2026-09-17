# Editor context suite — implementation proposal

**Standing:** agent-authored proposal, 2026-09-08. This is an implementation
plan, not an adopted architecture contract or evidence that the capability
exists. It records the smallest owner contracts needed before implementation.
No production source was changed by this planning pass.

## Purpose

Turn the thin inner-canvas line into a quiet, document-aware editing surface,
and let a person deliberately attach a precise selection from any pane to the
active agent encounter. The interaction must preserve native refs, revisions,
provenance and authority. It must not create a desktop document model, browser
DOM store, copied transcript, or second semantic selection.

The user-facing shape is:

1. The pane tab remains the only persistent filename label.
2. A single 28–32 px canvas command line presents only controls useful for the
   active document type. It does not repeat the filename.
3. The bottom line shares the canvas background and carries only compact
   state that matters while editing (for example dirty/read-only, line and
   column, zoom, page); it has a top rule and no panel name.
4. **Attach context** enters a pane-local selection mode. Selectable content
   receives a one-pixel focus treatment and pointer affordance; there is no
   wash over every element. A click or text selection creates a candidate.
5. The candidate appears beside the active encounter composer as a removable
   chip. Nothing is disclosed to the agent until the person sends the turn.

## Recovered ground

The proposal follows these current sources:

- [`docs/cradle/01-DESIGN.md`](../../../../../docs/cradle/01-DESIGN.md),
  especially §§3, 5 and 8: authored material remains distinct from a
  commission; knowledge/context is selection-anchored and promoted without
  forking identity.
- [`docs/cradle/02-ARCHITECTURE.md`](../../../../../docs/cradle/02-ARCHITECTURE.md),
  §§5–9 and §14: semantic and presentation state are distinct; one global
  focus carries stable owner refs; a Surface binding may move without minting
  another subject; one canonical encounter keeps one transcript and composer.
- [`docs/cradle/03-UX-STATES.md`](../../../../../docs/cradle/03-UX-STATES.md),
  B, C, E and F: surface focus is not semantic selection; commission records
  what was sent; UI selection is not context disclosure; reconnect and
  subject-switch states preserve identity and clear unrelated readings.
- [`docs/cradle/04-VERIFICATION.md`](../../../../../docs/cradle/04-VERIFICATION.md):
  a source or selection can be commissioned without mutating it; selected
  context remains inspectable and revision-aware.
- [`docs/OI-DESKTOP-APPLICATION-SPEC.md`](../../../../../docs/OI-DESKTOP-APPLICATION-SPEC.md),
  §§5, 9, 12–14 and 17: the canvas is a general Surface host, owners retain
  refs and actions, visible does not mean trusted or authorised, and the same
  stable subject must survive navigator/canvas/encounter presentation.
- [`SELF-OTHER-FIELD-UX-2026-09-08.md`](../../../../../.superpowers/sdd/cradle-rebuild/SELF-OTHER-FIELD-UX-2026-09-08.md),
  “One pane system” and “Foundation engineering”: the right side remains the
  optional accompanying agent; canvas panes carry other detail; selections
  do not silently disclose content; owner revisions coordinate windows.

Current implementation facts at O:I `269b8ab`:

- [`SourceSurface.tsx`](../../../src/surface/SourceSurface.tsx) has a real
  Central source buffer, base revision, CAS save/conflict, caret/scroll restore
  and source history. It has no context-selection contract.
- [`FileSurface.tsx`](../../../src/files/FileSurface.tsx) reads native
  `central.path-ref/v1` locations, owner revisions and disclosed write/history/
  restore availability. It has no typed attachment path.
- [`MaterialSurface.tsx`](../../../src/material/MaterialSurface.tsx) renders
  HTML, Markdown, images and PDFs and gives HTML/Markdown their existing Source
  view. Rendered HTML runs in a sandboxed iframe. Unsupported binary material
  has an honest disposition. There is no browser-to-host inspection bridge.
- [`types.ts`](../../../src/surface/types.ts) carries a Surface binding's
  owner ref/location and view placement. Layout persistence deliberately does
  not persist semantic selection.
- [`kernel/types.ts`](../../../src/kernel/types.ts) mirrors opaque refs,
  Central locations/revisions and the kernel's one global focus. It exposes no
  context candidate/resolution operation.
- [`EncounterView.tsx`](../../../src/encounter/EncounterView.tsx) has one
  AIKit-owned transcript/draft/composer across presentations. The current
  `prompt` request carries only `agent_session` and `draft_revision`; there is
  no owner-supported attachment field. This gap prevents production context
  attachment today.

## One visual grammar, controls by document type

The command line is a host slot. Each renderer supplies a bounded list of
commands and status readings; it does not render another header. Controls that
mutate content call the native owner action and show its exact availability.

| Surface | Always visible | Disclosed on demand | Selection support |
|---|---|---|---|
| Plain text / source / code | edit or read-only state; Save only when dirty and owner-write is available; Attach context | History, compare/recover, encoding/line endings; language mode only when a real editor supplies it | text ranges anchored by UTF-8 offsets, line/column and exact quote against the owner revision |
| Markdown | Rendered/Source, zoom in rendered view, Save in Source when available, Attach context | outline, links, history | source ranges in Source; rendered block or text ranges resolved back to source offsets by the Markdown renderer |
| HTML document | Rendered/Source, reload, zoom, Attach context | page outline, open/reveal owner actions, console only when a native browser capability supplies it | DOM element/text candidates from the contained document, then owner resolution against the exact HTML revision |
| PDF | page, zoom, fit, Attach context when the viewer exposes selection geometry/text | thumbnails/outline/search, native open/reveal | page plus text quote and quad/rect geometry; unavailable if the native viewer cannot supply reliable text/geometry |
| Image / SVG | zoom, fit; Attach context for the whole image | metadata and owner open/reveal; region annotation only after an owner contract exists | whole owner ref/revision now; bounded pixel/normalised region only after a native annotation contract exists |
| JSON / structured text | Source controls initially | tree view only when a real renderer lands | source text range now; JSON Pointer only if the renderer can map it back to the same revision |
| Unsupported binary | no editor controls beyond owner-disclosed open/reveal | mime, size and reason | whole-file ref only when agent retrieval is permitted; no fabricated inner selection |

The suite must use roving focus and overflow rather than widening the bar. At
narrow pane widths, preserve the primary mode, Attach context and one overflow
button. Tooltips and native menus disclose shortcuts. Controls do not wrap.

## Proposed typed boundary

The renderer may propose a **candidate** because a DOM node, PDF glyph or text
range is presentation state. Only an owner resolver may turn it into context
that can be commissioned.

```ts
type ContextCandidate = {
  schema: "oi.context-candidate/v1";
  surface_binding_id: string;
  subject: SemanticRef;                 // existing opaque owner ref
  observed_revision: string | null;     // null is explicit, never “latest”
  presentation: "source" | "rendered" | "pdf" | "image";
  selection:
    | { kind: "text-range"; utf8_start: number; utf8_end: number;
        quote: { exact: string; prefix?: string; suffix?: string } }
    | { kind: "dom-element"; frame_path: number[];
        selector: { css?: string; xpath?: string };
        quote?: { exact: string; prefix?: string; suffix?: string } }
    | { kind: "pdf-range"; page: number; quads: number[][];
        quote?: { exact: string; prefix?: string; suffix?: string } }
    | { kind: "whole-subject" }
    | { kind: "image-region"; x: number; y: number; width: number; height: number };
};

type ContextSelection = {
  schema: "oi.context-selection/v1";
  selection_ref: string;                // minted by native owner/resolver
  subject: SemanticRef;
  resolved_revision: string;
  selector: ContextCandidate["selection"];
  display: { label: string; excerpt?: string };
  disclosure: {
    retrieval_allowed: boolean;
    audience?: string[];
    classification?: string;
    reason?: string;
  };
  provenance: { owner: string; operation: string; receipt_refs: string[] };
};
```

`ContextCandidate` may live only in the active pane's transient presentation
state. `ContextSelection` is returned by the native owner operation and held in
the AIKit encounter draft as a typed attachment. The desktop must not invent
`selection_ref`, infer retrieval permission from rendering, or save selected
content in layout/local storage. Exact quote is an anchoring aid and review
excerpt, not an authority-bearing copy.

For browser content, the contained renderer posts candidates through a
versioned, origin-checked bridge. The host accepts messages only from the
mounted frame/window generation and validates bounds and payload size. CSS or
XPath alone is insufficient: the candidate also carries the Central ref and
observed revision. Scripts inside the page cannot attach or send context.

## Owner contracts required

These are product-owner gaps, not desktop APIs to improvise.

1. **Central resolution operation.** Given an owner source/path ref, observed
   revision and candidate selector, return a resolved selection or one of
   `revision-moved`, `selector-not-found`, `retrieval-withheld`, `unsupported`
   with the current revision when available. It must bound quote/excerpt size
   and carry a receipt. HTML DOM resolution may belong to a Central-declared
   material renderer, but the returned ref/revision remains owner anchored.
2. **AIKit encounter draft attachments.** Extend the canonical encounter
   `draft` reading/mutation to carry ordered `ContextSelection` refs beside
   text, with draft revision/CAS semantics. Extend `prompt` so AIKit resolves
   and records the exact attachment set atomically with the turn. The current
   desktop `prompt {agent_session,draft_revision}` is insufficient.
3. **AIKit disclosure/admission result.** Before send, report whether each
   attachment is eligible, disclosed, withheld, stale or unavailable for that
   actual session/harness. Rendering a file and selecting it do not establish
   model readability. Send must refuse or require explicit removal when the
   owner cannot preserve the reviewed set.
4. **Actuation/encounter receipt.** The commissioned turn records selection
   refs, source revisions, audience/session, time and native result. Returned
   work can therefore cite what was actually supplied without embedding the
   entire source in the desktop transcript.
5. **External browser observation.** If a later browser opens a URL without a
   native source ref/revision, its owner must define an observation/snapshot
   ref and trust policy. Until then it may be shown and inspected locally but
   only explicitly attached as `transient observed material`, never presented
   as durable/retrievable source.

## Interaction and routing lifecycle

1. `⌘⇧A` (proposed; verify against the native shortcut table) toggles Attach
   context in the focused pane. A toolbar button exposes the same act.
2. The pane displays a short mode label and Escape affordance. Focus remains in
   the document. Pointer hover draws a one-pixel outline; keyboard navigation
   moves a visible focus ring among semantic blocks/elements.
3. Space/Enter or pointer selection creates a candidate and invokes the owner
   resolver. Text selection may use the editor's native selection gesture and
   an adjacent Add action; normal text selection must remain available outside
   Attach context mode.
4. Successful resolution adds a chip to the **currently targeted encounter
   draft**. The target is explicit: when one encounter composer has focus, use
   it; with several visible and none focused, open a target picker naming the
   real AgentSession refs. Never route by nearest pane or most recent incoming
   activity.
5. The chip shows source label, selection kind, short revision and status.
   Activate it to preview the exact resolved excerpt/element and provenance;
   Delete removes it from the draft. Reordering is keyboard accessible.
6. Send is the only disclosure boundary. The confirmation is the ordinary
   reviewed composer state, not a modal on every turn. If audience, trust or
   retrieval state changed, the owner returns a blocking preflight result and
   the composer names the affected chip.
7. On send success, the transcript records compact attachment refs and the
   owner receipt. On failure, text and chips stay in the AIKit draft. Closing,
   full view, split, detach/re-dock and subject switches preserve the one
   canonical encounter draft rather than copying it.

Cross-pane selection does not change the kernel's one global semantic focus
until the existing focus action does so. The selection candidate names its
origin Surface binding, while the resolved selection names the owner subject.
This keeps interaction focus, semantic focus and context disclosure distinct.

## Stale, failure and recovery states

| Condition | Required result |
|---|---|
| Owner revision moves before resolution | Keep the candidate visible as stale; offer Re-resolve against current revision, Preview both, or Remove. Never silently shift offsets/selectors. |
| Revision moves after chip creation but before Send | AIKit preflight blocks that attachment and reports expected/current revisions. Re-resolve produces a new selection ref and replaces it only after user review. |
| CSS/XPath no longer resolves | Try quote fallback only through the owner resolver and report the change. Ambiguous matches require user choice; no nearest-node guess. |
| Frame reloads or navigates | Invalidate outstanding candidates by frame generation. Existing resolved chips remain owner refs but are rechecked at Send. |
| Source is dirty locally | Select against the cradle buffer only if Central/AIKit define a draft-snapshot ref; otherwise label it local unsaved and refuse attachment, offering Save then attach. Never call the base revision's old content the selected draft. |
| Retrieval becomes withheld | Keep a visible chip with withheld reason; Send omits nothing silently and cannot bypass owner policy. |
| Target encounter detaches/disconnects | Keep attachments in its canonical AIKit draft; local pane selection mode can close independently. Reconnection rereads the draft revision. |
| Resolver unavailable | Selection mode remains usable for local inspection, but Add reports unavailable and does not fabricate a chip. |

## Privacy and trust

- Default disclosure is zero. Hover, highlight, copy, selection and semantic
  focus do not feed the agent.
- Attachment previews show the actual recipient encounter and any owner-
  supplied audience/classification. Cross-world or shared material never
  inherits local visibility.
- The browser bridge rejects credentials, hidden form values, password fields,
  selected content outside the rendered owner subject and unbounded page HTML.
  Sandboxed content cannot invoke send, mutate files or request authority.
- Logs/telemetry carry refs, kinds, byte counts and failure states; quoted
  content is excluded unless the owner receipt explicitly requires it.
- A selection chip does not grant file-write, browser execution, network or
  tool authority. Those remain separate native permission decisions.

## Accessibility and keyboard acceptance

- The toolbar is a labelled `toolbar` with roving tab stop, arrow-key movement,
  Home/End and Escape back to the document. Mode toggles expose pressed state.
- Selection mode announces entry, candidate, resolved/stale/error and exit via
  a restrained live region. Outline, cursor and text label all convey mode;
  colour and motion are never the sole signal.
- DOM element navigation follows document order and skips hidden/inert/control
  interiors that may contain secrets. A tree/list alternative exposes the
  same candidate set where pointer hit testing is spatial.
- Text selection retains platform behaviour, IME composition and screen-reader
  virtual-cursor use. Attach mode must not intercept typing shortcuts.
- Reduced motion removes travelling outlines and keeps immediate focus changes.
  High contrast uses system focus colours while preserving the one-pixel edge.
- Chips are a labelled list with remove buttons, reorder shortcuts, full
  provenance descriptions and deterministic focus after deletion.

## Implementation slices and real acceptance

### EC-01 — host chrome and renderer contribution contract

Replace repeated inner filename/status headers with one `SurfaceCommandLine`
and `SurfaceFooter` slot owned by the host. Port existing HTML/Markdown toggle,
zoom/reload, file save/history and revision state into typed contributions.
Verify each real format at narrow/wide widths, keyboard traversal and no
duplicate filename beyond the tab.

### EC-02 — source-range candidates

Add pane-local selection mode for the real source/file editors. Produce bounded
UTF-8 offsets and quote context against the exact owner or explicit dirty draft
basis. Verify Unicode, CRLF, long files, rapid edits, save conflict and
multi-pane selection.

### EC-03 — owner resolution

Land the Central operation and kernel adapter with real files and revisions.
Tests must change the source between candidate and resolve and prove structured
stale/ambiguous/refused outcomes. The app walk must show both sides and preserve
the candidate.

### EC-04 — encounter draft attachments and send authority

Land AIKit's typed attachment draft/prompt contract, then render chips in the
existing `EncounterView`. Verify the same draft/ref set through side, full, tab,
detach/re-dock and reconnect. A real provider turn must receive only the
explicitly sent resolved selections; a selected but unsent candidate must be
absent from the receipt and provider context.

### EC-05 — rendered Markdown/HTML inspection

Add a versioned frame bridge and renderer source-map/resolution contract.
Walk nested elements, text, links, same-document reload, rapid navigation and
script attempts to forge attach/send messages. Prove that the host rejects
wrong origin/source/frame generation and oversized payloads.

### EC-06 — PDF/media and cross-pane routing

Integrate only viewer capabilities that expose reliable page/text/geometry.
Prove explicit unavailable states otherwise. With two encounters and two
document panes open, keyboard and pointer selection must reach only the chosen
AgentSession draft and survive layout transitions.

### EC-07 — lifecycle/resource walk

Repeat selection, reload, full/restore, split, detach/re-dock and close cycles
on large real HTML/PDF/source material. Record subscriptions, frame listeners,
renderer resources and process memory. Hidden/unmounted frames release
inspection listeners; completed cycles settle within the separately established
foundation budget.

No slice passes from unit tests or screenshots alone. Acceptance requires the
running native app, real owner operations and receipts naming the refs,
revisions, session and disclosure result.

## Decisions the owner still needs to make

These are consequential presentation/contract choices absent from the recovered
ground. They need adoption before their dependent slice lands:

- the final shortcut for Attach context after collision checking against the
  native command map;
- whether an unsaved source buffer may receive a native draft-snapshot ref, or
  must always be saved before attachment;
- which product owns durable DOM/PDF sub-selection identity if Central declines
  to extend its source/material read contract;
- the trust and retention contract for non-Central live web observations;
- whether sending to multiple recipients creates one shared commission with one
  reviewed attachment set or separate recipient-scoped admissions/receipts.

Everything else above is implementable as presentation work or as the named
native-owner increments once these contracts exist.
