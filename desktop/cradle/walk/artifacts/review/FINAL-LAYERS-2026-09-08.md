# Desktop final layers — implementation and native review

Agent implementation/evidence, 2026-09-08. This records the scoped user-requested tranche, not adoption of new product ground.

## Implemented surfaces

- New tab creates a real blank tab in the selected group. It offers project-owned Flow writing, search, a terminal, and browsing. Async creation returns to its originating workspace. Flow creation failures retain the blank tab and expose Central's refusal.
- Flow writing uses Central's existing create/read/write Actions. New files land at `ProjectCentral/now/flows/<id>/flow.md`; source and Flow refs come from Central. Saves use the expected revision, retain newer in-flight edits, and keep unsaved recovery local. Creation performs no agent invocation.
- The terminal is xterm.js backed by portable-pty and a real login shell. Native commands are restricted to trusted local shell webviews. Output has backpressure, cursor acknowledgement and serialized screen recovery; moving a tab transfers the consumer lease rather than starting another shell.
- Editor tools are contextual and collapsible. Save, path and history sit in the pane footer. Focused pane footers yield and return on hover or keyboard access. Selected text has an explicit context entry point; context is appended to an existing conversation draft, never sent automatically.
- Browser downloads use WebKit's real download callbacks and collision-safe native Downloads paths. Temporary and Personal storage are explicit choices; Personal uses a persistent native website-data store.
- The left sidebar ground continues through the header and footer. Pane content and rendered material focus update the owning project. Right-side pane maximization uses the whole canvas and retains the previous arrangement.

## Native observations

Built the Tauri application against the current O:I suite and Central owner binaries, using the existing temporary Editor/Material/Other Central ground. These are observed desktop interactions, not mocked bridge responses.

- Restored existing source and rendered HTML tabs. Fixed the source editor's pre-load `buffer.path` dereference which otherwise blanked the app.
- Clicked the right group's plus button: an actual New tab appeared without opening the sidebar. Opened Terminal and executed `printf`, `pwd`, and `stty size` in Material's actual directory.
- Maximized the right group. The terminal expanded across the canvas; `stty size` changed from `46 35` to `46 110`.
- Interrupted `sleep` with Ctrl-C and successfully ran a subsequent command.
- Detached the terminal into a native window; previous output remained, new shell input returned `DETACHED_SHELL_OK`, and re-docking returned the same terminal body.
- Downloaded `/download` from the local HTTP acceptance server. Native status reported `/Users/admin/Downloads/browser-check.txt`; the saved bytes were exactly `Native browser download check`.
- Switched to Personal, set an expiring persistent test cookie, quit/relaunched the app and checked the page. The cookie remained `oi_browser_check=present`. The page's attempts to invoke `kernel_event_log` and `browser_reconcile` remained denied by native webview capabilities.
- Created a real Flow in Editor's NOW field. This exposed a kernel adapter error: an absent optional read revision was sent as JSON null and Central correctly treated that as a mismatched explicit revision. The adapter now omits the field; real-owner integration covers unversioned and revision-checked reads.

- After the adapter fix, restored that Flow, edited and saved through the native UI. Central returned revision `central.content-fnv1a64/v1:31:3809ca54dc6e57cf` and the ordinary file contained exactly `Native Flow acceptance verified`. Selected `Flow acceptance`; context review showed its exact 15 characters and Central source ref. No conversation was sent.
- Native review confirmed the active Flow tab stays in view, Editor becomes the selected sidebar project, and the sidebar ground continues to the bottom edge.

## Companion evidence

- `TERMINAL-2026-09-08.md`: real PTY tests and lifecycle boundaries.
- `EDITOR-SUITE-2026-09-08.md`: 33/33 editor and 26/26 material checks, plus researched Git owner contract.
- `EDITOR-CONTEXT-PLAN-2026-09-08.md`: larger context/editor design seam.

## Context draft verification

The focused context draft walk passes 7/7 against a real AIKit resident owner: explicit destination, exact quote, preserved existing draft, provenance/revision, no transcript/provider invocation, visible stale-selection refusal, and unchanged draft after refusal. Receipt: `walk/artifacts/context-draft.json`.

The test uses explicit matching AIKit binaries from the gated revision because the ambient AIKit executable was replaced during this session while its session-space owner was still older (schema 7 versus 6). A test-only command router forwards to those real owners; it does not synthesize responses. Promotion must keep the suite and its owner binaries matched.

## Explicit capability boundaries

Terminal processes live for this app session; app restart is not process restoration. Browser downloads expose requested/completed/failed states; WebKit's exposed callback does not provide byte progress or a cancellation handle. Git actions require a Central owner increment; the editor does not fabricate branch/staging state. Current context insertion is a provenance-bearing quoted excerpt in the real shared draft, not a new semantic attachment protocol or arbitrary web-element picker. The default installed suite's stale Central CLI still needs promotion/recomposition for the current binary material-read contract; this native review uses the current owner binary explicitly.
