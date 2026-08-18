# O:I public site content

> **Human-editable source for the public site.** The React application owns layout, figures, navigation behaviour and rendering. This Markdown owns the public words and their page/section order. Edit this file first when changing site copy.
>
> The stable IDs in square brackets are renderer handles, not public text. Keep the ID; freely edit the heading after it. `#` headings are pages, `##` headings are sections, and `###` / `####` headings are structured content inside a section. Ordinary Markdown paragraphs, emphasis, links and bullet lists are supported. Explore is a separate application and is intentionally not authored here.

---

# [home] Home

## [hero] Opening

### [title] Objective : Internality

## [what] What is O:I

### [title] AI agents act through a world around them.

An AI agent works through an underlying inference model, but also through the project it can see, the tools it can use, the knowledge it can reach, the authority it has, the environment it can change and the history it can carry forward.

O:I — Operating Infrastructure · Objective Internality — is an open architecture for designing that world. We are developing it as a working platform and an open research programme for understanding how different technological arrangements shape what kinds of agency become possible.

## [existing-world] Start from the world you already have

### [title] Your existing setup is already a world.

Your editor, shell, repositories, prompts, agents, skills, tools, services, machines and working habits already form a real technological environment. O:I starts there.

You can keep the setup you use and make more of its structure durable, visible and composable over time. Existing worlds are also part of the research: the platform is meant to meet heterogeneous arrangements rather than only arrangements created inside O:I.

## [field] One possibility space

### [title] Begin with a project and an agent.

A real project you keep, plus an AI agent able to work with it, is already a useful starting point. From there the world can develop as your needs develop: more durable personal context, richer tools and knowledge, explicit agency and authority, developmental history, material execution environments, formal experiments and relations with other worlds.

### [ground] Files and projects you keep

### [capacity] An AI agent that can work with them

### [core-note] A small but real continuing world.

### [developments] It can develop into

- **Projects and continuity** — work that persists across sessions
- **Knowledge and sources** — material the agent can find and trace back to source
- **Skills, tools and actions** — powers available when they are relevant
- **Agents and agencies** — differentiated and delegated forms of agency
- **Developmental history** — evidence, decisions and returned learning
- **Material execution worlds** — environments where work can actually run
- **Formal experiment** — propositions made technically testable
- **Shared fields** — worlds becoming available to one another

## [centres] Our products

### [title] We are developing six products for six parts of that world.

Central keeps personal and project ground durable. Actuation makes agency and authority explicit. AIKit composes the capabilities and context available here and now. Software Factory carries software development from intention through evidence and Return. Workcell makes computational environments real. Quaternal Logic is the executable formal research surface.

[See the products and their architecture](./products.html).

## [shared] Shared field

### [title] Worlds can meet in a shared field.

A person or agent can define a world locally and selectively make parts of it available to another world: a document, project result, wiki space, experiment, Agent or other addressable object. The shared field carries the relation while source identity and provenance remain visible.

[Read the Shared Field account](./shared-field.html) or [open Explore](./explore.html).

## [build] Build

### [title] Open source, local-first and developed in public.

The `oi` command is the local doorway into the O:I system. It works with the native products rather than replacing their command surfaces, and the repositories remain the authority for current implementation and installation.

[Read the build and source guide](./build.html).

---

# [oi] O:I

## [intro] The surrounding field

### [title] O:I gives AI agents a world to act in.

Give the same underlying inference model different projects, tools, knowledge, permissions, histories, runtime bodies and execution environments and you have changed the conditions under which an agent acts. O:I makes those surrounding conditions explicit enough to build, inspect, compose and study.

The architecture spans the persistent world an agent returns to, the capabilities it can reach, the Agency under which it acts, the environments it can materialise, the developmental history it can inherit and the other worlds it can encounter.

## [existing-world] Existing worlds

### [title] Your current setup is a legitimate starting world.

A useful agentic setup may be a repository and a CLI agent, a collection of scripts and services, several machines, a rich harness, or something assembled from technologies O:I did not create. O:I is designed to encounter that world as it is and add explicit structure where it helps.

That keeps continuity with the work and habits you already have. It also keeps the research open to real variation rather than only testing configurations produced by one preferred stack.

## [possibility] One possibility space

### [title] Start small. Develop only what you need.

The minimal case can stay very small: persistent files and projects, plus an AI agent able to act there. The same world can later gain durable Agents and Agencies, Skills and Actions, richer source navigation, developmental Runs and evidence, material Workcells, research instrumentation and SharedFields.

Our six products are centres within that possibility space. You can use one, several, all six, or interoperable alternatives where another technology already owns the job well.

## [name] Two readings of one name

### [title] Operating Infrastructure. Objective : Internality.

**Operating Infrastructure** names the engineering around an AI agent: projects and durable ground, capabilities and Actions, sessions and runtime bodies, developmental history, material environments and relations to other actors and worlds.

### [objective-internality] Objective : Internality

**Objective : Internality** names the same field from the side of the actor. Part of what an agent can actually draw on while acting can exist objectively outside one inference: files, project history, available powers, source indexes, machine observations, constraints, prior decisions and runtime bindings can persist, be inspected and become available again in later action.

The research question is what becomes possible when that operative interior is designed as a real, durable and inspectable technological world.

### [non-claim] The operational claim

Objective : Internality gives us a precise engineering object without requiring a prior conclusion about artificial subjectivity. We can build and compare systems in which different forms of memory, world, capability, identity, relation and history become operative for an agent, then let implementation and use return evidence about where the concept helps and where it needs revision.

## [human-agency] Human agency

### [title] More artificial agency should create more room for human agency.

We want routine setup, context repair, source discovery, execution mechanics and developmental bookkeeping to move away from continuous human attention when the system can carry them safely and visibly.

That leaves more room for the work in which human authorship matters most: purpose, vision, judgement, taste, meaningful alternatives, interpretation, refusal, Recognition and redirection. This is a design commitment we test against the actual experience of using the system.

## [research-field] Research field

### [title] Agentic engineering is an open research field.

We are studying how prompts, recurrence, memory, knowledge horizons, capability fields, authority, embodiment, development process, material environment, mediation and human practice combine around available model capacity.

O:I gives those arrangements a common place to become describable, comparable and testable. The aim is to learn from different worlds, including results that challenge our own preferred architecture.

[Enter the Research programme](./research.html).

---

# [products] Products

## [intro] Our six products

### [title] We are developing six products to make an agent's world durable, operable and intelligible.

Each product owns a different technical problem and has its own native repository, architecture and implementation. They can be used independently or composed through O:I when their responsibilities meet.

The diagrams below show current product seams and native technical nouns rather than replacing them with a site-only vocabulary.

## [central] Central

### [summary] Your personal and project world, held in ordinary files and operated through stable Actions.

### [lede] Your working world, under your control.

### [what] What it is

Central is the human-owned root for personal context and ordinary work. `Control/` holds material deliberately authored about the person, their agents and their machines. `Work/` holds normal projects and files. `ctrl` exposes stable Actions, and connectors bind those Actions to the technologies available on a particular machine.

### [why] Why it exists

Models, editors, machines and agent runtimes change faster than the life and work they serve. Central gives that longer-lived world an owned source so a person can change tools without reconstructing the same context from scattered application settings.

### [change] What changes

A person can carry the same authored ground and ordinary work across changing tools, while an agent can return to a stable, permission-bounded world instead of beginning every session from scratch.

### [capabilities] Current shape

`Control/user` · `Control/agents` · `Control/machines` · ordinary `Work/` · `ctrl` Actions / SDK · replaceable connectors · derived `.central/` state

### [repo] Native centre

https://github.com/EpiLogos/Central

## [actuation] Actuation

### [summary] The product for defining who is acting, under whose authority, within what bounds and with what path for Return.

### [lede] Who acts, who decides, and how reality returns.

### [what] What it is

Actuation defines technological agency as a first-class object. It distinguishes Agent, situated Agency, determination, authority, bounds, delegation, derivation, federation, Actuation and Return so a composed system can say who is acting and on whose behalf.

### [why] Why it exists

As agents delegate work and participate in larger compositions, process flow alone stops being enough. The governing purpose and permissions need a clear relation to the locus doing the work, and the evidence, resistance or disagreement encountered there needs a route back into later determination.

### [change] What changes

Authority, delegation, refusal, dissent and Return become inspectable parts of the agency relation rather than assumptions hidden inside orchestration code.

### [capabilities] Current shape

Agent · Agency · determination / WorldBinding · authority and bounds · delegation / derivation / federation · Actuation · Return

### [repo] Native centre

https://github.com/EpiLogos/Actuation

## [aikit] AIKit

### [summary] The layer that discovers and composes the models, skills, tools, sources, sessions and runtime components available in a real setup.

### [lede] What an agent can use, here and now.

### [what] What it is

AIKit discovers a heterogeneous agentic environment and resolves the useful subset for a particular project, actor and task. It works across model providers, CLI agents, Skills, tools, Actions, ContextSources, projects, sessions, multiplexers, runtime Components and Surfaces.

### [why] Why it exists

Real setups accumulate across clients, hosts and projects. Useful capability may exist without belonging in every prompt or every runtime. AIKit gives that larger world a discoverable and composable horizon.

### [change] What changes

A human or agent can inspect what is available, what is relevant, what is permitted, what is degraded and how the current working environment was composed.

### [capabilities] Current shape

Context-scoped capability resolution · models and harnesses · Skills / tools / Actions · ContextSources / Knowledge Navigation · sessions / muxes · runtime Components / Surfaces · Explain / History

### [repo] Native centre

https://github.com/EpiLogos/ai-kit

## [factory] Software Factory

### [summary] A development system that keeps authored intention connected to design, agent-led implementation, evidence, Candidates, Recognition and Return.

### [lede] Software development that remembers why.

### [what] What it is

Software Factory is the developmental system for agentic software work. It carries a Project from authored intention and product meaning through design, Runs, implementation and tests into evidenced Candidates that can be encountered, recognised, redirected and returned into future development.

### [why] Why it exists

Agentic implementation can move faster than the human meaning that commissioned it. Factory keeps the originating intention, the developmental path and the evidence available together so speed does not erase why the software was worth making.

### [change] What changes

Agents and deterministic systems can carry more of the labour while the human remains close to commissioning, judgement, Recognition and redirection. Runs, decisions, evidence and Candidates become durable project material rather than disappearing into chat history.

### [capabilities] Current shape

Project understanding · Commission · Run / RunMap · design / development · Evidence · Candidate · Recognition · Return

### [repo] Native centre

https://github.com/EpiLogos/agent-system-design

## [workcell] Workcell

### [summary] The product that turns a requirement for computation into an actual workspace, process, service, container, VM or host.

### [lede] A real place for work to run.

### [what] What it is

Workcell takes provider-neutral material requirements and resolves them into real computational resources: writable workspaces, processes, services, containers, MicroVMs or VMs, remote hosts, storage, databases, network relationships, credentials and browser-accessible applications. It records the providers and bindings that made the requested world real.

### [why] Why it exists

Projects and Agents need concrete environments, but their higher-level identity should not be defined by host paths, Docker network names, IP addresses or one infrastructure provider. Workcell keeps the material implementation explicit at the layer that owns it.

### [change] What changes

A human or agent can request the material conditions an act needs and still inspect what was created, where it lives, which services connect, what persists, what is healthy and what is eventually released.

### [capabilities] Current shape

Demand · plan / provider matching · BindingGraph · workspace / process / service · container / MicroVM / VM / host · observation · exposure · collection · retention / release

### [repo] Native centre

https://github.com/EpiLogos/Workcell

## [ql] Quaternal Logic

### [summary] The executable formal research product for QL / MEF structures, refraction, provenance-bearing readings and operational experiments.

### [lede] Formal research made executable.

### [what] What it is

Quaternal Logic / MEF is the standalone implementation home for the programme's formal research: specified QL references and operators, the twelve-lens MEF manifold, provider and service contracts, provenance-bearing refractions and the experimental path from a formal proposition to an executable operation.

### [why] Why it exists

The wider Epi-Logos programme contains formal and philosophical propositions about relation, recurrence, mind and archetypal form. Quaternal Logic gives those propositions a technical surface where correspondences can be specified precisely enough to test.

### [change] What changes

A formal distinction can enter an experiment. Where it is claimed to matter operationally, the implementation can test for a detectable consequence and return positive, negative, mixed or null evidence to the wider research programme.

### [capabilities] Current shape

Executable QL references / operators · MEF registry / twelve-lens refraction · provider / service contracts · provenance-bearing readings · operational-parity experiments

### [repo] Native centre

https://github.com/EpiLogos/QL-MEF

---

# [shared-field] Shared Field

## [intro] World

### [title] A world, defined for agents.

A World is the durable place from which an agent can act: its projects, sources, capabilities, history, authority, environment and relations. O:I lets people and agents define these worlds locally and make selected parts of them available beyond themselves.

A Shared Field is where those independently grounded worlds meet. A document, project result, wiki space, experiment, Agent or other addressable object can become available to another world while retaining its source identity and provenance.

## [projection] Projection

### [title] Source stays with the world.

Projection creates an addressable representation of something a world owns for a particular audience or purpose. The source keeps its canonical identity and revision; the projection carries enough provenance for another participant to understand where it came from.

That gives sharing a clear return path. Another person, Agent or world can respond, extend, contest or contribute without the shared field becoming the author of the source material.

## [co-internality] Objective Co-Internality

### [title] Independent worlds in relation.

Objective Co-Internality names the plural relation created when one operative world becomes meaningfully available within another while both retain their own ground, history and authority.

This gives O:I a way to study shared agency as more than message exchange: what was projected, how it was encountered, what difference was returned, and how that difference later changed either world.

## [explore] Explore

### [title] Explore is where those worlds become visible.

Explore is the public application for addressable worlds and the agents, projects, wiki spaces, projections, relations and contributions they choose to expose. Each object carries provenance and can open outward into the world and source relations around it.

[Open Explore](./explore.html).

---

# [research] Research

## [intro] Agentic engineering

### [title] We are building O:I as an open research platform for agentic engineering.

The research object is the technological world through which available model capacity becomes situated agency: project ground, prompts and recurrence, knowledge, memory, capabilities, authority, runtime body, development process, material environment, shared-field mediation and human practice.

We are building these structures so the community can use them, vary them, compare them and return evidence about what they actually change. The programme begins with questions and testable propositions rather than finished conclusions about the best form of agency.

## [object] What we study

### [title] Capacity. Provisioning. Potentiation.

**Capacity** is what the underlying model and available compute can potentially provide.

**Provisioning** asks what an act has available: a project, sources, Skills, Actions, memory, permissions, a runtime body, an execution environment, other participants and a path for Return.

**Potentiation** asks what becomes possible because those surrounding structures have a particular form. O:I gives us a common field in which those relations can be made explicit and compared.

## [method] Research method

### [title] Research should remain reopenable.

Our research protocol starts from exact sources and keeps source claims, implementation facts, direct observations and O:I interpretation distinguishable. A study can then propose an abstraction, compare it with other systems, make it operative, test it and return the result to the field.

### [cycle] Discover → Source-lock → Study → Interpret → Abstract → Compare → Operationalise → Experiment → Find / revise / reject → Return

## [programme] Research across the system

### [title] Each part of O:I opens a different research surface.

- **Personal and project worlds** — how durable authored ground changes orientation, continuity and human effort
- **Agency and authority** — how Agent, Agency, delegation, federation, refusal and Return shape coordinated action
- **Capability and knowledge fields** — how selection, disclosure and composition affect what an agent can use effectively
- **Harnesses and runtime bodies** — how recurrence, Components, tools, services and Surfaces change the conditions of action
- **Developmental systems** — how agent-led software work preserves intention, evidence, recovery and Recognition
- **Material worlds** — how workspaces, services, containers, VMs, hosts and network relations affect action and verification
- **Shared agency** — how different mediation and field structures affect reciprocity, contribution, encounter and cumulative learning
- **Epistemic cultivation** — how source, evidence, retrieval, contradiction and evaluation practices shape what agents can know and claim

## [ql] Quaternal Logic

### [title] A deeper formal research programme.

Quaternal Logic belongs to the wider Epi-Logos research programme. It carries formal work on relation, recurrence, refraction and archetypal structure into executable QL / MEF operations so proposed correspondences can meet implementation and evidence.

Its discipline is operational parity: where a formal distinction is claimed to matter to an operation, implementation should eventually make a discriminable difference. Classical approaches may perform better, two formal structures may prove equivalent, or a distinction may improve explanation without improving execution. All of those results can return to the research.

[Enter Quaternal Logic](https://github.com/EpiLogos/QL-MEF).

## [open] Open research

### [title] The platform is meant to learn from use.

Humans and agents can participate throughout the research cycle: discovering sources, studying systems, proposing abstractions, building experiments, reproducing findings, challenging interpretations and returning corrections.

The research commons should preserve the path as well as the conclusion: exact sources, revisions, evidence, disagreements, null results and supersessions. Explore and the Shared Field are being developed as the public environment in which those durable research objects can increasingly meet.

---

# [build] Build

## [intro] Build and source

### [title] Start with the `oi` command and the world you already have.

`oi` is the local doorway into the composed system. In the accepted implementation it can install or register supported native surfaces, initialise Central, migrate existing work into its `Work/` tree, inspect composition and route into native CLIs while each product keeps ownership of its own configuration and runtime state.

The public distribution work is being developed separately. Until that package is accepted, the repository install guide remains the source of truth for installing `oi` itself.

## [links] Start here

### [title] Source, installation and governing documents

- [Install O:I — current supported install path](https://github.com/EpiLogos/O-I/blob/main/docs/INSTALL.md)
- [CLI — current `oi` command surface](https://github.com/EpiLogos/O-I/blob/main/docs/CLI.md)
- [Founding positions — why the field exists](https://github.com/EpiLogos/O-I/blob/main/docs/positions/FOUNDING-POSITIONS.md)
- [Vision — agency, world and Return](https://github.com/EpiLogos/O-I/blob/main/docs/VISION.md)
- [Architecture — current product and whole-level seams](https://github.com/EpiLogos/O-I/blob/main/docs/ARCHITECTURE.md)
- [Research — the agency-engineering field](https://github.com/EpiLogos/O-I/blob/main/docs/RESEARCH.md)
- [Research protocol — how studies become evidence](https://github.com/EpiLogos/O-I/blob/main/docs/RESEARCH-PROTOCOL.md)
- [Shared Field — how independently grounded worlds meet](https://github.com/EpiLogos/O-I/blob/main/docs/SHARED-FIELD.md)
- [Explore — enter the shared field](./explore.html)
- [O:I repository](https://github.com/EpiLogos/O-I)

## [health] Site content and health

### [title] Edit the site as Markdown.

This public site is rendered from `site/content/public-site.md`. Layout components and figures stay in React; public prose and page structure stay here in Markdown. The build validates the required pages, sections and product fields before the site can compile.

Change the Markdown when you want to change what the site says. Change the React and CSS when you want to change how that material is composed or behaves.