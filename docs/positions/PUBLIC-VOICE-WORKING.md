# {O:I} Public Voice — Working Editorial Draft

**Status: editorial working file. Agent-drafted for owner revision — not adopted copy.**

## On this revision

**Revision 2 — register pass, on owner instruction (2026-09-17).** Revision 1 spoke the programme's architectural dialect; the owner called the register wrong and named the intent this voice must serve: **caring for the will in relation to the tools that can realise it.** Every quoted passage below has been rewritten *from intent* into that register — each one considered on its own terms, not laced with the vocabulary. Three kinds of entry remain, honestly marked:

- **[RENDERED]** — the intent of a source passage, translated into this register by this session. The source's own words stand unchanged at the cited location; the verbatim originals of Revision 1 remain in git history (commit `73c48e4c`) for line-by-line comparison. A rendered line is offered copy, never the owner's words.
- **[QUOTE — already in this voice]** — passages whose own words already speak this register. Rewriting them would only damage them, so they are kept exactly as written.
- **[PARAPHRASE / INTENT / PROPOSITION / TODAY]** — as before: owner framing in other words, design intention, testable proposition, demonstrated capability.

- **What this file is.** One editable place holding this round of public-voice work: the recovered propositions rendered human, a proposed narrative, compact variants, the few questions that need an owner decision, and the propagation map. It is not a founding position and not a rewrite of any owner file. `site/content/public-site.md` remains the designated public-copy source, untouched.
- **Base revision.** Sources read from `origin/main @ 21bd04d7` (EpiLogos/O-I); line numbers refer to that revision.

---

## Part I — Where the public voice stands

**The designated owner-maintained public-copy source exists.** `site/content/public-site.md` opens (operational text, kept verbatim):

> **[QUOTE — operational]** "Human-editable source for the public site. The React application owns layout, figures, navigation behaviour and rendering. This Markdown owns the public words and their page/section order. Edit this file first when changing site copy." — site/content/public-site.md L3

Pipeline: the Markdown compiles through `site/src/lib/public-content.ts` into validated page outlines, guarded by `site/public-content.test.mjs` in CI, deploying via `.github/workflows/site.yml` on push to `main` touching `site/**` or `shared-field/**`. Pages authored there: **Home, O:I, Products, Shared Field, Research, Build**. Explore is a separate application, intentionally not authored in that file (L5). A second copy store exists for the v2 shell: `site/src/shell/content.ts` — see open question Q3.

**The owner has already iterated on this voice** (`b0d7b046` editable source, `9b6422d6` rewrite around direct product meaning, `903ce3f1` restore the world-making proposition, `4bcf34fc` carry human authorship into the public field). Some of the owner's published lines already speak the human register — the hero chain "what you mean, what they may do … how results return to you", and the Personal Web passage in Part II. This revision brings the rest of the voice up to that standard rather than pulling those lines down.

**What is genuinely missing from the public voice today:**

1. **The field named as care for the will.** The site presents World and Life and Objective Internality, but never says plainly what the whole thing is *for*: keeping a person's intent in charge while tools become able to realise it. QL/Epi-Logos as a developed, potentially privileged way of understanding that relation — not the field's definition — appears nowhere.
2. **Paradigms as Technē.** The dual-reading architecture (landed, owner-ratified) is absent from public copy.
3. **Expressions as an inhabitable medium.** Expression Field, WorldPresentation pages, the Personal Web and their relation to the Shared Field are absent from the site — the largest gap between what the site says and what the project now is.
4. **The site's own Field relation.** The direction that the site's field must enter the same admitted SharedField/Expression world (never be a decorative copy) is recorded in contracts but not yet in public wording. Part VI records the bindings.

---

## Part II — The propositions, rendered human

Every entry renders what its source is protecting at the level of intent. Sources unchanged; verbatim originals in commit `73c48e4c` on this branch.

### What this whole thing is for

> **[RENDERED | FOUNDING-POSITIONS.md L113]** O:I's real subject is everything *around* a model — because that, more than the model, decides whether what the model does is something you meant. The whole field exists between what a machine can do and what a person actually wants done.

> **[RENDERED | FOUNDING-POSITIONS.md L115]** The model matters. What surrounds it matters. The problem worth a career is the relation between them.

> **[RENDERED | FOUNDING-POSITIONS.md L243–245]** Nobody yet possesses a real craft of this — no one knows, the way a joiner knows joinery, how instructions, memory, tools, knowledge, authority, machines and human practice combine into something that reliably acts *as intended*. So every arrangement is treated here as an experiment: describable, comparable, repeatable, worth learning from even when it fails.

> **[RENDERED | FOUNDING-POSITIONS.md L11]** This project exists to learn. That demands two kinds of memory kept honestly: a faithful memory of what we meant, and a faithful memory of what came back.

> **[RENDERED | FOUNDING-POSITIONS.md L31]** What the software manages today is evidence about today. However far it gets, it never retroactively becomes the reason any of this exists.

### The person's ground

> **[RENDERED | FOUNDING-POSITIONS.md L93]** You should be able to set down, in your own words and once, who you are, what you care about, how you want to be worked with, what you refuse, what your projects are for — and have those words *stay yours*: kept rather than retyped into every request, kept rather than dissolved into somebody's profile of you.

> **[RENDERED | FOUNDING-POSITIONS.md L198]** When what you have written endures and is brought in only where it is needed, you stop having to rebuild yourself at the start of every conversation — and stop having to stand guard over every action for your intent to still be in it.

> **[RENDERED | FOUNDING-POSITIONS.md L77]** What a machine understood is not what you said. What it noticed is not what you prefer. Being able to read your words is not permission to use them. A suggestion is not a decision you made.

> **[RENDERED | public-site.md L157]** You write what you mean. It stays written. Your tools draw on it where it is needed. Work happens and meets the world. What actually happened comes back to you. You decide what that changes.

### The worlds people already have

> **[RENDERED | FOUNDING-POSITIONS.md L123]** Whatever arrangement you already work in is already real — already a way your intentions reach the world through tools. It does not need replacing to count.

> **[RENDERED | FOUNDING-POSITIONS.md L127]** The strange setup, the minimal one, the fiercely bespoke one, the one built on different ideas altogether: each can reveal something about this field that our own preferred way of working would keep hidden.

> **[RENDERED | FOUNDING-POSITIONS.md L129]** The six products are powerful ways of tending such a world. They are not the measure of what a world must be.

### What a person gets back

> **[RENDERED | FOUNDING-POSITIONS.md L196]** The aim was never just to hand you back a few hours. It is to put your intent where it has the most say over what the machine-made becomes.

> **[RENDERED | FOUNDING-POSITIONS.md L237]** The question to hold all of this to: as the tools grow more capable, do you gain more say over what matters, spend less time repeating and policing yourself — and receive the truth of what happened in a form you can act on?

### One field, six places — and no seventh product

> **[RENDERED | FOUNDING-POSITIONS.md L190]** That is why the products are places within one field, each holding open a different part of it — not stations everyone must pass through.

> **[RENDERED | FOUNDING-POSITIONS.md L525 · O-I README.md L79]** O:I is the whole that relates these centres. It is not a seventh product beside them.

> **[RENDERED | FOUNDING-POSITIONS.md L521]** What lasts in each product is the idea it holds steady; the SDKs are how the rest of your tools shake hands with it.

### The developed paradigm within the field

> **[RENDERED | FOUNDING-POSITIONS.md L393]** Quaternal Logic carries a wider body of thought — Epi-Logos — grown from depth psychology, Eastern metaphysics and a long effort to understand awareness, form, relation, polarity and return as one fabric. Within O:I it is the most fully developed paradigm in the field — thought in, and built around, for years by the people who started this — potentially privileged in their eyes, and still one way of seeing among the possible ones, never the field's definition.

> **[RENDERED | FOUNDING-POSITIONS.md L397]** The founding wager: that tools like these can be built in real sympathy with an understanding of mind and world unlike the one this industry starts from — and that the sympathy will prove itself, or fail, in contact with reality.

> **[RENDERED | FOUNDING-POSITIONS.md L409]** Quaternal Logic is the family's deepest research surface. A minimal O:I stays entirely ordinary. The fullest version asks questions the rest of the field deliberately leaves open.

> **[RENDERED | FOUNDING-POSITIONS.md L405]** And the honesty clause: no running system, however impressive, counts as proof of the philosophy behind it.

> **[RENDERED | FOUNDING-POSITIONS.md L407]** *QL as bimba, software as pratibimba* — a formed idea expressed into a technical reflection, and the reflection tells you what the idea actually means once it has to work.

> **[RENDERED | PRAXIS-AND-OPERATIVE-LANGUAGE.md L147]** Openness means keeping the whole space of possibilities open. It does not mean pretending every part of it is equally developed for what you need.

> **[PARAPHRASE — owner's commissioned intent, this round]** O:I is paradigmatisation as a technological field; QL/Epi-Logos is a developed, potentially privileged paradigm within it, not the definition of all O:I. In the register of this revision: *the field itself is the care of a person's will in its relation to the tools that can realise it — and one school, long developed, offers the deepest account of that care, without exhausting the field.*

### Paradigms as Technē

> **[RENDERED | TECHNE-DUAL-READING.md L79]** The central proof is no longer that several windows can show the same information. It is that you can change how you are holding your work — met as a living whole, or worked as a professional instrument — without ever losing what you were working on.

> **[RENDERED | TECHNE-DUAL-READING.md L14–20]** One field, two readings: the same subject encountered living, material, experiential — or handled deep, professional, authorable.

> **[RENDERED | INHABITED-SYSTEM-ORIENTATION.md L161]** Crossing between the readings changes how the thing shows itself and what you can do next. It never changes what the thing is.

> **[RENDERED | EXPRESSION-WORLD-SUBSTRATE-WAYFINDER.md L50–52]** The shared machinery must not secretly assume one way of seeing before you arrive. And a paradigm is no theme painted onto generic software: it arrives with real forms, real operations, real law.

### The paradigm question, plainly

> **[RENDERED | NOW-PARADIGM-RETURN.md L40]** The useful question is never just "what did the model say?" It is: *through whose understanding of purpose, world, source and authority did this work become intelligible to the machine that did it?*

### Expressions, pages, personal webs, shared fields

> **[RENDERED | docs/cradle/EXPRESSION-FIELD.md L7–11]** O:I needs a medium in which a world can be felt directly — not flattened into dashboards and labels. The Expression Field is that medium. An Expression is a living presentation of things that genuinely exist and matter somewhere; quiet as a page or vast as a sky. And it never takes ownership of what it shows.

> **[RENDERED | docs/experience/EXPRESSION-FIELD.md L7]** You should feel that you are inside the thing being understood or made — whatever apparatus you need arising where it helps, and withdrawing without breaking the spell.

> **[RENDERED | docs/experience/EXPRESSION-FIELD.md L21]** An Expression is not a decorated brochure. Through it, you operate the world it presents.

> **[RENDERED | shared-field/WORLD-PRESENTATION.md L3, L19]** A WorldPresentation is how a world becomes portable: a composed page or scene that can travel, while what it presents stays home — owned where it has always been owned. The projection is the public face; the source keeps a life of its own.

> **[RENDERED | docs/experience/EXPRESSION-WORLD-UX.md L53–57]** A page can hold a living Expression. An Expression can open a door back to the page, the source, the file that grounds it.

> **[QUOTE — already in this voice | docs/cradle/PERSONAL-WEB.md L7]** "I can build a personal web with my agents: a home, writing, interests, works, people, projects, occasions and collections. I can organise it through time and relations, craft how each page looks, and choose the parts that others can enter. Someone can encounter my work, follow it to me, discover a shared interest and continue into another world. My private sources and ongoing work are not the price of participating." *(This is the register the rest of the voice is being raised to.)*

> **[RENDERED | docs/cradle/PERSONAL-WEB.md L9]** Beings and Things are the exact names of the first two families. Six forms to begin from — not a ceiling, not a compulsory workflow, not a theory that thought comes in exactly six kinds.

> **[RENDERED | docs/SHARED-FIELD.md L199–201]** A SharedField is a place where more than one person's world can matter: people contribute, meet what others made, and change what can happen next. What makes it a field is not the volume of messages — it is that real differences, made by nameable people, persist there and keep working after you have met them.

> **[QUOTE — already in this voice | docs/experience/SHARED-FIELD-DESKTOP.md L91]** "There is no infinite engagement feed."

> **[RENDERED | docs/experience/SHARED-FIELD-DESKTOP.md L598]** The intended feeling is travel, encounter, making together: another person's world arrives as a world — not as a profile card wrapped in platform chrome.

> **[RENDERED | docs/cradle/EXPRESSION-FIELD.md L244]** A SharedField receives what is explicitly projected to it — never the ambient hum of your private, running life.

> **[RENDERED | docs/SHARED-FIELD.md L533]** O:I needs a public front door because an architecture like this should be experienceable — not merely arguable in the abstract.

### What return means

> **[RENDERED | FOUNDING-POSITIONS.md L293]** Community is not an adoption strategy. It is how the research becomes larger than the people who started it.

> **[RENDERED | FOUNDING-POSITIONS.md L311]** Positive, negative, mixed, null — every result belongs in what comes back.

> **[RENDERED | PRAXIS-AND-OPERATIVE-LANGUAGE.md L205]** You make your understanding real; the real talks back; and what comes back is allowed to change your mind. That is the whole loop — nothing more mysterious than that, and nothing harder.

### Wording anchors already published

> **[QUOTE — already in this voice | public-site.md L13, L17, L19]** "Objective : Internality" · "O:I maps what it means for an AI agent to have a world." · "You use {O:I} to give artificial agents a world that persists: what you mean, what they may do, what they can bring to bear, how work develops, where it runs, and how results return to you — so capacity becomes situated agency instead of a one-shot prompt." *(The hero chain already is the will-and-tools relation in plain words; the closing clause "capacity becomes situated agency" is the one phrase Revision 2 would soften — see variant IV-2.)*

> **[RENDERED | public-site.md L29–31]** Start where you are. Your editor, your terminal, your repositories, your habits — they already form a real place where your intentions reach the world through tools. O:I starts there, not from a clean room.

> **[RENDERED | public-site.md L47]** Minimal O:I: what you mean stays written, and a model can act from it.

> **[RENDERED | public-site.md L141]** Objective Internality ≠ Subjective Immediacy — rendered: this technology addresses the world a being *has*; it does not claim to touch the feeling of being someone. It stays honest about that line.

> **[RENDERED | public-site.md L147]** You can point at something regardless of where it currently lives, because it is held by its relations, not its location. Relation without capture: a term stays alive as long as the relation that defines it stays attached.

> **[RENDERED | public-site.md L77]** your local world → you choose what to show → the shared field → another world meets it

> **[RENDERED | public-site.md L393]** The design problem is *legibility without capture*: enough of someone's ground visible for the relation to be accountable — never the whole person absorbed by the service.

> **[QUOTE — already in this voice | public-site.md product ledes L193–339]** "Write the ground your agents can return to." · "Who acts, who decides, and how reality returns." · "What an agent can use, here and now." · "Software development that remembers why." · "A real place for work to run." · "Formal research made executable." *(Six one-liners already in voice; keep.)*

> **[RENDERED | product readme seeds]** Actuation (L7): so that the acting itself — who did what, on whose behalf — becomes something you can inspect, revisit and change. · AIKit (L3): the layer that makes everything you actually have usable, here and now. · Factory (L155): kept, as it stands — "The durable result is not only code. It is a Project that knows more about itself." · Workcell (L53): kept, as it stands — "A Project should not become 'a Docker project' merely because Docker happened to satisfy today's demand." · QL (L135): kept, as it stands — "Alignment, not translation. Refraction, not renaming."

### The discipline the voice must keep

> **[RENDERED | FOUNDING-POSITIONS.md L531]** This document should make language clearer. It must not become a source of slogans.

> **[RENDERED | FOUNDING-POSITIONS.md L537]** Public language should lead with the thing itself — the world, the relation, the human consequence — before defending against a misreading the reader may never have had.

> **[RENDERED | FOUNDING-POSITIONS.md L535]** Say first what whole human reality a product protects or opens. Then why it matters. Then how the relations work. The machinery's own vocabulary comes last, if at all.

> **[RENDERED | FOUNDING-POSITIONS.md L499]** Public copy is a projection of this structure, not an independent exercise in compression.

---

## Part III — The proposed narrative

**[PROPOSED]** One arc, ordered as commissioned: the human stake first; what the relations enable before any part is named; the deep material met through Expressions rather than through a glossary. Written to project into the site's existing page structure (Part VI).

### 1. The situation

> A capable model is easy to get. What is not easy is everything around it: whether anyone can still say what the work is for, what the machine may do, what it draws on, where it runs — and how what happens makes its way back to the person who must answer for it.
>
> Around every model that matters to you stands this arrangement, half improvised and half forgotten: prompts written again from scratch, preferences scattered across settings, intentions that exist nowhere outside this afternoon's conversation. O:I begins from a simple conviction. That arrangement is real. It can be built with care. And its quality — far more than the brand of model — decides whether the new power in your working life serves your purposes or quietly substitutes its own.

### 2. The research project

> O:I is a research project and a product family at once: the products exist so that a question can be studied in the open. The question — what becomes possible for a person when the world around their tools is made deliberately, when what you mean, refuse and care about stops being improvised and starts being kept?
>
> No one yet has a craft of this. Every arrangement of instructions, memory, tools, authority, machines and human practice is treated here as an experiment: describable, comparable, repeatable, worth learning from — including, perhaps especially, when it fails.

### 3. The person's ground

> You should be able to set down, in your own words and once, who you are, what you care about, how you want to be worked with, what you refuse, what your projects mean — and have those words keep. Kept as yours. Brought in when they are needed instead of retyped forever. Held apart from what machines noticed and what they inferred. Changed only when you accept the change.
>
> This is what it means for intent to persist into action: you remain present where your judgement matters — without rebuilding yourself every morning, and without standing guard over every act.

### 4. The world you already have

> Whatever arrangement you work in now — one editor and a terminal helper, a shelf of scripts, five machines, a setup nobody else would recognise — is already real: already a way your intentions reach the world. It does not need replacing to count. O:I meets it as it is and adds structure only where structure helps. The smallest version is almost nothing: what you mean, kept; a machine able to act from it.

### 5. What the relations make possible

> Five relations carry most of the possibility.
>
> **What you mean, kept.** Your purposes and refusals persist into what your tools do. Principles arrive without retyping; a refusal stays a refusal.
>
> **Only what is needed, taken.** Of everything that exists in your world, the tools draw the smallest sufficient part for the act at hand. Context stops being a hoard and becomes a form of respect.
>
> **What happened, coming back.** Work runs somewhere real and returns as truth you can use. When you hand authority downward, what actually happened is obliged to travel back up to you.
>
> **Why it was made, remembered.** Projects keep the intention that started them alongside everything learned on the way. Speed stops erasing meaning.
>
> **Worlds, meeting without merging.** Anything addressable can be shown to someone while what it comes from stays home. Another person's world arrives as a world — and what they send back is allowed to change yours.
>
> None of this asks you to change vendors, models or stacks. These relations are simply what the six products make concrete.

### 6. The six places

> The products are places within one field, each tending a different part of it. O:I is the whole relating them — there is no seventh product called O:I.
>
> **Central** — *Write the ground your agents can return to.* Set down what you mean once, in files you own; Central keeps clear what you wrote versus what was observed or guessed, and gives your tools a steady way to act from it. Your world stays yours while everything technical changes around it.
>
> **Actuation** — *Who acts, who decides, and how reality returns.* Actuation makes the acting itself visible: delegation, authority, bounds, and the road back — inspectable, rather than buried in machinery where no one can answer for anything.
>
> **AIKit** — *What an agent can use, here and now.* Across clients, hosts and years, a real setup accumulates far more than any moment needs. AIKit sees that horizon and brings the needed part within reach — without demanding your whole world be rebuilt inside one tool.
>
> **Software Factory** — *Software development that remembers why.* The intention that commissioned a piece of work stays beside everything that happened on the way, so the fast parts remain answerable to the meaning — and the project ends up knowing more about itself than when it began.
>
> **Workcell** — *A real place for work to run.* Somewhere the work actually happens — a workspace, a process, a machine — made when needed, visible while it lives, released when done. And a project is never reduced to wherever it happened to run today.
>
> **Quaternal Logic** — *Formal research made executable.* The programme's deepest claims about form and relation get a surface precise enough to be tested: where a distinction is claimed to matter, the tools should eventually show a difference you can observe — and whatever the test returns, confirming, refuting or null, goes back to the research. Alignment, not translation; refraction, not renaming.

### 7. Paradigms, and one developed paradigm here

> There is a layer beneath the features. Every tool embodies a way of seeing — an interpretation of what matters, what authority is, what a world is. Mostly that interpretation is invisible and unchosen. O:I treats it as workable: ways of seeing can be made, inhabited, compared, taught — craft with form rather than mood with vocabulary. The shared machinery deliberately assumes none of them.
>
> Within that openness, one paradigm here is old, developed and loved. Epi-Logos, carried by Quaternal Logic, grew from depth psychology and Eastern metaphysics and has been thought in — and built around — for years by the people who started this place. It is potentially privileged in their eyes; it is still one way of seeing, not the definition of the field. It speaks through its own vocabulary and its own door into the common ground, and the common ground stays common. A minimal O:I remains entirely ordinary; the deepest questions stay open for those who want them.

### 8. Expressions: a medium you can be inside

> The deeper you go, the less you should be reading documentation, and the more you should be entering. An Expression is a presentation with a pulse: a world's actual subjects and relations rendered so you can be inside them — quiet as a page, vast as a sky, or in your hands as an instrument. Through it you operate the world, rather than viewing it. It never takes ownership of what it shows.
>
> Pages — WorldPresentations — are how a world becomes portable without being extracted: composed, held by reference, able to open back onto the sources that ground them. What you choose to share is projected, audience by audience, into the shared field, where someone else can meet it, answer it, and change something — while it stays home. This site intends to keep the same discipline: what you reach from here should be part of that same world, not a copy of it in a glass case.

**[TODAY]** What §8 may honestly claim as working now: the Expression Field vision/UX/Wayfinder landed (#305); WorldPresentation admits an Expression renderer with live/fallback behaviour (#307); the human/Agent application contract `oi.expression/v1` is implemented (#310); the point-cloud engine runs today as the first material body of Expressions; the SharedField contracts (`oi.projection/v1`, `oi.shared-field/v1`, `oi.contribution/v1`, `oi.encounter/v1`) have an executable floor with SF1–SF6 desktop lanes landed. Human-graded acceptance of the Expression experience (EX6 human grades) and agent-grade invocation inside a joined field (SF3 binding) remain open — claim the capability, not the finished experience.

### 9. The open door

> The field grows the way the research grows: from people whose worlds we will never see. Bring a tool we didn't build. Run the comparison. Reproduce the result — or fail to. Say plainly what you found; every result belongs, including the ones that humble us. If you work with machines, the arrangement on your desk is already evidence, and there is a place for it here.

---

## Part IV — Compact variants

### Hero (front door)

1. **[QUOTE — already in this voice]** *(owner, current)* "Objective : Internality" — "O:I maps what it means for an AI agent to have a world." with the standing support paragraph (public-site.md L13–25).
2. **[PROPOSED]** "A capable model is not yet a capable agent in a particular world. O:I is the craft of that world: what you mean, kept; what is needed, reached; what happens, returned." *(First sentence the owner's, O-I README L7; the rest proposed.)*
3. **[PROPOSED]** "Everything a model can do is potential until it stands in a world that remembers what you meant. O:I builds that world — and studies what it changes."

### Research invitation

1. **[PROPOSED]** "Whatever your setup already is, it is real: a way your intentions reach the world through tools. Bring it as it is. Connect what you use, run the comparison, return what you find — every result belongs, especially the ones that embarrass the theory."
2. **[PROPOSED]** "This field becomes larger than its founders only if people from worlds we will never see work in it, vary it, and send back what happened. That is the invitation, and it is a real one: your desk is already evidence."

### World / field entrance (Explore · Shared Field)

1. **[QUOTE — already in this voice]** *(owner, v2 shell)* "Enter the field." · *(owner, site)* "Explore is where those worlds become visible."
2. **[PROPOSED]** "Beyond your own world, other people's worlds appear as worlds — pages, living expressions, shared fields — not as profiles in a feed. Meet, answer, return."
3. **[PROPOSED]** "Enough of someone's world visible to hold the relation accountable — never the whole person absorbed." *(The owner's "legibility without capture" relation, carried with its meaning attached per FOUNDING-POSITIONS L531–533.)*

### Product introductions

The six ledes **[QUOTE — already in this voice]** stand unchanged (Part II). Section 6 above now carries the full product voice in-register; for shorter surfaces, the one-line alternates:

- **Central** — **[PROPOSED]** "Set down what you mean once. Your tools act from it — and it stays yours."
- **Actuation** — **[PROPOSED]** "Who is acting, who decided, and how the truth gets back — made visible, kept answerable."
- **AIKit** — **[PROPOSED]** "Everything you actually have, brought within reach for the task at hand — nothing rebuilt to get there."
- **Software Factory** — **[PROPOSED]** "Work that keeps the reason it was begun beside everything learned on the way."
- **Workcell** — **[PROPOSED]** "A real place for the work to run — made when needed, visible while it lives, released when done."
- **Quaternal Logic** — **[PROPOSED]** "Where the deepest claims get tested: if a distinction matters, the tools should show it."

**[TODAY]** Capability level these may claim: each product has a native, working CLI surface today (Actuation's ~30-command fail-closed surface; AIKit's control plane, self-labelled production-oriented alpha; Factory's atomic self-hosting commission; Workcell's provider-neutral core; QL's executable `vak compose` path; `oi` routing all six). None claims live Series-1 capability runs or hosted materialisation beyond evidence; the variants keep to that level.

### Expression / page explanations

- **What is an Expression?** — **[PROPOSED]** "A living presentation of things that really exist somewhere — page-quiet, sky-vast, or in-hand as an instrument. You can act through it, and it never takes ownership of what it shows."
- **What is a page?** — **[PROPOSED]** "A WorldPresentation: a made page that can travel — prose, readings, living expressions composed together, each part held by reference to where it comes from. A way for a world to be visited without being moved out of itself."
- **What is the Personal Web?** — **[QUOTE — already in this voice]** The owner's own passage (cradle/PERSONAL-WEB.md L7, quoted in full in Part II) is the recommended copy, if Q4 resolves in favour of publishing the first-person voice. Failing that: **[PROPOSED]** "A personal web built with your agents — a home, writing, works, people and collections, crafted in form and shared by choice. Private sources stay private; what you project is what others meet."
- **What is a Shared Field?** — **[PROPOSED]** "A place where more than one person's world can matter — bounded, attributable, revisitable. You show a part; the whole stays yours; what others return is allowed to matter. There is no infinite feed in it."

**[INTENT]** Placement: these explainers belong behind the front door — reached from the Field/Explore entrance and product pages, not the hero path. Restrained door; deeper material met through Expressions and WorldPresentations.

---

## Part V — Open questions for the owner

- **Q1 — Central's public readme.** The canonical six include Central, but no product readme for Central exists in this checkout. Until one exists, Central's public copy anchors on FOUNDING-POSITIONS L509 and the site's `[central]` section. Draft it in EpiLogos/Central first?
- **Q2 — The brand line at the door.** Hero title "Objective : Internality"; body copy "{O:I}"; v2 nav treats the spelled-out name as the Home label. Which carries the front door?
- **Q3 — Two copy stores.** `site/content/public-site.md` (Markdown, contract-tested) and `site/src/shell/content.ts` (v2 shell TypeScript) hold overlapping copy with no shared source. Until one is canonical, adopted wording must be double-entered. Which leads?
- **Q4 — First person on the public site.** The register this revision converges on is exemplified by the owner's own "I" passage (cradle/PERSONAL-WEB.md L7). May that voice appear on the public site attributed to the owner, or does public copy stay in the we/you register with the "I" passage as inner direction?
- **Q5 — Technē depth at first contact.** The narrative gives the dual reading one plain paragraph (§7) and defers the 3:3/4:2 machinery to deeper surfaces. Confirm, or hold Technē behind the Research page until an Expression demonstrates it.

---

## Part VI — Passage-to-destination propagation map

For later use, once wording is adopted. Nothing propagates automatically; every row is a manual, owner-gated projection. **This round performs none of these.**

| Working-file passage | Destination | Mechanism / binding | Guard |
| --- | --- | --- | --- |
| Hero variants (IV) | `site/content/public-site.md` `[home]/[hero]` + v2 shell hero | Edit Markdown section (keep stable IDs); mirror into `site/src/shell/content.ts` until Q3 resolves | `site/public-content.test.mjs` CI guard; deploy runs only on push to `main` touching `site/**` |
| Narrative §1–§5 (III) | `public-site.md` `[home]/[what]`, `[existing-world]`, `[field]`; `[oi]` page `[intro]`, `[human-agency]` | Section-level edit; prose written to drop into the existing section order | FOUNDING-POSITIONS L499: copy as projection of positions; L535 ordering |
| §6 six places (III) + product one-liners (IV) | Site `[products]` sections; the six product READMEs (ai-kit, Actuation, Factory, Workcell, QL-MEF, Central per Q1) | Ledes stay owner-authored; body replaced only on adoption | Product-description order L535; each repo's own conventions; readme edits land in the product repos |
| §7 paradigms/Technē (III) | New site section (proposed ID `[paradigms]` on the `[oi]` or `[research]` page) | Requires renderer support for a new section — small React addition, out of scope this round | TECHNE-DUAL-READING consistency; Q5 |
| §8 Expressions (III) + explainers (IV) | Site `[shared-field]` page and a future Expressions section; `docs/VISION.md`, O-I `README.md` front door | Prose adoption; the site's *Field itself* binds differently (row below) | EXPRESSION-FIELD ownership laws (`Expression != canonical subject`, `WorldPresentation != Expression`) |
| **Site Field relation** — the site's field enters the same admitted SharedField/Expression world | `site/src/explore/presentation-components.tsx` (accepted portable renderer registry); `oi.projection/v1` audience-scoped projections; `oi.expression/v1` application contract (`docs/contracts/EXPRESSION-APPLICATION-V1.md`) | The site presents admitted WorldPresentations/Expressions through the same contracts the desktop uses — never a parallel decorative copy. Existing bindings: renderer relation #307; application seam #310; SharedField contract floor under `shared-field/` (SF lanes #18/#344) | `SHARED-FIELD.md` L533 (public front door); `cradle/EXPRESSION-FIELD.md` L244 (explicit Projection only); `preview ≠ publication`; safe fallback for targets without the live renderer |
| Research invitation (IV) | `public-site.md` `[research]/[open]`; `docs/RESEARCH.md` tail | Prose adoption | FOUNDING-POSITIONS L311 (null results belong) |
| Explore/entrance variants (IV) | v2 shell `content.ts` nav hints; future site Explore copy | Manual sync while Q3 open | SHARED-FIELD-DESKTOP L91 (no feed) |
| Personal Web passage | Future site section when Personal Web publication ships | Deferred until PW lanes land; the owner's L7 passage is the intended copy if Q4 allows | PW standing: "specified, not executed" |
| Cradle first-visitor copy | `desktop/cradle/src/flow/welcomePhrases.ts`, `FreshSurface.tsx`, `Rest.tsx`, `WelcomeField.tsx` | **No action this round** — already owner-voiced, and already in this register; listed so marketing never leaks into it | Cradle copy stays owner-authored |

**Explicit non-goals of this round:** no site UI implementation, no change to the active Cradle convergence branch, no deployment, no edit to `site/content/public-site.md`, `site/src/shell/content.ts`, FOUNDING-POSITIONS, or any product README; no propagation until adopted.

---

## Sources read (all at `origin/main @ 21bd04d7` unless noted)

- `docs/positions/FOUNDING-POSITIONS.md`, `docs/positions/PRAXIS-AND-OPERATIVE-LANGUAGE.md` (in full)
- `docs/experience/NOW-PARADIGM-RETURN.md`, `DOCUMENT-OPERATIONS.md`, `STORIES.md` (in full)
- `docs/cradle/EXPRESSION-FIELD.md`, `docs/experience/EXPRESSION-FIELD.md`, `EXPRESSION-WORLD-UX.md`, `PERSONAL-WEB.md`, `SHARED-FIELD-DESKTOP.md`, `TECHNE-DUAL-READING.md`, `INHABITED-SYSTEM-ORIENTATION.md`, `PRACTICE-CONDITIONS.md`
- `docs/SHARED-FIELD.md`, `shared-field/WORLD-PRESENTATION.md`, `docs/SHARED-FIELD-QL-EPI-INTEGRATION-WAYFINDER.md` (§0, §4, §12 status), `docs/EXPRESSION-WORLD-SUBSTRATE-WAYFINDER.md`, `docs/HUMAN-AGENT-COVENANT.md`, `docs/VISION.md`, `docs/RESEARCH.md`, `docs/RESEARCH-PROTOCOL.md`
- `site/content/public-site.md` (in full), `site/src/shell/content.ts` (copy highlights), `site/README.md`, `site/HANDOFF-UI-ENRICHMENT-2026-09-12.md`, `site/redesign-v2` branch (wording/design as source)
- Product readmes: `Work/O-I`, `Work/ai-kit`, `Work/Actuation`, `Work/Factory`, `Work/Workcell`, `Work/Quaternal-Logic`, `Work/Point-Cloud-Demo`
- Owner's commissioned framing and register instruction (session, 2026-09-17)
