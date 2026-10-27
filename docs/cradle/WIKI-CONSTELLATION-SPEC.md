# Wiki and constellation practice — Cradle implementation specification

**Standing:** owner-directed design specification, 20 September 2026; implementation and installed-app evidence are separate. **Read first:** [product decisions WC01–WC15](../positions/WIKI-CONSTELLATION-PRACTICE.md), [stories](../experience/STORIES.md), implementation Wayfinder (retired 27 Oct into the DLW map, O-I #706; read it at `8873b0968`).

This specifies the joined Wiki/Technè practice. It extends `02-ARCHITECTURE.md` (with workspace continuity, §6.1–§6.8), O:I #366/#335/#375 and the existing `ql.techne/v1` / `oi.expression/v1` seams. Exact native symbols and available schema versions are reconciled from the incoming mains; the behaviour and ownership decisions below are already explicit. Missing owner functionality is implementation work, not permission to omit the experience.

## 1. Product contract and native ownership

The ordinary Wiki is a complete linked-document working environment without QL. Editable constellations add contextual organisation. Technè makes and operates those organisations in the existing 3D Expression medium. Returned constellations, QL relations, Expressions and artifacts become discoverable in the same native knowledge field.

| Matter | Owner and implementation consequence |
|---|---|
| Source bytes, native identity/revisions, personal and Project ground | Central or the source's actual native owner. Central remains the root meta-Project, not just configuration. Use source-native edits and locators. |
| SourcePool, SemanticWiki/ProjectMap, link resolution, navigation, indexed relation discovery | AIKit and its existing providers. Extend the native knowledge contracts; do not implement a competing parser/resolver/index in each renderer. |
| QL forms, role/structural operations, warranted readings and interpretive provenance | QL-MEF. Form validity, result class/evidence and human acceptance remain distinct. |
| Recorded Wiki constellation membership and authored graph relations | The current native Wiki/constellation owner, resolved through AIKit's existing contract. QL supplies formal meaning/bindings, not a new renderer-owned semantic database. If persistence is missing, implement it at that owner. |
| Expression, Profile, Scene, Edition, portals and authored presentation | O:I's existing Expression owner and revisioned save path. No shadow Scene or Palace store. |
| Agent identity, situated Agency, authority, Activity and Return | Actuation, with AIKit supplying actual context, skills and harness/session composition. QL supplies the relevant Technè role/profile; it does not create another runtime. |
| Kernel resource retention, request composition and typed change delivery | Existing O:I application/kernel loading state, extended with revision-aware knowledge resources where necessary. Derived retained readings are not owner truth. |
| Workspace placement, filters, camera, selection presentation and restoration | Existing Cradle workspace/Surface machinery. Semantic focus remains bound to native subject references. |

The Wiki and constellation layers are not the 3:3/4:2 modes. Both modes can disclose both layers. The three engineering responsibilities are native work, retained kernel resources and presentation; live-view retention, model continuity and durable recovery are cooperating lifecycle mechanisms, not three rival stores.

## 2. Markdown and source relationship contract

### 2.1 Required ordinary document experience

Render headings, paragraphs, lists, quotations, tables, fenced code, emphasis, images and links using the shared format-aware reader/editor. Source editing and preview share one revision-aware working model. Preserve authored bytes and supported frontmatter on read/import; do not normalise a corpus into QL or rewrite every file to install identifiers.

Support ordinary relative Markdown links, wikilinks and aliases, heading targets, and the supported block-reference/embed forms of the selected native dialect. The first implementation must inventory dialect support explicitly and implement the agreed forms end to end, not silently strip unsupported syntax. Unresolved and ambiguous targets remain visible and actionable. External URLs and media follow the existing safe material/portal policy; imported raw HTML is not ambient executable app or native-Action authority.

### 2.2 One parser/resolver authority, several consumers

Reader navigation, graph edges, backlinks, search results, rename handling and agent lookup consume the same owner-resolved occurrence. Carry the source owner/ref and revision, occurrence or selector, original target text, resolved target ref where available, relationship kind, and resolution standing. An occurrence identifies a particular source link; multiple occurrences may share endpoints without being the same occurrence.

Relative paths resolve against the source's native location and permitted scope, not the currently focused pane. Aliases do not silently coalesce distinct documents. Heading/block resolution uses the source dialect and exact revision. On ambiguity, show candidate identities with locations; do not pick one based on a coincidentally matching title.

Backlinks are the inverse reading of recorded source occurrences, not an independently authored second set of assertions. Tag membership is distinct from a document-to-document assertion; two shared tags do not create a clique of semantic edges. Suggested unlinked mentions remain suggestions until an author deliberately creates a link. Existing semantic relationship meanings remain intact beside these source-derived relationships.

### 2.3 Source edits, rename and external change

On supported edit/save, update link occurrences, backlinks, headings, tags and affected graph readings incrementally from the actual owner receipt/revision. Renaming a file preserves native identity where the owner supports it. Offer any necessary incoming-link rewrites as explicit source edits, using preview and native revision checks; an index update is not permission to rewrite every backlink source.

Agent/external writes, moves, deletion, watcher overflow and reconnect must converge through the same invalidation/reconciliation path. Missing selectors after an edit are stale or unresolved, never silently rebound to an unrelated paragraph. Dirty local text survives revalidation and conflict. Exact selections use native selector/span plus source revision; raw DOM nodes are not durable context.

## 3. Wiki UI and navigation decisions

These are initial interaction defaults to implement and verify, not historical descriptions of the app.

**Reader:** proper Markdown body; source identity and reading/edit state; summonable heading outline; internal/external link distinction; inline preview; backlink excerpts and typed incoming/outgoing relations; source/verso access. Read, source-edit and format-aware preview use the existing editor suite, not a Wiki-only fork. Text selection offers Add to Context and Add to constellation through a compact contextual toolbelt.

**Search:** keep the one existing search/command entry. Deliver title/alias and warm native results promptly, then supplementary provider results as available. Show per-provider pending/unavailable state. Keep selection/focus stable when late results arrive. Abort or ignore obsolete requests, retain input-method handling, and avoid a fixed debounce on cheap local filtering. Heavy provider queries may use measured debounce/coalescing. Preserve native query/ranking semantics and disclose provider provenance rather than inventing a rival parser in React.

**Graph:** keep small nodes and thin lines as the quiet default. Labels emerge with semantic zoom, focus and selection; rich particle treatment belongs to the chosen expressive presentation, not mandatory background work. Global/scope and selected-subject local views support explicit recentre, fit-to-selection, Back/Forward and return to the reader's exact anchor. A selected-subject view initially shows one hop; saved views restore their deliberate depth rather than resetting it.

**Filter controls:** compact icon entry; scope, subject kind, relation family/type, direction, depth, tags/properties, text query, unresolved and isolated items; optional saved emphasis groups; label/arrow/density controls. Applied filters remain visible as removable chips. Clear filters preserves camera/selection; Fit changes camera only. Saved groups affect appearance, not native membership or QL classification. Empty successful results, incomplete readings and failed providers have different messages.

**Preview and traversal:** hover/focus preview where suitable, with keyboard invocation and dismissal. Single selection identifies the object; deliberate open follows its source. Keyboard movement, multi-selection, context menu and accessible list alternatives address the same references. Restore reading position, graph camera, selected relation/member, expansion and filters across Back, mode changes and restart using existing continuity.

**Agent context:** selected/available material is not automatically loaded context. The existing Context area holds compact exact-reference selections and the actual disclosed basis. No new participant modal. A selected source, edge occurrence or constellation role can be addressed directly to the existing companion.

## 4. Graph reading and filter semantics

Carry root/scope, exact subject and relation refs, membership/role bindings, source revisions, shape bindings, permitted actions, pagination/completeness and provider standing through the existing read contracts. Full source bodies are acquired on selection, preview or bounded work demand, not eagerly for every node.

Maintain distinguishable relationship families: source occurrences; tag/property membership where represented; native semantic relations; constellation whole/member/role relationships; deliberately authored QL relations; presentation-only connections. Exact type names follow the native owners. A filter may combine families but cannot erase their provenance.

Compute admitted audience/scope before matching, context expansion, counts and cache delivery. No hidden private member, label, aggregate count or cached relation may leak through a contextual formation. Absence of inaccessible material must not imply that the accessible reading is globally complete.

Separate **matches**, **structural context** and **presentation**. Default constellation filtering retains the permitted structural basis with nonmatches subdued. Strict matches-only hides nonmatches but labels the formation as partial. Neither operation changes membership or creates a smaller QL form. Match, context and displayed counts are distinguishable. An isolated node with hidden neighbours is not labelled as inherently unrelated.

Layout separates atomic structure from composite arrangement. Native form bindings govern canonical member roles/positions where selected; composite packing can move whole formations without deforming their internal structure. Authored placement overrides are revisioned presentation. Expansion/collapse and legitimate compact 0/1 forms retain the disclosed whole/derivation. Budgets use explicit expansion/pagination/shape-aware compression, never an unexplained first-ten truncation. Cyclic references must not cause infinite expansion.

## 5. Editable constellation contract

A working constellation binds its own identity/revision, question or purpose, selected source/native members, contextual roles, chosen frame/form, authored relationships and supporting references. Use the existing native constellation and QL extension/binding records; do not freeze an invented universal schema here.

Both material-first and frame-first creation are required. Empty positions may be visibly unfilled questions or deliberate newly authored source objects; the UI must not fabricate source members to complete a shape. Source material can participate in several constellations with different contextual roles. A role assignment is not a permanent classification of the underlying document.

Support create, select/multiselect, add/remove member, assign/reassign role, connect/reconnect/type relation, annotate, choose/change frame, inspect basis, compare an alternative, save and resume. Whole/member relations and explicitly authored pairwise relations remain distinct. QL structural validation reports whether the selected form/binding is valid; provenance/evidence reports support for the interpretation. A provisional interpretation can be edited and saved with its honest standing.

Reusable constellations are referenced by identity. Composition distinguishes a live reference, an explicit revision-bound reference and a deliberate variant using existing revision vocabulary. Presentation-only changes in one Expression do not mutate all users of the same constellation. A source constellation revision exposes affected consumers; it does not silently overwrite their authored layouts. Delete-member, retract-relation, hide-overlay, delete-presentation and delete-source are distinct commands with distinct effects.

### 5.1 Direct manipulation and its effect

Selecting or moving an object is immediate, reversible work. Drawing a connection can create a presentation connection or, through an explicit relation tool/type, request a semantic relationship. The toolbelt shows the intended effect and standing without interrupting each gesture with a policy form. Form choice and geometrical proximity alone never assert a source relationship.

Authorised semantic authoring uses the real native Action and revision check. Saving presentation uses the existing Expression save/CAS. Editing a source uses its native editor/save path. A draft preview is visually distinct from a saved native result; receipt/readback confirms the latter. Do not describe this boundary as a read-only Technè restriction.

## 6. Technè and Expression embodiment

Use the existing Global Expression Stage and accepted renderer/component intake. Technè is its deep operating mode; instruments are lenses and tool sets over the same selected field, not six separately mounted apps or a second graph engine.

Bound members support selectable glyphs, text, images and supported particle/entity forms in three dimensions. Bound relations support thin lines and particle/material treatments. The existing writing overlay, media, Studio/toolbelt, Scene transport, composition controls and native portals remain available. Agent operations use public structured operations, not renderer scraping or detached hand-authored scene JSON.

Canonical formation, authored arrangement and physical state are different. Hold the structural scaffold through anchors/constraints while allowing declared material dynamics. An authored spatial deviation remains possible and explicit. Physical movement does not rewrite membership. A Scene saves authored/configuration state under the current engine law; exact GPU rewind is not presumed.

M0′ gathers and traverses the corpus and initiates a working whole. M1′ foregrounds construction. M2′ operates relation/becoming views including chronology. M3′ composes actual Expression Scene refs into a Journey. M4′ situates relevant places/occasions. M5′ composes native constellations, Expressions, Scenes and media into Palace/integral articulation and Return. These are non-compulsory, coordinate-preserving cross-opens; an unavailable facet does not substitute another subject.

## 7. Shared agent staging and operation contract

The staging space is the current inquiry/working constellation, persisted through the existing native draft/work and Expression mechanisms. It references corpus sources; it does not duplicate the corpus or establish a hidden chat-only ontology. It should expose question, scope, frame, selected members/passages, tentative roles/relations, alternative constructions, source basis, actual disclosed context, current agent act and resulting artifacts.

Use existing `TechneReading`, `DisclosureSession`, Workspace selection, `oi.expression/v1`, native Knowledge Actions and actual Agency/session bindings. The same member/relation/role selected by a person is addressable by the agent. A direct human edit advances the working revision; stale agent proposals must be rebased, rejected or retained as an alternative rather than overwriting that edit.

Required structured operation meanings are: resolve an ordinary linked source/local whole; gather exact passages; open/create a working constellation; select frame and assign roles; propose or author relationships under authority; compose supported glyph/media/particle/Scene presentation; inspect and explain basis; checkpoint/hold/continue; save composition; commit intended native knowledge differences; return and reopen outputs. Bind these meanings to actual existing Action IDs at the execution cut. No new API prefix is mandated by this list.

Agents may perform substantial reversible composition within granted scope. Native source mutation and publication retain their own review requirements. Switching lenses does not mint an AgentSession, grant additional authority, cancel a running task or automatically load the entire corpus. Existing Epii/Aletheia-Technè roles remain distinct from Guardians and Anima.

## 8. Return, discovery and cumulative knowledge

Persist constellations and attributable QL relations through their native Wiki/QL-bound operations, Expression/Scene/Palace composition through O:I's existing persistence, and generated artifacts through their actual source/artifact owner. Index those returned identities through the existing Wiki/SourcePool/Library route. The Library references real subjects and collections; there is no hand-maintained parallel catalogue.

A returned relation retains endpoints or whole/member roles, relation meaning, constellation/frame context, actor/act, source revisions, support and standing. Preserve n-ary organisations; do not flatten every whole into pairwise links. Source links remain source links. A QL interpretation does not rewrite the linked Markdown occurrence unless the person separately edits that source.

Saved/generated outputs retain derivation. Repeated generation from the same evidence does not accumulate independent evidential weight. Work may be reusable, disputed, revised or retracted without deleting its historical basis. Loop re-entry must remain bounded and identifiable so an artifact cannot recursively ingest itself as fresh independent evidence.

Multi-owner Return is not a distributed transaction. Show each save/result and its native receipt, partial success, retry/idempotency or unavailable compensation. Do not report the whole Return saved because the Expression save succeeded while the relation write failed. Preserve working state and allow completion without duplicate artifacts or relations.

Source changes mark affected interpretation and presentation bindings for currentness review. Unchanged members retain identities. Preserve an explicitly pinned historical reading; offer deliberate rebase/recomposition for changed live work. Publication is separately authorised through the existing audience-filtered SharedField/WorldPresentation boundary. Local usefulness does not require hosted availability.

## 9. Kernel loading/resource state and performance

Use the existing kernel/application resource layer above disposable views. It legitimately retains source/read models, adjacency/index projections, in-flight work, revision/currentness information and subscriptions. Native authority remains with owners; deleting the cache must not delete authored work. Native buffers which already exist remain the one editable model.

Key resources by native World/owner/reference, operation/projection/query, source or version-vector basis and access/provider epoch. Path or workspace alone is not sufficient. Independent providers can publish separate useful partial readings; the UI must label partial/completeness and never manufacture one coherent global revision. An operation requiring a coherent bound whole resolves and records that basis before save.

Deduplicate equivalent reads and use bounded concurrency. Cancellation releases a consumer's interest, not another consumer's required read. Prioritise visible page/selection, then requested expansion, then background refresh. A slow/offline SharedField provider must not delay permitted local Wiki reading. Preserve causal writes and owner locking; parallelism is introduced at independent read boundaries, not by removing write ordering.

Warm Back/mode-return reuses unchanged resources and view state. Restart restores useful persisted models/checkpoints before unrelated tree enumeration, then revalidates under current access. Cache authority is not current permission. Revocation, deletion, owner epoch changes and stale selectors are handled explicitly. Valid cached content may remain visible with refreshing/error state where policy permits; failure is not empty success.

Reuse existing canvas culling, worker layout and Stage ownership where present. Retain useful positions while updates arrive; filter appearance changes do not rerun structural layout. Recompute affected formations/packing rather than restarting everything. Bound hit-testing, labels, accessible row DOM, subscriptions and hidden work. Offscreen rich views suspend/release using the real lifecycle, while independent native agent tasks can continue.

### 9.1 Proposed engineering budgets

These are targets to measure, not claims about the installed app or Obsidian. Record hardware/OS/build, corpus/index size, visible set, cold/warm basis and sample distribution. If a target is missed, retain the measurement and fix or explicitly amend it; do not relabel the target as achieved.

| Interaction | Initial target |
|---|---|
| Warm page return | First usable body within 100 ms at p95. |
| Indexed title/alias result or lightweight local filter | First useful result within 150 ms at p95. |
| Warm bounded graph | Correct initial formation within 200 ms at p95. |
| Pan/zoom/selection | Target 60 Hz for the recorded visible working set; investigate recurring interaction-blocking main-thread tasks. |
| Mode return | No unnecessary body reread, full-tree wait or reconstruction of unchanged formations. |

Use an authorised representative corpus plus generated 1k/10k/larger index cases and explicit bounded visible sets. Test cold startup separately. Inject a slow local directory, slow/failing supplementary provider and external revision change. Count owner acquisitions, worker jobs, frame latency and retained memory; operation count and measurement must support the perceived result.

## 10. Verification and implementation standing

The Wayfinder (retired 27 Oct into the DLW map, O-I #706; read it at `8873b0968`) assigns the work and WCT01–WCT18 checks; the [stories](../experience/STORIES.md) keep the whole human/agent activities visible. Existing #65, native matrices, CAW and QL UX obligations remain. Disconnect a real producer/handler and require the relevant integration test to fail.

The first joined acceptance specimen is an ordinary linked Markdown corpus → precise passage selection → QL-framed editable constellation with agent collaboration → full Expression presentation → Scene/Palace composition → native relation/artifact Return → Wiki rediscovery → mode/restart recovery → source-change reconciliation. Include a second constellation using one of the same sources and an ordinary no-QL path. No serial ten-subject demo or fixture-only renderer path satisfies this contract.

### Development verification of the Wiki entrance

The read-only `Wiki constellation integration` workflow pins the actual AIKit Wiki/construction owner and Central first-save owner. It builds each native binary, records Cargo's real executable artifact paths and uses a temporary Central/Notes world. Binary-helper unit tests write their own isolated receipts, never the real build receipt.

Focused local checks are:

```sh
cd desktop/cradle
npx tsc --noEmit
node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/wiki-*.test.mjs
node tests/knowledge-expression.mjs
```

The supplementary `tests/wiki-recovery-browser.mjs` exercises the production drawer in an in-memory browser document with explicitly controlled host responses and checkpoint storage. It covers owner refusal, a lost response, exact retries, checkpoint failure, restart input, current-attachment verification and stale artifact refusal. It is component evidence, not native storage or Stage proof.

The shared successor includes the kernel first-save regression at `kernel/tests/wiki_expression_save.rs`. Run the existing complete kernel suite against the integrated patch; the local component results below do not replace native execution. The configured Project must not appear in the creation input.

The complete browser test is `tests/wiki-constructive-browser.mjs`. It requires the real `OI_BIN`, `OI_AIKIT_BIN`, `OI_CENTRAL_CTRL_BIN` and `WIKI_KERNEL_BIN` executables. It does not mock the kernel transport. The intended walk is selected Markdown passages → native constellation and relation → real Stage/composer → native artifact → Return → separate kernel restart and reopen, followed by frame-first construction and stale-source refusal.

Keep the performed test result, source revision and native revisions with every claim. A committed test is not a passed test. Controlled native/browser evidence does not assert installation on the owner's machine, live agent-provider performance, hosted privacy acceptance or human-use completion.

## 11. Adaptive Wiki–user–agent interaction (AP01–AP08)

A correction must change what the next act receives, not merely become another note. The experience is the GV row for **Use this correction** in [STORIES](../experience/STORIES.md) and manual §19.4; the cases are WCT19–WCT25 in [CASES](../experience/CASES.md).

### AP01 — Keep authority and knowledge organisation orthogonal

There are two knowledge layers: ordinary source relations, and deliberately authored QL constellations over them. Separately, there are human governance, agent-maintained operational interpretation, and session evidence. These are roles and provenance within one connected corpus, not three stores or three Wikis.

Ordinary Markdown links, exact passage selectors, backlinks and tags are the usable basis. AIKit's bkmr source pool and ripgrep search are native source/retrieval providers, not rival semantic universes. Preserve provider identity, query/selector, source revision, access and provenance. A search hit is not a permanent relation; reading a bookmark does not promote its instructions into governance. Constellation membership may organise governance, corrections, examples and interpretations creatively without changing their authority. Saving an attributed QL relation is different from drawing a nearby glyph.

### AP02 — Governance, interpretation and feedback have different effects

Human-authored governance retains its existing Central authority and reviewed mutation path. The agent's operational projection lives as ordinary agent-maintained Wiki source and can change through a tool inside its granted scope. Generated harness files remain rebuildable products of composition, never the editable master.

A correction retains its exact evidence reference, attributed actor, source/basis revision, intended scope, reason and replacement interpretation. Agent inference remains distinguishable from an explicit human correction. A string naming a user or an evidence URI is attribution, not authenticated authority. Publication, credentials, permission changes and source recognition are never inferred from that string.

The effective reading combines eligible governance, selected operational interpretation, relevant project/skill knowledge and the current task. It does not indiscriminately concatenate all of them. It exposes conflicts and omitted material rather than silently choosing whichever paragraph happens to appear last. An immediate correction can change the intended application of a rule without rewriting the rule's durable source.

### AP03 — Express purpose, scope and useful exceptions

A behavioural rule should explain the value it protects, when it applies, useful counterexamples and the expected alternative. This need not become a compulsory data-entry schema: clear Markdown is sufficient; typed links can enrich it.

For example, “verify before claiming completion” means preserve the distinction between implementation, executed evidence and acceptance. It does not mean stop useful implementation because installed hardware is unavailable. A useful correction is: “Complete and test the remote work that is possible; report the remaining hardware boundary separately.” Another example is “be concise”: give the direct answer first, but do not omit the derivation when the task explicitly requires it.

This is contextual interpretation, not an automatic negation of every constraint. Privacy boundaries, denied source access, actual authority and security checks do not acquire a counter-law merely because an agent finds them inconvenient. A changed human preference is not permission to bypass an unrelated native gate.

### AP04 — Preserve the user and the actual Central/workcell relation

The user is a durable subject linked to the containing Central root; the guardian field is a maintained collaboration around that subject, not a freshly minted identity on every prompt. Product guardian Agencies remain their actual Actuation-owned collaborators. A guardian's interpretation is not the user and cannot confer recognition on itself.

Distinguish the person's default/main Central world, the current workcell's Central materialisation, a child ProjectCentral, and the Central product's source repository. Central remains the root meta-project even when no child project is active. Workcell placement does not redefine user identity; ProjectCentral repeats the source/Wiki relation at narrower scope. “Current Central” must resolve from the actual bound workcell/root, never from a guessed home path or silent fallback to the primary machine.

Portable preferences may be explicitly inherited from the primary world. Local observations, host paths, credentials and machine-specific corrections stay with the actual materialisation unless deliberately transferred. Two sibling projects or two workcells with similar directory names must not share a correction accidentally. The UI should show a human-readable scope label with exact identity available on inspection, not demand that the person enter raw world IDs.

### AP05 — Close both the write path and the delivery path

The supported product–harness composition supplies a small bootstrap map: current user/guardian/root/project context, Wiki route, relevant skill/document procedure, selected projection sources and the native correction tool. Do not dump the full Wiki into AGENTS.md. Do not make the agent rediscover an undisclosed tool or repair its own strap every session.

A real correction performs: resolve exact source → read current basis → apply scoped revision-checked change → retain evidence → invalidate the affected current reading → compose the next act → deliver through a supported harness event → record actual acknowledgement/use where available. Compaction, restart, resume and context switching must return to this same relation. A generation existing on disk is not a running agent's loaded context.

AIKit #366 supplies an initial native slice: `aikit wiki projection read/update`, selected `hook/continuity/wiki-projection` reread at SessionStart/UserPromptSubmit, and actual Claude-compatible hook context output. It does not silently enable the capability, authenticate a submitted actor, create a full expiry policy, or pretend every harness accepts Claude's protocol. Unsupported live delivery remains explicit; a fresh supported session or the correct native adapter is the route, not an invented acknowledgement.

Document skills must use this same context route before writing: recover the relevant project vision, exact source and current correction, then author the requested document. A correction to one report should not automatically rewrite every writing skill. Per-skill overlays and the project/user interpretation cooperate through existing composition, with ownership and precedence inspectable.

### AP06 — Make the feedback loop visible without turning it into administration

Use the existing chat/selection and Run / Agents / Context surfaces. An inline correction control offers the inferred narrow scope and editable text, with a deliberate broader-scope choice. No participant modal, compulsory QL form or separate memory dashboard is required. User-initiated source editing remains ordinary Wiki editing.

Context presents **effective guidance** as source-bound items: scope, current revision, reason for inclusion and delivery state. Inspect reveals governance basis, correction evidence, omitted/conflicting sources and the exact act receipt. Run records the delivery/act boundary; Agents exposes the actual guardian and selected capabilities. “Saved”, “Selected”, “Emitted”, “Acknowledged” and “Observed in use” are different claims. Do not label a model self-report alone as reliable proof of behavioural change.

The Wiki offers a linked view of governance, current interpretations and feedback. QL constellation work can compare purposes, exceptions, recurring failures and alternatives over those same subjects. It is an optional richer working medium, not a required taxonomy before a plain-language correction takes effect. The next human or agent edit advances the actual shared revision; a stale proposal cannot overwrite it.

### AP07 — Review governance from evidence, not self-reinforcing summaries

The review view groups relevant corrections with the exact governance clauses and scoped outcomes. Retain contradictory examples, superseded interpretations and their dates. Multiple generated summaries of one event are one source lineage, not independent corroboration. A narrowly successful exception need not become a global preference.

The human can accept a proposed governance diff through the existing source-return mechanism. Until then, it remains a proposal; authorised operational guidance can still function. When governance changes, mark dependent interpretations for re-evaluation and show what would change, rather than stacking contradictory old and new laws indefinitely. Undo, suspension, expiry and deletion invalidate future delivery without rewriting historical act receipts. Session-only material expires with its actual scope and must not leak into global projection.

### AP08 — Prove changed use, privacy and recovery

The minimum joined walk starts with a real strapped agent applying an overly literal project instruction. The person corrects it once; the tool changes the exact selected Wiki source; the next prompt receives its new revision; an independent reviewer observes the requested behavioural difference. Restart and compaction preserve the durable correction. A different project and workcell do not inherit it accidentally. An explicit session exception does not survive its scope.

Repeat with a deliberately disconnected context consumer: source save may pass, but the joined case must fail. Include simultaneous edits, stale basis, denied or removed source, whole-fragment budget exclusion, unsupported harness event, clear/suspend, conflicting guidance and QL absent. Removing or denying a source must not resurrect its cached interpretation. Byte/readback, emitted protocol, actual harness receipt and human experience each retain their evidence grade.

**Delivery boundary:** this source extension defines the complete interaction. AIKit #366 is a bounded native implementation, not a claim that the existing desktop has all controls, that every document skill is strapped, or that installed/live-model acceptance is complete. The receiving Wiki/agent-shell owners must join those consumers and record the actual integrated source/build/install/run cut.

## 12. Save, Return and recovery

**Interrupted save or Return:** the original file-save operation and the subsequent Return are retained separately. A refused first save names the owner's reason and does not offer Return as if a file exists. An acknowledged write whose readback failed asks the person to inspect its destination, not to create another artifact. Once the file is verified, an interrupted Return exposes **Retry exact Return**. That control keeps the original operation identity and validates the recorded file revision without opening or replacing another live composition. Failed checkpoint storage prevents dispatch. Inspection of an existing native Return is read-only and verifies that the exact attachment still exists; a historical receipt or idempotent reply cannot conceal a later replacement. This is the concrete partial-success behaviour required by WC09/WC10/WC14, not a new approval ceremony.

**Save constellation** sends a revision-bound native action. The register and each cited source must still match their recorded basis. An acknowledged native save and indexed availability are separate facts: the UI states whether Wiki/search readback actually found the saved result. A transport receipt alone is not reported as indexed knowledge.

An Expression working document is not yet a native file. Under **Save and Return composition**, choose an existing destination directory and a filename. First save uses Central's explicit no-overwrite creation operation; a later save uses the expected revision of the previously saved file.

The native save response carries a file receipt. It is not required to repeat the entire Expression document. The consumer independently reads the saved file and compares its complete document with the intended working revision. Matching only the Expression reference and revision number is insufficient when the body differs.

After the file is verified, **Return saved Expression to constellation** records its exact native artifact location and source revision in the construction. File save and Return are intentionally separate: an unavailable Wiki operation must not erase or repeat a successful artifact save. The original sources, contextual memberships and whole remain distinct. The returned artifact is derived work, not independent corroboration of the sources which produced it.

Returned work reopens through its actual native file after a kernel restart. A reference is not treated as proof that an in-memory working document still exists. If the artifact has changed since the recorded Return, inspect the current file before replacing the recorded composition.

### Recover a changed or interrupted operation

Unsaved construction input stays with the Wiki surface. Before a native constellation save, the exact pending request and operation identity are persisted. After an uncertain result, **Inspect saved state** checks the native register. If that operation is recorded, the saved result is recovered without creating another constellation. If another edit advanced the basis, the proposal is retained for explicit reconciliation. It is never automatically applied to the new revision.

Before an artifact save, the exact intended Expression document, destination and first-save operation identity are retained. **Inspect pending Expression file** performs a read, not a replay. A completely matching file recovers the successful save. A different file remains a conflict; the consumer never overwrites it merely because the reference or filename looks familiar.

**Restore retained composition** uses the native Expression validator to restore the exact pending working document after a restart. **Retry exact file save** reuses the retained operation only while its intended content still matches. A changed live composition is not submitted under the old creation identity. A failed checkpoint write is surfaced before starting a new native operation; clearing or repairing browser storage is not silently treated as successful recovery.

#### Exact save and Return recovery

The file address is the selected native Central directory, not the currently focused Project. The Expression first-save adapter explicitly suppresses automatic Project-operand injection for `central.files.create`. Central keeps rejecting unknown creation fields; its protected-ground, source, symlink and no-overwrite checks remain unchanged.

A refusal now names the native owner's diagnostic. A write acknowledged before readback failed is described as an acknowledged write, not as an unsaved artifact. Successful Return requires the file location and revision in the save receipt to agree with an independent read of the exact destination. The diagnostic never dumps the source document into an alert.

Before **Return saved Expression to constellation**, the drawer retains the exact native Return request and artifact pointer in its existing checkpoint. Failure to retain that checkpoint prevents dispatch. A lost response leaves the artifact saved and makes **Retry exact Return** available. The retry reuses the original operation identity; it does not generate another Expression or re-save its file.

After restart, the retry reads the exact recorded file and checks its source revision and Expression identity. It does not open or replace an unrelated live composition. A changed, redirected or malformed file refuses before the Return action. **Inspect saved state** distinguishes an absent Return from a recorded one. For a recorded Return, both the native operation's actor/basis and the intended current attachment must match; an old historical receipt alone cannot establish that a later-replaced attachment is still current. The same check is applied to an idempotent retry response before the drawer reports completion. Inspection remains read-only.

### Graph filters and the root mapping

The small-node graph can display the available field or a selected subject's neighbourhood. Depth and direction change traversal. Kind, tag, relation and relationship-layer controls change the displayed reading. With structural context retained, a matching constellation member keeps its disclosed surrounding formation; matches-only views remain explicitly partial. Neither operation changes membership. Saved filter views are presentation preferences, not authored constellations.

A directly opened Wiki establishes Central's root mapping before asking for a child Project's register. This is a navigation prerequisite, not a requirement for a person to visit a separate dashboard first. Central remains the root meta-project. A child absent from the native root disclosure is refused rather than guessed from a path or silently replaced by another Project.

### Constructive selection is not disclosure

Select a passage in the reader and choose **Add to constellation**. The drawer holds its source identity, exact source revision, native UTF-8 span and rendered quotation. Two different passages in one source are separate contextual participations; the underlying document is still one source. **Add to Context** is a separate operation. Constructive selection does not automatically disclose the passage to an agent.

Name the inquiry, write its question and choose an available Wiki space. Keep **Open arrangement** for ordinary constructive work, or choose an authoring form returned by the native owner. QL roles may remain open. Choosing a form states an interpretive framing, not a claim that the original writing has been conclusively classified.

For frame-first work, open **Constellations**, start a new inquiry and save its chosen frame before adding passages. Open positions do not become fabricated source members. Add material later through the same reader selection operation.

Assign roles and add named connections between contextual participants. A connection has direction and standing: proposed, asserted, contested or uncertain. These are deliberate authored relations, not deductions from spatial proximity. Removing a member retracts its connections as part of the proposal; reconnecting a retained relationship addresses the original native edge. The source itself is not deleted.
