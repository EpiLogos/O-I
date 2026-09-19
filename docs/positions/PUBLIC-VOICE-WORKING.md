# {O:I} Public Voice — Working Editorial Draft

**Status: editorial working file. Agent-drafted for owner revision — not adopted copy.**

- **What this file is.** One editable place holding everything for this round of public-voice work: the owner passages recovered verbatim, a proposed public narrative, compact copy variants, the few wording questions that genuinely need an owner decision, and the map for propagating adopted wording to site, docs and Expression surfaces.
- **What this file is not.** It is not a founding position, not a replacement for `docs/positions/FOUNDING-POSITIONS.md`, and not a rewrite of any owner-authored file. The designated public-copy source remains `site/content/public-site.md`; it has not been touched and should not be changed until wording here is adopted.
- **Base revision.** All sources read from `origin/main @ 21bd04d7` (EpiLogos/O-I). Line numbers refer to that revision.
- **Drafted by.** Agent session, 2026-09-17, on the owner's commission to recover the complete public proposition. Every word in proposed sections is yours to change; nothing here acquires standing until you adopt it.

## How to read the tags

Every passage carries exactly one provenance tag. These distinctions are load-bearing in this programme and are kept visible throughout:

| Tag | Meaning |
| --- | --- |
| **[QUOTE]** | The owner's words, verbatim, with file and line. Edit only by later authorial revision of the source. |
| **[PARAPHRASE]** | The owner's framing carried into other words; attribution kept. |
| **[PROPOSED]** | Agent-drafted public copy, offered for your revision. Not yours yet. |
| **[INTENT]** | Design intention — what the work is meant to make possible. Not a claim that it works today. |
| **[PROPOSITION]** | A research proposition — meaningful because it can be tested, compared, contradicted. |
| **[TODAY]** | Demonstrated capability, qualified by the evidence standing recorded in the sources. |

Proposed copy follows the site's established register: `{O:I}` with braces in body text, second person for the reader, first-person plural for the programme — the same voice you already published in `site/content/public-site.md`.

---

## Part I — Where the public voice stands

**The designated owner-maintained public-copy source exists.** `site/content/public-site.md` opens:

> **[QUOTE]** "Human-editable source for the public site. The React application owns layout, figures, navigation behaviour and rendering. This Markdown owns the public words and their page/section order. Edit this file first when changing site copy." — site/content/public-site.md @ origin/main L3

Pipeline: the Markdown compiles through `site/src/lib/public-content.ts` into validated page outlines, guarded by `site/public-content.test.mjs` in CI, and deploys to GitHub Pages via `.github/workflows/site.yml` on push to `main` touching `site/**` or `shared-field/**`. Pages authored there: **Home, O:I, Products, Shared Field, Research, Build**. Explore is a separate application, intentionally not authored in that file (L5).

**You have already iterated on this voice.** The copy history on main shows the movement of recent months: `b0d7b046` "add editable public content source", `9b6422d6` "rewrite public copy around direct product meaning", `dfb79bdb` "project collective SDK research position into public pages", `903ce3f1` "restore the world-making proposition on the front door", `4bcf34fc` "carry human authorship into the public field". This draft continues that line; it does not restart it.

**A second copy store exists and must be kept in sync.** The v2 site shell keeps its own copy in TypeScript at `site/src/shell/content.ts` (per `site/HANDOFF-UI-ENRICHMENT-2026-09-12.md`: "ALL copy and page/section structure (`PAGES`, `PRODUCTS`)"). Two stores of the same prose currently coexist — see open question Q3.

**The old site branch is merged, not abandoned.** `site/redesign-v2` landed through #275 (`a10f350b`). Its useful residue is wording and design, not its code: the point-cloud hero video behind the transparent O:I mark, bone-white palette, un-boxed editorial sections, and lines like "Enter the field." and "This landing stays the front door." (both recovered in Part II). Its stale code is source only.

**What the published voice already covers.** The complete commissioned proposition is mostly present in `public-site.md`: the research project, existing heterogeneous worlds, human-authored ground, selective context and capability, the six products, the Shared Field, extension and community Return — in your own published words.

**What is genuinely missing from the public voice today:**

1. **Paradigmatisation as the field itself.** The site presents World and Life and Objective Internality, but never states the field-level claim you commissioned this round with: O:I treats paradigms themselves as workable technological objects, and QL/Epi-Logos is a developed, potentially privileged paradigm *within* that field — not the definition of all of it.
2. **Paradigms as Technē.** The dual-reading architecture (landed, owner-ratified) appears nowhere in public copy.
3. **Expressions as an inhabitable medium.** The Expression Field, WorldPresentation pages, the Personal Web and their relation to the Shared Field are absent from the site — the largest gap between what the site says and what the project now is.
4. **The site's own Field relation.** The direction that the site's field must enter the same admitted SharedField/Expression world (never be a decorative copy) is recorded in contracts but not yet in public wording. Part VI records the existing bindings.

---

## Part II — Recovered owner passages (quotation bank)

Verbatim, attributed, grouped by theme. This is the anchor bank: proposed copy below must stay recoverable to these.

### The field and the research object

> **[QUOTE]** "This gives O:I its central engineering object: the technological field through which available inference capacity becomes situated agency." — docs/positions/FOUNDING-POSITIONS.md L113

> **[QUOTE]** "The model remains important. The surrounding structure remains important. The research problem is their relation." — FOUNDING-POSITIONS.md L115

> **[QUOTE]** "We do not yet possess a settled engineering science of how underlying model capacity, prompts, recurrence, memory, capabilities, tools, knowledge horizons, social topology, authority, embodiment, development process, material environment, mediation and human practice combine to produce different forms of effective agency." / "O:I treats those arrangements as research configurations." — FOUNDING-POSITIONS.md L243, L245

> **[QUOTE]** "The project is meant to learn. That requires both a durable account of what we are trying to do and a durable account of what reality returns." — FOUNDING-POSITIONS.md L11

> **[QUOTE]** "Current implementation gives evidence about what is real now. It does not retroactively become the reason the project exists." — FOUNDING-POSITIONS.md L31

### Human-authored ground

> **[QUOTE]** "A person should be able to write in ordinary language about who they are, what they care about, how they want agents to work with them, what they refuse, what machines mean in their environment, and what purposes govern a Project. Those writings can remain durable source rather than being repeatedly retyped into prompts or prematurely translated into a platform's universal profile schema." — FOUNDING-POSITIONS.md L93

> **[QUOTE]** "If those remain durable and selectively available, the person does not have to reconstruct themselves at the start of every inference or supervise every action in order to remain causally present in the system." — FOUNDING-POSITIONS.md L198

> **[QUOTE]** "Generated interpretation is not authored source. Observation is not preference. Retrieval is not permission. A returned proposal is not an accepted revision." — FOUNDING-POSITIONS.md L77

> **[QUOTE]** "The relation we are building toward is **human authorship → durable source → selective operative use → action and encounter → returned evidence → human Recognition and revision**." — site/content/public-site.md L157

### Existing worlds of agency

> **[QUOTE]** "Whatever combination somebody already uses is already a real arrangement of technological agency." — FOUNDING-POSITIONS.md L123

> **[QUOTE]** "The odd setup, the minimal setup, the highly bespoke setup, the competing framework, and the arrangement whose ontology differs from ours can all expose something about the field that a first-party reference stack may hide." — FOUNDING-POSITIONS.md L127

> **[QUOTE]** "The six products are therefore strong instruments for developing a World, rather than a definition of which Worlds count." — FOUNDING-POSITIONS.md L129

### What becomes possible for a person

> **[QUOTE]** "The design aim is not merely to automate enough mechanics that a person gets some time back. It is to place human authorship where it has the greatest consequence for the form of the resulting agency." — FOUNDING-POSITIONS.md L196

> **[QUOTE]** "does greater technological agency increase the person's ability to author the structures that matter, reduce the need to repeat or police those structures mechanically, and return reality in a form from which the person can genuinely revise them?" — FOUNDING-POSITIONS.md L237

### O:I as the whole; the six products as centres

> **[QUOTE]** "That is why the O:I products are centres within a field rather than mandatory boxes in a workflow." — FOUNDING-POSITIONS.md L190

> **[QUOTE]** "**O:I is the Idea and whole relating these centres.**" — FOUNDING-POSITIONS.md L525

> **[QUOTE]** "{O:I} itself is the Idea and whole relating these centres. It is not a seventh product beside them." — O-I README.md L79

> **[QUOTE]** "Across these centres, the **abstractions are the durable root and the SDKs are accommodation surfaces**." — FOUNDING-POSITIONS.md L521

### QL / Epi-Logos within O:I — the framing this round must preserve

> **[QUOTE]** "Quaternal Logic belongs to a wider Epi-Logos philosophical programme shaped by depth psychology, Eastern metaphysics, recursive relational thought, and a long attempt to articulate an archetypal structure in which awareness, manifestation, relation, polarity, mediation, return, and agency can be understood together." — FOUNDING-POSITIONS.md L393

> **[QUOTE]** "The originating ambition is to ask whether agentic technology can be developed in structural sympathy with an account of mind and world that differs from the predominantly materialist and computational ontology from which the AI industry usually begins." — FOUNDING-POSITIONS.md L397

> **[QUOTE]** "Quaternal Logic therefore belongs in the O:I family as its deepest explicit formal research surface. A minimal O:I can remain entirely ordinary. A maximal research programme can use QL to ask questions that the rest of the field deliberately leaves open." — FOUNDING-POSITIONS.md L409

> **[QUOTE]** "Operational parity is also the epistemic safeguard. QL is speculative research, not metaphysics proven by software." — FOUNDING-POSITIONS.md L405

> **[QUOTE]** "The relation can be stated compactly as **QL as bimba, software as pratibimba**: a formal or archetypal image is expressed into a technical reflection, and the reflection returns information about what the originating form actually means when made operative." — FOUNDING-POSITIONS.md L407

> **[QUOTE]** "Openness means preserving the possibility space, not pretending every point in it is equally developed for every purpose." — docs/positions/PRAXIS-AND-OPERATIVE-LANGUAGE.md L147

**[PARAPHRASE]** The owner's commissioned framing for this round (session instruction, 2026-09-17): *O:I is paradigmatisation as a technological field; QL/Epi-Logos is a developed, potentially privileged paradigm within it — not the definition of all O:I.* The founding positions support this from both sides: the field-level object (L113) and the bounded QL position (L393–409).

### Paradigms as Technē

> **[QUOTE]** (owner-ratified) "The central #65 proof is no longer merely that several surfaces can display related information. It is that a person can change **reading** without silently changing **what they are working on**." — docs/experience/TECHNE-DUAL-READING.md L79

> **[QUOTE]** (owner-ratified) The two readings over one field: "`3:3 EXPRESSION READING / living/material/experiential`" and "`4:2 TECHNĒ READING / deep/professional/research-authoring`". — TECHNE-DUAL-READING.md L14–20

> **[QUOTE]** "The two sides preserve the same subject, refs, sources, constellation and occasion. Crossing them changes **how the thing is disclosed and what operations are available**, not what the thing is." — docs/experience/INHABITED-SYSTEM-ORIENTATION.md L161

> **[QUOTE]** "the substrate must not presuppose the Epi interpretation which will later operate through it. Likewise, the paradigm is not a theme painted over generic software. It supplies real semantics, forms, operations, profiles, source relations, Agents and developmental laws through the native extension surface." — docs/EXPRESSION-WORLD-SUBSTRATE-WAYFINDER.md L50–52

### Paradigm as inspectable mediation

> **[QUOTE]** "The useful paradigmatic question is not only 'what answer did the model produce?' It is 'through what interpretation of purpose, world, source, practice and authority did this work become intelligible and actionable to this Agent?'" — docs/experience/NOW-PARADIGM-RETURN.md L40

### Expressions, pages, personal web, shared field

> **[QUOTE]** "O:I needs a human and Agent medium in which a world can become directly sensible without being flattened into dashboards, labels or disconnected specialist applications." / "The **Expression Field** is that medium." / "An Expression is a living presentation of native subjects and relations. It can be quiet and page-like, spatial and graphical, animated and musical, or a full-screen processual instrument. It does not acquire ownership of what it presents." — docs/cradle/EXPRESSION-FIELD.md L7–11

> **[QUOTE]** "The person should feel that they are **inside the thing being understood or made**. Information, source, graph, Agent and editing apparatus arise where useful and withdraw without destroying continuity." — docs/experience/EXPRESSION-FIELD.md L7

> **[QUOTE]** "The Expression is not a decorative landing page for capabilities. The person can operate the represented world through it." — docs/experience/EXPRESSION-FIELD.md L21

> **[QUOTE]** "`WorldPresentation` is the portable composition representation used when an explicitly projected O:I world owns more than a sparse title/list view." / "The Projection remains the public/shared representation envelope. The native source retains canonical ownership." — shared-field/WORLD-PRESENTATION.md L3, L19

> **[QUOTE]** "A page can contain a live Expression. An Expression can contain a portal to the page, source or file which explains/grounds it." — docs/experience/EXPRESSION-WORLD-UX.md L53–57

> **[QUOTE]** (owner's first-person definition, owner-approved direction) "I can build a personal web with my agents: a home, writing, interests, works, people, projects, occasions and collections. I can organise it through time and relations, craft how each page looks, and choose the parts that others can enter. Someone can encounter my work, follow it to me, discover a shared interest and continue into another world. My private sources and ongoing work are not the price of participating." — docs/cradle/PERSONAL-WEB.md L7

> **[QUOTE]** "**Beings** and **Things** are the exact plural family names. … Six is the initial repertoire, not the maximum number of templates, a compulsory workflow, or six allowed forms of thought." — docs/cradle/PERSONAL-WEB.md L9

> **[QUOTE]** "A `SharedField` is an **addressable relational environment in which multiple Participants can contribute, encounter one another's Contributions or Projections, and thereby alter the conditions of subsequent agency**." / "The defining property is not message volume. It is the possibility of recurrent mutual conditioning through durable, attributable, addressable differences." — docs/SHARED-FIELD.md L199, L201

> **[QUOTE]** "There is no infinite engagement feed." — docs/experience/SHARED-FIELD-DESKTOP.md L91

> **[QUOTE]** "The intended feeling is **travel, encounter and making together**: another person's world becomes present as a coherent world, not as a profile card surrounded by platform chrome." — docs/experience/SHARED-FIELD-DESKTOP.md L598

> **[QUOTE]** "SharedField receives an explicit Projection of an Expression or WorldPresentation, never ambient private runtime state." — docs/cradle/EXPRESSION-FIELD.md L244

> **[QUOTE]** "O:I requires a public browser front door because the architecture should be experienceable, not merely sufficient in abstraction." — docs/SHARED-FIELD.md L533

### Return, evidence, community

> **[QUOTE]** "This is why community development is more than an adoption strategy for O:I. It is one way the research field becomes larger than the experiences of the original developers." — FOUNDING-POSITIONS.md L293

> **[QUOTE]** "Positive, negative, mixed and null results all belong in that return." — FOUNDING-POSITIONS.md L311

> **[QUOTE]** (the closed loop, in the Epi-Logos idiom) "an articulated form enters practice; practice encounters reality; reality returns a difference; the form can then be recognised, refined, rejected or developed." — PRAXIS-AND-OPERATIVE-LANGUAGE.md L205

### Wording anchors already published (owner's own site copy)

> **[QUOTE]** "Objective : Internality" — public-site.md L13 (hero title) · "O:I maps what it means for an AI agent to have a world." — L17 · "You use {O:I} to give artificial agents a world that persists: what you mean, what they may do, what they can bring to bear, how work develops, where it runs, and how results return to you — so capacity becomes situated agency instead of a one-shot prompt." — L19

> **[QUOTE]** "Start where you are. Your editor, shell, repositories, prompts, agents, skills, tools, services, machines and working habits already form a real technological environment. O:I starts there." — public-site.md L29–31

> **[QUOTE]** "Minimal O:I: durable ground + actuated model capacity." — public-site.md L47

> **[QUOTE]** "Objective Internality ≠ Subjective Immediacy." — public-site.md L141

> **[QUOTE]** "Ref → Relation → Operation → Consequence → Return. That is relation without capture. A term stays alive when its defining relation stays attached." — public-site.md L147

> **[QUOTE]** "The design problem is **legibility without capture**: enough source, permission and provenance can become visible for a relation to be accountable without requiring either participant's whole local world to be absorbed by the shared service." — public-site.md L393

> **[QUOTE]** "local agent world → selective Projection → Shared Field → encounter by another world" — public-site.md L77

> **[QUOTE]** (v2 shell, product ledes) "Write the ground your agents can return to." · "Who acts, who decides, and how reality returns." · "What an agent can use, here and now." · "Software development that remembers why." · "A real place for work to run." · "Formal research made executable." — public-site.md L193–339 (per product); v2 shell nav hints: "World and Life" · "Six offices" · "Between worlds" · "Enter the field." · "This landing stays the front door." — site/src/shell/content.ts

> **[QUOTE]** (product seed lines from the six readmes) Actuation: "Actuation exists so agency itself can become an addressable, inspectable and experimentally revisable part of the technological world." (README L7) · AIKit: "The operative composition and disclosure layer for heterogeneous agentic worlds." (README L3) · Factory: "The durable result is not only code. It is a Project that knows more about itself." (README L155) · Workcell: "A Project should not become 'a Docker project' merely because Docker happened to satisfy today's demand." (README L53) · QL: "Alignment, not translation. Refraction, not renaming." (README L135)

### The language discipline public copy must obey

> **[QUOTE]** "This document should support clear public and technical language rather than become a slogan source." — FOUNDING-POSITIONS.md L531

> **[QUOTE]** "Public language should lead positively from the thing itself. Boundaries and non-identities remain important where confusion is likely or where ownership depends on them, but first contact should name the World, relation, product, research object or human consequence before defending it against a mistaken reading the reader may never have had." — FOUNDING-POSITIONS.md L537

> **[QUOTE]** "A product description should first make clear what whole human or agent reality the product protects, changes, or opens; then why that matters; then the relations through which it does so; and only then the implementation vocabulary." — FOUNDING-POSITIONS.md L535

> **[QUOTE]** "Public copy should become a projection from this structure rather than an independent exercise in compression." — FOUNDING-POSITIONS.md L499

---

## Part III — The proposed public narrative

**[PROPOSED]** One coherent arc, ordered as the commission requires: the human and research purpose first, what the relations enable before any part is named, the deep material met through Expressions rather than through a glossary. Editorial notes after each movement say what the prose draws from. This narrative is written to project into the site's existing page structure (Part VI), not to replace it wholesale.

### 1. The situation

> A capable model is easy to obtain. A capable agent in a particular world is something else: it depends on what the agent can see of your purposes, what it may do, what it can reach, where its work actually runs, and how what happens comes back to the person who answers for it.
>
> Most of that surrounding structure exists today only as improvisation — scattered across prompts, application settings, scripts and habits, rebuilt at the start of every session, invisible exactly when something goes wrong. O:I begins from the observation that this structure is technological. It can be authored, built, inspected, composed and studied — and its quality, more than the choice of model, decides what the agency in your work and life becomes.

*Draws from: FOUNDING-POSITIONS L107–117; public-site.md L19–25; O-I README L7.*

### 2. The research project

> O:I is a research programme and a product field at once: products exist so that a question can be studied in the open. The question is what becomes possible when the technological world around an available model is designed deliberately — when ground, capability, authority, memory, places and returns stop being improvised and become things a person can author and inspect.
>
> No settled engineering science of agency exists yet. The field treats every arrangement of prompts, tools, machines, mediation and human practice as a research configuration: describable, comparable, changeable, and worth learning from — including the ones that fail. O:I exists to help that science develop in public, with evidence that can be checked.

*Draws from: FOUNDING-POSITIONS L11, L243–249; public-site.md L411–429; docs/RESEARCH.md L7.*

### 3. The person's ground

> You should be able to write, in your own words, who you are, what you care about, how you want agents to work with you, what you refuse, and what your projects mean — and have those words keep standing as durable source. Relevant parts become available to an agent when they are useful; the whole of you never has to become one prompt. What you wrote stays distinguishable from what a machine observed and from what an agent inferred, and it changes through your acceptance rather than silent reinterpretation.
>
> This is authorship that persists into action: you remain present in the system at the places where your judgement matters most, without reconstructing yourself at the start of every session or supervising every act.

*Draws from: FOUNDING-POSITIONS L93, L196–198, L77; public-site.md L151–163.*

### 4. The world you already have

> Whatever combination you already use — an editor and a terminal agent, a bench of scripts and services, several machines, a rich harness assembled from technologies O-I did not build — is already a real arrangement of technological agency. O:I is made to meet that world as it is and add explicit structure where it helps. A minimal O:I can be as small as durable ground plus an agent able to act from it; nothing else has to be added until it is useful.

*Draws from: FOUNDING-POSITIONS L121–129; public-site.md L29–35, L117–123.*

### 5. What the relations enable

> Five relations carry most of the possibility.
>
> **Ground to act.** What you author persists into what your agents do. Your principles arrive without being retyped; your refusals stay refusals.
>
> **Selection to capability.** Of everything that exists in your world, the smallest sufficient part becomes operative for the act at hand. Context stops being a hoard and becomes a craft.
>
> **Act to reality to Return.** Work runs somewhere real, and what actually happened comes back in a form you can judge. When authority is delegated downward, reality is obliged to travel back up.
>
> **Development to memory.** Projects remember why they exist — the intention that commissioned them, the path they took, what was learned, what was refused. Speed stops erasing meaning.
>
> **World to world.** Anything addressable — a document, a result, an experiment, an agent — can be projected outward for an audience while its source stays home. Other people's worlds become present as worlds, and what they return can change yours.
>
> None of these relations requires a particular vendor, model or stack. They are the substrate the six products make concrete.

*Draws from: FOUNDING-POSITIONS L77, L365; public-site.md L157, L373–381; SHARED-FIELD.md L199–209; the site's human-agency relation L157. This movement deliberately precedes any product name, per the commission ("explain what these relations enable before naming parts") and FOUNDING-POSITIONS L535.*

### 6. The six centres

> The products are centres within a field, each holding open one stretch of the possibility space. O:I is the whole relating them — there is no seventh product called O:I.
>
> **Central** — *Write the ground your agents can return to.* Central holds your purposes, principles, refusals and project meanings as ordinary files you own, distinguishes what you wrote from what was observed or inferred, and exposes stable actions to the agents you run — so your world stays recognisably yours while models, editors and machines change.
>
> **Actuation** — *Who acts, who decides, and how does reality return?* Actuation makes agency itself addressable: agents, delegation, authority, bounds and the return path become inspectable parts of the relation rather than assumptions buried in orchestration code.
>
> **AIKit** — *What an agent can use, here and now.* Your setup holds more than any single act needs — models, skills, tools, sources, sessions across clients and hosts. AIKit discovers that horizon and resolves the useful subset for the task at hand, without requiring your world to be rewritten into one runtime.
>
> **Software Factory** — *Software development that remembers why.* Factory carries a project from authored intention through design, development and evidence into candidates a person can recognise, redirect or accept — so implementation that moves faster than meaning stays answerable to what was meant. The durable result is a project that knows more about itself.
>
> **Workcell** — *A real place for work to run.* Workcell turns a requirement for computation into an actual workspace, process, container, VM or host — and keeps those providers from becoming the identity of your work. You can inspect what was created, where it lives, and what was released.
>
> **Quaternal Logic** — *Formal research made executable.* QL gives the programme's philosophical propositions a technical surface precise enough to test: where a formal distinction is claimed to matter, implementation should eventually make a discriminable difference — and positive, negative, mixed or null results all return to the research. Alignment, not translation; refraction, not renaming.

*Ledes are the owner's published words (public-site.md per-product `### [lede]`). Body sentences are agent-compressed from the owner's product paragraphs (public-site.md L197–357, FOUNDING-POSITIONS L509–519) and readme seed lines. Deliberately varied in shape — no repeated template, per the commission.*

### 7. Paradigms as Technē; one paradigm within the field

> O:I is paradigmatisation as a technological field. A paradigm — the interpretive whole through which purpose, world, source, practice and authority become intelligible together — is usually invisible and unchosen. Here paradigms can be designed, inhabited, made operative, compared and taught: treated as Technē, craft with form. The products deliberately supply a substrate that does not presuppose any one of them; whatever interpretation later operates through it must arrive through explicit, answerable surfaces.
>
> The same subject can be met through different readings without losing its identity: encountered as a living whole, or worked as a deep professional instrument. Crossing between readings changes how a thing is disclosed and what operations are available — never what the thing is.
>
> Within that field, Quaternal Logic and the wider Epi-Logos programme are one developed paradigm — shaped by depth psychology, Eastern metaphysics and relational thought, carried furthest by this work's originators, potentially privileged in their eyes, and still one paradigm among possible others. It inhabits the common substrate through its own SDK and vocabulary rather than defining the field in its image. A minimal O:I can remain entirely ordinary; the deepest research questions stay open for those who want them.

*Draws from: the owner's commissioned framing (see Part II [PARAPHRASE]); FOUNDING-POSITIONS L113, L393–409; TECHNE-DUAL-READING L14–20, L79; INHABITED-SYSTEM-ORIENTATION L161; EXPRESSION-WORLD-SUBSTRATE-WAYFINDER L50–52; PRAXIS L137–149. The phrase "potentially privileged" is the owner's own commissioned wording, kept intact.*

### 8. Expressions: an inhabitable medium

> O:I's deeper material is not met by reading documentation; it is met by entering worlds. The Expression Field is the medium for that. An Expression is a living presentation of a world's actual subjects and relations — quiet as a page, spatial as a sky, or a working instrument — through which you can operate the world rather than merely view it. Presentation never takes ownership of what it presents: sources, agents and authority stay with their native systems.
>
> Pages are WorldPresentations — portable, authored compositions holding prose, readings and live Expressions side by side, each bound to its source by reference, each able to open back to what grounds it. Pages you choose to share are projected, audience by audience, into the Shared Field, where another person or world can encounter them, respond, and return a difference while the source stays home. The site you are reading is built on the same terms: its field is an admitted part of that shared world, not a decorative copy of it.

*Draws from: cradle/EXPRESSION-FIELD L7–11, L244, L283; experience/EXPRESSION-FIELD L7–21; EXPRESSION-WORLD-UX L53–57; WORLD-PRESENTATION L3, L19; SHARED-FIELD L533. The final sentence states the intended public direction [INTENT] — the site-Field binding is recorded in Part VI; it is not yet a demonstrated site behaviour and should not ship before the binding does.*

**[TODAY]** What the Expression movement may honestly claim as working now: the Expression Field vision/UX/Wayfinder is landed (#305); WorldPresentation admits an Expression renderer with live/fallback behaviour (#307); the revisioned human/Agent application contract `oi.expression/v1` is implemented (#310); the point-cloud engine is the first material body of Expressions, running today with real GPU work and self-contained HTML export; the SharedField contracts (`oi.projection/v1`, `oi.shared-field/v1`, `oi.contribution/v1`, `oi.encounter/v1`) have an executable floor, and the SF1–SF6 desktop lanes are landed. Human-graded acceptance of the Expression experience (EX6 human grades) and agent-grade invocation inside a joined field (SF3 binding) remain open — public copy should carry the capability without claiming the finished experience.

### 9. The open door

> The field grows the way the research does: by people extending it from worlds we will never fully see. Connect a technology through a public contract. Run a comparison. Reproduce a result. Contest an interpretation. Return what you found — positive, negative, mixed and null results all belong. Reference implementations establish working paths; community implementations widen the field. If you work with agents, the arrangement on your desk is already research material, and there is a place for it here.

*Draws from: FOUNDING-POSITIONS L293–311; public-site.md L494–509.*

---

## Part IV — Compact variants

Each variant is small by design. Anchors marked *(owner)* are already published and are listed so variants can be compared against the current voice; they need no adoption.

### Hero (front door)

1. **[QUOTE]** *(owner, current)* Title: "Objective : Internality" — Proposition: "O:I maps what it means for an AI agent to have a world." with the standing support paragraph (public-site.md L13–25).
2. **[PROPOSED]** Lead: "A capable model is not yet a capable agent in a particular world. O:I builds the world around it — and studies what that changes." *(First sentence is the owner's, O-I README L7; second is proposed.)*
3. **[PROPOSED]** Lead: "O:I studies, and builds, the world around the model: the ground, capability, authority, places and returns that turn capacity into agency." *(Restrained single-sentence variant for a quieter door.)*

### Research invitation

1. **[PROPOSED]** "Different people already inhabit different technological worlds. Whatever your setup is, it is already a real arrangement of agency — and a possible contribution. O:I gives those differences a common way into the field: stable abstractions, public contracts, and a return path for what you find."
2. **[PROPOSED]** "Build a provider, run a comparison, reproduce a result, contest an interpretation — then return what happened. Positive, negative and null results all belong here; that is what makes this a research field rather than a product line."

### World / field entrance (Explore · Shared Field)

1. **[QUOTE]** *(owner, v2 shell)* "Enter the field." · **[QUOTE]** *(owner, site)* "Explore is where those worlds become visible."
2. **[PROPOSED]** "Beyond your own world, other people's worlds appear as worlds — pages, living expressions, shared fields — rather than profiles in a feed. Encounter, respond, and let the difference return."
3. **[PROPOSED]** "The field you enter here is shared on the system's own terms: projections admitted from real worlds, sources staying home. Enough of a relation visible to be accountable — never the whole world absorbed." *(Carries the owner's "legibility without capture" relation with its explanation attached, per FOUNDING-POSITIONS L531–533.)*

### Product introductions

The six ledes **[QUOTE]** are the owner's and stand. The variants below reshape the supporting sentence per product, for readmes and product pages — each in a different register, so the family does not read as one stamped template:

- **Central** — **[PROPOSED]** "Your ground, in your words, in ordinary files. Central keeps what you authored distinguishable from everything observed and inferred, and gives your agents a stable way to act from it. Change tools without reconstructing yourself."
- **Actuation** — **[PROPOSED]** "Agency as a first-class object. Actuation answers, inspectably: who is acting, under whose authority, within what bounds — and it keeps a path open for what actually happens to travel back to whoever decides."
- **AIKit** — **[PROPOSED]** "The horizon of what an agent can use, resolved here and now. AIKit discovers the models, skills, tools, sources and sessions a real setup has accumulated and selects the smallest useful subset for the act — without demanding one runtime to rule them."
- **Software Factory** — **[PROPOSED]** "Development that keeps its memory. Intention, evidence, candidates and recognition stay in relation from commission to return, so faster implementation answers to what was meant — and a project ends up knowing more about itself."
- **Workcell** — **[PROPOSED]** "Material truth for digital work. Workcell resolves what an act needs — workspaces, processes, containers, machines — into real, inspectable places, then keeps provider detail from leaking into what the work means."
- **Quaternal Logic** — **[PROPOSED]** "Where the programme's philosophy becomes testable. QL/MEF turns formal and archetypal propositions into executable operations whose outcomes — confirming, refuting or null — return to the research with their provenance attached."

**[TODAY]** Capability level these introductions may claim: each product has a native, working CLI surface today (Actuation's ~30-command fail-closed surface; AIKit's control plane, self-labelled production-oriented alpha; Factory's atomic self-hosting commission; Workcell's provider-neutral core; QL's executable `vak compose` path; `oi` routing all six). None of the six readmes claims live Series-1 capability runs or hosted materialisation beyond what is evidenced; the variants above keep to that level.

### Expression / page explanations

- **What is an Expression?** — **[PROPOSED]** "A living presentation of a world's actual subjects and relations — a page when quiet, a space when spatial, an instrument when there is work to do. You can operate what it presents, and it never takes ownership of it: sources, agents and authority stay with their native systems."
- **What is a page?** — **[PROPOSED]** "A WorldPresentation: a portable, authored composition — prose, readings, links and live Expressions side by side — each element bound to its source by reference. A page is how a world becomes presentable without being extracted from the world that owns it."
- **What is the Personal Web?** — **[PARAPHRASE]** (edited paraphrase of the owner's first-person passage, cradle/PERSONAL-WEB.md L7) "A personal web built with your agents: a home, writing, interests, works, people, projects and collections — organised through time and relation, crafted in form, shared by choice. Its first forms have names — Beings, Things, Flow/Dialogue, Day/4+2, Yoshimoto Cube, Epi-Card — a starting repertoire, not a ceiling. Private sources stay private; what you project is what others meet."
- **What is a Shared Field?** — **[PROPOSED]** "An addressable environment where independently grounded worlds meet without ceasing to be separately grounded. Projection makes a representation available without transferring ownership; encounter, contribution and return happen in the field, and sources stay home. A commons, a study room, a collaboration — bounded, attributable, revisitable. There is no infinite feed in it."

**[INTENT]** Placement note: these explainers belong behind the front door — reached from the Field/Explore entrance and from product pages — not on the hero path. That matches the commissioned direction: restrained door, deeper material through Expressions and WorldPresentations.

---

## Part V — Open questions for the owner

Only questions where wording or source genuinely cannot be settled from the ground:

- **Q1 — Central's public readme.** The canonical six include Central, but no product readme for Central exists in this checkout (the `~/Central` installation is not the product repo checkout). Until one exists, Central's public copy anchors on FOUNDING-POSITIONS L509 and the site's `[central]` section. Should Central's readme be drafted in EpiLogos/Central before any readme-level propagation?
- **Q2 — The brand line at the door.** Hero title reads "Objective : Internality"; body copy uses "{O:I}"; the v2 nav treats "Objective : Internality" as the Home label. Which carries the front door going forward — spelled-out name, mark, or both in the current mix?
- **Q3 — Two copy stores.** `site/content/public-site.md` (Markdown, contract-tested, your designated source) and `site/src/shell/content.ts` (v2 shell, TypeScript) hold overlapping copy with no shared source. Until one is canonical, any adopted wording must be double-entered by hand. Which store leads?
- **Q4 — First person on the public site.** Your Personal Web direction is written in your own "I" (cradle/PERSONAL-WEB.md L7). May that voice appear on the public site attributed to you, or should public copy remain in the site's we/you register with the "I" passage left as inner direction?
- **Q5 — Technē depth at first contact.** The proposed narrative gives the dual reading one plain paragraph (Part III §7) and defers the 3:3/4:2 machinery to deeper surfaces. Confirm, or pull Technē entirely behind the Research page until an Expression demonstrates it.

---

## Part VI — Passage-to-destination propagation map

For later use, once wording here is adopted. Nothing propagates automatically; every row is a manual, owner-gated projection. **This round performs none of these.**

| Working-file passage | Destination | Mechanism / binding | Guard |
| --- | --- | --- | --- |
| Hero variants (IV) | `site/content/public-site.md` `[home]/[hero]` + v2 shell hero | Edit Markdown section (keep stable IDs); mirror into `site/src/shell/content.ts` until Q3 resolves | `site/public-content.test.mjs` CI guard; deploy runs only on push to `main` touching `site/**` |
| Narrative §1–§5 (III) | `public-site.md` `[home]/[what]`, `[existing-world]`, `[field]`; `[oi]` page `[intro]`, `[human-agency]` | Section-level edit; prose here is written to drop into the existing section order | FOUNDING-POSITIONS L499: copy as projection of positions; L535 ordering |
| §6 six centres (III) + product variants (IV) | Site `[products]` sections; the six product READMEs (ai-kit, Actuation, Factory, Workcell, QL-MEF, Central per Q1) | Ledes stay owner-authored; supporting sentences replace readme/site body only on adoption | Product-description order L535; each repo's own conventions; readme edits land in the product repos, not O-I |
| §7 paradigms/Technē (III) | New site section (proposed ID `[paradigms]` on the `[oi]` or `[research]` page) | Requires renderer support for a new section — small React addition, out of scope this round | TECHNE-DUAL-READING consistency; Q5 |
| §8 Expressions (III) + explainers (IV) | Site `[shared-field]` page and a future Expressions section; `docs/VISION.md`, O-I `README.md` front door | Prose adoption; the site's *Field itself* binds differently (row below) | EXPRESSION-FIELD ownership laws (`Expression != canonical subject`, `WorldPresentation != Expression`) |
| **Site Field relation** — the site's field enters the same admitted SharedField/Expression world | `site/src/explore/presentation-components.tsx` (accepted portable renderer registry); `oi.projection/v1` audience-scoped projections; `oi.expression/v1` application contract (`docs/contracts/EXPRESSION-APPLICATION-V1.md`) | The site presents admitted WorldPresentations/Expressions through the same contracts the desktop uses — never a parallel decorative copy. Existing bindings: WorldPresentation renderer relation #307; Expression application seam #310; SharedField contract floor under `shared-field/` (SF lanes #18/#344) | `SHARED-FIELD.md` L533 (public front door); `cradle/EXPRESSION-FIELD.md` L244 (explicit Projection only); `preview ≠ publication`; fallback rule (targets without the live renderer get a safe fallback) |
| Research invitation (IV) | `public-site.md` `[research]/[open]`; `docs/RESEARCH.md` tail | Prose adoption | FOUNDING-POSITIONS L311 (null results belong) |
| Explore/entrance variants (IV) | v2 shell `content.ts` nav hints; future site Explore copy | Manual sync while Q3 open | SHARED-FIELD-DESKTOP L91 (no feed) |
| Personal Web explainer (IV) | Future site section when Personal Web publication ships | Deferred until PW lanes land | PW standing: "specified, not executed"; Q4 voice decision |
| Cradle first-visitor copy | `desktop/cradle/src/flow/welcomePhrases.ts`, `FreshSurface.tsx`, `Rest.tsx`, `WelcomeField.tsx` | **No action this round** — already owner-voiced; listed so marketing never leaks into it | Cradle copy stays owner-authored |

**Explicit non-goals of this round:** no site UI implementation, no change to the active Cradle convergence branch, no deployment, no edit to `site/content/public-site.md`, `site/src/shell/content.ts`, FOUNDING-POSITIONS, or any product README; no propagation of anything until adopted.

---

## Sources read (all at `origin/main @ 21bd04d7` unless noted)

- `docs/positions/FOUNDING-POSITIONS.md`, `docs/positions/PRAXIS-AND-OPERATIVE-LANGUAGE.md` (in full)
- `docs/experience/NOW-PARADIGM-RETURN.md`, `DOCUMENT-OPERATIONS.md`, `STORIES.md` (in full)
- `docs/cradle/EXPRESSION-FIELD.md`, `docs/experience/EXPRESSION-FIELD.md`, `EXPRESSION-WORLD-UX.md`, `PERSONAL-WEB.md`, `SHARED-FIELD-DESKTOP.md`, `TECHNE-DUAL-READING.md`, `INHABITED-SYSTEM-ORIENTATION.md`, `PRACTICE-CONDITIONS.md`
- `docs/SHARED-FIELD.md`, `shared-field/WORLD-PRESENTATION.md`, `docs/SHARED-FIELD-QL-EPI-INTEGRATION-WAYFINDER.md` (§0, §4, §12 status), `docs/EXPRESSION-WORLD-SUBSTRATE-WAYFINDER.md`, `docs/HUMAN-AGENT-COVENANT.md`, `docs/VISION.md`, `docs/RESEARCH.md`, `docs/RESEARCH-PROTOCOL.md`
- `site/content/public-site.md` (in full), `site/src/shell/content.ts` (copy highlights), `site/README.md`, `site/HANDOFF-UI-ENRICHMENT-2026-09-12.md`, `site/redesign-v2` branch (wording/design as source)
- Product readmes: `Work/O-I`, `Work/ai-kit`, `Work/Actuation`, `Work/Factory`, `Work/Workcell`, `Work/Quaternal-Logic`, `Work/Point-Cloud-Demo` (working trees byte-identical to main for READMEs)
- Owner's commissioned framing for this round (session instruction, 2026-09-17)
